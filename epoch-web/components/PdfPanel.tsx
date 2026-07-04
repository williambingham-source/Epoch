'use client';

import { useState, useEffect } from 'react';
import { compileLatex } from '@/lib/api';

interface Props {
  latex: string;
}

export default function PdfPanel({ latex }: Props) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    };
  }, [pdfUrl]);

  async function compile() {
    setCompiling(true);
    setError(null);
    try {
      const blob = await compileLatex(latex);
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div className="pdf-panel">
      <div className="pdf-toolbar">
        <button className="primary" onClick={compile} disabled={compiling || !latex.trim()}>
          {compiling ? 'Compiling…' : 'Compile PDF'}
        </button>
        {error && <span className="pdf-error">{error}</span>}
      </div>
      {pdfUrl ? (
        <iframe
          className="pdf-iframe"
          src={pdfUrl}
          title="Compiled PDF"
        />
      ) : (
        <div className="pdf-placeholder">
          {compiling ? 'Compiling…' : 'Click "Compile PDF" to preview'}
        </div>
      )}
      <style>{`
        .pdf-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .pdf-toolbar {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
        }
        .pdf-error {
          color: var(--error);
          font-size: 12px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .pdf-iframe {
          flex: 1;
          border: none;
          background: #fff;
        }
        .pdf-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
