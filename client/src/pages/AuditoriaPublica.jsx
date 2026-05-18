// =====================================================
// VISTA PÚBLICA: Auditoría de Campo (practicante)
// Ruta: /auditoria/:token  (login con user/pass requerido)
// =====================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  FaSearch, FaQrcode, FaCheck, FaTimes, FaMapMarkerAlt, FaUser,
  FaBarcode, FaHashtag, FaWifi, FaSync, FaUndo, FaVolumeUp, FaVolumeMute,
  FaSignOutAlt, FaKeyboard, FaTh, FaThLarge, FaList, FaThList,
} from 'react-icons/fa'
import { MdAssignmentTurnedIn, MdConfirmationNumber, MdSignalWifiOff } from 'react-icons/md'
import HIDScannerInput from '../components/HIDScannerInput'
import { enqueue, sync, subscribe as subscribeQueue, uuidv4 } from '../components/auditOfflineQueue'
import './AuditoriaPublica.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')

const ESTADOS = ['Sin asignar', 'Localizado', 'Baja', 'No Localizado']

const ESTADO_CFG = {
  'Localizado':    { bg: '#fefce8', color: '#713f12', border: '#fde047' },
  'Sin asignar':   { bg: '#f8fafc', color: '#475569', border: '#cbd5e1' },
  'Baja':          { bg: '#f0fdf4', color: '#166534', border: '#86efac' },
  'No Localizado': { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd' },
}

const VIEW_MODES = [
  { key: 'grid4',    Icon: FaTh,      label: 'Mosaico 4 columnas' },
  { key: 'grid3',    Icon: FaThLarge, label: 'Mosaico 3 columnas' },
  { key: 'list',     Icon: FaList,    label: 'Lista' },
  { key: 'list-img', Icon: FaThList,  label: 'Lista con imagen' },
]

// ── Helpers ──────────────────────────────────────────────
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 880
    g.gain.value = 0.08
    o.start()
    setTimeout(() => { o.stop(); ctx.close() }, 110)
  } catch {}
}

const lastChange = new Map()
function shouldDedupe(itemId, estado) {
  const prev = lastChange.get(itemId)
  if (!prev) return false
  return prev.estado === estado && (Date.now() - prev.ts) < 3000
}
function markChange(itemId, estado) {
  lastChange.set(itemId, { estado, ts: Date.now() })
}
function recentDifferent(itemId, estado) {
  const prev = lastChange.get(itemId)
  if (!prev || prev.estado === estado) return null
  return (Date.now() - prev.ts) < 3000 ? prev : null
}

// ── Imagen del bien ───────────────────────────────────────
function ItemImage({ src }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <div className="pub-img-empty" aria-label="Sin imagen">
        <span>Sin imagen</span>
      </div>
    )
  }
  return (
    <img
      className="pub-item-img"
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

// ── Tarjeta de bien ───────────────────────────────────────
function ItemCard({ item, onUpdate, reviewedInSession, online, mode }) {
  const [showObs, setShowObs]         = useState(false)
  const [pendingEstado, setPending]   = useState(null)
  const [obs, setObs]                 = useState('')
  const [flash, setFlash]             = useState(false)
  const obsRef = useRef(null)

  const handleConfirm = async () => {
    if (!pendingEstado) return
    const ok = await onUpdate(item, pendingEstado, obs.trim() || null, 'manual')
    if (ok) { setFlash(true); setTimeout(() => setFlash(false), 900) }
    setShowObs(false); setPending(null); setObs('')
  }
  const handleCancel = () => { setShowObs(false); setPending(null); setObs('') }

  const estadoActual = item.estado || 'Sin asignar'
  const cfg          = ESTADO_CFG[estadoActual] || {}
  const reviewed     = reviewedInSession.has(item.id)
  const isListMode   = mode === 'list' || mode === 'list-img'
  const activeCfg    = ESTADO_CFG[pendingEstado ?? estadoActual] || cfg

  const stateSelect = (
    <select
      className={`pub-card-estado-select${isListMode ? ' pub-select-sm' : ''}`}
      value={pendingEstado ?? estadoActual}
      style={{ background: activeCfg.bg, color: activeCfg.color, borderColor: activeCfg.border }}
      onChange={e => {
        const val = e.target.value
        if (val === estadoActual) { handleCancel(); return }
        setPending(val); setObs(''); setShowObs(true)
        setTimeout(() => obsRef.current?.focus(), 50)
      }}
    >
      {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
    </select>
  )

  const obsPanel = (
    <div className={`pub-card-obs${isListMode ? ' pub-card-obs-row' : ''}`}>
      <textarea
        ref={obsRef}
        placeholder="Observación opcional (Enter+Ctrl para confirmar)"
        value={obs}
        onChange={e => setObs(e.target.value)}
        rows={2}
        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleConfirm() }}
      />
      <div className="pub-card-obs-actions">
        <button className="pub-obs-cancel" onClick={handleCancel}>
          <FaTimes size={11} /> Cancelar
        </button>
        <button className="pub-obs-confirm" onClick={handleConfirm}>
          <FaCheck size={11} /> Confirmar {pendingEstado}
          {!online && <span className="pub-obs-offline-tag">offline</span>}
        </button>
      </div>
    </div>
  )

  // ── Modo lista ─────────────────────────────────────────
  if (isListMode) {
    return (
      <div
        className={[
          'pub-card-row',
          mode === 'list-img' ? 'has-thumb' : '',
          flash     ? 'pub-card-flash'    : '',
          reviewed  ? 'pub-card-reviewed' : '',
        ].filter(Boolean).join(' ')}
        style={{ borderLeftColor: cfg.border }}
      >
        {mode === 'list-img' && (
          <div className="pub-row-thumb">
            <ItemImage src={item.archi} />
          </div>
        )}

        <div className="pub-row-id">
          <span className="pub-card-num-id"><FaHashtag size={9} />{item.id}</span>
          {item.folio && (
            <span className="pub-card-folio"><MdConfirmationNumber size={10} />{item.folio}</span>
          )}
          {reviewed && <FaCheck size={10} className="pub-row-checked" title="Revisado en esta sesión" />}
        </div>

        <div className="pub-row-body">
          <span className="pub-row-desc">{item.descripcion || '—'}</span>
          <div className="pub-row-meta">
            {item.ubicacion && <span><FaMapMarkerAlt size={9} /> {item.ubicacion}</span>}
            {item.usu_asig  && <span><FaUser size={9} /> {item.usu_asig}</span>}
            {item.no_serie  && <span><FaBarcode size={9} /> {item.no_serie}</span>}
          </div>
        </div>

        <div className="pub-row-right">
          {stateSelect}
        </div>

        {showObs && obsPanel}
      </div>
    )
  }

  // ── Modo mosaico ───────────────────────────────────────
  return (
    <div
      className={[
        'pub-card',
        mode === 'grid4' ? 'pub-card-compact' : '',
        flash    ? 'pub-card-flash'    : '',
        reviewed ? 'pub-card-reviewed' : '',
      ].filter(Boolean).join(' ')}
      style={{ background: cfg.bg, borderLeftColor: cfg.border }}
    >
      <div className="pub-card-head">
        <div className="pub-card-id">
          <div className="pub-card-ids">
            <span className="pub-card-num-id" title="ID del bien">
              <FaHashtag size={9} />{item.id}
            </span>
            {item.folio && (
              <span className="pub-card-folio" title="Folio patrimonial">
                <MdConfirmationNumber size={11} />{item.folio}
              </span>
            )}
          </div>
          {reviewed && (
            <span className="pub-card-check-badge" title="Revisado en esta sesión">
              <FaCheck size={9} /> Marcado
            </span>
          )}
        </div>
      </div>

      <p className="pub-card-desc">{item.descripcion || '—'}</p>

      {mode === 'grid3' && (
        <div className="pub-card-meta">
          {(item.marca || item.modelo) && (
            <span>{[item.marca, item.modelo].filter(Boolean).join(' · ')}</span>
          )}
          {item.no_serie        && <span className="pub-card-serie"><FaBarcode size={10} /> {item.no_serie}</span>}
          {item.clave_patrimonial && <span className="pub-card-serie"><FaHashtag size={9} /> {item.clave_patrimonial}</span>}
          {item.ubicacion       && <span><FaMapMarkerAlt size={10} /> {item.ubicacion}</span>}
          {item.usu_asig        && <span><FaUser size={10} /> {item.usu_asig}</span>}
        </div>
      )}

      <div className="pub-card-select-row">{stateSelect}</div>
      {showObs && obsPanel}
    </div>
  )
}

// ── Vista principal ───────────────────────────────────────
export default function AuditoriaPublica() {
  const { token } = useParams()

  const [authState, setAuthState] = useState('checking')
  const [authError, setAuthError] = useState(null)
  const [session,   setSession]   = useState(null)

  const [items,      setItems]      = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [loading,    setLoading]    = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [itemsError, setItemsError] = useState(null)
  const [filters,    setFilters]    = useState({ search: '', estado: '', ubicacion: '', responsable: '', id: '' })
  const [scanCameraSupported, setScanCameraSupported] = useState(false)
  const [scanning,   setScanning]   = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [burstMode,  setBurstMode]  = useState(true)
  const [beepEnabled, setBeepEnabled] = useState(true)
  const [hidEnabled,  setHidEnabled]  = useState(true)
  const [reviewedInSession, setReviewedInSession] = useState(new Set())
  const [searchInput, setSearchInput] = useState('')

  const [online,      setOnline]      = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing,     setSyncing]     = useState(false)
  const [geo,         setGeo]         = useState(null)
  const [filterOpts,  setFilterOpts]  = useState({ ubicaciones: [], responsables: [] })

  const [bigToast,  setBigToast]  = useState(null)
  const [undoEntry, setUndoEntry] = useState(null)

  // Vista persistida en localStorage
  const [viewMode, setViewMode] = useState(
    () => localStorage.getItem('audit_view_mode') || 'grid3'
  )
  const handleViewMode = (mode) => {
    setViewMode(mode)
    localStorage.setItem('audit_view_mode', mode)
  }

  // ── Countdown de expiración ───────────────────────────────
  const [showCountdown, setShowCountdown] = useState(false)
  const [timeLeft,      setTimeLeft]      = useState(0)
  useEffect(() => {
    if (authState !== 'ok' || !session?.expires_at) return
    const raw = session.expires_at
    const expiresAt = new Date(raw.includes('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z')
    setTimeLeft(Math.max(0, expiresAt - Date.now()))
    const ticker  = setInterval(() => setTimeLeft(Math.max(0, expiresAt - Date.now())), 1000)
    const flipper = setInterval(() => setShowCountdown(v => !v), 4000)
    return () => { clearInterval(ticker); clearInterval(flipper) }
  }, [authState, session?.expires_at]) // eslint-disable-line

  const videoRef            = useRef(null)
  const scanControlsRef     = useRef(null)
  const handleScannedCodeRef = useRef(null)
  const itemsRef            = useRef(items)
  itemsRef.current = items
  const lastScannedRef = useRef({ code: null, ts: 0 })

  // ── Detectar soporte cámara
  useEffect(() => {
    setScanCameraSupported(
      typeof window !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    )
  }, [])

  // ── Online/offline + cola
  useEffect(() => {
    const on  = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  useEffect(() => subscribeQueue(setPendingCount), [])

  // ── Validar sesión
  const checkSession = useCallback(async () => {
    setAuthState('checking')
    try {
      const res  = await fetch(`${API_BASE}/auditoria/${token}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) { setSession(data.session); setAuthState('ok') }
      else { setAuthError(data.message || 'Enlace inválido'); setAuthState('error') }
    } catch {
      setAuthError('Sin conexión. Intenta de nuevo.')
      setAuthState('error')
    }
  }, [token])
  useEffect(() => { checkSession() }, [checkSession])

  // ── Geolocalización
  useEffect(() => {
    if (authState !== 'ok' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      pos => setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [authState])

  // ── Cargar items
  const fetchItems = useCallback(async (page = 1, f = filters, append = false) => {
    append ? setLoadingMore(true) : setLoading(true)
    if (!append) setItemsError(null)
    const params = new URLSearchParams({ page, per_page: 30 })
    if (f.search)      params.set('search',      f.search)
    if (f.estado)      params.set('estado',      f.estado)
    if (f.ubicacion)   params.set('ubicacion',   f.ubicacion)
    if (f.responsable) params.set('responsable', f.responsable)
    if (f.id)          params.set('id',          f.id)
    try {
      const res  = await fetch(`${API_BASE}/auditoria/${token}/items?${params}`, { credentials: 'include' })
      if (res.status === 401) { setAuthState('needsLogin'); return }
      const data = await res.json()
      if (data.success) {
        setItems(prev => append ? [...prev, ...data.data] : data.data)
        setPagination(data.pagination)
      } else if (!append) {
        setItemsError(data.message || 'No se pudieron cargar los bienes.')
      }
    } catch {}
    finally { append ? setLoadingMore(false) : setLoading(false) }
  }, [token, filters])

  useEffect(() => { if (authState === 'ok') fetchItems(1, filters) }, [authState]) // eslint-disable-line

  // ── Opciones de filtros
  useEffect(() => {
    if (authState !== 'ok') return
    fetch(`${API_BASE}/auditoria/${token}/filter-options`, { credentials: 'include' })
      .then(r => (r.ok || r.status === 304) ? r.json() : Promise.reject(r.status))
      .then(data => { if (data.success) setFilterOpts({ ubicaciones: data.ubicaciones, responsables: data.responsables }) })
      .catch(err => console.warn('[AuditoriaPublica] filter-options falló:', err))
  }, [authState, token])

  // ── SSE: patch in-place
  useEffect(() => {
    if (authState !== 'ok') return
    let es
    try { es = new EventSource(`${API_BASE}/patrimonioci/stream`) } catch { return }
    const handler = ev => {
      try {
        const data = JSON.parse(ev.data || '{}')
        if (!data?.id || !data?.estado) return
        setItems(prev => {
          let changed = false
          const next = prev.map(it => {
            if (it.id === data.id && it.estado !== data.estado) { changed = true; return { ...it, estado: data.estado } }
            return it
          })
          return changed ? next : prev
        })
      } catch {}
    }
    es.addEventListener('inventory_updated', handler)
    es.onerror = () => {}
    return () => es.close()
  }, [authState]) // eslint-disable-line

  // ── Sync de cola
  const flushQueue = useCallback(async () => {
    if (!online || syncing) return
    setSyncing(true)
    try {
      const r = await sync(token, async entry => {
        const res = await fetch(`${API_BASE}/auditoria/${token}/items/${entry.item_id}/estado`, {
          method: 'PATCH', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            estado: entry.estado, observaciones: entry.observaciones || undefined,
            metadata: entry.metadata || undefined, client_change_id: entry.client_change_id,
          }),
        })
        let body = null
        try { body = await res.json() } catch {}
        return { ok: res.ok, status: res.status, body }
      })
      if (r.needsLogin) setAuthState('needsLogin')
      if (r.sent > 0) setBigToast({ kind: 'info', title: `Sincronizados ${r.sent} cambios`, message: '', auto: 2500 })
    } finally { setSyncing(false) }
  }, [token, online, syncing])
  useEffect(() => { if (authState === 'ok' && online) flushQueue() }, [authState, online, flushQueue])

  // ── Auto-hide toast
  useEffect(() => {
    if (bigToast?.auto) {
      const id = setTimeout(() => setBigToast(null), bigToast.auto)
      return () => clearTimeout(id)
    }
  }, [bigToast])

  // ── Enviar actualización
  const sendUpdate = useCallback(async (itemId, estado, observaciones, ccid, metadata) => {
    try {
      const res = await fetch(`${API_BASE}/auditoria/${token}/items/${itemId}/estado`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado, observaciones: observaciones || undefined, metadata: metadata || undefined, client_change_id: ccid }),
      })
      const body = await res.json().catch(() => null)
      return { ok: res.ok, status: res.status, body }
    } catch (err) {
      return { ok: false, status: 0, body: { error: err.message } }
    }
  }, [token])

  const updateEstadoForItem = useCallback(async (item, estado, observaciones, source) => {
    if (item.estado === estado && !observaciones) return true
    if (shouldDedupe(item.id, estado)) return true

    const recent = recentDifferent(item.id, estado)
    if (recent && source === 'manual') {
      const ok = window.confirm(
        `Hace ${Math.round((Date.now() - recent.ts) / 1000)}s marcaste este bien como "${recent.estado}". ¿Cambiar a "${estado}"?`
      )
      if (!ok) return false
    }
    if (item.estado === 'Baja' && estado === 'Localizado' && source === 'scanner') {
      if (!window.confirm(`Este bien está marcado como "Baja". ¿Confirmas marcarlo como "Localizado"?`)) return false
    }

    const ccid     = uuidv4()
    const metadata = { source, ...(geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy } : {}) }
    const prevEstado = item.estado

    setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado } : it))
    setReviewedInSession(prev => new Set([...prev, item.id]))
    markChange(item.id, estado)

    const r = await sendUpdate(item.id, estado, observaciones, ccid, metadata)
    if (r.ok) {
      if (undoEntry?.timeoutId) clearTimeout(undoEntry.timeoutId)
      const tid = setTimeout(() => setUndoEntry(null), 5000)
      setUndoEntry({ item, prevEstado, ccid, timeoutId: tid })
      return true
    }
    if (r.status === 401) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
      setAuthError('Sesión expirada'); setAuthState('error')
      return false
    }
    if (r.status === 404 || r.status === 400 || r.status >= 500) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
      setBigToast({ kind: 'error', title: `Error ${r.status}`, message: r.body?.message || 'Contacta al administrador.', auto: 4500 })
      return false
    }
    // sin red → encolar
    await enqueue({ token, item_id: item.id, estado, observaciones, metadata }).catch(() => {})
    setBigToast({ kind: 'warn', title: 'Sin conexión', message: 'El cambio se enviará al recuperar la conexión.', auto: 2500 })
    return true
  }, [geo, sendUpdate, token, undoEntry])

  const handleUndo = useCallback(async () => {
    if (!undoEntry) return
    const { item, prevEstado, timeoutId } = undoEntry
    clearTimeout(timeoutId); setUndoEntry(null)
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
    const ccid     = uuidv4()
    const metadata = { source: 'undo', ...(geo ? geo : {}) }
    const r = await sendUpdate(item.id, prevEstado, '[undo]', ccid, metadata)
    if (!r.ok && !online) {
      await enqueue({ token, item_id: item.id, estado: prevEstado, observaciones: '[undo]', metadata }).catch(() => {})
    }
  }, [undoEntry, sendUpdate, geo, online, token])

  // ── Búsqueda
  const searchDebounceRef = useRef(null)
  const handleSearchInput = value => {
    setSearchInput(value)
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    searchDebounceRef.current = setTimeout(() => {
      const updated = { ...filters, search: value }
      setFilters(updated); fetchItems(1, updated)
    }, 400)
  }
  const handleClearSearch = () => {
    setSearchInput('')
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current)
    const updated = { ...filters, search: '' }
    setFilters(updated); fetchItems(1, updated)
  }
  const applyEstadoFilter = estado => {
    const updated = { ...filters, estado }
    setFilters(updated); fetchItems(1, updated)
  }
  const handleFilterField = (field, value) => {
    const updated = { ...filters, [field]: value }
    setFilters(updated); fetchItems(1, updated)
  }
  const handleLoadMore = () => {
    const next = pagination.page + 1
    if (next <= pagination.total_pages) fetchItems(next, filters, true)
  }

  // ── Scanner
  const handleScannedCode = useCallback(async (code, meta = {}) => {
    if (!code) return
    const raw = String(code).trim()
    if (!raw) return
    let trimmed = raw
    try {
      const url   = new URL(raw)
      const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
      if (parts.length > 0) trimmed = parts[parts.length - 1]
    } catch {}

    const now = Date.now()
    if (lastScannedRef.current.code === trimmed && now - lastScannedRef.current.ts < 1500) return
    lastScannedRef.current = { code: trimmed, ts: now }

    let match = itemsRef.current.find(it =>
      String(it.folio || '').toLowerCase()           === trimmed.toLowerCase() ||
      String(it.clave_patrimonial || '').toLowerCase() === trimmed.toLowerCase() ||
      String(it.no_serie || '').toLowerCase()        === trimmed.toLowerCase() ||
      String(it.id)                                  === trimmed
    )
    if (!match) {
      try {
        const params = new URLSearchParams({ search: trimmed, per_page: 10 })
        const res    = await fetch(`${API_BASE}/auditoria/${token}/items?${params}`, { credentials: 'include' })
        if (res.status === 401) { setAuthError('Sesión expirada'); setAuthState('error'); return }
        const data = await res.json()
        if (data.success && data.data.length === 1) {
          match = data.data[0]
        } else if (data.success && data.data.length > 1) {
          const t     = trimmed.toLowerCase()
          const exact = data.data.find(it =>
            String(it.folio || '').toLowerCase()           === t ||
            String(it.clave_patrimonial || '').toLowerCase() === t ||
            String(it.no_serie || '').toLowerCase()        === t ||
            String(it.id)                                  === trimmed
          )
          if (exact) { match = exact } else {
            setSearchInput(trimmed)
            handleFilterField('search', trimmed)
            setBigToast({ kind: 'info', title: 'Varios resultados', message: 'Selecciona el bien manualmente.', auto: 2500 })
            return
          }
        }
      } catch {}
    }
    if (!match) {
      if (beepEnabled) beep()
      setBigToast({
        kind: 'error', title: 'Código no encontrado',
        message: raw !== trimmed ? `Leído: "${trimmed}"\n(original: "${raw}")` : `Leído: "${trimmed}"`,
      })
      return
    }
    const okUpdate = await updateEstadoForItem(match, 'Localizado', null, 'scanner')
    if (okUpdate) {
      if (beepEnabled) beep()
      setBigToast({ kind: 'ok', title: 'Localizado', message: `${match.folio || '#' + match.id} · ${match.descripcion || ''}`, auto: 2500 })
      if (!burstMode) stopScan()
    }
  }, [token, burstMode, beepEnabled, updateEstadoForItem]) // eslint-disable-line
  handleScannedCodeRef.current = handleScannedCode

  const startScan = () => {
    if (!scanCameraSupported) {
      setBigToast({ kind: 'info', title: 'Cámara no disponible', message: 'Usa búsqueda manual.', auto: 2500 })
      return
    }
    setScanning(true); setManualCode('')
  }
  const stopScan = () => {
    try { scanControlsRef.current?.stop() } catch {}
    scanControlsRef.current = null; setScanning(false)
  }

  useEffect(() => {
    if (!scanning) return
    let cancelled = false
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (cancelled || !videoRef.current) return
      const codeReader = new BrowserMultiFormatReader()
      return codeReader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        result => { if (result) handleScannedCodeRef.current?.(result.getText(), { source: 'camera' }) }
      )
    }).then(controls => {
      if (!controls) return
      if (cancelled) controls.stop()
      else scanControlsRef.current = controls
    }).catch(() => {
      if (!cancelled) {
        setScanning(false)
        setBigToast({ kind: 'error', title: 'No se pudo abrir la cámara', message: 'En iPhone: Ajustes › Safari › Cámara → Permitir.', auto: 5000 })
      }
    })
    return () => { cancelled = true }
  }, [scanning]) // eslint-disable-line

  // ── Logout
  const handleLogout = async () => {
    try { await fetch(`${API_BASE}/auditoria/${token}/logout`, { method: 'POST', credentials: 'include' }) } catch {}
    setAuthError('Sesión cerrada'); setAuthState('error'); setSession(null)
  }

  // ── Estados de auth
  if (authState === 'checking') {
    return (
      <div className="pub-loading-page">
        <div className="pub-spinner" />
        <span>Verificando enlace…</span>
      </div>
    )
  }
  if (authState === 'error') {
    return (
      <div className="pub-error-page">
        <FaTimes size={36} color="#b91c1c" />
        <h2>Enlace no válido</h2>
        <p>{authError}</p>      </div>
    )
  }
  if (authState === 'needsLogin' || !session) {
    return (
      <div className="pub-error-page">
        <FaTimes size={36} color="#b91c1c" />
        <h2>Enlace no válido</h2>
        <p>El enlace es inválido, expiró o fue revocado.</p>
      </div>
    )
  }

  const raw       = session?.expires_at || ''
  const expiresAt = raw ? new Date(raw.includes('Z') || raw.includes('+') ? raw : raw.replace(' ', 'T') + 'Z') : new Date()
  const expiresDate = `${String(expiresAt.getDate()).padStart(2,'0')}/${String(expiresAt.getMonth()+1).padStart(2,'0')}/${expiresAt.getFullYear()}`
  const h   = Math.floor(timeLeft / 3600000)
  const m   = Math.floor((timeLeft % 3600000) / 60000)
  const s   = Math.floor((timeLeft % 60000) / 1000)
  const countdown = timeLeft > 0
    ? `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
    : 'Expirada'
  const expiresLabel = showCountdown ? `Expira en ${countdown}` : `Expira ${expiresDate}`

  const totalItems  = pagination.total
  const pctSession  = totalItems > 0 ? Math.round((reviewedInSession.size / totalItems) * 100) : 0
  const hasMore     = pagination.page < pagination.total_pages
  const activeFilters = [filters.search, filters.estado, filters.ubicacion, filters.responsable].filter(Boolean).length

  return (
    <div className="pub-root">
      <HIDScannerInput
        enabled={hidEnabled && !scanning}
        onScan={(code, m) => handleScannedCode(code, { source: 'hid', ...m })}
      />

      {/* ── Header ─────────────────────────────────── */}
      <header className="pub-header">
        <div className="pub-header-top">
          <div className="pub-header-brand">
            <MdAssignmentTurnedIn size={22} className="pub-brand-icon" />
            <div>
              <h1 className="pub-header-main-title">Auditoría de Campo</h1>
              <span className="pub-header-sub">
                <strong>{session.intern_name}</strong> · {expiresLabel}
              </span>
            </div>
          </div>

          <div className="pub-header-stats">
            <span className="pub-stat" title="Total de bienes en la sesión">{totalItems} bienes</span>
            <span className="pub-stat pub-stat-reviewed" title="Bienes marcados en esta sesión">
              <FaCheck size={9} /> {reviewedInSession.size}
            </span>
            <span
              className={`pub-stat pub-stat-net ${online ? 'pub-net-on' : 'pub-net-off'}`}
              title={online ? 'En línea' : 'Sin conexión — los cambios se guardan localmente'}
            >
              {online ? <FaWifi size={11} /> : <MdSignalWifiOff size={13} />}
              {online ? 'Online' : 'Offline'}
            </span>
            {pendingCount > 0 && (
              <span className="pub-stat pub-stat-pending" title={`${pendingCount} cambio(s) por sincronizar`} onClick={flushQueue}>
                <FaSync size={10} className={syncing ? 'pub-spin' : ''} /> {pendingCount}
              </span>
            )}
            <button className="pub-btn-icon-mini pub-btn-logout" title="Cerrar sesión" onClick={handleLogout}>
              <FaSignOutAlt size={13} />
            </button>
          </div>
        </div>

        {reviewedInSession.size > 0 && (
          <div className="pub-session-progress">
            <div className="pub-session-bar">
              <div className="pub-session-fill" style={{ width: `${pctSession}%` }} />
            </div>
            <span>{pctSession}% revisado esta sesión</span>
          </div>
        )}
      </header>

      {/* ── Barra de búsqueda y filtros ─────────────── */}
      <div className="pub-search-bar">
        <form className="pub-search-form" onSubmit={e => e.preventDefault()}>
          <div className="pub-search-input-wrap">
            <FaSearch size={14} className="pub-search-icon" />
            <input
              type="text"
              placeholder="Buscar folio, ID, descripción, serie, marca…"
              value={searchInput}
              onChange={e => handleSearchInput(e.target.value)}
            />
            {searchInput && (
              <button type="button" className="pub-search-clear" onClick={handleClearSearch} title="Limpiar búsqueda">
                <FaTimes size={12} />
              </button>
            )}
          </div>
          <button type="button" className="pub-btn-scan" onClick={startScan} title="Escanear código con cámara">
            <FaQrcode size={18} />
          </button>
        </form>

        <div className="pub-filters-row">
          <select className="pub-filter-select" value={filters.estado} onChange={e => applyEstadoFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            {ESTADOS.map(e => <option key={e} value={e}>{e}</option>)}
          </select>

          {filterOpts.ubicaciones.length > 0 && (
            <select className="pub-filter-select" value={filters.ubicacion} onChange={e => handleFilterField('ubicacion', e.target.value)}>
              <option value="">Todas las ubicaciones</option>
              {filterOpts.ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          )}

          {filterOpts.responsables.length > 0 && (
            <select className="pub-filter-select" value={filters.responsable} onChange={e => handleFilterField('responsable', e.target.value)}>
              <option value="">Todos los responsables</option>
              {filterOpts.responsables.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          <div className="pub-filter-toggles-inline">
            <label className="pub-toggle" title="Pistola USB de códigos de barras">
              <input type="checkbox" checked={hidEnabled} onChange={e => setHidEnabled(e.target.checked)} />
              <FaKeyboard size={12} />
            </label>
            <label className="pub-toggle" title={beepEnabled ? 'Beep activado' : 'Beep desactivado'}>
              <input type="checkbox" checked={beepEnabled} onChange={e => setBeepEnabled(e.target.checked)} />
              {beepEnabled ? <FaVolumeUp size={12} /> : <FaVolumeMute size={12} />}
            </label>
            <label className="pub-toggle" title="Modo ráfaga (escáner continuo)">
              <input type="checkbox" checked={burstMode} onChange={e => setBurstMode(e.target.checked)} />
              Ráfaga
            </label>
          </div>

          <div className="pub-view-toggle" role="group" aria-label="Modo de vista">
            {VIEW_MODES.map(({ key, Icon, label }) => (
              <button
                key={key}
                className={`pub-view-btn${viewMode === key ? ' active' : ''}`}
                title={label}
                onClick={() => handleViewMode(key)}
                aria-pressed={viewMode === key}
              >
                <Icon size={14} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toast grande ────────────────────────────── */}
      {bigToast && (
        <div className={`pub-bigtoast pub-bigtoast-${bigToast.kind}`} onClick={() => setBigToast(null)}>
          <div className="pub-bigtoast-title">{bigToast.title}</div>
          {bigToast.message && <div className="pub-bigtoast-msg">{bigToast.message}</div>}
        </div>
      )}

      {/* ── Undo ────────────────────────────────────── */}
      {undoEntry && (
        <div className="pub-undo">
          <span>Marcado como <strong>Localizado</strong>: {undoEntry.item.folio || '#' + undoEntry.item.id}</span>
          <button onClick={handleUndo}><FaUndo size={11} /> Deshacer</button>
        </div>
      )}

      {/* ── Modal escáner ───────────────────────────── */}
      {scanning && (
        <div className="pub-scan-modal" onClick={stopScan}>
          <div className="pub-scan-inner" onClick={e => e.stopPropagation()}>
            <div className="pub-scan-header">
              <span>{burstMode ? 'Modo ráfaga activo' : 'Apunta al código'}</span>
              <button onClick={stopScan}><FaTimes size={16} /></button>
            </div>
            <video ref={videoRef} className="pub-scan-video" playsInline muted />
            <div className="pub-scan-overlay"><div className="pub-scan-frame" /></div>
            <div className="pub-scan-manual">
              <input
                type="text" placeholder="O escribe folio, serie o ID…"
                value={manualCode} onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualCode.trim()) {
                    handleScannedCode(manualCode.trim(), { source: 'manual' }); setManualCode('')
                  }
                }}
              />
              <button
                className="pub-scan-manual-btn" disabled={!manualCode.trim()}
                onClick={() => { if (manualCode.trim()) { handleScannedCode(manualCode.trim(), { source: 'manual' }); setManualCode('') } }}
              >
                <FaCheck size={14} />
              </button>
            </div>
            <div className="pub-scan-toolbar">
              <label className="pub-toggle">
                <input type="checkbox" checked={burstMode} onChange={e => setBurstMode(e.target.checked)} /> Ráfaga
              </label>
              <label className="pub-toggle">
                <input type="checkbox" checked={beepEnabled} onChange={e => setBeepEnabled(e.target.checked)} />
                {beepEnabled ? <FaVolumeUp size={11} /> : <FaVolumeMute size={11} />} Beep
              </label>
            </div>
          </div>
        </div>
      )}

      {/* ── Contenido principal ─────────────────────── */}
      <main className="pub-main">
        {loading ? (
          <div className="pub-loading">
            <div className="pub-spinner" />
            <span>Cargando bienes…</span>
          </div>
        ) : itemsError ? (
          <div className="pub-empty pub-empty-error">
            <FaTimes size={28} color="#b91c1c" />
            <p>{itemsError}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="pub-empty">
            <FaSearch size={28} color="#cbd5e1" />
            <p>
              {activeFilters > 0
                ? 'Sin resultados con los filtros actuales. Ajusta la búsqueda.'
                : 'No se encontraron bienes.'}
            </p>
          </div>
        ) : (
          <>
            {/* Info de resultados */}
            <div className="pub-result-row">
              <span className="pub-result-info">
                {totalItems} resultado{totalItems !== 1 ? 's' : ''}
                {filters.search && <> · <em>"{filters.search}"</em></>}
                {filters.estado && <> · <em>{filters.estado}</em></>}
              </span>
            </div>

            <div className={`pub-cards-grid pub-cards-${viewMode}`}>
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onUpdate={updateEstadoForItem}
                  reviewedInSession={reviewedInSession}
                  online={online}
                  mode={viewMode}
                />
              ))}
            </div>

            {hasMore && (
              <div className="pub-load-more">
                <button className="pub-btn-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore
                    ? 'Cargando…'
                    : `Cargar más (${pagination.total - items.length} restante${pagination.total - items.length !== 1 ? 's' : ''})`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
