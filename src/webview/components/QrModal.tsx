import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';

export function QrModal({ url, onClose }: { url: string; onClose: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!canvasRef.current || !url) return;
    QRCode.toCanvas(canvasRef.current, url, {
      width: 200,
      margin: 2,
      color: { dark: '#1e1e2e', light: '#cdd6f4' },
    }).catch(() => setError(true));
  }, [url]);

  return (
    <div className="qr-overlay" onClick={onClose}>
      <div className="qr-modal" onClick={(e) => e.stopPropagation()}>
        <div className="qr-modal-header">
          <span className="qr-modal-title">Open on device</span>
          <button className="qr-modal-close" onClick={onClose}>✕</button>
        </div>
        {error ? (
          <div className="qr-modal-error">Could not generate QR code</div>
        ) : (
          <canvas ref={canvasRef} className="qr-canvas" />
        )}
        <div className="qr-modal-url">{url}</div>
        <div className="qr-modal-hint">Scan with your phone or tablet camera</div>
      </div>
    </div>
  );
}
