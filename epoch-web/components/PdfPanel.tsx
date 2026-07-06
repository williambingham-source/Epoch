'use client';

interface Props {
  pdfUrl: string | null;
  compiling: boolean;
  error: string | null;
}

export default function PdfPanel({ pdfUrl, compiling, error }: Props) {
  return (
    <div className="pdf-panel">
      {pdfUrl ? (
        <iframe
          key={pdfUrl}
          className="pdf-iframe"
          src={pdfUrl}
          title="Compiled PDF"
        />
      ) : (
        <div className="pdf-placeholder">
          {compiling
            ? 'Compiling…'
            : error
            ? <span style={{ color: 'var(--error)', maxWidth: 400, textAlign: 'center', fontSize: 12 }}>{error}</span>
            : 'Compile to preview PDF'}
        </div>
      )}
      <style>{`
        .pdf-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          background: var(--bg);
        }
        .pdf-iframe {
          flex: 1;
          border: none;
          background: #fff;
          width: 100%;
          height: 100%;
        }
        .pdf-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
          padding: 24px;
        }
      `}</style>
    </div>
  );
}
