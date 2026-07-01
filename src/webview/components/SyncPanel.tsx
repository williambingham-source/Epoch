import React from 'react';
import type { RemoteInfo, SyncResult } from '../types.js';

interface Props {
  remoteInfo: RemoteInfo | null;
  syncing: boolean;
  lastResult: SyncResult | null;
  lastAction: 'push' | 'pull' | null;
  lastSyncTime: Date | null;
  onPush: () => void;
  onPull: () => void;
  onRefresh: () => void;
  onOpenExternal: (url: string) => void;
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function SyncPanel({
  remoteInfo,
  syncing,
  lastResult,
  lastAction,
  lastSyncTime,
  onPush,
  onPull,
  onRefresh,
  onOpenExternal,
}: Props) {
  if (!remoteInfo) {
    return (
      <div className="epoch-sync-bar">
        <span className="sync-loading">⟳ Checking remote…</span>
      </div>
    );
  }

  if (!remoteInfo.hasRemote) {
    return (
      <div className="epoch-sync-bar">
        <span className="sync-branch">⎇ {remoteInfo.branch}</span>
        <span className="sync-sep" />
        <span className="sync-no-remote">No remote configured</span>
        <button className="btn sync-btn icon secondary" onClick={onRefresh} title="Refresh">
          ↺
        </button>
      </div>
    );
  }

  const { branch, ahead, behind, displayUrl, browseUrl } = remoteInfo;
  const isPushing = syncing && lastAction === 'push';
  const isPulling = syncing && lastAction === 'pull';

  const deltaLabel = (() => {
    if (ahead > 0 && behind > 0) return `↑${ahead} ↓${behind}`;
    if (ahead > 0) return `↑${ahead}`;
    if (behind > 0) return `↓${behind}`;
    return '✓';
  })();

  const deltaClass = ahead > 0 || behind > 0 ? 'sync-delta-dirty' : 'sync-delta-clean';

  return (
    <div className="epoch-sync-bar">
      {/* Branch */}
      <span className="sync-branch" title={`Current branch: ${branch}`}>
        ⎇ {branch}
      </span>

      {/* Ahead / behind indicator */}
      <span className={`sync-delta ${deltaClass}`} title={
        ahead > 0 && behind > 0
          ? `${ahead} commit(s) ahead, ${behind} behind remote`
          : ahead > 0
          ? `${ahead} commit(s) ahead of remote — push to sync`
          : behind > 0
          ? `${behind} commit(s) behind remote — pull to sync`
          : 'In sync with remote'
      }>
        {deltaLabel}
      </span>

      <span className="sync-sep" />

      {/* Remote URL — clickable to open in browser */}
      {displayUrl && browseUrl && (
        <button
          className="sync-url-btn"
          onClick={() => onOpenExternal(browseUrl)}
          title={`Open ${browseUrl} in browser`}
        >
          {displayUrl}
        </button>
      )}

      {/* Push */}
      <button
        className="btn sync-btn"
        onClick={onPush}
        disabled={syncing}
        title="Commit any unsaved changes and push to remote"
      >
        {isPushing ? '…' : '↑ Push'}
      </button>

      {/* Pull */}
      <button
        className="btn sync-btn secondary"
        onClick={onPull}
        disabled={syncing}
        title="Pull latest commits from remote"
      >
        {isPulling ? '…' : '↓ Pull'}
      </button>

      {/* Refresh */}
      <button
        className="btn sync-btn icon secondary"
        onClick={onRefresh}
        disabled={syncing}
        title="Refresh sync status"
      >
        ↺
      </button>

      {/* Last result */}
      {lastResult && (
        <>
          <span className="sync-sep" />
          <span
            className={`sync-result ${lastResult.success ? 'success' : 'error'}`}
            title={lastResult.details ?? lastResult.message}
          >
            {lastResult.success ? '✓' : '✗'} {lastResult.message}
            {lastSyncTime && (
              <span className="sync-time"> · {timeAgo(lastSyncTime)}</span>
            )}
          </span>
        </>
      )}

      {/* Show last commit when idle */}
      {!lastResult && remoteInfo.lastCommit && (
        <>
          <span className="sync-sep" />
          <span className="sync-last-commit" title={remoteInfo.lastCommit}>
            {remoteInfo.lastCommit}
          </span>
        </>
      )}
    </div>
  );
}
