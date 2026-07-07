'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';

interface ChatMsg {
  type: 'message' | 'join' | 'leave';
  user: string;
  text?: string;
  ts: number;
}

interface Props {
  workspaceName: string;
}

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPanel({ workspaceName }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = useSession() as { data: any };
  const username: string = session?.user?.login ?? session?.user?.name ?? 'anonymous';

  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!workspaceName || typeof window === 'undefined') return;
    const url = `ws://${window.location.hostname}:3002/chat?workspace=${encodeURIComponent(workspaceName)}&user=${encodeURIComponent(username)}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as ChatMsg;
        setMessages((prev) => [...prev.slice(-499), msg]);
      } catch { /* ignore malformed */ }
    };

    return () => { ws.close(); wsRef.current = null; };
  }, [workspaceName, username]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(text);
    setInput('');
  }, [input]);

  const handleKey = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }, [send]);

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h13A1.5 1.5 0 0 1 18 4.5v8A1.5 1.5 0 0 1 16.5 14H11l-3 3v-3H3.5A1.5 1.5 0 0 1 2 12.5v-8z"/>
        </svg>
        <span className="chat-title">Chat</span>
        <span className={`chat-dot${connected ? ' connected' : ''}`} title={connected ? 'Connected' : 'Disconnected'} />
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-empty">No messages yet</div>
        )}
        {messages.map((m, i) => {
          if (m.type === 'join' || m.type === 'leave') {
            return (
              <div key={i} className="chat-system">
                {m.user} {m.type === 'join' ? 'joined' : 'left'} · {fmt(m.ts)}
              </div>
            );
          }
          const isMine = m.user === username;
          return (
            <div key={i} className={`chat-msg${isMine ? ' mine' : ''}`}>
              <div className="chat-meta">
                <span className="chat-user">{isMine ? 'You' : m.user}</span>
                <span className="chat-time">{fmt(m.ts)}</span>
              </div>
              <div className="chat-bubble">{m.text}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder="Message…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          disabled={!connected}
        />
        <button className="chat-send" onClick={send} disabled={!connected || !input.trim()} title="Send (Enter)">
          <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
            <path d="M15.854.146a.5.5 0 0 1 .11.54l-5.819 14.547a.75.75 0 0 1-1.329.124l-3.178-4.995L.643 7.184a.75.75 0 0 1 .124-1.33L15.314.037a.5.5 0 0 1 .54.11z"/>
          </svg>
        </button>
      </div>

      <style>{`
        .chat-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          background: var(--surface);
          overflow: hidden;
        }
        .chat-header {
          display: flex;
          align-items: center;
          gap: 7px;
          padding: 8px 12px 7px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          color: var(--text-muted);
        }
        .chat-title {
          font-size: 12px;
          font-weight: 600;
          color: var(--text);
          letter-spacing: .02em;
          flex: 1;
        }
        .chat-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--error, #f38ba8);
          flex-shrink: 0;
          transition: background 0.2s;
        }
        .chat-dot.connected { background: var(--success, #a6e3a1); }
        .chat-messages {
          flex: 1;
          overflow-y: auto;
          padding: 8px 10px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 0;
        }
        .chat-empty {
          color: var(--text-muted);
          font-size: 12px;
          text-align: center;
          margin-top: 24px;
        }
        .chat-system {
          text-align: center;
          font-size: 10px;
          color: var(--text-muted);
          opacity: 0.7;
          padding: 2px 0;
        }
        .chat-msg { display: flex; flex-direction: column; gap: 2px; }
        .chat-meta { display: flex; align-items: baseline; gap: 6px; }
        .chat-user { font-size: 11px; font-weight: 600; color: var(--accent); }
        .chat-msg.mine .chat-user { color: var(--text-muted); }
        .chat-time { font-size: 10px; color: var(--text-muted); opacity: 0.6; }
        .chat-bubble {
          font-size: 12px;
          color: var(--text);
          line-height: 1.45;
          word-break: break-word;
          white-space: pre-wrap;
          background: var(--surface2);
          border-radius: 4px;
          padding: 5px 8px;
        }
        .chat-msg.mine .chat-bubble {
          background: color-mix(in srgb, var(--accent) 15%, var(--surface2));
        }
        .chat-input-row {
          display: flex;
          align-items: flex-end;
          gap: 6px;
          padding: 8px 10px;
          border-top: 1px solid var(--border);
          flex-shrink: 0;
        }
        .chat-input {
          flex: 1;
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 5px;
          color: var(--text);
          font-size: 12px;
          padding: 5px 8px;
          resize: none;
          outline: none;
          line-height: 1.4;
          min-height: 28px;
          max-height: 80px;
          overflow-y: auto;
          font-family: inherit;
        }
        .chat-input:focus { border-color: var(--accent); }
        .chat-input:disabled { opacity: 0.45; }
        .chat-send {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--accent);
          color: var(--bg);
          border: none;
          border-radius: 5px;
          flex-shrink: 0;
          cursor: pointer;
          transition: opacity 0.12s;
        }
        .chat-send:hover:not(:disabled) { opacity: 0.85; }
        .chat-send:disabled { opacity: 0.35; cursor: not-allowed; }
      `}</style>
    </div>
  );
}
