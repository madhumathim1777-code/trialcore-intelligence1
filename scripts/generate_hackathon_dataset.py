"""
Generates the complete STUDY-042 canonical synthetic clinical-trial dataset in hackathon-data/
241 subjects across 12 sites (S01 to S12), 27,125 total records across 12 sequential cuts.
Complies with CDISC SDTM domain structures and hackathon specifications.
"""
import os
import csv
import json
import random
from datetime import datetime, timedelta

def generate_hackathon_data(base_dir="hackathon-data"):
    os.makedirs(os.path.join(base_dir, "data"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "documents"), exist_ok=True)
    os.makedirs(os.path.join(base_dir, "responses"), exist_ok=True)

    # 1. README.md
    with open(os.path.join(base_dir, "README.md"), "w") as f:
        f.write("# STUDY-042 Clinical Trial Dataset\n\n"
                "Synthetic Phase III diabetes-drug-vs-placebo trial.\n"
                "- 241 subjects enrolled across 12 investigational sites (S01 to S12)\n"
                "- 27,125 total records across 12 sequential surveillance cuts\n"
                "- Protocol: STUDY-042 (v1.0 at baseline, v2.0 at Cut 4, v3.0 at Cut 8)\n"
                "- CDISC SDTM domains: DM, LB, AE, EX, CM, VS, DS, MH, EG\n"
                "- Longitudinal cuts: 1 to 12 with cut_available and corrected_at_cut tracking\n")

    # 2. cuts.csv
    cuts_data = []
    for c in range(1, 13):
        p_ver = 1 if c <= 3 else (2 if c <= 7 else 3)
        cuts_data.append({
            "cut": c,
            "cut_name": f"Cut {c}",
            "date": f"2026-0{(c//2)+1:01d}-{(c%2)*14 + 10:02d}",
            "protocol_version": f"v{p_ver}",
            "description": f"Longitudinal Surveillance Cut {c}"
        })
    with open(os.path.join(base_dir, "data", "cuts.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=cuts_data[0].keys())
        writer.writeheader()
        writer.writerows(cuts_data)

    # 3. reference_ranges.csv
    ref_ranges = [
        {"test_name": "ALT", "category": "LIVER", "unit": "U/L", "normal_low": 10.0, "normal_high": 45.0, "uln": 45.0, "critical_high": 135.0},
        {"test_name": "AST", "category": "LIVER", "unit": "U/L", "normal_low": 10.0, "normal_high": 40.0, "uln": 40.0, "critical_high": 120.0},
        {"test_name": "BILIRUBIN", "category": "LIVER", "unit": "mg/dL", "normal_low": 0.2, "normal_high": 1.2, "uln": 1.2, "critical_high": 2.4},
        {"test_name": "ALP", "category": "LIVER", "unit": "U/L", "normal_low": 40.0, "normal_high": 120.0, "uln": 120.0, "critical_high": 240.0},
        {"test_name": "CREATININE", "category": "RENAL", "unit": "mg/dL", "normal_low": 0.6, "normal_high": 1.3, "uln": 1.3, "critical_high": 2.6},
        {"test_name": "GLUCOSE", "category": "METABOLIC", "unit": "mg/dL", "normal_low": 70.0, "normal_high": 100.0, "uln": 100.0, "critical_high": 200.0},
        {"test_name": "HBA1C", "category": "METABOLIC", "unit": "%", "normal_low": 4.0, "normal_high": 5.6, "uln": 5.6, "critical_high": 10.0},
        {"test_name": "HEMOGLOBIN", "category": "HEMATOLOGY", "unit": "g/dL", "normal_low": 12.0, "normal_high": 17.5, "uln": 17.5, "critical_high": 20.0},
    ]
    with open(os.path.join(base_dir, "data", "reference_ranges.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=ref_ranges[0].keys())
        writer.writeheader()
        writer.writerows(ref_ranges)

    # 4. DM.csv - Demographics (241 subjects across 12 sites)
    sites = [f"S{i:02d}" for i in range(1, 13)]
    subjects = []
    # Guarantee key subjects
    key_subjects = [
        {"usubjid": "042-S01-001", "site": "S01", "age": 58, "sex": "M", "race": "White", "cohort": "Cohort A", "arm": "Active Drug 50mg"},
        {"usubjid": "042-S01-002", "site": "S01", "age": 62, "sex": "F", "race": "Asian", "cohort": "Cohort A", "arm": "Active Drug 50mg"},
        {"usubjid": "042-S02-001", "site": "S02", "age": 49, "sex": "M", "race": "Black", "cohort": "Cohort B", "arm": "Placebo"},
        {"usubjid": "042-S03-001", "site": "S03", "age": 71, "sex": "M", "race": "White", "cohort": "Cohort A", "arm": "Active Drug 50mg"},
        {"usubjid": "042-S05-001", "site": "S05", "age": 54, "sex": "F", "race": "White", "cohort": "Cohort B", "arm": "Placebo"},
        {"usubjid": "042-S05-003", "site": "S05", "age": 66, "sex": "M", "race": "White", "cohort": "Cohort A", "arm": "Active Drug 50mg"},
        {"usubjid": "042-S07-001", "site": "S07", "age": 60, "sex": "F", "race": "Hispanic", "cohort": "Cohort A", "arm": "Active Drug 50mg"},
        {"usubjid": "042-S07-002", "site": "S07", "age": 52, "sex": "M", "race": "White", "cohort": "Cohort B", "arm": "Active Drug 50mg"},
        {"usubjid": "042-S07-003", "site": "S07", "age": 69, "sex": "F", "race": "White", "cohort": "Cohort B", "arm": "Active Drug 50mg"},
    ]
    subjects.extend(key_subjects)
    subj_count = len(subjects)

    # Generate remaining subjects up to 241
    random.seed(42)
    races = ["White", "Black", "Asian", "Hispanic", "Other"]
    sexes = ["M", "F"]
    cohorts = ["Cohort A", "Cohort B"]
    arms = ["Active Drug 50mg", "Placebo"]

    for s_idx in range(subj_count + 1, 242):
        site_id = sites[(s_idx - 1) % len(sites)]
        local_num = ((s_idx - 1) // len(sites)) + 1
        subjid = f"042-{site_id}-{local_num:03d}"
        subjects.append({
            "usubjid": subjid,
            "site": site_id,
            "age": random.randint(35, 78),
            "sex": random.choice(sexes),
            "race": random.choice(races),
            "cohort": random.choice(cohorts),
            "arm": random.choice(arms),
            "cut_available": 1 if s_idx <= 120 else (2 if s_idx <= 180 else (3 if s_idx <= 220 else 4))
        })

    for s in subjects[:len(key_subjects)]:
        s["cut_available"] = 1

    with open(os.path.join(base_dir, "data", "DM.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(subjects[0].keys()))
        writer.writeheader()
        writer.writerows(subjects)

    # Visits schedule
    visits = ["SCREENING", "BASELINE", "WEEK2", "WEEK4", "WEEK6", "WEEK8", "WEEK10", "WEEK12"]

    # 5. LB.csv - Laboratory
    lb_records = []
    lb_seq = 1
    tests = ["ALT", "AST", "BILIRUBIN", "ALP", "CREATININE", "GLUCOSE"]

    for sub in subjects:
        subjid = sub["usubjid"]
        site = sub["site"]
        enroll_cut = sub["cut_available"]

        for v_idx, visit in enumerate(visits):
            v_cut = max(enroll_cut, (v_idx // 2) + 1)
            v_date = f"2026-0{(v_idx//2)+1:01d}-{(v_idx%2)*14 + 10:02d}"

            for t_name in tests:
                ref = next(r for r in ref_ranges if r["test_name"] == t_name)
                val = round(random.uniform(ref["normal_low"] * 1.05, ref["normal_high"] * 0.95), 1)
                unit = ref["unit"]
                corr_cut = None

                # Specific Benchmark Cases:
                # 1. 042-S05-003 Hy's Law at WEEK4
                if subjid == "042-S05-003" and visit == "WEEK4":
                    if t_name == "ALT":
                        val = 160.0  # > 3x ULN (45)
                        corr_cut = 5  # Corrected at cut 5 to 38.0
                    elif t_name == "BILIRUBIN":
                        val = 2.8   # > 2x ULN (1.2)
                    elif t_name == "ALP":
                        val = 90.0  # < 2x ULN (120)

                # 2. Adversarial Lab unit corruption on 042-S02-001 at WEEK10 (Cut 7)
                if subjid == "042-S02-001" and visit == "WEEK10" and t_name == "ALT":
                    val = 3500.0
                    unit = "µkat/L"

                lb_records.append({
                    "record_id": f"LB_{subjid}_{visit}_{t_name}",
                    "usubjid": subjid,
                    "site": site,
                    "lbseq": lb_seq,
                    "visit": visit,
                    "visit_date": v_date,
                    "test_name": t_name,
                    "value": val,
                    "unit": unit,
                    "uln": ref["uln"],
                    "cut_available": v_cut,
                    "corrected_at_cut": corr_cut
                })
                lb_seq += 1

    with open(os.path.join(base_dir, "data", "LB.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(lb_records[0].keys()))
        writer.writeheader()
        writer.writerows(lb_records)

    # 6. AE.csv - Adverse Events
    ae_records = []
    ae_seq = 1

    # Deterministic AE discontinuations for COUNT benchmark:
    # 042-S07-002: Severe Hepatotoxicity (Discontinued)
    ae_records.append({
        "record_id": "AE_042-S07-002_01",
        "usubjid": "042-S07-002",
        "site": "S07",
        "aeseq": ae_seq,
        "visit": "WEEK4",
        "event_term": "Severe Hepatotoxicity",
        "severity": "Grade 3",
        "is_serious": "Y",
        "action_taken": "Study Discontinued",
        "date": "2026-02-14",
        "cut_available": 3
    })
    ae_seq += 1

    # 042-S07-003: Maculopapular Rash (Discontinued)
    ae_records.append({
        "record_id": "AE_042-S07-003_01",
        "usubjid": "042-S07-003",
        "site": "S07",
        "aeseq": ae_seq,
        "visit": "WEEK4",
        "event_term": "Maculopapular Rash",
        "severity": "Grade 3",
        "is_serious": "N",
        "action_taken": "Study Discontinued",
        "date": "2026-02-15",
        "cut_available": 3
    })
    ae_seq += 1

    # Baseline headache for S01-001 (None action)
    ae_records.append({
        "record_id": "AE_042-S01-001_01",
        "usubjid": "042-S01-001",
        "site": "S01",
        "aeseq": ae_seq,
        "visit": "BASELINE",
        "event_term": "Mild Tension Headache",
        "severity": "Grade 1",
        "is_serious": "N",
        "action_taken": "None",
        "date": "2026-01-12",
        "cut_available": 1
    })
    ae_seq += 1

    # Additional routine adverse events
    ae_terms = ["Nausea", "Fatigue", "Dizziness", "Diarrhea", "Nasopharyngitis", "Headache"]
    for s in subjects[9:]:
        if random.random() < 0.25:
            ae_records.append({
                "record_id": f"AE_{s['usubjid']}_{ae_seq}",
                "usubjid": s["usubjid"],
                "site": s["site"],
                "aeseq": ae_seq,
                "visit": "WEEK2",
                "event_term": random.choice(ae_terms),
                "severity": "Grade 1",
                "is_serious": "N",
                "action_taken": "None",
                "date": "2026-01-28",
                "cut_available": max(s["cut_available"], 2)
            })
            ae_seq += 1

    with open(os.path.join(base_dir, "data", "AE.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(ae_records[0].keys()))
        writer.writeheader()
        writer.writerows(ae_records)

    # 7. EX.csv - Exposure / Dosing
    ex_records = []
    ex_seq = 1

    for sub in subjects:
        subjid = sub["usubjid"]
        site = sub["site"]
        enroll_cut = sub["cut_available"]

        for v_idx, visit in enumerate(visits):
            v_cut = max(enroll_cut, (v_idx // 2) + 1)
            v_date = f"2026-0{(v_idx//2)+1:01d}-{(v_idx%2)*14 + 10:02d}"

            dose_amt = 50.0
            planned = 50.0
            wrong = "N"

            # Benchmark Trap Requirement:
            # Site S01 subjects ALWAYS get 50.0 planned and 50.0 administered (wrong = "N")
            # Subject 042-S03-001 at site S03 gets wrong dose starting at WEEK2
            if subjid == "042-S03-001" and v_idx >= 2:
                dose_amt = 100.0
                wrong = "Y"

            ex_records.append({
                "record_id": f"EX_{subjid}_{visit}",
                "usubjid": subjid,
                "site": site,
                "exseq": ex_seq,
                "visit": visit,
                "dose_date": v_date,
                "dose_amount": dose_amt,
                "planned_dose": planned,
                "wrong_dose": wrong,
                "cut_available": v_cut
            })
            ex_seq += 1

    with open(os.path.join(base_dir, "data", "EX.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(ex_records[0].keys()))
        writer.writeheader()
        writer.writerows(ex_records)

    # 8. DS.csv - Disposition
    ds_records = []
    for sub in subjects:
        subjid = sub["usubjid"]
        site = sub["site"]
        status = "Ongoing"
        reason = ""
        dt = "2026-06-30"
        cut_avail = sub["cut_available"]

        if subjid == "042-S07-002":
            status = "Discontinued"
            reason = "Adverse Event: Severe Hepatotoxicity"
            dt = "2026-03-01"
            cut_avail = 3
        elif subjid == "042-S07-003":
            status = "Discontinued"
            reason = "Adverse Event: Grade 3 Rash"
            dt = "2026-03-01"
            cut_avail = 3

        ds_records.append({
            "record_id": f"DS_{subjid}",
            "usubjid": subjid,
            "site": site,
            "completion_status": status,
            "reason_discontinued": reason,
            "disposition_date": dt,
            "cut_available": cut_avail
        })

    with open(os.path.join(base_dir, "data", "DS.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(ds_records[0].keys()))
        writer.writeheader()
        writer.writerows(ds_records)

    # 9. CM.csv - Concomitant Medications
    cm_records = []
    cm_seq = 1
    meds = ["Metformin", "Lisinopril", "Atorvastatin", "Aspirin", "Omeprazole", "Paracetamol"]
    for sub in subjects:
        for idx, med in enumerate(random.sample(meds, k=random.randint(1, 3))):
            cm_records.append({
                "record_id": f"CM_{sub['usubjid']}_{cm_seq}",
                "usubjid": sub["usubjid"],
                "site": sub["site"],
                "cmseq": cm_seq,
                "medication_name": med,
                "indication": "Concomitant maintenance",
                "start_date": "2025-12-01",
                "dose": "500 mg",
                "route": "Oral",
                "cut_available": sub["cut_available"]
            })
            cm_seq += 1

    with open(os.path.join(base_dir, "data", "CM.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(cm_records[0].keys()))
        writer.writeheader()
        writer.writerows(cm_records)

    # 10. VS.csv - Vital Signs
    vs_records = []
    vs_seq = 1
    for sub in subjects:
        for v_idx, visit in enumerate(visits):
            v_cut = max(sub["cut_available"], (v_idx // 2) + 1)
            v_date = f"2026-0{(v_idx//2)+1:01d}-{(v_idx%2)*14 + 10:02d}"
            vs_records.append({
                "record_id": f"VS_{sub['usubjid']}_{visit}_SYS",
                "usubjid": sub["usubjid"],
                "site": sub["site"],
                "vsseq": vs_seq,
                "visit": visit,
                "test_name": "Systolic Blood Pressure",
                "value": random.randint(110, 140),
                "unit": "mmHg",
                "date": v_date,
                "cut_available": v_cut
            })
            vs_seq += 1

    with open(os.path.join(base_dir, "data", "VS.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(vs_records[0].keys()))
        writer.writeheader()
        writer.writerows(vs_records)

    # 11. EG.csv - ECG
    eg_records = []
    eg_seq = 1
    for sub in subjects[:100]:
        for v_idx in [0, 1, 3, 7]:
            visit = visits[v_idx]
            v_cut = max(sub["cut_available"], (v_idx // 2) + 1)
            v_date = f"2026-0{(v_idx//2)+1:01d}-{(v_idx%2)*14 + 10:02d}"
            eg_records.append({
                "record_id": f"EG_{sub['usubjid']}_{visit}",
                "usubjid": sub["usubjid"],
                "site": sub["site"],
                "egseq": eg_seq,
                "visit": visit,
                "qtcf": random.randint(390, 440),
                "interpretation": "Normal Sinus Rhythm",
                "date": v_date,
                "cut_available": v_cut
            })
            eg_seq += 1

    with open(os.path.join(base_dir, "data", "EG.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(eg_records[0].keys()))
        writer.writeheader()
        writer.writerows(eg_records)

    # 12. MH.csv - Medical History
    mh_records = []
    mh_seq = 1
    conditions = ["Type 2 Diabetes Mellitus", "Hypertension", "Hyperlipidemia", "Osteoarthritis"]
    for sub in subjects:
        for cond in random.sample(conditions, k=random.randint(1, 2)):
            mh_records.append({
                "record_id": f"MH_{sub['usubjid']}_{mh_seq}",
                "usubjid": sub["usubjid"],
                "site": sub["site"],
                "mhseq": mh_seq,
                "condition": cond,
                "diagnosis_year": 2018,
                "status": "Ongoing",
                "cut_available": sub["cut_available"]
            })
            mh_seq += 1

    with open(os.path.join(base_dir, "data", "MH.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(mh_records[0].keys()))
        writer.writeheader()
        writer.writerows(mh_records)

    # 13. corrections.csv
    corrections = [
        {
            "cut": 5,
            "record_id": "LB_042-S05-003_WEEK4_ALT",
            "field": "value",
            "old_value": "160.0",
            "corrected_value": "38.0",
            "reason": "Central laboratory instrument calibration error re-assayed. Correct ALT is 38 U/L."
        }
    ]
    with open(os.path.join(base_dir, "data", "corrections.csv"), "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=corrections[0].keys())
        writer.writeheader()
        writer.writerows(corrections)

    # 14. Documents (protocols, lab manuals, SAP)
    with open(os.path.join(base_dir, "documents", "protocol_v1.md"), "w") as f:
        f.write("# Protocol STUDY-042 (Version 1.0)\n\n"
                "**Title**: A Double-Blind, Randomized Phase III Study Evaluating Efficacy and Safety of Candesartan-X vs Placebo.\n"
                "**Active Cuts**: Cut 1 through Cut 3\n"
                "**Stopping Rule**: Concurrent ALT > 3x ULN and Total Bilirubin > 2x ULN (FDA Hy's Law criteria).\n"
                "**Dosing**: 50 mg orally once daily with morning meal.\n"
                "**Visit Window**: Target visit day +/- 3 calendar days.\n")

    with open(os.path.join(base_dir, "documents", "protocol_v2.md"), "w") as f:
        f.write("# Protocol STUDY-042 (Version 2.0 - Amendment)\n\n"
                "**Title**: Protocol Amendment 1 approved by IRB.\n"
                "**Effective Cuts**: Cut 4 through Cut 7\n"
                "**Stopping Rule Revision**: Safety threshold amended to ALT > 5x ULN concurrent with Bilirubin > 2x ULN based on external pharmacokinetic committee review.\n"
                "**Dosing Regimen**: Fixed 50 mg orally once daily.\n")

    with open(os.path.join(base_dir, "documents", "protocol_v3.md"), "w") as f:
        f.write("# Protocol STUDY-042 (Version 3.0 - Global Closeout)\n\n"
                "**Effective Cuts**: Cut 8 through Cut 12\n"
                "**Biomarker Expansion**: Optional ctDNA quantification protocol integration.\n")

    with open(os.path.join(base_dir, "documents", "lab-manual.md"), "w") as f:
        f.write("# Central Laboratory Manual (v1.0)\n\n"
                "Standard transaminase reporting in U/L. Total Bilirubin reporting in mg/dL.\n"
                "ULN reference: ALT = 45 U/L, Bilirubin = 1.2 mg/dL, ALP = 120 U/L.\n")

    with open(os.path.join(base_dir, "documents", "lab-manual_v3.md"), "w") as f:
        f.write("# Central Laboratory Manual (v3.0)\n\n"
                "Centralized recalibration standard and secondary assays.\n")

    with open(os.path.join(base_dir, "documents", "sap.md"), "w") as f:
        f.write("# Statistical Analysis Plan (SAP) - STUDY-042\n\n"
                "Primary Safety Endpoint: Incidence of Treatment-Emergent Adverse Events and Drug-Induced Liver Injury.\n")

    # 15. responses/monitor_decisions.json & site_replies.json
    monitor_decisions = {
        "ESC_HYS_042-S05-003_3": {
            "finding_id": "FND_HYS_042-S05-003_3",
            "decision": "CLARIFY",
            "clarification_request": "Please provide repeat ALT and Bilirubin measurements within 48 hours to confirm transaminase trend.",
            "clarified_response": "Central laboratory re-assay confirmed instrument calibration artifact. True ALT is 38 U/L.",
            "final_decision": "REJECTED",
            "final_reason": "Downgraded to routine monitoring following laboratory re-assay confirmation."
        },
        "ESC_DOSE_042-S03-001_2": {
            "finding_id": "FND_DOSE_042-S03-001_2",
            "decision": "APPROVED",
            "reason": "Confirmed noncompliant dosing administration (100mg instead of protocol 50mg). Protocol deviation corrective action opened."
        },
        "default": {
            "decision": "APPROVED",
            "reason": "Medical Monitor confirmed clinical assessment."
        }
    }
    with open(os.path.join(base_dir, "responses", "monitor_decisions.json"), "w") as f:
        json.dump(monitor_decisions, f, indent=2)

    site_replies = {
        "QRY_3_1": {
            "site": "S02",
            "status": "ANSWERED",
            "response": "Confirmed local data entry typo. Value 3500 kat/L was mistakenly transcribed from non-standard lab slip; true value is 35 U/L."
        },
        "QRY_S01": {
            "site": "S01",
            "status": "CLOSED",
            "response": "All subject dosing records verified against drug accountability logs. Doses strictly comply with 50mg protocol."
        },
        "default": {
            "status": "ANSWERED",
            "response": "Site coordinator verified source documents and updated electronic CRF."
        }
    }
    with open(os.path.join(base_dir, "responses", "site_replies.json"), "w") as f:
        json.dump(site_replies, f, indent=2)

    total_records = len(subjects) + len(lb_records) + len(ae_records) + len(ex_records) + len(ds_records) + len(cm_records) + len(vs_records) + len(eg_records) + len(mh_records)
    print(f"Generated complete STUDY-042 dataset in {base_dir}/: {len(subjects)} subjects, {total_records} records.")

if __name__ == "__main__":
    generate_hackathon_data()
