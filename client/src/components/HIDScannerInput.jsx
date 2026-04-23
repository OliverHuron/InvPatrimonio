// =====================================================
// HIDScannerInput
// Captura entrada de pistolas USB de códigos de barras
// (que se comportan como teclado HID).
// - Mantiene autofoco invisible.
// - Detecta entrada rápida (>30 chars/seg) como escaneo.
// - Emite onScan(code, { source }) al recibir Enter.
// =====================================================

import React, { useEffect, useRef } from 'react';

const RATE_THRESHOLD = 30; // chars por segundo

export default function HIDScannerInput({ enabled = true, onScan, blockedRefs = [] }) {
  const inputRef = useRef(null);
  const buffer = useRef('');
  const firstStamp = useRef(0);

  // Re-foco persistente cuando el usuario no esté escribiendo en otro input
  useEffect(() => {
    if (!enabled) return;
    const focus = () => {
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) {
        // El usuario está editando, no robar el foco
        return;
      }
      // Tampoco robar foco si está dentro de refs bloqueados
      for (const r of blockedRefs) {
        if (r?.current && (r.current === ae || r.current.contains?.(ae))) return;
      }
      inputRef.current?.focus();
    };
    focus();
    const id = setInterval(focus, 800);
    document.addEventListener('click', focus);
    return () => {
      clearInterval(id);
      document.removeEventListener('click', focus);
    };
  }, [enabled, blockedRefs]);

  const handleKeyDown = (e) => {
    if (!enabled) return;
    if (e.key === 'Enter') {
      const code = buffer.current.trim();
      const elapsed = (performance.now() - firstStamp.current) / 1000;
      const rate = elapsed > 0 ? code.length / elapsed : Infinity;
      buffer.current = '';
      firstStamp.current = 0;
      if (code.length >= 3 && rate >= RATE_THRESHOLD) {
        onScan?.(code, { source: 'hid', rate });
      } else if (code.length >= 3) {
        // entrada lenta: probable escritura humana, igual la pasamos como manual
        onScan?.(code, { source: 'manual', rate });
      }
      e.preventDefault();
      return;
    }
    if (e.key.length === 1) {
      if (!buffer.current) firstStamp.current = performance.now();
      buffer.current += e.key;
    }
    if (e.key === 'Escape') {
      buffer.current = '';
      firstStamp.current = 0;
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      onKeyDown={handleKeyDown}
      onChange={() => {}}
      style={{
        position: 'fixed',
        left: -9999,
        top: -9999,
        opacity: 0,
        width: 1,
        height: 1,
        pointerEvents: 'none',
      }}
      aria-hidden="true"
      tabIndex={-1}
    />
  );
}
