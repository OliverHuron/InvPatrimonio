// =====================================================
// VISTA PÚBLICA: Auditoría de Campo (practicante)
// Ruta: /auditoria/:token  — sin login requerido
// =====================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { FaSearch, FaQrcode, FaCheck, FaTimes, FaFilter, FaMapMarkerAlt, FaUser, FaBarcode, FaHashtag } from 'react-icons/fa'
import { MdAssignmentTurnedIn, MdConfirmationNumber } from 'react-icons/md'
import './AuditoriaPublica.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')

const ESTADOS = ['Sin asignar', 'Localizado', 'Baja', 'No Localizado']

const ESTADO_CFG = {
  'Localizado':    { bg: '#fefce8', color: '#854d0e', border: '#fde047', btn: '#ca8a04' },
  'Sin asignar':   { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', btn: '#64748b' },
  'Baja':          { bg: '#f0fdf4', color: '#166534', border: '#86efac', btn: '#16a34a' },
  'No Localizado': { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd', btn: '#2563eb' },
}

// ── Tarjeta de bien ────────────────────────────────────────
function ItemCard({ item, token, onUpdated, reviewedInSession }) {
  const [saving, setSaving] = useState(false)
  const [flash, setFlash] = useState(false)
  const [showObs, setShowObs] = useState(false)
  const [pendingEstado, setPendingEstado] = useState(null)
  const [obs, setObs] = useState('')
  const obsRef = useRef(null)

  const handleEstadoClick = (estado) => {
    if (saving) return
    if (estado === item.estado && !showObs) return
    setPendingEstado(estado)
    setObs('')
    setShowObs(true)
    // focus observaciones input
    setTimeout(() => obsRef.current?.focus(), 50)
  }

  const handleConfirm = async () => {
    if (!pendingEstado || saving) return
    setSaving(true)
    try {
      const res = await fetch(`${API_BASE}/auditoria/${token}/items/${item.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: pendingEstado, observaciones: obs.trim() || undefined })
      })
      const data = await res.json()
      if (data.success) {
        setFlash(true)
        setTimeout(() => setFlash(false), 900)
        onUpdated(item.id, pendingEstado)
        setShowObs(false)
        setPendingEstado(null)
        setObs('')
      }
    } catch { /* network error silencioso */ }
    finally { setSaving(false) }
  }

  const handleCancel = () => {
    setShowObs(false)
    setPendingEstado(null)
    setObs('')
  }

  const estadoActual = item.estado || 'Sin asignar'
  const cfg = ESTADO_CFG[estadoActual] || {}
  const reviewed = reviewedInSession.has(item.id)

  return (
    <div className={`pub-card ${flash ? 'pub-card-flash' : ''} ${reviewed ? 'pub-card-reviewed' : ''}`}>
      {/* Cabecera */}
      <div className="pub-card-head">
        <div className="pub-card-id">
          <div className="pub-card-ids">
            <span className="pub-card-num-id">
              <FaHashtag size={9} />{item.id}
            </span>
            {item.folio && (
              <span className="pub-card-folio">
                <MdConfirmationNumber size={12} />{item.folio}
              </span>
            )}
          </div>
          {reviewed && <span className="pub-card-check-badge"><FaCheck size={9} /> Marcado</span>}
        </div>
        <span
          className="pub-card-estado-badge"
          style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}
        >
          {estadoActual}
        </span>
      </div>

      {/* Info principal */}
      <p className="pub-card-desc">{item.descripcion || '—'}</p>

      <div className="pub-card-meta">
        {(item.marca || item.modelo) && (
          <span>{[item.marca, item.modelo].filter(Boolean).join(' · ')}</span>
        )}
        {item.no_serie && (
          <span className="pub-card-serie"><FaBarcode size={10} /> {item.no_serie}</span>
        )}
        {item.ubicacion && (
          <span className="pub-card-ubic"><FaMapMarkerAlt size={10} /> {item.ubicacion}</span>
        )}
        {item.usu_asig && (
          <span className="pub-card-usu"><FaUser size={10} /> {item.usu_asig}</span>
        )}
      </div>

      {/* Botones de estado */}
      <div className="pub-card-btns">
        {ESTADOS.map(e => {
          const c = ESTADO_CFG[e] || {}
          const isActive = estadoActual === e
          const isPending = pendingEstado === e
          return (
            <button
              key={e}
              className={`pub-card-btn ${isActive ? 'pub-card-btn-active' : ''} ${isPending ? 'pub-card-btn-pending' : ''}`}
              style={isActive || isPending
                ? { background: c.btn, color: '#fff', borderColor: c.btn }
                : { color: c.btn, borderColor: c.border }
              }
              onClick={() => handleEstadoClick(e)}
              disabled={saving}
            >
              {isActive && <FaCheck size={9} />} {e}
            </button>
          )
        })}
      </div>

      {/* Observaciones + confirmar */}
      {showObs && (
        <div className="pub-card-obs">
          <textarea
            ref={obsRef}
            placeholder="Observación opcional (ej: 'sin etiqueta', 'dañado')…"
            value={obs}
            onChange={e => setObs(e.target.value)}
            rows={2}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleConfirm() }}
          />
          <div className="pub-card-obs-actions">
            <button className="pub-obs-cancel" onClick={handleCancel}>
              <FaTimes size={11} /> Cancelar
            </button>
            <button className="pub-obs-confirm" onClick={handleConfirm} disabled={saving}>
              {saving
                ? 'Guardando…'
                : <><FaCheck size={11} /> Confirmar {pendingEstado}</>
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Vista principal ────────────────────────────────────────
export default function AuditoriaPublica() {
  const { token } = useParams()

  const [session, setSession]           = useState(null)
  const [sessionError, setSessionError] = useState(null)
  const [items, setItems]               = useState([])
  const [pagination, setPagination]     = useState({ total: 0, page: 1, total_pages: 1 })
  const [loading, setLoading]           = useState(false)
  const [loadingMore, setLoadingMore]   = useState(false)
  const [filters, setFilters]           = useState({ search: '', estado: '', ubicacion: '' })
  const [showFilters, setShowFilters]   = useState(false)
  const [scanSupported, setScanSupported] = useState(false)
  const [scanning, setScanning]         = useState(false)
  const [reviewedInSession, setReviewedInSession] = useState(new Set())
  const [searchInput, setSearchInput]   = useState('')
  const videoRef  = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => { setScanSupported('BarcodeDetector' in window) }, [])

  // Validar sesión
  useEffect(() => {
    fetch(`${API_BASE}/auditoria/${token}`)
      .then(r => r.json())
      .then(d => { if (d.success) setSession(d.session); else setSessionError(d.message || 'Enlace inválido') })
      .catch(() => setSessionError('Error de red'))
  }, [token])

  const fetchItems = useCallback(async (page = 1, f = filters, append = false) => {
    append ? setLoadingMore(true) : setLoading(true)
    const params = new URLSearchParams({ page, per_page: 30 })
    if (f.search)    params.set('search', f.search)
    if (f.estado)    params.set('estado', f.estado)
    if (f.ubicacion) params.set('ubicacion', f.ubicacion)
    try {
      const res  = await fetch(`${API_BASE}/auditoria/${token}/items?${params}`)
      const data = await res.json()
      if (data.success) {
        setItems(prev => append ? [...prev, ...data.data] : data.data)
        setPagination(data.pagination)
      }
    } catch { /* network error */ }
    finally { append ? setLoadingMore(false) : setLoading(false) }
  }, [token, filters])

  useEffect(() => { if (session) fetchItems(1, filters) }, [session]) // eslint-disable-line

  // Aplicar filtro por estado (chips rápidos)
  const applyEstadoFilter = (estado) => {
    const updated = { ...filters, estado }
    setFilters(updated)
    fetchItems(1, updated)
  }

  const handleSearch = (e) => {
    e.preventDefault()
    const updated = { ...filters, search: searchInput }
    setFilters(updated)
    fetchItems(1, updated)
  }

  const handleClearSearch = () => {
    setSearchInput('')
    const updated = { ...filters, search: '' }
    setFilters(updated)
    fetchItems(1, updated)
  }

  const handleUbicacionFilter = (val) => {
    const updated = { ...filters, ubicacion: val }
    setFilters(updated)
    fetchItems(1, updated)
  }

  const handleEstadoUpdated = (id, newEstado) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, estado: newEstado } : item))
    setReviewedInSession(prev => new Set([...prev, id]))
  }

  const handleLoadMore = () => {
    const nextPage = pagination.page + 1
    if (nextPage <= pagination.total_pages) fetchItems(nextPage, filters, true)
  }

  // Escaneo con BarcodeDetector
  const startScan = async () => {
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      const detector = new window.BarcodeDetector({ formats: ['code_128', 'code_39', 'qr_code', 'ean_13', 'code_93'] })
      // Escanear frames hasta detectar o cancelar
      const scan = async () => {
        if (!streamRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length > 0) {
            const val = codes[0].rawValue
            stopScan()
            setSearchInput(val)
            const updated = { ...filters, search: val }
            setFilters(updated)
            fetchItems(1, updated)
          } else {
            requestAnimationFrame(scan)
          }
        } catch { requestAnimationFrame(scan) }
      }
      scan()
    } catch { setScanning(false) }
  }

  const stopScan = () => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setScanning(false)
  }

  // ── Error de sesión ────────────────────────────────────
  if (sessionError) {
    return (
      <div className="pub-error-page">
        <FaTimes size={36} color="#b91c1c" />
        <h2>Enlace no válido</h2>
        <p>{sessionError}</p>
      </div>
    )
  }
  if (!session) return <div className="pub-loading-page">Verificando enlace…</div>

  const expiresStr  = new Date(session.expires_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })
  const totalItems  = pagination.total
  const pctSession  = totalItems > 0 ? Math.round((reviewedInSession.size / totalItems) * 100) : 0
  const hasMore     = pagination.page < pagination.total_pages

  return (
    <div className="pub-root">

      {/* ── Header ──────────────────────────────────── */}
      <header className="pub-header">
        <div className="pub-header-top">
          <div className="pub-header-title">
            <MdAssignmentTurnedIn size={20} />
            <div>
              <h1>Auditoría de Campo</h1>
              <span>Hola, <strong>{session.intern_name}</strong> · Expira {expiresStr}</span>
            </div>
          </div>
          <div className="pub-header-stats">
            <span className="pub-stat">{totalItems} bienes</span>
            <span className="pub-stat pub-stat-reviewed">{reviewedInSession.size} marcados</span>
          </div>
        </div>

        {/* Barra de progreso de sesión */}
        {reviewedInSession.size > 0 && (
          <div className="pub-session-progress">
            <div className="pub-session-bar">
              <div className="pub-session-fill" style={{ width: `${pctSession}%` }} />
            </div>
            <span>{pctSession}% esta sesión</span>
          </div>
        )}
      </header>

      {/* ── Buscador ────────────────────────────────── */}
      <div className="pub-search-bar">
        <form className="pub-search-form" onSubmit={handleSearch}>
          <div className="pub-search-input-wrap">
            <FaSearch size={14} className="pub-search-icon" />
            <input
              type="text"
              placeholder="Buscar folio, descripción, serie, marca…"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" className="pub-search-clear" onClick={handleClearSearch}>
                <FaTimes size={12} />
              </button>
            )}
          </div>
          <button type="submit" className="pub-btn-search">Buscar</button>
          {scanSupported && (
            <button type="button" className="pub-btn-scan" onClick={startScan} title="Escanear código">
              <FaQrcode size={18} />
            </button>
          )}
          <button
            type="button"
            className={`pub-btn-filter ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(f => !f)}
            title="Filtros"
          >
            <FaFilter size={14} />
          </button>
        </form>

        {/* Chips de estado rápido */}
        <div className="pub-estado-chips">
          <button
            className={`pub-chip ${!filters.estado ? 'pub-chip-active' : ''}`}
            onClick={() => applyEstadoFilter('')}
          >
            Todos
          </button>
          {ESTADOS.map(e => {
            const c = ESTADO_CFG[e] || {}
            return (
              <button
                key={e}
                className={`pub-chip ${filters.estado === e ? 'pub-chip-active' : ''}`}
                style={filters.estado === e ? { background: c.btn, color: '#fff', borderColor: c.btn } : { color: c.btn, borderColor: c.border }}
                onClick={() => applyEstadoFilter(e)}
              >
                {e}
              </button>
            )
          })}
        </div>

        {/* Filtros expandibles */}
        {showFilters && (
          <div className="pub-filters-panel">
            <label>
              Ubicación
              <input
                type="text"
                placeholder="Filtrar por ubicación…"
                value={filters.ubicacion}
                onChange={e => handleUbicacionFilter(e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      {/* ── Modal de escáner ────────────────────────── */}
      {scanning && (
        <div className="pub-scan-modal" onClick={stopScan}>
          <div className="pub-scan-inner" onClick={e => e.stopPropagation()}>
            <div className="pub-scan-header">
              <span>Apunta la cámara al código</span>
              <button onClick={stopScan}><FaTimes size={16} /></button>
            </div>
            <video ref={videoRef} className="pub-scan-video" playsInline muted />
            <div className="pub-scan-overlay">
              <div className="pub-scan-frame" />
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de bienes ──────────────────────────── */}
      <main className="pub-main">
        {loading ? (
          <div className="pub-loading">
            <div className="pub-spinner" />
            Cargando bienes…
          </div>
        ) : items.length === 0 ? (
          <div className="pub-empty">
            <FaSearch size={28} color="#cbd5e1" />
            <p>No se encontraron bienes.<br />Prueba con otros filtros.</p>
          </div>
        ) : (
          <>
            <div className="pub-result-info">
              {totalItems} resultados
              {filters.search && <> · búsqueda: <em>"{filters.search}"</em></>}
              {filters.estado && <> · estado: <em>{filters.estado}</em></>}
            </div>

            <div className="pub-cards-grid">
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  token={token}
                  onUpdated={handleEstadoUpdated}
                  reviewedInSession={reviewedInSession}
                />
              ))}
            </div>

            {hasMore && (
              <div className="pub-load-more">
                <button
                  className="pub-btn-load-more"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore
                    ? 'Cargando…'
                    : `Cargar más (${pagination.total - items.length} restantes)`
                  }
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
