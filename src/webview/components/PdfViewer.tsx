import React, { useEffect, useRef, useState } from 'react';

declare global {
  interface Window {
    __PDFJS_WORKER_SRC__: string;
  }
}

interface Props {
  base64: string;
  fileName: string;
}

export function PdfViewer({ base64, fileName }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages, setNumPages] = useState(0);
  const [loadedPages, setLoadedPages] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!base64 || !window.__PDFJS_WORKER_SRC__) return;
    let cancelled = false;

    (async () => {
      try {
        // Dynamic import: pdfjs only loads when a PDF is rendered, not at app startup.
        // This prevents its initialization from crashing the webview on load.
        const pdfjs = await import('pdfjs-dist');
        pdfjs.GlobalWorkerOptions.workerSrc = window.__PDFJS_WORKER_SRC__;

        const raw = atob(base64);
        const data = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);

        const pdf = await pdfjs.getDocument({ data }).promise;
        if (cancelled) return;

        setNumPages(pdf.numPages);
        setLoadedPages(0);

        if (!containerRef.current) return;
        containerRef.current.innerHTML = '';

        for (let p = 1; p <= pdf.numPages; p++) {
          if (cancelled) break;
          const page = await pdf.getPage(p);
          const viewport = page.getViewport({ scale: 1.4 });

          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = 'pdf-canvas';
          containerRef.current.appendChild(canvas);

          const ctx = canvas.getContext('2d');
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport }).promise;
          }
          if (!cancelled) setLoadedPages(p);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [base64]);

  if (error) {
    return <div className="pdf-error muted">PDF render error: {error}</div>;
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-meta muted">
        {fileName}
        {numPages > 0 &&
          ` — ${loadedPages < numPages ? `${loadedPages}/` : ''}${numPages} page${numPages !== 1 ? 's' : ''}`}
      </div>
      <div className="pdf-pages" ref={containerRef} />
    </div>
  );
}
