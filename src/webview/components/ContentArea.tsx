import React from 'react';
import type { Manifest, NodeEntry, ResearchNode, ReviewRequest, ProjectStatus } from '../types.js';
import { NodeEditor } from './NodeEditor.js';
import { PdfViewer } from './PdfViewer.js';
import { ReviewView } from './ReviewView.js';

function WorkspaceHome({ manifest, nodeCount }: { manifest: Manifest; nodeCount: number }) {
  return (
    <div className="workspace-home">
      <h1>{manifest.name}</h1>
      {manifest.description && <p className="description">{manifest.description}</p>}
      <p className="muted">
        {nodeCount} {nodeCount === 1 ? 'node' : 'nodes'} &middot; created{' '}
        {new Date(manifest.createdAt).toLocaleDateString()}
      </p>
      <p className="muted" style={{ marginTop: 12 }}>
        Select a node from the sidebar to view or edit it, or add a new top-level node.
      </p>
    </div>
  );
}

export interface ContentAreaProps {
  manifest: Manifest;
  nodeCount: number;
  showReview: boolean;
  showPdf: boolean;
  showEditor: boolean;
  activeReview: ReviewRequest | null;
  pdfBase64: string | null;
  pdfFileName: string;
  currentPath: string | null;
  editingNode: ResearchNode | null;
  currentEntry: NodeEntry | null;
  allNodes: NodeEntry[];
  isDirty: boolean;
  nodeReview: ReviewRequest | null;
  onNodeChange: (node: ResearchNode) => void;
  onSave: () => void;
  onOpenFolder: (nodePath: string) => void;
  onRequestReview: (proposedStatus: ProjectStatus, comment: string) => void;
  onViewReview: (review: ReviewRequest) => void;
  onCompile: () => void;
  onSubmitDecision: (reviewId: string, verdict: 'approved' | 'rejected', comment: string) => void;
  onCloseReview: () => void;
}

export function ContentArea(p: ContentAreaProps) {
  if (p.showReview) {
    return (
      <ReviewView
        review={p.activeReview!}
        isSelf={false}
        onSubmitDecision={(verdict, comment) =>
          p.onSubmitDecision(p.activeReview!.id, verdict, comment)
        }
        onCompile={p.onCompile}
        onClose={p.onCloseReview}
      />
    );
  }

  if (p.showPdf) {
    return <PdfViewer base64={p.pdfBase64!} fileName={p.pdfFileName} />;
  }

  if (p.showEditor) {
    return (
      <NodeEditor
        nodePath={p.currentPath!}
        node={p.editingNode!}
        savedStatus={p.currentEntry?.node.status ?? p.editingNode!.status}
        allNodes={p.allNodes}
        isDirty={p.isDirty}
        nodeReview={p.nodeReview}
        onChange={p.onNodeChange}
        onSave={p.onSave}
        onOpenFolder={p.onOpenFolder}
        onRequestReview={p.onRequestReview}
        onViewReview={p.onViewReview}
      />
    );
  }

  return <WorkspaceHome manifest={p.manifest} nodeCount={p.nodeCount} />;
}
