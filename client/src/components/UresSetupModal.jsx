import React, { useState, useRef, useCallback } from 'react';
import axios from 'axios';
import './UresSetupModal.css';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
export const URES_STORAGE_KEY = 'patrimonio_ures_config';

const UresSetupModal = ({ onConfirm }) => {
  const [inputValue, setInputValue] = useState('');
  const [chips, setChips] = useState(() => {
    try {
      const stored = localStorage.getItem(URES_STORAGE_KEY);
      const existing = stored ? JSON.parse(stored) : [];
      return existing.map(code => ({ code: String(code), status: 'valid' }));
    } catch { return []; }
  });
  const inputRef = useRef(null);

  const validateUres = useCallback(async (code) => {
    try {
      const { data } = await axios.get(`${API_BASE}/ures/${code}`, { withCredentials: true });
      // La API devuelve [{"ures_ures": "1"}] si existe, [{"ures_ures": "0"}] si no
      return Array.isArray(data) && data.length > 0 && String(data[0]?.ures_ures) === '1';
    } catch {
      return false;
    }
  }, []);

  const addChip = useCallback(async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return;
    if (chips.find(c => c.code === code)) {
      inputRef.current?.focus();
      return;
    }
    setChips(prev => [...prev, { code, status: 'validating' }]);
    const isValid = await validateUres(code);
    setChips(prev =>
      prev.map(c => c.code === code ? { ...c, status: isValid ? 'valid' : 'invalid' } : c)
    );
  }, [chips, validateUres]);

  const commitInput = useCallback(() => {
    const val = inputValue.trim();
    if (val) { addChip(val); setInputValue(''); }
  }, [inputValue, addChip]);

  const handleKeyDown = (e) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault();
      commitInput();
      return;
    }
    if (e.key === 'Backspace' && !inputValue) {
      setChips(prev => prev.slice(0, -1));
    }
  };

  const removeChip = (code) => {
    setChips(prev => prev.filter(c => c.code !== code));
    inputRef.current?.focus();
  };

  const handleConfirm = () => {
    const validCodes = chips.filter(c => c.status === 'valid').map(c => c.code);
    if (validCodes.length === 0) return;
    localStorage.setItem(URES_STORAGE_KEY, JSON.stringify(validCodes));
    onConfirm(validCodes);
  };

  const validCount  = chips.filter(c => c.status === 'valid').length;
  const invalidChips = chips.filter(c => c.status === 'invalid');
  const hasValidating = chips.some(c => c.status === 'validating');

  return (
    <div className="um-backdrop">
      <div className="um-card">

        {/* Franja de acento */}
        <div className="um-accent-bar" />

        {/* Cabecera limpia */}
        <div className="um-head">
          <p className="um-step">Configuración inicial</p>
          <h2 className="um-title">¿Qué URES deseas consultar?</h2>
          <p className="um-subtitle">
            Agrega los números de URES que administras. Los bienes de todas ellas
            aparecerán unificados en el sistema.
          </p>
          <div className="um-badges">
            <span className="um-badge um-badge--info">
              <svg viewBox="0 0 16 16" fill="currentColor"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M8 7v4M8 5.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
              Solo se configura una vez
            </span>
            <span className="um-badge um-badge--muted">
              <svg viewBox="0 0 16 16" fill="none"><path d="M11 2l3 3-8 8H3v-3L11 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></svg>
              Modificable desde ajustes
            </span>
          </div>
        </div>

        {/* Área de entrada */}
        <div className="um-body">
          <div
            className="um-tag-input"
            onClick={() => inputRef.current?.focus()}
          >
            {chips.map(chip => (
              <span key={chip.code} className={`um-tag um-tag--${chip.status}`}>
                {chip.status === 'validating' && <span className="um-tag-spin" />}
                {chip.status === 'valid'      && (
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {chip.status === 'invalid'    && (
                  <svg viewBox="0 0 12 12" fill="none">
                    <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                )}
                <span>{chip.code}</span>
                {chip.status !== 'validating' && (
                  <button
                    type="button"
                    className="um-tag-remove"
                    onClick={(e) => { e.stopPropagation(); removeChip(chip.code); }}
                    aria-label={`Quitar ${chip.code}`}
                  />
                )}
              </span>
            ))}
            <input
              ref={inputRef}
              className="um-raw-input"
              type="text"
              inputMode="numeric"
              value={inputValue}
              onChange={e => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={handleKeyDown}
              onBlur={commitInput}
              placeholder={chips.length === 0 ? 'Ej: 23110100, 23110200…' : ''}
            />
          </div>

          <div className="um-row">
            <span className="um-hint">Enter · coma · espacio para agregar</span>
            <button
              type="button"
              className="um-btn-add"
              onClick={commitInput}
              disabled={!inputValue.trim()}
            >+ Agregar</button>
          </div>

          {/* Errores inline */}
          {invalidChips.length > 0 && (
            <ul className="um-errors">
              {invalidChips.map(chip => (
                <li key={chip.code}>
                  La URES <strong>{chip.code}</strong> no existe
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Pie */}
        <div className="um-foot">
          <span className="um-count">
            {validCount > 0
              ? `${validCount} URES lista${validCount > 1 ? 's' : ''}`
              : 'Agrega al menos una URES'}
          </span>
          <button
            type="button"
            className="um-btn-confirm"
            onClick={handleConfirm}
            disabled={validCount === 0 || hasValidating}
          >
            {hasValidating
              ? <><span className="um-btn-spin" />Verificando</>
              : <>Continuar <span className="um-arrow">→</span></>
            }
          </button>
        </div>

      </div>
    </div>
  );
};

export default UresSetupModal;
