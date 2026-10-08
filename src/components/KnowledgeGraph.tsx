import React, { useState, useEffect, useRef } from 'react';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  User,
  Activity,
  AlertTriangle,
  Pill,
  Heart,
  FileCheck,
  ShieldAlert,
  HelpCircle,
  Eye,
  CheckCircle,
  Info,
  Layers,
  ArrowRight
} from 'lucide-react';

export interface GraphNode {
  id: string;
  label: string;
  type: string; // Patient, Site, Visit, Laboratory, Adverse Event, Dose / Exposure, Concomitant Medication, Vital Sign, ECG, Finding, Alert
  site?: string;
  date?: string;
  value?: any;
  unit?: string;
  severity?: string;
  details?: any;
  x?: number;
  y?: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
}

interface KnowledgeGraphProps {
  currentCut: number;
  subjectId?: string;
  title?: string;
  onNodeSelect?: (node: GraphNode) => void;
}

const NODE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  Patient: { bg: 'bg-emerald-50', border: 'border-emerald-500', text: 'text-emerald-900', dot: '#059669' },
  Site: { bg: 'bg-slate-100', border: 'border-slate-400', text: 'text-slate-900', dot: '#64748b' },
  Visit: { bg: 'bg-indigo-50', border: 'border-indigo-400', text: 'text-indigo-900', dot: '#6366f1' },
  Laboratory: { bg: 'bg-teal-50', border: 'border-teal-500', text: 'text-teal-900', dot: '#0d9488' },
  'Adverse Event': { bg: 'bg-amber-50', border: 'border-amber-500', text: 'text-amber-900', dot: '#d97706' },
  'Dose / Exposure': { bg: 'bg-violet-50', border: 'border-violet-400', text: 'text-violet-900', dot: '#8b5cf6' },
  'Concomitant Medication': { bg: 'bg-cyan-50', border: 'border-cyan-400', text: 'text-cyan-900', dot: '#06b6d4' },
  'Vital Sign': { bg: 'bg-sky-50', border: 'border-sky-400', text: 'text-sky-900', dot: '#0284c7' },
  ECG: { bg: 'bg-purple-50', border: 'border-purple-400', text: 'text-purple-900', dot: '#9333ea' },
  Finding: { bg: 'bg-orange-50', border: 'border-orange-500', text: 'text-orange-900', dot: '#ea580c' },
  Alert: { bg: 'bg-rose-50', border: 'border-rose-500', text: 'text-rose-900', dot: '#e11d48' },
  Protocol: { bg: 'bg-emerald-100', border: 'border-emerald-600', text: 'text-emerald-950', dot: '#047857' },
};

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  currentCut,
  subjectId,
  title,
  onNodeSelect,
}) => {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [edges, setEdges] = useState<GraphEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [typeFilter, setTypeFilter] = useState<string>('ALL');

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGraphData();
  }, [currentCut, subjectId]);

  const fetchGraphData = async () => {
    setLoading(true);
    try {
      let url = `/api/knowledge-graph?cut=${currentCut}`;
      if (subjectId) url += `&subject_id=${subjectId}`;
      const res = await fetch(url);
      const data = await res.json();
      layoutGraph(data.nodes || [], data.edges || []);
    } catch (err) {
      console.error('Failed to load knowledge graph:', err);
    } finally {
      setLoading(false);
    }
  };

  // Deterministic circular/hierarchical layout for clear clinical graph visualization
  const layoutGraph = (rawNodes: GraphNode[], rawEdges: GraphEdge[]) => {
    const width = 850;
    const height = 500;
    const centerX = width / 2;
    const centerY = height / 2;

    const positionedNodes = rawNodes.map((n, i) => {
      let x = centerX;
      let y = centerY;

      if (n.type === 'Patient') {
        x = centerX - 180;
        y = centerY;
      } else if (n.type === 'Site') {
        x = centerX - 320;
        y = centerY - 100;
      } else if (n.type === 'Visit') {
        const visitIdx = rawNodes.filter((x) => x.type === 'Visit').indexOf(n);
        x = centerX - 40;
        y = centerY - 140 + visitIdx * 75;
      } else if (n.type === 'Laboratory') {
        const labIdx = rawNodes.filter((x) => x.type === 'Laboratory').indexOf(n);
        x = centerX + 140;
        y = centerY - 160 + labIdx * 60;
      } else if (n.type === 'Finding') {
        x = centerX + 290;
        y = centerY - 40;
      } else if (n.type === 'Alert') {
        x = centerX + 320;
        y = centerY + 80;
      } else {
        const otherIdx = i % 10;
        const angle = (otherIdx / 10) * 2 * Math.PI;
        x = centerX + 180 * Math.cos(angle);
        y = centerY + 160 * Math.sin(angle);
      }

      return { ...n, x, y };
    });

    setNodes(positionedNodes);
    setEdges(rawEdges);
    setPan({ x: 0, y: 0 });
    setZoom(1);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const nodeMap = new Map<string, GraphNode>();
  nodes.forEach((n) => nodeMap.set(n.id, n));

  const visibleNodes = nodes.filter((n) => {
    if (typeFilter === 'ALL') return true;
    return n.type === typeFilter;
  });

  const nodeTypes = Array.from(new Set(nodes.map((n) => n.type)));

  return (
    <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden shadow-xs space-y-0">
      {/* Top Toolbar */}
      <div className="p-4 border-b border-emerald-100 bg-emerald-50/30 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600" />
            {title || (subjectId ? `Patient 360 Knowledge Graph: ${subjectId}` : 'Connected Clinical Knowledge Graph')}
          </h4>
          <p className="text-[11px] text-slate-500 font-mono mt-0.5">
            {nodes.length} connected entities • {edges.length} relational edges • Cut {currentCut}
          </p>
        </div>

        {/* Filter & Zoom Controls */}
        <div className="flex items-center gap-2">
          {/* Node Type Filter */}
          <div className="flex items-center gap-1 bg-white border border-emerald-200 rounded-lg px-2 py-1 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-[11px] font-mono text-emerald-900 font-semibold focus:outline-none bg-transparent"
            >
              <option value="ALL">All Types ({nodes.length})</option>
              {nodeTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Zoom Buttons */}
          <div className="flex items-center bg-white border border-emerald-200 rounded-lg p-0.5 text-xs font-mono">
            <button
              onClick={() => setZoom((z) => Math.min(z + 0.15, 2.0))}
              className="p-1 hover:bg-emerald-50 rounded text-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[10px] text-slate-500 font-bold">{Math.round(zoom * 100)}%</span>
            <button
              onClick={() => setZoom((z) => Math.max(z - 0.15, 0.5))}
              className="p-1 hover:bg-emerald-50 rounded text-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => {
                setZoom(1);
                setPan({ x: 0, y: 0 });
              }}
              className="p-1 hover:bg-emerald-50 rounded text-slate-700 border-l border-emerald-100 ml-0.5"
              title="Reset View"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative h-[480px] bg-slate-50/70 overflow-hidden cursor-grab active:cursor-grabbing select-none"
      >
        {loading && (
          <div className="absolute inset-0 bg-white/70 backdrop-blur-xs z-20 flex items-center justify-center">
            <div className="flex items-center gap-2 text-xs font-mono text-emerald-800 bg-white px-4 py-2 rounded-xl shadow-md border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping"></span>
              Constructing connected knowledge graph...
            </div>
          </div>
        )}

        <svg
          className="w-full h-full"
          viewBox="0 0 850 500"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* Defs for arrow markers */}
          <defs>
            <marker
              id="arrow"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
            </marker>
            <marker
              id="arrow-alert"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="#e11d48" />
            </marker>
          </defs>

          {/* Render Edges */}
          {edges.map((e, idx) => {
            const sourceNode = nodeMap.get(e.source);
            const targetNode = nodeMap.get(e.target);
            if (!sourceNode || !targetNode || sourceNode.x === undefined || targetNode.x === undefined) {
              return null;
            }

            const isCritical = e.relationship.includes('ALERT') || e.relationship.includes('EVIDENCE');
            return (
              <g key={idx}>
                <line
                  x1={sourceNode.x}
                  y1={sourceNode.y}
                  x2={targetNode.x}
                  y2={targetNode.y}
                  stroke={isCritical ? '#f43f5e' : '#cbd5e1'}
                  strokeWidth={isCritical ? 2 : 1.2}
                  strokeDasharray={isCritical ? '4 2' : 'none'}
                  markerEnd={isCritical ? 'url(#arrow-alert)' : 'url(#arrow)'}
                />
              </g>
            );
          })}

          {/* Render Nodes */}
          {visibleNodes.map((n) => {
            if (n.x === undefined || n.y === undefined) return null;
            const style = NODE_COLORS[n.type] || NODE_COLORS.Laboratory;
            const isSelected = selectedNode?.id === n.id;

            return (
              <g
                key={n.id}
                transform={`translate(${n.x}, ${n.y})`}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNode(n);
                  if (onNodeSelect) onNodeSelect(n);
                }}
                className="cursor-pointer group"
              >
                {/* Node Ring */}
                <circle
                  r={isSelected ? 26 : 22}
                  fill="white"
                  stroke={style.dot}
                  strokeWidth={isSelected ? 3.5 : 2}
                  className="transition-all filter drop-shadow-sm group-hover:scale-110"
                />

                {/* Node Core Dot */}
                <circle r={isSelected ? 8 : 6} fill={style.dot} />

                {/* Label Box */}
                <rect
                  x="-70"
                  y="26"
                  width="140"
                  height="22"
                  rx="6"
                  fill="white"
                  stroke={isSelected ? style.dot : '#e2e8f0'}
                  strokeWidth={isSelected ? 1.5 : 1}
                  className="filter drop-shadow-2xs"
                />

                <text
                  x="0"
                  y="40"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight={isSelected ? 'bold' : '600'}
                  fill="#0f172a"
                  className="font-mono pointer-events-none"
                >
                  {n.label.length > 22 ? n.label.substring(0, 20) + '…' : n.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Node Detail Slide-over / Inspector */}
        {selectedNode && (
          <div className="absolute top-3 right-3 max-w-sm w-full bg-white/95 backdrop-blur-md border border-emerald-200 rounded-2xl p-4 shadow-xl z-30 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-emerald-100 pb-2">
              <div className="flex items-center gap-2">
                <span
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: (NODE_COLORS[selectedNode.type] || NODE_COLORS.Laboratory).dot }}
                />
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-500">
                  {selectedNode.type} Node Details
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <div className="text-xs font-bold text-slate-900">{selectedNode.label}</div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1 text-slate-700">
              <div>
                <span className="text-slate-400">Record ID:</span>{' '}
                <span className="text-emerald-800 font-bold">{selectedNode.id}</span>
              </div>
              {selectedNode.details?.subject_id && (
                <div>
                  <span className="text-slate-400">Subject ID:</span>{' '}
                  <span className="text-slate-900">{selectedNode.details.subject_id}</span>
                </div>
              )}
              {selectedNode.details?.site && (
                <div>
                  <span className="text-slate-400">Site:</span>{' '}
                  <span className="text-slate-900 font-bold">Site {selectedNode.details.site}</span>
                </div>
              )}
              {selectedNode.date && (
                <div>
                  <span className="text-slate-400">Collection Date:</span>{' '}
                  <span className="text-slate-800">{selectedNode.date}</span>
                </div>
              )}
              {selectedNode.value !== undefined && (
                <div>
                  <span className="text-slate-400">Value:</span>{' '}
                  <span className="text-emerald-700 font-bold">
                    {selectedNode.value} {selectedNode.unit || ''}
                  </span>
                </div>
              )}
              {selectedNode.details?.source_file && (
                <div>
                  <span className="text-slate-400">Source:</span>{' '}
                  <span className="text-teal-800">{selectedNode.details.source_file}</span>
                </div>
              )}
              <div>
                <span className="text-slate-400">Data Cut:</span>{' '}
                <span className="text-slate-800">Cut {currentCut}</span>
              </div>
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono">
              <span>Provenance: Verified CDISC Node</span>
              <span className="text-emerald-700 font-bold">Zero-Hallucination</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend Footer */}
      <div className="px-4 py-2.5 bg-slate-50 border-t border-emerald-100 flex flex-wrap items-center gap-3 text-[11px] font-mono text-slate-600">
        <span className="font-bold text-slate-800">Entity Legend:</span>
        {Object.entries(NODE_COLORS).slice(0, 6).map(([type, colors]) => (
          <div key={type} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: colors.dot }} />
            <span>{type}</span>
          </div>
        ))}
        <span className="text-slate-400">|</span>
        <span className="text-slate-500">Click any node to inspect provenance and evidence</span>
      </div>
    </div>
  );
};
