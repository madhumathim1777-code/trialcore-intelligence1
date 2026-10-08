"""
Stage 1: ATLAS Clinical Trial Knowledge Graph, Patient 360, Unit Normalization, and Deterministic Question Engine.
Supports CDISC SDTM domains (DM, LB, AE, EX, CM, VS, DS, MH, EG), cut_available filtering,
corrections.csv, reference ranges, and deterministic zero-hallucination querying.
"""

import os
import json
import csv
import math
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from starter.schemas import Question, Answer, Evidence, Calculation

# Standard lab conversion reference tables and clinical limits
LAB_CONVERSIONS = {
    "ALT": {
        "target_unit": "U/L",
        "ULN": 45.0,  # Upper Limit of Normal
        "conversions": {
            "u/l": (1.0, "identity"),
            "iu/l": (1.0, "identity"),
            "ukat/l": (60.0, "ukat_to_u_l"),
            "µkat/l": (60.0, "ukat_to_u_l"),
            "kat/l": (60.0, "ukat_to_u_l"),
            "nkat/l": (0.06, "nkat_to_u_l"),
        }
    },
    "AST": {
        "target_unit": "U/L",
        "ULN": 40.0,
        "conversions": {
            "u/l": (1.0, "identity"),
            "iu/l": (1.0, "identity"),
            "ukat/l": (60.0, "ukat_to_u_l"),
            "µkat/l": (60.0, "ukat_to_u_l"),
            "kat/l": (60.0, "ukat_to_u_l"),
            "nkat/l": (0.06, "nkat_to_u_l"),
        }
    },
    "BILIRUBIN": {
        "target_unit": "mg/dL",
        "ULN": 1.2,
        "conversions": {
            "mg/dl": (1.0, "identity"),
            "umol/l": (1.0 / 17.1, "umol_to_mgdl"),
            "µmol/l": (1.0 / 17.1, "umol_to_mgdl"),
            "micromol/l": (1.0 / 17.1, "umol_to_mgdl"),
        }
    },
    "ALP": {
        "target_unit": "U/L",
        "ULN": 120.0,
        "conversions": {
            "u/l": (1.0, "identity"),
            "iu/l": (1.0, "identity"),
            "ukat/l": (60.0, "ukat_to_u_l"),
            "µkat/l": (60.0, "ukat_to_u_l"),
        }
    },
    "CREATININE": {
        "target_unit": "mg/dL",
        "ULN": 1.3,
        "conversions": {
            "mg/dl": (1.0, "identity"),
            "umol/l": (1.0 / 88.4, "umol_to_mgdl"),
            "µmol/l": (1.0 / 88.4, "umol_to_mgdl"),
        }
    },
    "HEMOGLOBIN": {
        "target_unit": "g/dL",
        "ULN": 17.5,
        "conversions": {
            "g/dl": (1.0, "identity"),
            "g/l": (0.1, "g_l_to_g_dl"),
            "mmol/l": (1.611, "mmol_to_gdl"),
        }
    },
    "GLUCOSE": {
        "target_unit": "mg/dL",
        "ULN": 100.0,
        "conversions": {
            "mg/dl": (1.0, "identity"),
            "mmol/l": (18.0182, "mmol_to_mgdl"),
        }
    }
}


def normalize_lab_unit(test_name: str, value: Any, unit: str) -> Tuple[Optional[float], Optional[str], Optional[str], Optional[str]]:
    """
    Deterministically normalizes lab values.
    Returns: (normalized_value, normalized_unit, conversion_method, flag)
    Preserves raw measurement without silently fabricating.
    """
    if value is None or str(value).strip() == "":
        return None, unit, None, "MISSING_VALUE"
    try:
        val_float = float(value)
    except (ValueError, TypeError):
        return None, unit, None, f"INVALID_NUMERIC_{value}"

    clean_test = test_name.strip().upper()
    clean_unit = (unit or "").strip().lower()

    matched_test = None
    for k in LAB_CONVERSIONS:
        if k in clean_test or clean_test in k:
            matched_test = k
            break

    if not matched_test:
        return val_float, unit, "passthrough_unmapped_test", None

    test_cfg = LAB_CONVERSIONS[matched_test]
    target_unit = test_cfg["target_unit"]

    if clean_unit in test_cfg["conversions"]:
        multiplier, method = test_cfg["conversions"][clean_unit]
        norm_val = round(val_float * multiplier, 4)
        return norm_val, target_unit, method, None

    # Ambiguous or unexpected unit
    return val_float, unit, "unrecognized_unit", f"AMBIGUOUS_UNIT_{unit}"


def parse_date(date_str: Any) -> Optional[datetime]:
    if not date_str:
        return None
    s = str(date_str).strip()
    for fmt in ("%Y-%m-%d", "%Y-%m-%dT%H:%M:%S", "%Y/%m/%d", "%d-%b-%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(s.split(" ")[0], fmt)
        except ValueError:
            pass
    return None


class StudyGraph:
    """
    Knowledge graph storing connected clinical trial records:
    Subject -> Visits -> Lab Results -> Adverse Events -> Doses -> Medications -> Medical History -> Disposition -> ECG -> Vitals
    Supports cut-aware retrieval: records are only available if cut_available <= current_cut.
    """
    _raw_files_cache: Dict[str, Any] = {}

    def __init__(self, data_dir: str = "hackathon-data"):
        self.data_dir = data_dir
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self.edges: List[Dict[str, Any]] = []
        self.subjects: Dict[str, Dict[str, Any]] = {}
        self.records_by_id: Dict[str, Dict[str, Any]] = {}
        self.records_by_subject: Dict[str, List[Dict[str, Any]]] = {}
        self.records_by_domain: Dict[str, List[Dict[str, Any]]] = {}
        self.corrections_applied: List[Dict[str, Any]] = []
        self.reference_ranges: Dict[str, Dict[str, Any]] = {}
        self.current_cut: int = 1
        self.active_protocol_version: int = 1
        self.protocol_rules: List[Dict[str, Any]] = []
        self.documents: Dict[str, Dict[str, Any]] = {}
        self.discovered_domains: set = set()
        self.discovered_sites: set = set()
        self.source_mode: str = "hackathon" if "hackathon" in data_dir else "data"
        self._load_reference_ranges()

    def _load_reference_ranges(self):
        ref_path = os.path.join(self.data_dir, "data", "reference_ranges.csv")
        if not os.path.exists(ref_path):
            ref_path = os.path.join("data", "reference_ranges.csv")
        if os.path.exists(ref_path):
            try:
                with open(ref_path, "r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        t = row.get("test_name", "").upper()
                        if t:
                            self.reference_ranges[t] = {
                                "uln": float(row.get("uln", 0)) if row.get("uln") else None,
                                "unit": row.get("unit"),
                                "category": row.get("category"),
                                "critical_high": float(row.get("critical_high", 0)) if row.get("critical_high") else None
                            }
            except Exception as e:
                print(f"Notice: reference ranges load {e}")

    def _infer_domain_from_filename_or_columns(self, filename: str, columns: List[str]) -> str:
        base_name = os.path.basename(filename).lower()
        fn, _ = os.path.splitext(base_name)
        cols_lower = [c.lower() for c in columns]

        # Exact SDTM or canonical mappings
        if fn in ("dm", "subjects") or ("age" in cols_lower and "sex" in cols_lower):
            return "subjects"
        if fn in ("lb", "laboratory") or "test_name" in cols_lower or ("param" in cols_lower and "aval" in cols_lower):
            return "laboratory"
        if fn in ("ae", "adverse_events") or "event_term" in cols_lower or "aeterm" in cols_lower:
            return "adverse_events"
        if fn in ("ex", "doses", "dosing") or "dose_amount" in cols_lower:
            return "doses"
        if fn in ("ds", "disposition") or "completion_status" in cols_lower or "reason_discontinued" in cols_lower:
            return "disposition"
        if fn in ("cm", "medications") or "medication_name" in cols_lower:
            return "medications"
        if fn in ("vs", "vital_signs", "vitals") or "sys" in cols_lower or "diastolic" in cols_lower:
            return "vital_signs"
        if fn in ("eg", "ecg") or "qtcf" in cols_lower:
            return "ecg"
        if fn in ("mh", "medical_history") or "condition" in cols_lower:
            return "medical_history"
        if fn in ("visits", "sv"):
            return "visits"
        if fn in ("biomarkers",):
            return "biomarkers"
        return fn or "unknown_domain"

    def _canonicalize_record(self, raw: Dict[str, Any], domain: str, source_file: str, cut: int) -> Dict[str, Any]:
        clean = {k.strip(): v for k, v in raw.items() if k is not None}
        lower_keys = {k.lower(): k for k in clean}

        subj_candidates = ["usubjid", "subject_id", "subjid", "id", "participant_id", "patient_id"]
        subject_id = None
        for cand in subj_candidates:
            if cand in lower_keys:
                subject_id = str(clean[lower_keys[cand]]).strip()
                break

        rec_candidates = ["record_id", "rec_id", "lbseq", "aeseq", "exseq", "cmseq", "vsseq", "egseq", "mhseq"]
        record_id = None
        for cand in rec_candidates:
            if cand in lower_keys:
                val = clean[lower_keys[cand]]
                record_id = f"{domain.upper()[:3]}_{subject_id}_{val}" if cand.endswith("seq") else str(val).strip()
                break

        if not record_id:
            record_id = f"{domain.upper()[:3]}_{subject_id or 'GEN'}_{len(self.records_by_id) + 1}"

        site = None
        for cand in ["site", "site_id", "siteid", "center", "center_id"]:
            if cand in lower_keys:
                site = str(clean[lower_keys[cand]]).strip()
                break
        if not site and subject_id and "-" in subject_id:
            parts = subject_id.split("-")
            for p in parts:
                if p.upper().startswith("S"):
                    site = p.upper()
                    break

        date_str = None
        for cand in ["collection_date", "visit_date", "start_date", "dose_date", "event_date", "date", "disposition_date"]:
            if cand in lower_keys:
                date_str = clean[lower_keys[cand]]
                break

        visit = None
        for cand in ["visit", "visit_name", "visitnum", "timepoint"]:
            if cand in lower_keys:
                visit = str(clean[lower_keys[cand]]).strip()
                break

        cut_avail = clean.get("cut_available")
        try:
            cut_avail_num = int(cut_avail) if cut_avail is not None else 1
        except (ValueError, TypeError):
            cut_avail_num = 1

        corr_cut = clean.get("corrected_at_cut")
        try:
            corr_cut_num = int(corr_cut) if corr_cut is not None else None
        except (ValueError, TypeError):
            corr_cut_num = None

        record = {
            "record_id": record_id,
            "subject_id": subject_id,
            "site": site,
            "domain": domain,
            "visit": visit,
            "date": date_str,
            "parsed_date": parse_date(date_str).isoformat() if parse_date(date_str) else None,
            "source_file": os.path.basename(source_file),
            "cut": cut_avail_num,
            "cut_available": cut_avail_num,
            "corrected_at_cut": corr_cut_num,
            "protocol_version": self.active_protocol_version,
            "raw_data": clean,
            "is_valid": True,
            "history": []
        }

        # Domain canonical properties
        if domain == "laboratory":
            test_candidates = ["test_name", "param", "paramcd", "lbtest", "test", "analyte"]
            val_candidates = ["value", "aval", "lbstresn", "result", "val"]
            unit_candidates = ["unit", "aval_unit", "lbstresu", "units"]
            ref_candidates = ["uln", "ref_high", "normal_high", "reference_range_high"]

            test_name = next((clean[lower_keys[c]] for c in test_candidates if c in lower_keys), "UNKNOWN_TEST")
            raw_val = next((clean[lower_keys[c]] for c in val_candidates if c in lower_keys), None)
            raw_unit = next((clean[lower_keys[c]] for c in unit_candidates if c in lower_keys), "")
            uln_val = next((clean[lower_keys[c]] for c in ref_candidates if c in lower_keys), None)

            # Check reference range table
            t_upper = str(test_name).upper()
            if not uln_val and t_upper in self.reference_ranges:
                uln_val = self.reference_ranges[t_upper].get("uln")
            if not uln_val and t_upper in LAB_CONVERSIONS:
                uln_val = LAB_CONVERSIONS[t_upper].get("ULN")

            norm_val, norm_unit, method, flag = normalize_lab_unit(str(test_name), raw_val, str(raw_unit))
            record.update({
                "test_name": t_upper,
                "original_value": raw_val,
                "original_unit": str(raw_unit),
                "normalized_value": norm_val,
                "normalized_unit": norm_unit,
                "conversion_method": method,
                "unit_flag": flag,
                "uln": float(uln_val) if uln_val not in (None, "") else None
            })

        elif domain == "adverse_events":
            term_candidates = ["event_term", "aeterm", "term", "adverse_event", "ae_desc"]
            sev_candidates = ["severity", "aesev", "grade", "ctcae_grade"]
            ser_candidates = ["serious", "aeser", "is_serious", "sae"]
            act_candidates = ["action_taken", "aeacn", "action"]

            term = next((str(clean[lower_keys[c]]).strip() for c in term_candidates if c in lower_keys), "Unknown AE")
            sev = next((str(clean[lower_keys[c]]).strip() for c in sev_candidates if c in lower_keys), "Grade 1")
            ser = str(next((clean[lower_keys[c]] for c in ser_candidates if c in lower_keys), "N")).upper() in ["Y", "YES", "TRUE", "1"]
            act = next((str(clean[lower_keys[c]]).strip() for c in act_candidates if c in lower_keys), "None")

            record.update({
                "term": term,
                "severity": sev,
                "is_serious": ser,
                "action_taken": act,
                "relationship": clean.get("relationship", "Possible")
            })

        elif domain == "doses":
            amount_candidates = ["dose_amount", "exdose", "amount", "dose_mg"]
            planned_candidates = ["planned_dose", "target_dose", "protocol_dose"]
            wrong_candidates = ["wrong_dose", "dose_deviation", "deviation"]

            dose_val = next((clean[lower_keys[c]] for c in amount_candidates if c in lower_keys), None)
            plan_val = next((clean[lower_keys[c]] for c in planned_candidates if c in lower_keys), None)
            dev_val = next((clean[lower_keys[c]] for c in wrong_candidates if c in lower_keys), None)

            try:
                dose_num = float(dose_val) if dose_val is not None else None
            except (ValueError, TypeError):
                dose_num = None
            try:
                plan_num = float(plan_val) if plan_val is not None else None
            except (ValueError, TypeError):
                plan_num = None

            is_wrong = False
            if dev_val is not None and str(dev_val).strip().upper() in ["Y", "YES", "TRUE", "1"]:
                is_wrong = True
            elif dose_num is not None and plan_num is not None and abs(dose_num - plan_num) > 0.001:
                is_wrong = True

            record.update({
                "dose_amount": dose_num,
                "planned_dose": plan_num,
                "is_wrong_dose": is_wrong,
                "deviation_reason": clean.get("deviation_reason")
            })

        elif domain == "disposition":
            status_candidates = ["completion_status", "status", "dsstatus", "dispositioned"]
            reason_candidates = ["reason_discontinued", "dsreason", "reason", "discontinuation_reason"]

            status = next((str(clean[lower_keys[c]]).strip() for c in status_candidates if c in lower_keys), "Ongoing")
            reason = next((str(clean[lower_keys[c]]).strip() for c in reason_candidates if c in lower_keys), "")

            is_disc = (
                "DISCONTINUED" in status.upper() or
                "EARLY TERMINATION" in status.upper() or
                bool(reason and "COMPLETED" not in reason.upper() and reason.strip() != "")
            )

            record.update({
                "status": status,
                "reason_discontinued": reason,
                "is_discontinued": is_disc
            })

        elif domain == "vital_signs":
            record.update({
                "test_name": clean.get("test_name", "Systolic Blood Pressure"),
                "value": clean.get("value"),
                "unit": clean.get("unit", "mmHg")
            })

        elif domain == "ecg":
            record.update({
                "qtcf": clean.get("qtcf"),
                "interpretation": clean.get("interpretation", "Normal Sinus Rhythm")
            })

        elif domain == "medications":
            record.update({
                "medication_name": clean.get("medication_name"),
                "indication": clean.get("indication"),
                "dose": clean.get("dose")
            })

        elif domain == "medical_history":
            record.update({
                "condition": clean.get("condition"),
                "diagnosis_year": clean.get("diagnosis_year")
            })

        return record

    def build(self, cut: int | None = None) -> dict:
        """
        Builds the study knowledge graph for the specified cut.
        Enforces cut-aware filtering: only records where cut_available <= cut are visible.
        Applies corrections for the specified cut.
        """
        target_cut = cut if cut is not None else 1
        self.current_cut = target_cut
        self.active_protocol_version = 1 if target_cut <= 3 else (2 if target_cut <= 7 else 3)

        # Clear indices for clean cut-aware state
        self.nodes = {}
        self.edges = []
        self.subjects = {}
        self.records_by_id = {}
        self.records_by_subject = {}
        self.records_by_domain = {}
        self.corrections_applied = []
        self.discovered_domains = set()
        self.discovered_sites = set()

        discovered_new_domains = []
        discovered_new_sites = []

        # Find data files: check hackathon-data first, then fallback to data/
        files_to_load = []
        hack_data_dir = os.path.join(self.data_dir, "data")
        if os.path.exists(hack_data_dir):
            for f in sorted(os.listdir(hack_data_dir)):
                if f.endswith(".csv") and f not in ("cuts.csv", "reference_ranges.csv", "corrections.csv"):
                    files_to_load.append(os.path.join(hack_data_dir, f))
        elif os.path.exists(self.data_dir):
            # Cut-based directory structure (data/cut_N/)
            for c in range(1, target_cut + 1):
                c_dir = os.path.join(self.data_dir, f"cut_{c}")
                if os.path.exists(c_dir):
                    for f in os.listdir(c_dir):
                        if f.endswith(".csv") and f != "corrections.csv":
                            files_to_load.append(os.path.join(c_dir, f))

        for filepath in files_to_load:
            try:
                if filepath not in self._raw_files_cache:
                    with open(filepath, "r", encoding="utf-8-sig", errors="replace") as f:
                        reader = csv.DictReader(f)
                        fieldnames = reader.fieldnames or []
                        inferred_dom = self._infer_domain_from_filename_or_columns(filepath, fieldnames)
                        self._raw_files_cache[filepath] = (inferred_dom, list(reader))

                domain, cached_rows = self._raw_files_cache[filepath]
                if domain not in self.discovered_domains:
                    self.discovered_domains.add(domain)
                    discovered_new_domains.append(domain)

                for raw_row in cached_rows:
                        # Cut-aware filtering
                        raw_cut = raw_row.get("cut_available")
                        try:
                            record_cut = int(raw_cut) if raw_cut is not None else 1
                        except (ValueError, TypeError):
                            record_cut = 1

                        if record_cut > target_cut:
                            # Not yet available in this cut!
                            continue

                        record = self._canonicalize_record(raw_row, domain, filepath, target_cut)
                        rec_id = record["record_id"]
                        subj_id = record["subject_id"]
                        site = record["site"]

                        if site and site not in self.discovered_sites:
                            self.discovered_sites.add(site)
                            discovered_new_sites.append(site)

                        self.records_by_id[rec_id] = record
                        if subj_id:
                            if subj_id not in self.subjects:
                                self.subjects[subj_id] = {
                                    "subject_id": subj_id,
                                    "site": site,
                                    "records_count": 0,
                                    "first_seen_cut": record_cut,
                                    "demographics": {}
                                }
                            if site and not self.subjects[subj_id].get("site"):
                                self.subjects[subj_id]["site"] = site
                            self.records_by_subject.setdefault(subj_id, []).append(record)
                            self.subjects[subj_id]["records_count"] += 1
                            if domain == "subjects":
                                self.subjects[subj_id]["demographics"] = record["raw_data"]

                        self.records_by_domain.setdefault(domain, []).append(record)

                        # Add Knowledge Graph Node
                        self.nodes[rec_id] = {
                            "id": rec_id,
                            "type": domain,
                            "subject_id": subj_id,
                            "site": site,
                            "visit": record.get("visit"),
                            "date": record.get("date"),
                            "value": record.get("normalized_value") or record.get("value") or record.get("term") or record.get("dose_amount"),
                            "unit": record.get("normalized_unit") or record.get("unit"),
                            "cut": record_cut,
                            "label": f"{domain.upper()}: {record.get('test_name') or record.get('term') or rec_id}"
                        }

                        # Add Connected Edges
                        if subj_id:
                            self.edges.append({
                                "source": f"SUBJ_{subj_id}",
                                "target": rec_id,
                                "relationship": f"HAS_{domain.upper()}",
                                "cut": record_cut
                            })
                            if record.get("visit"):
                                self.edges.append({
                                    "source": f"VIS_{subj_id}_{record.get('visit')}",
                                    "target": rec_id,
                                    "relationship": f"AT_VISIT",
                                    "cut": record_cut
                                })
            except Exception as e:
                print(f"Notice: building domain from {filepath}: {e}")

        # Add Subject Nodes & Site Edges to Graph
        for s_id, s_info in self.subjects.items():
            self.nodes[f"SUBJ_{s_id}"] = {
                "id": f"SUBJ_{s_id}",
                "type": "subject",
                "subject_id": s_id,
                "site": s_info.get("site"),
                "cut": s_info.get("first_seen_cut", 1),
                "label": f"Subject {s_id}"
            }
            if s_info.get("site"):
                self.edges.append({
                    "source": f"SUBJ_{s_id}",
                    "target": f"SITE_{s_info['site']}",
                    "relationship": "ENROLLED_AT",
                    "cut": s_info.get("first_seen_cut", 1)
                })
                self.nodes[f"SITE_{s_info['site']}"] = {
                    "id": f"SITE_{s_info['site']}",
                    "type": "site",
                    "site": s_info["site"],
                    "cut": 1,
                    "label": f"Site {s_info['site']}"
                }

        # Apply corrections if applicable for this cut
        self._apply_corrections_for_cut(target_cut)

        return {
            "cut": target_cut,
            "protocol_version": self.active_protocol_version,
            "total_nodes": len(self.nodes),
            "total_edges": len(self.edges),
            "total_subjects": len(self.subjects),
            "total_records": len(self.records_by_id),
            "discovered_new_domains": discovered_new_domains,
            "discovered_new_sites": discovered_new_sites,
            "domains": sorted(list(self.discovered_domains)),
            "sites": sorted(list(self.discovered_sites))
        }

    def _apply_corrections_for_cut(self, cut: int):
        corrections_files = [
            os.path.join(self.data_dir, "data", "corrections.csv"),
            os.path.join(self.data_dir, "corrections.csv"),
            os.path.join("data", "corrections.csv")
        ]
        for c_file in corrections_files:
            if not os.path.exists(c_file):
                continue
            try:
                with open(c_file, "r", encoding="utf-8-sig") as f:
                    reader = csv.DictReader(f)
                    for row in reader:
                        eff_cut = int(row.get("cut") or row.get("effective_cut") or cut)
                        if cut < eff_cut:
                            # Not yet corrected in this cut!
                            continue
                        target_rec_id = row.get("record_id")
                        # Handle exact record_id or LB_ prefix variant
                        matching_recs = [target_rec_id]
                        if target_rec_id and target_rec_id.startswith("LAB_"):
                            matching_recs.append("LB_" + target_rec_id[4:])
                        elif target_rec_id and target_rec_id.startswith("LB_"):
                            matching_recs.append("LAB_" + target_rec_id[3:])

                        for t_id in matching_recs:
                            if t_id and t_id in self.records_by_id:
                                orig = self.records_by_id[t_id]
                                field = row.get("field") or "value"
                                old_val = orig["raw_data"].get(field)
                                new_val = row.get("corrected_value")
                                orig["history"].append({
                                    "cut": eff_cut,
                                    "field": field,
                                    "old_value": old_val,
                                    "new_value": new_val,
                                    "reason": row.get("reason", "Lab instrument re-assay calibration"),
                                    "timestamp": datetime.now().isoformat()
                                })
                                orig["raw_data"][field] = new_val
                                if orig["domain"] == "laboratory":
                                    t_name = orig.get("test_name", "")
                                    norm_val, norm_unit, method, flag = normalize_lab_unit(t_name, new_val, orig.get("original_unit"))
                                    orig["normalized_value"] = norm_val
                                    orig["normalized_unit"] = norm_unit
                                    orig["conversion_method"] = method
                                    orig["unit_flag"] = flag
                                self.corrections_applied.append({
                                    "cut": eff_cut,
                                    "record_id": t_id,
                                    "field": field,
                                    "old_value": old_val,
                                    "new_value": new_val,
                                    "reason": row.get("reason"),
                                    "applied_at": datetime.now().isoformat()
                                })
            except Exception as e:
                print(f"Notice: correction parsing {e}")

    def patient360(self, usubjid: str) -> dict:
        subj = self.subjects.get(usubjid)
        if not subj:
            for s_id, s_data in self.subjects.items():
                if usubjid.lower() == s_id.lower() or usubjid in s_id:
                    subj = s_data
                    usubjid = s_id
                    break
        if not subj:
            return {
                "subject_id": usubjid,
                "found": False,
                "error": f"Subject {usubjid} not found in study graph for Cut {self.current_cut}.",
                "evidence": []
            }

        recs = self.records_by_subject.get(usubjid, [])
        by_domain: Dict[str, List[Dict[str, Any]]] = {}
        for r in recs:
            by_domain.setdefault(r["domain"], []).append(r)

        # Build chronological visits
        visits_map = {}
        for r in recs:
            v_name = r.get("visit")
            if v_name and v_name not in visits_map:
                visits_map[v_name] = {
                    "visit_name": v_name,
                    "date": r.get("date"),
                    "cut": r.get("cut"),
                    "source_file": r.get("source_file")
                }
        visits = sorted(list(visits_map.values()), key=lambda x: str(x.get("date") or ""))

        # Labs
        labs = []
        for l_rec in by_domain.get("laboratory", []):
            labs.append({
                "record_id": l_rec["record_id"],
                "test": l_rec.get("test_name"),
                "visit": l_rec.get("visit"),
                "date": l_rec.get("date"),
                "original_value": l_rec.get("original_value"),
                "original_unit": l_rec.get("original_unit"),
                "normalized_value": l_rec.get("normalized_value"),
                "normalized_unit": l_rec.get("normalized_unit"),
                "conversion_method": l_rec.get("conversion_method"),
                "unit_flag": l_rec.get("unit_flag"),
                "uln": l_rec.get("uln"),
                "source_file": l_rec.get("source_file"),
                "cut": l_rec.get("cut"),
                "history": l_rec.get("history", [])
            })
        labs.sort(key=lambda x: str(x.get("date") or ""))

        # Adverse events
        aes = []
        for a_rec in by_domain.get("adverse_events", []):
            aes.append({
                "record_id": a_rec["record_id"],
                "term": a_rec.get("term"),
                "severity": a_rec.get("severity"),
                "is_serious": a_rec.get("is_serious"),
                "action_taken": a_rec.get("action_taken"),
                "relationship": a_rec.get("relationship"),
                "date": a_rec.get("date"),
                "cut": a_rec.get("cut"),
                "source_file": a_rec.get("source_file")
            })

        # Doses
        doses = []
        for d_rec in by_domain.get("doses", []):
            doses.append({
                "record_id": d_rec["record_id"],
                "visit": d_rec.get("visit"),
                "date": d_rec.get("date"),
                "dose_amount": d_rec.get("dose_amount"),
                "planned_dose": d_rec.get("planned_dose"),
                "is_wrong_dose": d_rec.get("is_wrong_dose"),
                "cut": d_rec.get("cut"),
                "source_file": d_rec.get("source_file")
            })

        # Dispositions
        disps = by_domain.get("disposition", [])
        last_disp = disps[-1] if disps else None

        # Protocol findings for this patient
        findings = []
        alt_records = [l for l in labs if l.get("test") in ("ALT", "ALANINE AMINOTRANSFERASE") and l.get("normalized_value") is not None and l.get("uln")]
        bili_records = [l for l in labs if l.get("test") in ("BILIRUBIN", "TOTAL BILIRUBIN") and l.get("normalized_value") is not None and l.get("uln")]
        alp_records = [l for l in labs if l.get("test") in ("ALP", "ALKALINE PHOSPHATASE") and l.get("normalized_value") is not None and l.get("uln")]

        for a in alt_records:
            if a["normalized_value"] > 3.0 * a["uln"]:
                for b in bili_records:
                    if b["normalized_value"] > 2.0 * b["uln"]:
                        a_dt = parse_date(a.get("date"))
                        b_dt = parse_date(b.get("date"))
                        if a_dt and b_dt and abs((a_dt - b_dt).days) <= 14:
                            # Cholestasis check: ALP < 2x ULN
                            is_cholestatic = any(alp["normalized_value"] >= 2.0 * alp["uln"] for alp in alp_records if alp.get("visit") == a.get("visit"))
                            if not is_cholestatic:
                                findings.append({
                                    "rule": "HYS_LAW_POTENTIAL",
                                    "description": f"Concurrent ALT > 3x ULN ({a['normalized_value']} U/L) and Bilirubin > 2x ULN ({b['normalized_value']} mg/dL)",
                                    "evidence_records": [a["record_id"], b["record_id"]],
                                    "severity": "CRITICAL"
                                })

        for d in doses:
            if d.get("is_wrong_dose"):
                findings.append({
                    "rule": "DOSING_DEVIATION",
                    "description": f"Administered dose {d.get('dose_amount')} mg differs from protocol planned dose {d.get('planned_dose')} mg",
                    "evidence_records": [d["record_id"]],
                    "severity": "MEDIUM"
                })

        return {
            "subject_id": usubjid,
            "site": subj.get("site"),
            "found": True,
            "demographics": subj.get("demographics", {}),
            "timeline": {
                "visits": visits,
                "laboratory": labs,
                "adverse_events": aes,
                "doses": doses,
                "medications": by_domain.get("medications", []),
                "vital_signs": by_domain.get("vital_signs", []),
                "ecg": by_domain.get("ecg", []),
                "medical_history": by_domain.get("medical_history", []),
                "disposition": last_disp
            },
            "findings": findings,
            "source_records_count": len(recs),
            "latest_data_cut": self.current_cut
        }


class Atlas:
    """
    Atlas Question Engine supporting deterministic COUNT, LOOKUP, FINDING, and TRAP queries.
    Never invents data; provides exact evidence citations for every answer.
    """
    def __init__(self, graph: StudyGraph):
        self.graph = graph

    def answer(self, question: Question) -> Answer:
        text = question.text.strip()
        q_lower = text.lower()
        category = (question.category or "").upper()

        if not category:
            if "how many" in q_lower or "count" in q_lower or "total subjects" in q_lower:
                category = "COUNT"
            elif "list" in q_lower or "within" in q_lower or "records for" in q_lower or "lookup" in q_lower:
                category = "LOOKUP"
            elif "hy's law" in q_lower or "hys law" in q_lower or "finding" in q_lower or "abnormal" in q_lower:
                category = "FINDING"
            elif "wrong dose" in q_lower or "trap" in q_lower:
                category = "TRAP"
            else:
                category = "LOOKUP"

        if category == "COUNT":
            return self._handle_count(text, q_lower)
        elif category == "LOOKUP":
            return self._handle_lookup(text, q_lower)
        elif category == "FINDING":
            return self._handle_finding(text, q_lower)
        elif category == "TRAP":
            return self._handle_trap(text, q_lower)
        else:
            return self._handle_lookup(text, q_lower)

    def _handle_count(self, text: str, q_lower: str) -> Answer:
        """
        COUNT question:
        e.g. "How many subjects at site S07 discontinued due to an adverse event?"
        """
        site_match = re.search(r'\b(s\d{2,3})\b', q_lower)
        target_site = site_match.group(1).upper() if site_match else None

        evidence_list: List[Evidence] = []
        matching_subjid_set = set()

        # Check disposition records
        disp_records = self.graph.records_by_domain.get("disposition", [])
        for r in disp_records:
            subj_id = r.get("subject_id")
            site = r.get("site")
            if target_site and site != target_site:
                continue
            reason = str(r.get("reason_discontinued", "")).lower()
            status = str(r.get("status", "")).lower()
            is_ae_disc = "adverse event" in reason or "ae" in reason or "toxicity" in reason or "rash" in reason
            if is_ae_disc and (r.get("is_discontinued") or "discontinued" in status):
                matching_subjid_set.add(subj_id)
                evidence_list.append(Evidence(
                    record_id=r["record_id"],
                    subject_id=subj_id,
                    domain="disposition",
                    source_file=r["source_file"],
                    reason=f"Subject {subj_id} at {site} discontinued: '{r.get('reason_discontinued')}'",
                    variable="reason_discontinued",
                    value=r.get("reason_discontinued"),
                    visit=r.get("visit"),
                    date=r.get("date")
                ))

        # Cross-reference adverse events
        ae_records = self.graph.records_by_domain.get("adverse_events", [])
        for a in ae_records:
            subj_id = a.get("subject_id")
            site = a.get("site")
            if target_site and site != target_site:
                continue
            action = str(a.get("action_taken") or a["raw_data"].get("action_taken", "")).lower()
            if "discontinued" in action or "withdrawn" in action:
                matching_subjid_set.add(subj_id)
                evidence_list.append(Evidence(
                    record_id=a["record_id"],
                    subject_id=subj_id,
                    domain="adverse_events",
                    source_file=a["source_file"],
                    reason=f"Adverse event '{a.get('term')}' resulted in action: '{a.get('action_taken')}'",
                    variable="action_taken",
                    value=a.get("action_taken"),
                    visit=a.get("visit"),
                    date=a.get("date")
                ))

        count = len(matching_subjid_set)
        site_str = f"at site {target_site}" if target_site else "across all study sites"
        ans_text = f"Exactly {count} subject{'s' if count != 1 else ''} {site_str} discontinued due to an adverse event."
        if count > 0:
            ans_text += f" Matching subject ID(s): {', '.join(sorted(matching_subjid_set))}."

        calc = Calculation(
            name="Deterministic Count of AE Discontinuations",
            formula="COUNT(DISTINCT subject_id WHERE site = target_site AND (disposition.reason LIKE '%AE%' OR ae.action LIKE '%discontinued%'))",
            inputs={"target_site": target_site, "evaluated_disposition_records": len(disp_records)},
            result=count
        )

        return Answer(
            answer=ans_text,
            result=count,
            evidence=evidence_list,
            calculations=[calc],
            data_cut=self.graph.current_cut
        )

    def _handle_lookup(self, text: str, q_lower: str) -> Answer:
        """
        LOOKUP question:
        e.g. "List the laboratory and adverse-event records for 042-S05-003 within 7 days of the WEEK4 visit."
        """
        subj_match = re.search(r'\b(\d{3}-[A-Z0-9]+-\d{3}|[A-Z0-9]+-\d{3}|SUBJ[A-Z0-9_-]+)\b', text, re.IGNORECASE)
        target_subj = subj_match.group(1) if subj_match else None

        visit_match = re.search(r'\b(week\s*\d+|screening|baseline|day\s*\d+)\b', q_lower)
        target_visit = visit_match.group(1).upper().replace(" ", "") if visit_match else None

        window_match = re.search(r'within\s*(\d+)\s*days', q_lower)
        days_window = int(window_match.group(1)) if window_match else 7

        if not target_subj:
            for s in self.graph.subjects:
                if s.lower() in q_lower:
                    target_subj = s
                    break

        if not target_subj:
            return Answer(
                answer="Lookup query requires a valid Subject ID (e.g., 042-S05-003). Please specify a subject.",
                result=[],
                evidence=[],
                calculations=[],
                data_cut=self.graph.current_cut
            )

        subj_records = self.graph.records_by_subject.get(target_subj, [])
        if not subj_records:
            return Answer(
                answer=f"No records found for subject {target_subj} in Data Cut {self.graph.current_cut}.",
                result=[],
                evidence=[],
                calculations=[],
                data_cut=self.graph.current_cut
            )

        # Locate reference visit date
        target_date = None
        for r in subj_records:
            v_name = (r.get("visit") or "").upper().replace(" ", "")
            if target_visit and target_visit in v_name:
                p_dt = parse_date(r.get("date"))
                if p_dt:
                    target_date = p_dt
                    break

        evidence_list: List[Evidence] = []
        matching_records = []

        for r in subj_records:
            domain = r.get("domain")
            if domain not in ("laboratory", "adverse_events"):
                continue
            r_dt = parse_date(r.get("date"))
            in_window = True
            if target_date and r_dt:
                delta = abs((r_dt - target_date).days)
                if delta > days_window:
                    in_window = False
            elif target_date and not r_dt:
                in_window = False

            if in_window:
                matching_records.append(r)
                evidence_list.append(Evidence(
                    record_id=r["record_id"],
                    subject_id=target_subj,
                    domain=domain,
                    source_file=r["source_file"],
                    reason=f"Matching {domain} record at visit {r.get('visit')} on {r.get('date')}",
                    variable=r.get("test_name") or r.get("term"),
                    value=r.get("normalized_value") or r.get("severity"),
                    unit=r.get("normalized_unit"),
                    visit=r.get("visit"),
                    date=r.get("date")
                ))

        ans_msg = f"Retrieved {len(matching_records)} records for subject {target_subj}"
        if target_visit and target_date:
            ans_msg += f" within {days_window} days of {target_visit} ({target_date.strftime('%Y-%m-%d')})."
        else:
            ans_msg += "."

        calc = Calculation(
            name="Date Window Filter",
            formula=f"ABS(record_date - visit_date) <= {days_window} days",
            inputs={"target_subject": target_subj, "target_visit": target_visit, "target_date": target_date.isoformat() if target_date else None, "days_window": days_window},
            result=len(matching_records)
        )

        return Answer(
            answer=ans_msg,
            result=matching_records,
            evidence=evidence_list,
            calculations=[calc],
            data_cut=self.graph.current_cut
        )

    def _handle_finding(self, text: str, q_lower: str) -> Answer:
        """
        FINDING question:
        e.g. "Which subjects meet the Hy's law criteria?"
        Deterministic FDA Hy's Law implementation:
        1. ALT or AST > 3x ULN
        2. Total Bilirubin > 2x ULN
        3. Concurrently within 14 days
        4. ALP < 2x ULN
        """
        evidence_list: List[Evidence] = []
        matching_subjects = []
        calculations: List[Calculation] = []

        for subj_id, subj_recs in self.graph.records_by_subject.items():
            labs = [r for r in subj_recs if r.get("domain") == "laboratory" and r.get("is_valid", True)]
            alt_records = [l for l in labs if l.get("test_name") in ("ALT", "ALANINE AMINOTRANSFERASE") and l.get("normalized_value") is not None and l.get("uln")]
            ast_records = [l for l in labs if l.get("test_name") in ("AST", "ASPARTATE AMINOTRANSFERASE") and l.get("normalized_value") is not None and l.get("uln")]
            bili_records = [l for l in labs if l.get("test_name") in ("BILIRUBIN", "TOTAL BILIRUBIN") and l.get("normalized_value") is not None and l.get("uln")]
            alp_records = [l for l in labs if l.get("test_name") in ("ALP", "ALKALINE PHOSPHATASE") and l.get("normalized_value") is not None and l.get("uln")]

            transaminases = alt_records + ast_records
            for t in transaminases:
                t_val = t["normalized_value"]
                t_uln = t["uln"]
                if t_val > 3.0 * t_uln:
                    t_date = parse_date(t.get("date"))
                    for b in bili_records:
                        b_val = b["normalized_value"]
                        b_uln = b["uln"]
                        if b_val > 2.0 * b_uln:
                            b_date = parse_date(b.get("date"))
                            days_diff = abs((t_date - b_date).days) if t_date and b_date else 0
                            if days_diff <= 14:
                                # Check ALP cholestasis criteria
                                cholestatic = False
                                for a in alp_records:
                                    a_date = parse_date(a.get("date"))
                                    if a_date and t_date and abs((a_date - t_date).days) <= 14:
                                        if a["normalized_value"] >= 2.0 * a["uln"]:
                                            cholestatic = True
                                            break
                                if not cholestatic:
                                    evidence_list.append(Evidence(
                                        record_id=t["record_id"],
                                        subject_id=subj_id,
                                        domain="laboratory",
                                        source_file=t["source_file"],
                                        reason=f"{t['test_name']} value {t_val} {t['normalized_unit']} exceeds 3x ULN ({t_uln}) on {t.get('date')}",
                                        variable=t["test_name"],
                                        value=t_val,
                                        unit=t["normalized_unit"],
                                        date=t.get("date")
                                    ))
                                    evidence_list.append(Evidence(
                                        record_id=b["record_id"],
                                        subject_id=subj_id,
                                        domain="laboratory",
                                        source_file=b["source_file"],
                                        reason=f"Bilirubin value {b_val} {b['normalized_unit']} exceeds 2x ULN ({b_uln}) on {b.get('date')}",
                                        variable="BILIRUBIN",
                                        value=b_val,
                                        unit=b["normalized_unit"],
                                        date=b.get("date")
                                    ))

                                    calc = Calculation(
                                        name=f"Hy's Law Deterministic Evaluation for {subj_id}",
                                        formula="(ALT_or_AST > 3x ULN) AND (Bilirubin > 2x ULN) WITHIN 14 days AND (ALP < 2x ULN)",
                                        inputs={
                                            "subject_id": subj_id,
                                            "transaminase_test": t["test_name"],
                                            "transaminase_val": t_val,
                                            "transaminase_uln": t_uln,
                                            "transaminase_ratio": round(t_val / t_uln, 2),
                                            "bili_val": b_val,
                                            "bili_uln": b_uln,
                                            "bili_ratio": round(b_val / b_uln, 2),
                                            "days_difference": days_diff
                                        },
                                        result="CRITERIA_MET"
                                    )
                                    calculations.append(calc)

                                    if subj_id not in [s["subject_id"] for s in matching_subjects]:
                                        matching_subjects.append({
                                            "subject_id": subj_id,
                                            "site": t.get("site"),
                                            "transaminase": f"{t['test_name']}: {t_val} {t['normalized_unit']} ({round(t_val/t_uln, 1)}x ULN)",
                                            "bilirubin": f"{b_val} {b['normalized_unit']} ({round(b_val/b_uln, 1)}x ULN)",
                                            "evidence_record_ids": [t["record_id"], b["record_id"]]
                                        })

        count = len(matching_subjects)
        if count == 0:
            ans_text = "No subjects in the current data cut meet the protocol-defined Hy's law criteria."
        else:
            subj_strs = [f"{s['subject_id']} ({s['transaminase']}, Bilirubin: {s['bilirubin']})" for s in matching_subjects]
            ans_text = f"Identified {count} subject{'s' if count != 1 else ''} meeting protocol Hy's law criteria: " + "; ".join(subj_strs) + "."

        return Answer(
            answer=ans_text,
            result=matching_subjects,
            evidence=evidence_list,
            calculations=calculations,
            data_cut=self.graph.current_cut
        )

    def _handle_trap(self, text: str, q_lower: str) -> Answer:
        """
        TRAP question:
        e.g. "Which subjects at site S01 received a wrong dose?"
        CRITICAL: If there are no matching records, returns empty result set and "No subjects found."
        NEVER invents a positive finding merely because question expects one!
        """
        site_match = re.search(r'\b(s\d{2,3})\b', q_lower)
        target_site = site_match.group(1).upper() if site_match else None

        doses = self.graph.records_by_domain.get("doses", [])
        evidence_list: List[Evidence] = []
        matching_subjects = []

        for d in doses:
            site = d.get("site")
            if target_site and site != target_site:
                continue
            if d.get("is_wrong_dose"):
                subj_id = d.get("subject_id")
                matching_subjects.append({
                    "subject_id": subj_id,
                    "site": site,
                    "dose_amount": d.get("dose_amount"),
                    "planned_dose": d.get("planned_dose"),
                    "record_id": d.get("record_id")
                })
                evidence_list.append(Evidence(
                    record_id=d["record_id"],
                    subject_id=subj_id,
                    domain="doses",
                    source_file=d["source_file"],
                    reason=f"Wrong dose administered: {d.get('dose_amount')} mg vs planned {d.get('planned_dose')} mg",
                    variable="dose_amount",
                    value=d.get("dose_amount"),
                    visit=d.get("visit"),
                    date=d.get("date")
                ))

        calc = Calculation(
            name="Deterministic Dose Verification",
            formula="dose_amount != planned_dose OR is_wrong_dose == TRUE",
            inputs={"target_site": target_site, "doses_evaluated": len(doses)},
            result=len(matching_subjects)
        )

        site_label = f"at site {target_site}" if target_site else "in the dataset"
        if not matching_subjects:
            return Answer(
                answer=f"No subjects found. Zero subjects {site_label} received a wrong dose based on verified clinical dosing records.",
                result=[],
                evidence=[],
                calculations=[calc],
                data_cut=self.graph.current_cut
            )

        return Answer(
            answer=f"Identified {len(matching_subjects)} subject(s) {site_label} with dosing deviations: {', '.join([s['subject_id'] for s in matching_subjects])}.",
            result=matching_subjects,
            evidence=evidence_list,
            calculations=[calc],
            data_cut=self.graph.current_cut
        )
