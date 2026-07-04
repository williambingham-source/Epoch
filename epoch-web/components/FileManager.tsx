'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  listFiles, readFsFile, uploadFile, createFsFile, createFsDir,
  deleteFsEntry, renameFsEntry,
} from '@/lib/api';
import type { FsEntry } from '@/lib/api';

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

function fileIcon(name: string, isDir: boolean): string {
  if (isDir) return '📁';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) return '🖼';
  if (['tex', 'sty', 'cls', 'bib'].includes(ext)) return '📝';
  if (ext === 'json') return '{}';
  if (ext === 'pdf') return '📋';
  return '📄';
}

// ---------------------------------------------------------------------------
// Tree node
// ---------------------------------------------------------------------------

interface TreeNodeProps {
  entry: FsEntry;
  depth: number;
  expanded: Set<string>;
  contents: Map<string, FsEntry[]>;
  selected: string | null;
  renamingPath: string | null;
  renameValue: string;
  onToggle: (path: string) => void;
  onSelect: (entry: FsEntry) => void;
  onStartRename: (path: string, currentName: string) => void;
  onSetRenameValue: (v: string) => void;
  onCommitRename: (entry: FsEntry) => void;
  onCancelRename: () => void;
  onDelete: (entry: FsEntry) => void;
  onCreateIn: (dir: string, type: 'file' | 'dir') => void;
  onUploadIn: (dir: string) => void;
}

function TreeNode({
  entry, depth, expanded, contents, selected,
  renamingPath, renameValue,
  onToggle, onSelect, onStartRename, onSetRenameValue, onCommitRename, onCancelRename,
  onDelete, onCreateIn, onUploadIn,
}: TreeNodeProps) {
  const isExpanded = expanded.has(entry.path);
  const isSelected = selected === entry.path;
  const isRenaming = renamingPath === entry.path;
  const children = contents.get(entry.path);

  return (
    <div>
      <div
        className={`fs-entry${isSelected ? ' selected' : ''}`}
        style={{ paddingLeft: 10 + depth * 16 }}
        onClick={() => {
          if (isRenaming) return;
          if (entry.isDir) onToggle(entry.path);
          onSelect(entry);
        }}
      >
        <span className="fs-icon" onClick={(e) => { if (entry.isDir) { e.stopPropagation(); onToggle(entry.path); } }}>
          {entry.isDir ? (isExpanded ? '▾' : '▸') : ' '}
        </span>
        <span className="fs-file-icon">{fileIcon(entry.name, entry.isDir)}</span>

        {isRenaming ? (
          <input
            autoFocus
            className="fs-rename-input"
            value={renameValue}
            onChange={(e) => onSetRenameValue(e.target.value)}
            onBlur={() => onCommitRename(entry)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { e.preventDefault(); onCommitRename(entry); }
              if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="fs-name">{entry.name}</span>
        )}

        {!isRenaming && (
          <div className="fs-actions">
            {entry.isDir && (
              <>
                <button title="New file" onClick={(e) => { e.stopPropagation(); onCreateIn(entry.path, 'file'); }}>+f</button>
                <button title="New folder" onClick={(e) => { e.stopPropagation(); onCreateIn(entry.path, 'dir'); }}>+d</button>
                <button title="Upload" onClick={(e) => { e.stopPropagation(); onUploadIn(entry.path); }}>↑</button>
              </>
            )}
            <button title="Rename" onClick={(e) => { e.stopPropagation(); onStartRename(entry.path, entry.name); }}>✎</button>
            <button title="Delete" className="fs-delete-btn" onClick={(e) => { e.stopPropagation(); onDelete(entry); }}>✕</button>
          </div>
        )}
      </div>

      {entry.isDir && isExpanded && children && children.map((child) => (
        <TreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          expanded={expanded}
          contents={contents}
          selected={selected}
          renamingPath={renamingPath}
          renameValue={renameValue}
          onToggle={onToggle}
          onSelect={onSelect}
          onStartRename={onStartRename}
          onSetRenameValue={onSetRenameValue}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onDelete={onDelete}
          onCreateIn={onCreateIn}
          onUploadIn={onUploadIn}
        />
      ))}

      {entry.isDir && isExpanded && !children && (
        <div style={{ paddingLeft: 26 + depth * 16, fontSize: 11, color: 'var(--text-muted)', opacity: 0.5 }}>
          loading…
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create prompt (inline mini-form)
// ---------------------------------------------------------------------------

interface CreatePromptProps {
  dir: string;
  type: 'file' | 'dir';
  onCreate: (dir: string, name: string, type: 'file' | 'dir') => Promise<void>;
  onCancel: () => void;
}

function CreatePrompt({ dir, type, onCreate, onCancel }: CreatePromptProps) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { onCancel(); return; }
    setBusy(true);
    await onCreate(dir, name.trim(), type);
    setBusy(false);
  }

  return (
    <form className="create-prompt" onSubmit={submit}>
      <span className="create-prompt-label">{type === 'file' ? '📄' : '📁'}</span>
      <input
        autoFocus
        className="create-prompt-input"
        placeholder={type === 'file' ? 'filename.tex' : 'folder-name'}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && onCancel()}
        disabled={busy}
      />
      <button type="submit" disabled={busy || !name.trim()}>✓</button>
      <button type="button" onClick={onCancel}>✕</button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// File preview
// ---------------------------------------------------------------------------

interface PreviewProps {
  path: string;
}

function FilePreview({ path }: PreviewProps) {
  const [content, setContent] = useState<string | null>(null);
  const [encoding, setEncoding] = useState<'utf-8' | 'base64'>('utf-8');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setContent(null);
    setError(null);
    readFsFile(path)
      .then((r) => { setContent(r.content); setEncoding(r.encoding); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [path]);

  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext);

  if (loading) return <div className="preview-state">Loading…</div>;
  if (error) return <div className="preview-state preview-error">{error}</div>;

  if (isImage && encoding === 'base64') {
    const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
    return (
      <div className="preview-image-wrap">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`data:${mime};base64,${content}`} alt={path} className="preview-image" />
      </div>
    );
  }

  return (
    <textarea
      className="preview-text"
      readOnly
      value={content ?? ''}
      spellCheck={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Main FileManager
// ---------------------------------------------------------------------------

export default function FileManager() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(['']));
  const [contents, setContents] = useState<Map<string, FsEntry[]>>(new Map());
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);

  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameLock = useRef(false);

  const [creating, setCreating] = useState<{ dir: string; type: 'file' | 'dir' } | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<FsEntry | null>(null);

  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadDir = useRef<string>('');

  // Root toolbar "create" and "upload" target the selected dir (or root)
  const activeDir = selectedIsDir ? (selected ?? '') : (selected ? parentOf(selected) : '');

  // Fetch directory contents
  const fetchDir = useCallback(async (dir: string) => {
    try {
      const entries = await listFiles(dir);
      setContents((prev) => new Map(prev).set(dir, entries));
    } catch { /* ignore */ }
  }, []);

  // Load root on mount
  useEffect(() => {
    fetchDir('');
  }, [fetchDir]);

  // Fetch a dir when it becomes expanded
  async function toggleDir(dirPath: string) {
    const next = new Set(expanded);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
      if (!contents.has(dirPath)) {
        await fetchDir(dirPath);
      }
    }
    setExpanded(next);
  }

  function handleSelect(entry: FsEntry) {
    setSelected(entry.path);
    setSelectedIsDir(entry.isDir);
  }

  // Rename
  function startRename(path: string, currentName: string) {
    renameLock.current = false;
    setRenamingPath(path);
    setRenameValue(currentName);
  }

  async function commitRename(entry: FsEntry) {
    if (renameLock.current) return;
    renameLock.current = true;
    const trimmed = renameValue.trim();
    setRenamingPath(null);
    if (!trimmed || trimmed === entry.name) return;
    const parent = parentOf(entry.path);
    const toPath = parent ? `${parent}/${trimmed}` : trimmed;
    try {
      await renameFsEntry(entry.path, toPath);
      const parentDir = parentOf(entry.path);
      await fetchDir(parentDir);
      if (selected === entry.path) { setSelected(toPath); }
    } catch { /* silent */ }
  }

  function cancelRename() {
    renameLock.current = false;
    setRenamingPath(null);
    setRenameValue('');
  }

  // Delete
  async function handleDelete(entry: FsEntry) {
    setDeleteConfirm(null);
    try {
      await deleteFsEntry(entry.path);
      const parentDir = parentOf(entry.path);
      await fetchDir(parentDir);
      if (selected === entry.path || selected?.startsWith(entry.path + '/')) {
        setSelected(null);
      }
    } catch { /* silent */ }
  }

  // Create
  async function handleCreate(dir: string, name: string, type: 'file' | 'dir') {
    setCreating(null);
    const path = dir ? `${dir}/${name}` : name;
    try {
      if (type === 'file') {
        await createFsFile(path);
      } else {
        await createFsDir(path);
      }
      await fetchDir(dir);
      if (!expanded.has(dir)) {
        setExpanded((prev) => new Set(prev).add(dir));
      }
    } catch { /* silent */ }
  }

  // Upload
  async function handleUploadFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    const dir = uploadDir.current;
    for (const file of files) {
      try {
        await uploadFile(dir, file);
      } catch { /* silent */ }
    }
    await fetchDir(dir);
    if (!expanded.has(dir)) {
      setExpanded((prev) => new Set(prev).add(dir));
    }
  }

  function triggerUpload(dir: string) {
    uploadDir.current = dir;
    uploadRef.current?.click();
  }

  const rootEntries = contents.get('') ?? [];

  return (
    <div className="file-manager">
      {/* Toolbar */}
      <div className="fm-toolbar">
        <span className="fm-active-dir" title={activeDir || 'workspace root'}>
          {activeDir ? `/${activeDir}` : '/'}
        </span>
        <div className="fm-toolbar-actions">
          <button title="New file" onClick={() => setCreating({ dir: activeDir, type: 'file' })}>+ File</button>
          <button title="New folder" onClick={() => setCreating({ dir: activeDir, type: 'dir' })}>+ Folder</button>
          <button title="Upload files" onClick={() => triggerUpload(activeDir)}>↑ Upload</button>
        </div>
      </div>

      {/* Create prompt (shows when creating at root or via toolbar) */}
      {creating && (
        <CreatePrompt
          dir={creating.dir}
          type={creating.type}
          onCreate={handleCreate}
          onCancel={() => setCreating(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fm-confirm">
          Delete <strong>{deleteConfirm.name}</strong>?
          <button className="btn-danger" onClick={() => handleDelete(deleteConfirm)}>Delete</button>
          <button onClick={() => setDeleteConfirm(null)}>Cancel</button>
        </div>
      )}

      {/* File tree */}
      <div className="fm-tree">
        {rootEntries.length === 0 && !contents.has('') && (
          <div className="fm-empty">Loading workspace…</div>
        )}
        {rootEntries.map((entry) => (
          <TreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            expanded={expanded}
            contents={contents}
            selected={selected}
            renamingPath={renamingPath}
            renameValue={renameValue}
            onToggle={toggleDir}
            onSelect={handleSelect}
            onStartRename={startRename}
            onSetRenameValue={setRenameValue}
            onCommitRename={commitRename}
            onCancelRename={cancelRename}
            onDelete={(e) => setDeleteConfirm(e)}
            onCreateIn={(dir, type) => setCreating({ dir, type })}
            onUploadIn={triggerUpload}
          />
        ))}
      </div>

      {/* File preview */}
      {selected && !selectedIsDir && (
        <div className="fm-preview">
          <div className="fm-preview-title">{selected.split('/').pop()}</div>
          <FilePreview path={selected} />
        </div>
      )}

      {/* Hidden file input for uploads */}
      <input
        ref={uploadRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={handleUploadFiles}
      />

      <style>{`
        .file-manager {
          display: flex;
          flex-direction: column;
          flex: 1;
          overflow: hidden;
          font-size: 13px;
        }
        .fm-toolbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 5px 10px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
          gap: 8px;
        }
        .fm-active-dir {
          font-size: 11px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          flex: 1;
          min-width: 0;
          font-family: monospace;
        }
        .fm-toolbar-actions {
          display: flex;
          gap: 4px;
          flex-shrink: 0;
        }
        .fm-toolbar-actions button {
          font-size: 12px;
          padding: 3px 8px;
          background: var(--surface2);
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 4px;
        }
        .fm-toolbar-actions button:hover { background: var(--accent-dim); color: var(--text); }

        .fm-confirm {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--surface2);
          border-bottom: 1px solid var(--border);
          font-size: 12px;
          flex-shrink: 0;
        }
        .fm-confirm strong { color: var(--error); }
        .btn-danger {
          background: var(--error);
          color: #fff;
          font-size: 12px;
          padding: 2px 8px;
        }
        .btn-danger:hover { opacity: 0.85; }

        .create-prompt {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 5px 10px;
          border-bottom: 1px solid var(--border);
          background: var(--surface2);
          flex-shrink: 0;
        }
        .create-prompt-label { font-size: 14px; }
        .create-prompt-input {
          flex: 1;
          font-size: 12px;
          background: var(--surface);
          border: 1px solid var(--accent);
          border-radius: 3px;
          color: var(--text);
          padding: 2px 6px;
          font-family: monospace;
        }
        .create-prompt button { font-size: 12px; padding: 2px 6px; }

        .fm-tree {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
          min-height: 0;
        }
        .fm-empty {
          padding: 16px;
          color: var(--text-muted);
          text-align: center;
          font-size: 12px;
        }
        .fs-entry {
          display: flex;
          align-items: center;
          gap: 4px;
          padding-top: 3px;
          padding-bottom: 3px;
          padding-right: 6px;
          cursor: pointer;
          border-radius: 3px;
          margin: 1px 4px;
          min-height: 24px;
        }
        .fs-entry:hover { background: var(--surface2); }
        .fs-entry.selected { background: var(--surface2); outline: 1px solid var(--accent-dim); }
        .fs-icon {
          width: 14px;
          text-align: center;
          font-size: 10px;
          color: var(--text-muted);
          flex-shrink: 0;
          user-select: none;
        }
        .fs-file-icon { font-size: 13px; flex-shrink: 0; }
        .fs-name {
          flex: 1;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-family: monospace;
          font-size: 12px;
        }
        .fs-rename-input {
          flex: 1;
          font-size: 12px;
          font-family: monospace;
          background: var(--surface2);
          border: 1px solid var(--accent);
          border-radius: 3px;
          color: var(--text);
          padding: 1px 5px;
        }
        .fs-actions {
          display: none;
          align-items: center;
          gap: 2px;
          flex-shrink: 0;
        }
        .fs-entry:hover .fs-actions { display: flex; }
        .fs-actions button {
          font-size: 10px;
          padding: 1px 4px;
          background: var(--surface);
          color: var(--text-muted);
          border: 1px solid var(--border);
          border-radius: 3px;
          white-space: nowrap;
        }
        .fs-actions button:hover { background: var(--accent-dim); color: var(--text); }
        .fs-delete-btn:hover { background: rgba(224,108,117,0.15) !important; color: var(--error) !important; }

        .fm-preview {
          border-top: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          max-height: 40%;
          min-height: 120px;
          flex-shrink: 0;
        }
        .fm-preview-title {
          font-size: 11px;
          color: var(--text-muted);
          padding: 4px 10px;
          border-bottom: 1px solid var(--border);
          font-family: monospace;
          background: var(--surface);
          flex-shrink: 0;
        }
        .preview-state {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 12px;
        }
        .preview-error { color: var(--error); }
        .preview-text {
          flex: 1;
          resize: none;
          background: var(--surface2);
          border: none;
          color: var(--text);
          font-family: monospace;
          font-size: 11px;
          padding: 8px 12px;
          line-height: 1.5;
          min-height: 0;
        }
        .preview-text:focus { outline: none; }
        .preview-image-wrap {
          flex: 1;
          overflow: auto;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--surface2);
          padding: 8px;
        }
        .preview-image {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
        }
      `}</style>
    </div>
  );
}

function parentOf(p: string): string {
  const idx = p.lastIndexOf('/');
  return idx > 0 ? p.slice(0, idx) : '';
}
