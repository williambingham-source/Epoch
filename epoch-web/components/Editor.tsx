'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import type { editor as EditorNS } from 'monaco-editor';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

interface Props {
  value: string;
  onChange: (value: string) => void;
  onSave: (value: string) => Promise<void>;
}

export default function Editor({ value, onChange, onSave }: Props) {
  const editorRef = useRef<EditorNS.IStandaloneCodeEditor | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestValue = useRef(value);
  latestValue.current = value;

  const scheduleAutoSave = useCallback((val: string) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onSave(val);
    }, 1500);
  }, [onSave]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function handleMount(ed: EditorNS.IStandaloneCodeEditor) {
    editorRef.current = ed;
    ed.addCommand(
      // Ctrl+S / Cmd+S
      2048 + 49,
      () => {
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        onSave(latestValue.current);
      }
    );
  }

  function handleChange(val: string | undefined) {
    const v = val ?? '';
    onChange(v);
    scheduleAutoSave(v);
  }

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <MonacoEditor
        height="100%"
        defaultLanguage="latex"
        value={value}
        onChange={handleChange}
        onMount={handleMount}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "'Cascadia Code', 'Fira Code', Consolas, monospace",
          fontLigatures: true,
          minimap: { enabled: false },
          wordWrap: 'on',
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          tabSize: 2,
          renderWhitespace: 'none',
          padding: { top: 12 },
        }}
        beforeMount={(monaco) => {
          if (!monaco.languages.getLanguages().some((l) => l.id === 'latex')) {
            monaco.languages.register({ id: 'latex' });
            monaco.languages.setMonarchTokensProvider('latex', {
              tokenizer: {
                root: [
                  [/\\[a-zA-Z]+/, 'keyword'],
                  [/%.*$/, 'comment'],
                  [/\$\$?/, 'string'],
                  [/[{}]/, 'delimiter.bracket'],
                ],
              },
            });
          }
        }}
      />
    </div>
  );
}
