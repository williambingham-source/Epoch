import React, { useRef, useState } from 'react';
import type { NodeEntry } from '../types.js';

const NODE_W = 180;
const NODE_H = 76;
const LAYER_H = 130;
const H_GAP = 20;
const PAD = 40;

const STATUS_COLOR: Record<string, string> = {
  Sketch:     'var(--vscode-descriptionForeground, #a6adc8)',
  Conjecture: '#89b4fa',
  Hypothesis: '#f9e2af',
  Theorem:    '#a6e3a1',
};

interface NodeLayout {
  path: string;
  title: string;
  status: string;
  x: number;
  y: number;
  deps: string[];
}

function computeLayout(nodes: NodeEntry[]): {
  layouts: NodeLayout[];
  canvasW: number;
  canvasH: number;
} {
  const nodeMap = new Map(nodes.map((n) => [n.path, n]));

  const layers = new Map<string, number>();
  for (const n of nodes) layers.set(n.path, 0);

  let changed = true;
  while (changed) {
    changed = false;
    for (const n of nodes) {
      for (const dep of n.node.validationPath) {
        if (!nodeMap.has(dep.nodePath)) continue;
        const depLayer = layers.get(dep.nodePath) ?? 0;
        const cur = layers.get(n.path) ?? 0;
        if (depLayer + 1 > cur) {
          layers.set(n.path, depLayer + 1);
          changed = true;
        }
      }
    }
  }

  const maxLayer = layers.size > 0 ? Math.max(...layers.values()) : 0;

  const byLayer = new Map<number, string[]>();
  for (const [p, l] of layers) {
    if (!byLayer.has(l)) byLayer.set(l, []);
    byLayer.get(l)!.push(p);
  }

  const maxRowNodes = Math.max(...[...byLayer.values()].map((ps) => ps.length), 1);
  const canvasW = Math.max(500, maxRowNodes * (NODE_W + H_GAP) - H_GAP + 2 * PAD);
  const canvasH = PAD + maxLayer * LAYER_H + NODE_H + PAD;

  const layouts: NodeLayout[] = [];
  for (const [layer, paths] of byLayer) {
    const rowW = paths.length * (NODE_W + H_GAP) - H_GAP;
    const startX = (canvasW - rowW) / 2;
    paths.forEach((p, i) => {
      const entry = nodeMap.get(p)!;
      layouts.push({
        path: p,
        title: entry.node.title,
        status: entry.node.status,
        x: startX + i * (NODE_W + H_GAP),
        y: PAD + (maxLayer - layer) * LAYER_H,
        deps: entry.node.validationPath
          .filter((d) => nodeMap.has(d.nodePath))
          .map((d) => d.nodePath),
      });
    });
  }

  return { layouts, canvasW, canvasH };
}

function truncate(s: string, max: number) {
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

interface Props {
  nodes: NodeEntry[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
}

export function DagCanvas({ nodes, selectedPath, onSelect }: Props) {
  const { layouts, canvasW, canvasH } = computeLayout(nodes);
  const posMap = new Map(layouts.map((n) => [n.path, n]));

  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    dragRef.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    setPan({
      x: dragRef.current.panX + e.clientX - dragRef.current.startX,
      y: dragRef.current.panY + e.clientY - dragRef.current.startY,
    });
  };
  const onMouseUp = () => { dragRef.current = null; };

  if (nodes.length === 0) {
    return (
      <div className="muted" style={{ padding: 32, textAlign: 'center' }}>
        No nodes in workspace
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
      <svg
        width={canvasW}
        height={canvasH}
        style={{ display: 'block', userSelect: 'none', cursor: dragRef.current ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <defs>
          <marker id="dag-vs-arrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <polygon points="0 0, 7 3.5, 0 7" fill="var(--vscode-input-border, #45475a)" />
          </marker>
          {layouts.map((n) => (
            <clipPath key={n.path} id={`dag-vs-clip-${n.path.replace(/[^a-zA-Z0-9]/g, '_')}`}>
              <rect x={NODE_W - 60} y={8} width={52} height={NODE_H - 16} rx={3} />
            </clipPath>
          ))}
        </defs>

        <g transform={`translate(${pan.x},${pan.y})`}>
          {/* Edges */}
          {layouts.flatMap((src) =>
            src.deps.map((depPath) => {
              const dep = posMap.get(depPath);
              if (!dep) return null;
              const sx = src.x + NODE_W / 2;
              const sy = src.y + NODE_H;
              const tx = dep.x + NODE_W / 2;
              const ty = dep.y;
              const cpDy = Math.abs(ty - sy) * 0.45;
              return (
                <path
                  key={`${src.path}->${depPath}`}
                  d={`M ${sx} ${sy} C ${sx} ${sy + cpDy} ${tx} ${ty - cpDy} ${tx} ${ty}`}
                  fill="none"
                  stroke="var(--vscode-input-border, #45475a)"
                  strokeWidth={1.5}
                  markerEnd="url(#dag-vs-arrow)"
                />
              );
            })
          )}

          {/* Nodes */}
          {layouts.map((n) => {
            const isSelected = n.path === selectedPath;
            const color = STATUS_COLOR[n.status] ?? '#888';

            return (
              <g
                key={n.path}
                transform={`translate(${n.x},${n.y})`}
                onClick={() => onSelect(n.path)}
                style={{ cursor: 'pointer' }}
              >
                {isSelected && (
                  <rect
                    x={-2} y={-2}
                    width={NODE_W + 4} height={NODE_H + 4}
                    rx={6}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={0.5}
                  />
                )}
                <rect
                  width={NODE_W}
                  height={NODE_H}
                  rx={4}
                  fill="var(--vscode-sideBar-background, #181825)"
                  stroke={isSelected ? color : 'var(--vscode-input-border, #45475a)'}
                  strokeWidth={isSelected ? 1.5 : 1}
                />
                <rect width={4} height={NODE_H} rx={2} fill={color} />
                <text
                  x={12} y={24}
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--vscode-foreground, #cdd6f4)"
                  style={{ pointerEvents: 'none' }}
                >
                  {truncate(n.title, 20)}
                </text>
                <text x={12} y={42} fontSize={10} fill={color} style={{ pointerEvents: 'none' }}>
                  {n.status}
                </text>
                <text
                  x={12} y={60}
                  fontSize={9}
                  fill="var(--vscode-descriptionForeground, #6c7086)"
                  style={{ pointerEvents: 'none' }}
                >
                  {truncate(n.path, 22)}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
