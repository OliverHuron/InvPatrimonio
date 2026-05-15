import React, { useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Joyride, STATUS } from 'react-joyride'
import './Utilidades.css'

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000/api'
export const URES_STORAGE_KEY = 'patrimonio_ures_config'
const TOUR_KEY = 'patrimonio_tour_utilidades_done'

const TOUR_STEPS = [
  {
    target: 'body',
    placement: 'center',
    title: 'Bienvenido a Utilidades',
    content: 'Aquí configuras los códigos URES de las dependencias que administras. Esta guía te explica cómo hacerlo.',
    disableBeacon: true,
  },
  {
    target: '#ut-input-area',
    title: 'Agrega tus URES',
    content: 'Escribe el número de URES y presiona Enter, coma o espacio para agregarlo. Puedes agregar varios códigos.',
    placement: 'bottom',
    disableBeacon: true,
  },
  {
    target: '#ut-add-btn',
    title: 'Botón Agregar',
    content: 'También puedes usar este botón para confirmar el código escrito en el campo.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '#ut-save-btn',
    title: 'Guardar y continuar',
    content: 'Cuando tengas al menos una URES válida (chip verde), usa este botón para guardar y acceder al inventario.',
    placement: 'top',
    disableBeacon: true,
  },
  {
    target: '#ut-guides-panel',
    title: 'Guía rápida',
    content: 'Aquí encuentras el significado de cada color de chip y dónde localizar tu código URES si no lo conoces.',
    placement: 'left',
    disableBeacon: true,
  },
]

const TOOLTIP_TEXT = {
  que_es: 'La URES (Unidad Responsable) es el código que identifica a tu dependencia dentro de la UMSNH. Todos los bienes patrimoniales están clasificados bajo uno o varios códigos URES.',
  donde_encontrar: 'Puedes encontrar tu código URES en cualquier documento oficial de tu dependencia, en el sistema SIIF o solicitándolo al Departamento de Patrimonio.',
  varios: 'Si administras más de una dependencia, puedes agregar múltiples códigos. Los inventarios de todas ellas se mostrarán unificados.',
}

const Tooltip = ({ text, children, position = 'bottom' }) => {
  const [coords, setCoords] = useState(null)
  const wrapRef = useRef(null)

  const show = () => {
    if (!wrapRef.current) return
    const r = wrapRef.current.getBoundingClientRect()
    if (position === 'right') {
      setCoords({ top: r.top + r.height / 2, left: r.right + 10 })
    } else {
      setCoords({ top: r.bottom + 8, left: r.left + r.width / 2 })
    }
  }

  return (
    <span
      ref={wrapRef}
      className="ut-tooltip-wrap"
      onMouseEnter={show}
      onMouseLeave={() => setCoords(null)}
    >
      {children}
      {coords && (
        <span
          className={`ut-tooltip-box ut-tooltip-box--${position}`}
          style={
            position === 'right'
              ? { position: 'fixed', top: coords.top, left: coords.left, transform: 'translateY(-50%)' }
              : { position: 'fixed', top: coords.top, left: coords.left, transform: 'translateX(-50%)' }
          }
        >
          {text}
        </span>
      )}
    </span>
  )
}

const Utilidades = () => {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [inputValue, setInputValue] = useState('')
  const [chips, setChips] = useState(() => {
    try {
      const stored = localStorage.getItem(URES_STORAGE_KEY)
      const existing = stored ? JSON.parse(stored) : []
      return existing.map(code => ({ code: String(code), status: 'valid' }))
    } catch { return [] }
  })
  const [saved, setSaved] = useState(false)
  const [tourKey, setTourKey] = useState(0)
  const [runTour, setRunTour] = useState(() => {
    if (!localStorage.getItem(TOUR_KEY)) {
      localStorage.setItem(TOUR_KEY, '1')
      return true
    }
    return false
  })

  const handleTourCallback = ({ status }) => {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      setRunTour(false)
    }
  }

  const startTour = () => {
    setTourKey(k => k + 1)
    setRunTour(true)
  }

  const isEditing = chips.some(c => c.status === 'valid') &&
    !!localStorage.getItem(URES_STORAGE_KEY)

  const validateUres = useCallback(async (code) => {
    try {
      const { data } = await axios.get(`${API_BASE}/ures/${code}`, { withCredentials: true })
      return Array.isArray(data) && data.length > 0 && String(data[0]?.ures_ures) === '1'
        ? 'valid' : 'invalid'
    } catch (err) {
      if (err.response?.status === 403) return 'forbidden'
      return 'invalid'
    }
  }, [])

  const addChip = useCallback(async (rawCode) => {
    const code = rawCode.trim()
    if (!code) return
    if (chips.find(c => c.code === code)) { inputRef.current?.focus(); return }
    setChips(prev => [...prev, { code, status: 'validating' }])
    const result = await validateUres(code)
    setChips(prev => prev.map(c => c.code === code ? { ...c, status: result } : c))
  }, [chips, validateUres])

  const commitInput = useCallback(() => {
    const val = inputValue.trim()
    if (val) { addChip(val); setInputValue('') }
  }, [inputValue, addChip])

  const handleKeyDown = (e) => {
    if (['Enter', ',', ' '].includes(e.key)) { e.preventDefault(); commitInput(); return }
    if (e.key === 'Backspace' && !inputValue) setChips(prev => prev.slice(0, -1))
  }

  const removeChip = (code) => {
    setChips(prev => prev.filter(c => c.code !== code))
    inputRef.current?.focus()
  }

  const handleSave = () => {
    const validCodes = chips.filter(c => c.status === 'valid').map(c => c.code)
    if (validCodes.length === 0) return
    localStorage.setItem(URES_STORAGE_KEY, JSON.stringify(validCodes))
    setSaved(true)
    window.dispatchEvent(new CustomEvent('ures-updated'))
    setTimeout(() => navigate('/inventario'), 1200)
  }

  const validCount    = chips.filter(c => c.status === 'valid').length
  const invalidChips  = chips.filter(c => c.status === 'invalid')
  const forbiddenChips = chips.filter(c => c.status === 'forbidden')
  const hasValidating = chips.some(c => c.status === 'validating')

  return (
    <div className="ut-page">
      <Joyride
        key={tourKey}
        steps={TOUR_STEPS}
        run={runTour}
        continuous
        showProgress
        showSkipButton
        callback={handleTourCallback}
        locale={{ back: 'Anterior', close: 'Cerrar', last: 'Finalizar', next: 'Siguiente', skip: 'Saltar' }}
        styles={{
          options: {
            primaryColor: '#1664C0',
            zIndex: 10000,
          },
          tooltipTitle: { fontSize: 15, fontWeight: 700 },
          tooltipContent: { fontSize: 13 },
        }}
      />

      {/* ── ENCABEZADO ── */}
      <div className="ut-header">
        <div className="ut-header-left">
          <h1 className="ut-header-title">Utilidades</h1>
        </div>
        <button
          type="button"
          className="ut-btn-tour"
          onClick={startTour}
          title="Ver guía interactiva"
        >
          ? Guía
        </button>
      </div>

      <div className="ut-body">

        {/* ── PANEL TUTORIAL (primera vez) ── */}
        {!isEditing && (
          <div className="ut-tutorial">
            <div className="ut-tutorial-steps">
              <div className={`ut-step ${chips.length === 0 ? 'ut-step--active' : ''}`}>
                <div className="ut-step-num">1</div>
                <div className="ut-step-text">
                  <strong>Agrega tus URES</strong>
                  <span>Ingresa los códigos de las dependencias que administras</span>
                </div>
              </div>
              <div className="ut-step-connector" />
              <div className={`ut-step ${chips.length > 0 && validCount === 0 ? 'ut-step--active' : ''}`}>
                <div className="ut-step-num">2</div>
                <div className="ut-step-text">
                  <strong>Verifica</strong>
                  <span>El sistema confirma que los códigos existen</span>
                </div>
              </div>
              <div className="ut-step-connector" />
              <div className={`ut-step ${validCount > 0 ? 'ut-step--active' : ''}`}>
                <div className="ut-step-num">3</div>
                <div className="ut-step-text">
                  <strong>Explora</strong>
                  <span>Accede al inventario unificado de tus bienes</span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="ut-cols">

          {/* ── FORMULARIO PRINCIPAL ── */}
          <div className="ut-card">
            <div className="ut-card-body">

              <div className="ut-field-header">
                <h2 className="ut-card-title">
                 URES
                  <Tooltip text={TOOLTIP_TEXT.que_es} position="right">
                    <span className="ut-info-icon">?</span>
                  </Tooltip>
                </h2>
                <p className="ut-card-subtitle">
                  Escribe el número de URES y presiona Enter, coma o espacio para agregarlo.
                  {' '}
                  <Tooltip text={TOOLTIP_TEXT.varios}>
                    <span className="ut-link-hint">¿Tienes varias URES?</span>
                  </Tooltip>
                </p>
              </div>

              <div
                id="ut-input-area"
                className="ut-tag-input"
                onClick={() => inputRef.current?.focus()}
              >
                {chips.map(chip => (
                  <span key={chip.code} className={`ut-tag ut-tag--${chip.status}`}>
                    {chip.status === 'validating' && <span className="ut-tag-spin" />}
                    {chip.status === 'valid' && (
                      <svg viewBox="0 0 12 12" fill="none">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {chip.status === 'invalid' && (
                      <svg viewBox="0 0 12 12" fill="none">
                        <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    )}
                    {chip.status === 'forbidden' && (
                      <svg viewBox="0 0 12 12" fill="none">
                        <path d="M6 2v4M6 8.5v.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                      </svg>
                    )}
                    <span>{chip.code}</span>
                    {chip.status !== 'validating' && (
                      <button
                        type="button"
                        className="ut-tag-remove"
                        onClick={(e) => { e.stopPropagation(); removeChip(chip.code) }}
                        aria-label={`Quitar ${chip.code}`}
                      />
                    )}
                  </span>
                ))}
                <input
                  ref={inputRef}
                  className="ut-raw-input"
                  type="text"
                  inputMode="numeric"
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={handleKeyDown}
                  onBlur={commitInput}
                  placeholder={chips.length === 0 ? 'Ej: 23110100, 231…' : ''}
                />
              </div>

              <div className="ut-input-row">
                <button
                  id="ut-add-btn"
                  type="button"
                  className="ut-btn-add"
                  onClick={commitInput}
                  disabled={!inputValue.trim()}
                >+ Agregar</button>
              </div>

              {invalidChips.length > 0 && (
                <ul className="ut-errors ut-errors--red">
                  {invalidChips.map(chip => (
                    <li key={chip.code}>URES <strong>{chip.code}</strong> - no existe en el sistema</li>
                  ))}
                </ul>
              )}

              {forbiddenChips.length > 0 && (
                <ul className="ut-errors ut-errors--yellow">
                  {forbiddenChips.map(chip => (
                    <li key={chip.code}>URES <strong>{chip.code}</strong> - sin permiso de acceso (403)</li>
                  ))}
                </ul>
              )}

              <div className="ut-footer">
                <span className="ut-count">
                  {validCount > 0
                    ? `${validCount} URES lista${validCount > 1 ? 's' : ''}`
                    : 'Agrega al menos una URES para continuar'}
                </span>
                <button
                  id="ut-save-btn"
                  type="button"
                  className={`ut-btn-save ${saved ? 'ut-btn-save--ok' : ''}`}
                  onClick={handleSave}
                  disabled={validCount === 0 || hasValidating || saved}
                >
                  {saved
                    ? <><span className="ut-check-icon">✓</span> Guardado</>
                    : hasValidating
                      ? <><span className="ut-btn-spin" />Verificando…</>
                      : isEditing ? 'Guardar cambios' : <>Continuar <span className="ut-arrow">→</span></>
                  }
                </button>
              </div>

            </div>
          </div>

          {/* ── GUÍAS INLINE ── */}
          <div id="ut-guides-panel" className="ut-guides">
            <p className="ut-guides-title">Guía rápida</p>

            <div className="ut-guide-item">
              <div className="ut-guide-dot ut-guide-dot--blue" />
              <div>
                <strong>¿Qué es una URES?</strong>
                <p>La <em>Unidad Responsable</em> identifica tu dependencia. Los bienes patrimoniales se clasifican bajo ese código.</p>
              </div>
            </div>

            <div className="ut-guide-item">
              <div className="ut-guide-dot ut-guide-dot--blue" />
              <div>
                <strong>¿Dónde encuentro mi código?</strong>
                <p>Son otorgados por las autoridades, es el el numero de URES asignado a tu dependencia.</p>
              </div>
            </div>

            <div className="ut-guide-item">
              <div className="ut-guide-dot ut-guide-dot--blue" />
              <div>
                <strong>¿Puedo agregar varias?</strong>
                <p>Sí. Los inventarios de todas las URES se muestran unificados, sin duplicados.</p>
              </div>
            </div>

            <div className="ut-guide-divider" />

            <div className="ut-guide-item">
              <div className="ut-guide-dot ut-guide-dot--yellow" />
              <div>
                <strong>Chip amarillo - sin permiso</strong>
                <p>La URES existe pero tu sesión no tiene acceso. Contacta al administrador del sistema.</p>
              </div>
            </div>

            <div className="ut-guide-item">
              <div className="ut-guide-dot ut-guide-dot--red" />
              <div>
                <strong>Chip rojo - no encontrada</strong>
                <p>El código no corresponde a ninguna URES registrada. Verifica el número.</p>
              </div>
            </div>

            <div className="ut-guide-divider" />

            <div className="ut-guide-item">
              <div className="ut-guide-dot ut-guide-dot--gray" />
              <div>
                <strong>Modificable en cualquier momento</strong>
                <p>Puedes regresar a Utilidades desde el menú lateral para añadir o quitar URES.</p>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

export default Utilidades
