'use client';

interface Props {
  excalidrawUrl?: string;
}

export default function CanvasPanel({ excalidrawUrl }: Props) {
  const url = excalidrawUrl ?? (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001');

  return (
    <div className="canvas-panel">
      <iframe
        src={url}
        className="canvas-iframe"
        title="Excalidraw Canvas"
        allow="clipboard-read; clipboard-write"
      />
      <style>{`
        .canvas-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
        }
        .canvas-iframe {
          flex: 1;
          border: none;
          width: 100%;
          height: 100%;
        }
      `}</style>
    </div>
  );
}
