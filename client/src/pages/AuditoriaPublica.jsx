// =====================================================
// VISTA PÚBLICA: Auditoría de Campo (practicante)
// Ruta: /auditoria/:token  (login con user/pass requerido)
// =====================================================

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import {
  FaSearch, FaQrcode, FaCheck, FaTimes, FaFilter, FaMapMarkerAlt, FaUser,
  FaBarcode, FaHashtag, FaWifi, FaSync, FaUndo, FaVolumeUp, FaVolumeMute,
  FaSignOutAlt, FaKeyboard
} from 'react-icons/fa'
import { MdAssignmentTurnedIn, MdConfirmationNumber, MdSignalWifiOff } from 'react-icons/md'
import HIDScannerInput from '../components/HIDScannerInput'
import { enqueue, sync, subscribe as subscribeQueue, uuidv4 } from '../components/auditOfflineQueue'
import './AuditoriaPublica.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')

const ESTADOS = ['Sin asignar', 'Localizado', 'Baja', 'No Localizado']

const ESTADO_CFG = {
  'Localizado':    { bg: '#fefce8', color: '#854d0e', border: '#fde047', btn: '#ca8a04' },
  'Sin asignar':   { bg: '#f8fafc', color: '#475569', border: '#cbd5e1', btn: '#64748b' },
  'Baja':          { bg: '#f0fdf4', color: '#166534', border: '#86efac', btn: '#16a34a' },
  'No Localizado': { bg: '#eff6ff', color: '#1e40af', border: '#93c5fd', btn: '#2563eb' },
}

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

// Anti doble-tap: mapa { itemId: { estado, ts } }
const lastChange = new Map()
function shouldDedupe(itemId, estado) {
  const prev = lastChange.get(itemId)
  if (!prev) return false
  const dt = Date.now() - prev.ts
  if (prev.estado === estado && dt < 3000) return true
  return false
}
function markChange(itemId, estado) {
  lastChange.set(itemId, { estado, ts: Date.now() })
}
function recentDifferent(itemId, estado) {
  const prev = lastChange.get(itemId)
  if (!prev || prev.estado === estado) return null
  const dt = Date.now() - prev.ts
  if (dt < 3000) return prev
  return null
}

// ── Tarjeta de bien ───────────────────────────────────────
function ItemCard({ item, onUpdate, reviewedInSession, online }) {
  const [showObs, setShowObs] = useState(false)
  const [pendingEstado, setPendingEstado] = useState(null)
  const [obs, setObs] = useState('')
  const [flash, setFlash] = useState(false)
  const obsRef = useRef(null)

  const handleEstadoClick = (estado) => {
    if (estado === item.estado && !showObs) return
    setPendingEstado(estado)
    setObs('')
    setShowObs(true)
    setTimeout(() => obsRef.current?.focus(), 50)
  }

  const handleConfirm = async () => {
    if (!pendingEstado) return
    const ok = await onUpdate(item, pendingEstado, obs.trim() || null, 'manual')
    if (ok) {
      setFlash(true)
      setTimeout(() => setFlash(false), 900)
    }
    setShowObs(false)
    setPendingEstado(null)
    setObs('')
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
      <div className="pub-card-head">
        <div className="pub-card-id">
          <div className="pub-card-ids">
            <span className="pub-card-num-id"><FaHashtag size={9} />{item.id}</span>
            {item.folio && (
              <span className="pub-card-folio">
                <MdConfirmationNumber size={12} />{item.folio}
              </span>
            )}
          </div>
          {reviewed && <span className="pub-card-check-badge"><FaCheck size={9} /> Marcado</span>}
        </div>
        <span className="pub-card-estado-badge"
              style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
          {estadoActual}
        </span>
      </div>

      <p className="pub-card-desc">{item.descripcion || '—'}</p>

      <div className="pub-card-meta">
        {(item.marca || item.modelo) && (
          <span>{[item.marca, item.modelo].filter(Boolean).join(' · ')}</span>
        )}
        {item.no_serie && <span className="pub-card-serie"><FaBarcode size={10} /> {item.no_serie}</span>}
        {item.clave_patrimonial && <span className="pub-card-serie"><FaHashtag size={9} /> {item.clave_patrimonial}</span>}
        {item.ubicacion && <span className="pub-card-ubic"><FaMapMarkerAlt size={10} /> {item.ubicacion}</span>}
        {item.usu_asig && <span className="pub-card-usu"><FaUser size={10} /> {item.usu_asig}</span>}
      </div>

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
                : { color: c.btn, borderColor: c.border }}
              onClick={() => handleEstadoClick(e)}
            >
              {isActive && <FaCheck size={9} />} {e}
            </button>
          )
        })}
      </div>

      {showObs && (
        <div className="pub-card-obs">
          <textarea
            ref={obsRef}
            placeholder="Observación opcional"
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
      )}
    </div>
  )
}

// ── Pantalla de Login ─────────────────────────────────────
function LoginScreen({ token, onSuccess, sessionInfo }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch(`${API_BASE}/auditoria/${token}/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      })
      const data = await res.json()
      if (data.success) onSuccess(data.session)
      else setError(data.message || 'Credenciales incorrectas')
    } catch {
      setError('Error de red. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="pub-login-page">
      <form className="pub-login-card" onSubmit={submit}>
        <div className="pub-login-head">
          <MdAssignmentTurnedIn size={28} />
          <h2>Auditoría de Campo</h2>
          {sessionInfo?.intern_name && (
            <p>Hola, <strong>{sessionInfo.intern_name}</strong></p>
          )}
          <p className="pub-login-sub">Ingresa tu usuario y contraseña.</p>
        </div>

        <label>
          Usuario
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="aud-xxxx"
            autoFocus
            autoComplete="username"
            spellCheck="false"
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            spellCheck="false"
          />
        </label>

        {error && <div className="pub-login-error">{error}</div>}

        <button type="submit" className="pub-login-btn" disabled={submitting}>
          {submitting ? 'Verificando…' : 'Entrar'}
        </button>

        <p className="pub-login-foot">
          Si el acceso no funciona, contacta al administrador.
        </p>
      </form>
    </div>
  )
}

// ── Vista principal ──────────────────────────────────────
export default function AuditoriaPublica() {
  const { token } = useParams()

  const [authState, setAuthState] = useState('checking') // checking | needsLogin | ok | error
  const [authError, setAuthError] = useState(null)
  const [session, setSession] = useState(null)

  const [items, setItems] = useState([])
  const [pagination, setPagination] = useState({ total: 0, page: 1, total_pages: 1 })
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [filters, setFilters] = useState({ search: '', estado: '', ubicacion: '', responsable: '', id: '' })
  const [showFilters, setShowFilters] = useState(false)
  const [scanCameraSupported, setScanCameraSupported] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [burstMode, setBurstMode] = useState(true)
  const [beepEnabled, setBeepEnabled] = useState(true)
  const [hidEnabled, setHidEnabled] = useState(true)
  const [reviewedInSession, setReviewedInSession] = useState(new Set())
  const [searchInput, setSearchInput] = useState('')

  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [pendingCount, setPendingCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [geo, setGeo] = useState(null)
  const [filterOpts, setFilterOpts] = useState({ ubicaciones: [], responsables: [] })

  const [bigToast, setBigToast] = useState(null) // { kind, title, message, item }
  const [undoEntry, setUndoEntry] = useState(null) // { item, prevEstado, ccid, timeoutId }
  const lastScannedRef = useRef({ code: null, ts: 0 })

  const videoRef = useRef(null)
  const scanControlsRef = useRef(null)
  const handleScannedCodeRef = useRef(null)  // ref para evitar stale closure en el callback de zxing
  const itemsRef = useRef(items)
  itemsRef.current = items

  // ── Detect support
  useEffect(() => {
    setScanCameraSupported(
      typeof window !== 'undefined' &&
      !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
    )
  }, [])

  // ── Online/offline + queue counter
  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])
  useEffect(() => subscribeQueue(setPendingCount), [])

  // ── Validar sesión / login
  const checkSession = useCallback(async () => {
    setAuthState('checking')
    try {
      const res = await fetch(`${API_BASE}/auditoria/${token}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setSession(data.session)
        setAuthState('ok')
      } else if (res.status === 401 && data.requires_login) {
        // Pedir nombre del intern (no confidencial) para pintar la pantalla
        // El backend requiere login, pero no revela el intern_name. Usar placeholder.
        setSession(null)
        setAuthState('needsLogin')
      } else if (res.status === 401) {
        setSession(null)
        setAuthState('needsLogin')
      } else {
        setAuthError(data.message || 'Enlace inválido')
        setAuthState('error')
      }
    } catch {
      setAuthError('Sin conexión. Intenta de nuevo.')
      setAuthState('error')
    }
  }, [token])

  useEffect(() => { checkSession() }, [checkSession])

  // ── Geolocalización (una vez al login)
  useEffect(() => {
    if (authState !== 'ok') return
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => setGeo({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      }),
      () => {},
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    )
  }, [authState])

  // ── Cargar items
  const fetchItems = useCallback(async (page = 1, f = filters, append = false) => {
    append ? setLoadingMore(true) : setLoading(true)
    const params = new URLSearchParams({ page, per_page: 30 })
    if (f.search)      params.set('search', f.search)
    if (f.estado)      params.set('estado', f.estado)
    if (f.ubicacion)   params.set('ubicacion', f.ubicacion)
    if (f.responsable) params.set('responsable', f.responsable)
    if (f.id)          params.set('id', f.id)
    try {
      const res = await fetch(`${API_BASE}/auditoria/${token}/items?${params}`, { credentials: 'include' })
      if (res.status === 401) {
        setAuthState('needsLogin')
        return
      }
      const data = await res.json()
      if (data.success) {
        setItems(prev => append ? [...prev, ...data.data] : data.data)
        setPagination(data.pagination)
      }
    } catch { /* ignore */ }
    finally { append ? setLoadingMore(false) : setLoading(false) }
  }, [token, filters])

  useEffect(() => { if (authState === 'ok') fetchItems(1, filters) }, [authState]) // eslint-disable-line

  // ── Cargar opciones de filtros (ubicaciones y responsables)
  useEffect(() => {
    if (authState !== 'ok') return
    fetch(`${API_BASE}/auditoria/${token}/filter-options`, { credentials: 'include' })
      .then(r => (r.ok || r.status === 304) ? r.json() : Promise.reject(r.status))
      .then(data => { if (data.success) setFilterOpts({ ubicaciones: data.ubicaciones, responsables: data.responsables }) })
      .catch(err => console.warn('[AuditoriaPublica] filter-options falló:', err))
  }, [authState, token])

  // ── SSE: refrescar la lista cuando otro auditor o el admin cambien algo
  useEffect(() => {
    if (authState !== 'ok') return
    const url = `${API_BASE}/patrimonioci/stream`
    let es
    try {
      es = new EventSource(url)
    } catch { return }
    const handler = (ev) => {
      try {
        const data = JSON.parse(ev.data || '{}')
        if (!data?.id || !data?.estado) return
        // Patch in-place: actualiza solo el item afectado sin recargar la tabla
        setItems(prev => {
          let changed = false
          const next = prev.map(it => {
            if (it.id === data.id && it.estado !== data.estado) {
              changed = true
              return { ...it, estado: data.estado }
            }
            return it
          })
          return changed ? next : prev
        })
      } catch { /* ignorar parseo */ }
    }
    es.addEventListener('inventory_updated', handler)
    es.onerror = () => { /* el browser reintenta automáticamente */ }
    return () => es.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authState])

  // ── Sync de cola al recuperar red o al login
  const flushQueue = useCallback(async () => {
    if (!online || syncing) return
    setSyncing(true)
    try {
      const r = await sync(token, async (entry) => {
        const res = await fetch(
          `${API_BASE}/auditoria/${token}/items/${entry.item_id}/estado`,
          {
            method: 'PATCH',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              estado: entry.estado,
              observaciones: entry.observaciones || undefined,
              metadata: entry.metadata || undefined,
              client_change_id: entry.client_change_id,
            }),
          }
        )
        let body = null
        try { body = await res.json() } catch {}
        return { ok: res.ok, status: res.status, body }
      })
      if (r.needsLogin) setAuthState('needsLogin')
      if (r.sent > 0) setBigToast({
        kind: 'info', title: `Sincronizados ${r.sent} cambios`, message: '', auto: 2500
      })
    } finally {
      setSyncing(false)
    }
  }, [token, online, syncing])

  useEffect(() => { if (authState === 'ok' && online) flushQueue() }, [authState, online, flushQueue])

  // Auto-toast hide
  useEffect(() => {
    if (bigToast?.auto) {
      const id = setTimeout(() => setBigToast(null), bigToast.auto)
      return () => clearTimeout(id)
    }
  }, [bigToast])

  // ── Núcleo: actualizar estado (siempre intenta fetch; encola solo si falla la red)
  const sendUpdate = useCallback(async (itemId, estado, observaciones, ccid, metadata) => {
    try {
      const res = await fetch(`${API_BASE}/auditoria/${token}/items/${itemId}/estado`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          estado,
          observaciones: observaciones || undefined,
          metadata: metadata || undefined,
          client_change_id: ccid,
        }),
      })
      const body = await res.json().catch(() => null)
      return { ok: res.ok, status: res.status, body }
    } catch (err) {
      return { ok: false, status: 0, body: { error: err.message } }
    }
  }, [token])

  const updateEstadoForItem = useCallback(async (item, estado, observaciones, source) => {
    if (item.estado === estado && !observaciones) {
      // sin cambio real
      return true
    }

    // anti doble-tap mismo estado
    if (shouldDedupe(item.id, estado)) return true

    // confirmación si cambia rápido a estado distinto (solo en edición manual, no en scanner)
    const recent = recentDifferent(item.id, estado)
    if (recent && source === 'manual') {
      const ok = window.confirm(
        `Hace ${Math.round((Date.now() - recent.ts) / 1000)}s marcaste este bien como "${recent.estado}". ¿Cambiar a "${estado}"?`
      )
      if (!ok) return false
    }

    // Bien en Baja: confirmar siempre antes de pasarlo a Localizado por scanner
    if (item.estado === 'Baja' && estado === 'Localizado' && source === 'scanner') {
      const ok = window.confirm(
        `Este bien está marcado como "Baja". ¿Confirmas marcarlo como "Localizado"?`
      )
      if (!ok) return false
    }

    const ccid = uuidv4()
    const metadata = {
      source,
      ...(geo ? { lat: geo.lat, lng: geo.lng, accuracy: geo.accuracy } : {})
    }
    const prevEstado = item.estado

    // optimista
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado } : it))
    setReviewedInSession(prev => new Set([...prev, item.id]))
    markChange(item.id, estado)

    // intentar online; si falla / sin red → encolar
    const r = await sendUpdate(item.id, estado, observaciones, ccid, metadata)
    if (r.ok) {
      // Undo queda disponible 5s
      if (undoEntry?.timeoutId) clearTimeout(undoEntry.timeoutId)
      const tid = setTimeout(() => setUndoEntry(null), 5000)
      setUndoEntry({ item, prevEstado, ccid, timeoutId: tid })
      return true
    }
    if (r.status === 401) {
      // revertir y pedir login
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
      setAuthState('needsLogin')
      return false
    }
    if (r.status === 404 || r.status === 400) {
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
      setBigToast({
        kind: 'error',
        title: `Error ${r.status}`,
        message: r.body?.message || 'Datos inválidos',
        auto: 4000,
      })
      return false
    }
    if (r.status >= 500) {
      // Error de servidor — revertir y mostrar error visible
      setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
      setBigToast({
        kind: 'error',
        title: `Error del servidor (${r.status})`,
        message: r.body?.message || 'Contacta al administrador.',
        auto: 5000,
      })
      return false
    }
    // sin red (status 0): encolar
    await enqueue({
      token,
      item_id: item.id,
      estado,
      observaciones,
      metadata,
    }).catch(() => {})
    setBigToast({
      kind: 'warn',
      title: 'Sin conexión',
      message: 'El cambio se enviará al recuperar la conexión.',
      auto: 2500,
    })
    return true
  }, [geo, sendUpdate, token, undoEntry])

  const handleUndo = useCallback(async () => {
    if (!undoEntry) return
    const { item, prevEstado, timeoutId } = undoEntry
    clearTimeout(timeoutId)
    setUndoEntry(null)
    setItems(prev => prev.map(it => it.id === item.id ? { ...it, estado: prevEstado } : it))
    const ccid = uuidv4()
    const metadata = { source: 'undo', ...(geo ? geo : {}) }
    const r = await sendUpdate(item.id, prevEstado, '[undo]', ccid, metadata)
    if (!r.ok && !online) {
      await enqueue({ token, item_id: item.id, estado: prevEstado, observaciones: '[undo]', metadata }).catch(() => {})
    }
  }, [undoEntry, sendUpdate, geo, online, token])

  // ── Búsqueda
  const handleSearch = (e) => {
    e?.preventDefault?.()
    const updated = { ...filters, search: searchInput }
    setFilters(updated); fetchItems(1, updated)
  }
  const handleClearSearch = () => {
    setSearchInput('')
    const updated = { ...filters, search: '' }
    setFilters(updated); fetchItems(1, updated)
  }
  const applyEstadoFilter = (estado) => {
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

  // ── Scanner: callback unificado (cámara o HID)
  const handleScannedCode = useCallback(async (code, meta = {}) => {
    if (!code) return
    const raw = String(code).trim()
    if (!raw) return

    // Si el valor parece una URL, extraer el último segmento del path
    // (ej. "https://patrimonio.../auditoria/TOKEN" → "TOKEN")
    let trimmed = raw
    try {
      const url = new URL(raw)
      const parts = url.pathname.replace(/\/$/, '').split('/').filter(Boolean)
      if (parts.length > 0) trimmed = parts[parts.length - 1]
    } catch {} // no es URL, usar raw tal cual
    // Anti repetición de mismo escaneo en 1.5s
    const now = Date.now()
    if (lastScannedRef.current.code === trimmed && now - lastScannedRef.current.ts < 1500) return
    lastScannedRef.current = { code: trimmed, ts: now }

    // Buscar localmente primero (en página actual cargada)
    let match = itemsRef.current.find(it =>
      String(it.folio || '').toLowerCase() === trimmed.toLowerCase() ||
      String(it.clave_patrimonial || '').toLowerCase() === trimmed.toLowerCase() ||
      String(it.no_serie || '').toLowerCase() === trimmed.toLowerCase() ||
      String(it.id) === trimmed
    )

    // Si no, buscar en backend
    if (!match) {
      try {
        const params = new URLSearchParams({ search: trimmed, per_page: 10 })
        const res = await fetch(`${API_BASE}/auditoria/${token}/items?${params}`, { credentials: 'include' })
        if (res.status === 401) { setAuthState('needsLogin'); return }
        const data = await res.json()
        if (data.success && data.data.length === 1) {
          match = data.data[0]
        } else if (data.success && data.data.length > 1) {
          // Intentar match exacto entre los resultados antes de declarar ambigüedad
          const t = trimmed.toLowerCase()
          const exact = data.data.find(it =>
            String(it.folio || '').toLowerCase() === t ||
            String(it.clave_patrimonial || '').toLowerCase() === t ||
            String(it.no_serie || '').toLowerCase() === t ||
            String(it.id) === trimmed
          )
          if (exact) {
            match = exact
          } else {
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
      const debugMsg = raw !== trimmed
        ? `Leído: "${trimmed}"\n(original: "${raw}")`
        : `Leído: "${trimmed}"`
      setBigToast({
        kind: 'error',
        title: 'Código no encontrado',
        message: debugMsg,
        // Sin auto-dismiss: toca para cerrar
      })
      return
    }

    // Auto-marcar Localizado
    const okUpdate = await updateEstadoForItem(match, 'Localizado', null, 'scanner')
    if (okUpdate) {
      if (beepEnabled) beep()
      setBigToast({
        kind: 'ok',
        title: 'Localizado',
        message: `${match.folio || '#' + match.id} · ${match.descripcion || ''}`,
        auto: 2500,
      })
      // Si no estamos en modo ráfaga, cerrar scanner
      if (!burstMode) stopScan()
    }
  }, [token, burstMode, beepEnabled, updateEstadoForItem]) // eslint-disable-line
  // Mantener ref actualizada para el callback de zxing (evita stale closure)
  handleScannedCodeRef.current = handleScannedCode

  // ── Scanner cámara
  // startScan solo cambia estado; el useEffect de abajo inicia la cámara
  // DESPUÉS de que React renderice el <video> en el DOM.
  const startScan = () => {
    if (!scanCameraSupported) {
      setBigToast({ kind: 'info', title: 'Cámara no disponible', message: 'Usa búsqueda manual.', auto: 2500 })
      return
    }
    setScanning(true)
    setManualCode('')
  }
  const stopScan = () => {
    try { scanControlsRef.current?.stop() } catch {}
    scanControlsRef.current = null
    setScanning(false)
  }

  // Se ejecuta después de que React renderice el modal con <video> en el DOM
  useEffect(() => {
    if (!scanning) return
    let cancelled = false
    import('@zxing/browser').then(({ BrowserMultiFormatReader }) => {
      if (cancelled || !videoRef.current) return
      const codeReader = new BrowserMultiFormatReader()
      return codeReader.decodeFromConstraints(
        { video: { facingMode: 'environment' } },
        videoRef.current,
        (result) => { if (result) handleScannedCodeRef.current?.(result.getText(), { source: 'camera' }) }
      )
    }).then(controls => {
      if (!controls) return
      if (cancelled) controls.stop()
      else scanControlsRef.current = controls
    }).catch(() => {
      if (!cancelled) {
        setScanning(false)
        setBigToast({
          kind: 'error',
          title: 'No se pudo abrir la cámara',
          message: 'En iPhone: Ajustes › Safari › Cámara → Permitir.',
          auto: 5000,
        })
      }
    })
    return () => { cancelled = true }
  }, [scanning]) // eslint-disable-line

  // ── Logout
  const handleLogout = async () => {
    try {
      await fetch(`${API_BASE}/auditoria/${token}/logout`, {
        method: 'POST', credentials: 'include'
      })
    } catch {}
    setAuthState('needsLogin')
    setSession(null)
  }

  // ── Render: estados de auth
  if (authState === 'checking') {
    return <div className="pub-loading-page">Verificando enlace…</div>
  }
  if (authState === 'error') {
    return (
      <div className="pub-error-page">
        <FaTimes size={36} color="#b91c1c" />
        <h2>Enlace no válido</h2>
        <p>{authError}</p>
      </div>
    )
  }
  if (authState === 'needsLogin') {
    return (
      <LoginScreen
        token={token}
        sessionInfo={session}
        onSuccess={(sess) => { setSession(sess); setAuthState('ok'); }}
      />
    )
  }

  const expiresStr = new Date(session.expires_at).toLocaleString('es-MX', {
    dateStyle: 'medium', timeStyle: 'short'
  })
  const totalItems = pagination.total
  const pctSession = totalItems > 0 ? Math.round((reviewedInSession.size / totalItems) * 100) : 0
  const hasMore = pagination.page < pagination.total_pages

  return (
    <div className="pub-root">
      {/* Captador HID invisible (pistola USB de códigos de barras) */}
      <HIDScannerInput
        enabled={hidEnabled && !scanning}
        onScan={(code, m) => handleScannedCode(code, { source: 'hid', ...m })}
      />

      {/* Header */}
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
            <span className={`pub-stat pub-stat-net ${online ? 'pub-net-on' : 'pub-net-off'}`}
                  title={online ? 'En línea' : 'Sin conexión'}>
              {online ? <FaWifi size={11} /> : <MdSignalWifiOff size={13} />}
              {online ? 'En línea' : 'Offline'}
            </span>
            {pendingCount > 0 && (
              <span className="pub-stat pub-stat-pending"
                    title="Cambios pendientes de sincronizar"
                    onClick={flushQueue}>
                <FaSync size={10} className={syncing ? 'pub-spin' : ''} /> {pendingCount}
              </span>
            )}
            <button className="pub-btn-icon-mini" title="Salir" onClick={handleLogout}>
              <FaSignOutAlt size={13} />
            </button>
          </div>
        </div>

        {reviewedInSession.size > 0 && (
          <div className="pub-session-progress">
            <div className="pub-session-bar">
              <div className="pub-session-fill" style={{ width: `${pctSession}%` }} />
            </div>
            <span>{pctSession}% esta sesión</span>
          </div>
        )}
      </header>

      {/* Buscador */}
      <div className="pub-search-bar">
        <form className="pub-search-form" onSubmit={handleSearch}>
          <div className="pub-search-input-wrap">
            <FaSearch size={14} className="pub-search-icon" />
            <input
              type="text"
              placeholder="Buscar folio, ID, descripción, serie, marca…"
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
          <button type="button" className="pub-btn-scan" onClick={startScan} title="Escanear con cámara">
            <FaQrcode size={18} />
          </button>
          <button
            type="button"
            className={`pub-btn-filter ${showFilters ? 'active' : ''}`}
            onClick={() => setShowFilters(f => !f)}
            title="Filtros"
          >
            <FaFilter size={14} />
          </button>
        </form>

        {/* Chips de estado */}
        <div className="pub-estado-chips">
          <button className={`pub-chip ${!filters.estado ? 'pub-chip-active' : ''}`}
                  onClick={() => applyEstadoFilter('')}>Todos</button>
          {ESTADOS.map(e => {
            const c = ESTADO_CFG[e] || {}
            return (
              <button key={e}
                className={`pub-chip ${filters.estado === e ? 'pub-chip-active' : ''}`}
                style={filters.estado === e
                  ? { background: c.btn, color: '#fff', borderColor: c.btn }
                  : { color: c.btn, borderColor: c.border }}
                onClick={() => applyEstadoFilter(e)}>
                {e}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panel de filtros — fuera del sticky para evitar stacking context */}
      {showFilters && (
        <div className="pub-filters-panel">
          <div className="pub-filter-group">
            <label htmlFor="filter-id">ID</label>
            <input id="filter-id" type="number" placeholder="ID exacto…"
              value={filters.id}
              onChange={e => handleFilterField('id', e.target.value)} />
          </div>
          <div className="pub-filter-group">
            <label htmlFor="filter-ubicacion">Ubicación {filterOpts.ubicaciones.length > 0 && `(${filterOpts.ubicaciones.length})`}</label>
            <select
              id="filter-ubicacion"
              value={filters.ubicacion}
              onChange={e => handleFilterField('ubicacion', e.target.value)}
            >
              <option value="">Todas las ubicaciones</option>
              {filterOpts.ubicaciones.map(u => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className="pub-filter-group">
            <label htmlFor="filter-responsable">Responsable {filterOpts.responsables.length > 0 && `(${filterOpts.responsables.length})`}</label>
            <select
              id="filter-responsable"
              value={filters.responsable}
              onChange={e => handleFilterField('responsable', e.target.value)}
            >
              <option value="">Todos los responsables</option>
              {filterOpts.responsables.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div className="pub-filter-toggles">
            <label className="pub-toggle">
              <input type="checkbox" checked={hidEnabled} onChange={e => setHidEnabled(e.target.checked)} />
              <FaKeyboard size={12} /> Pistola USB activa
            </label>
            <label className="pub-toggle">
              <input type="checkbox" checked={beepEnabled} onChange={e => setBeepEnabled(e.target.checked)} />
              {beepEnabled ? <FaVolumeUp size={12} /> : <FaVolumeMute size={12} />} Beep
            </label>
            <label className="pub-toggle">
              <input type="checkbox" checked={burstMode} onChange={e => setBurstMode(e.target.checked)} />
              Modo ráfaga
            </label>
          </div>
        </div>
      )}

      {/* Toast grande */}
      {bigToast && (
        <div className={`pub-bigtoast pub-bigtoast-${bigToast.kind}`} onClick={() => setBigToast(null)}>
          <div className="pub-bigtoast-title">{bigToast.title}</div>
          {bigToast.message && <div className="pub-bigtoast-msg">{bigToast.message}</div>}
        </div>
      )}

      {/* Undo */}
      {undoEntry && (
        <div className="pub-undo">
          <span>Marcado como <strong>Localizado</strong>: {undoEntry.item.folio || '#' + undoEntry.item.id}</span>
          <button onClick={handleUndo}><FaUndo size={11} /> Deshacer</button>
        </div>
      )}

      {/* Modal escáner cámara */}
      {scanning && (
        <div className="pub-scan-modal" onClick={stopScan}>
          <div className="pub-scan-inner" onClick={e => e.stopPropagation()}>
            <div className="pub-scan-header">
              <span>{burstMode ? 'Modo ráfaga activo' : 'Apunta al código'}</span>
              <button onClick={stopScan}><FaTimes size={16} /></button>
            </div>
            <video ref={videoRef} className="pub-scan-video" playsInline muted />
            <div className="pub-scan-overlay"><div className="pub-scan-frame" /></div>

            {/* Entrada manual como alternativa */}
            <div className="pub-scan-manual">
              <input
                type="text"
                placeholder="O escribe folio, serie o ID…"
                value={manualCode}
                onChange={e => setManualCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && manualCode.trim()) {
                    handleScannedCode(manualCode.trim(), { source: 'manual' })
                    setManualCode('')
                  }
                }}
              />
              <button
                className="pub-scan-manual-btn"
                disabled={!manualCode.trim()}
                onClick={() => {
                  if (manualCode.trim()) {
                    handleScannedCode(manualCode.trim(), { source: 'manual' })
                    setManualCode('')
                  }
                }}
              >
                <FaCheck size={14} />
              </button>
            </div>

            <div className="pub-scan-toolbar">
              <label className="pub-toggle">
                <input type="checkbox" checked={burstMode} onChange={e => setBurstMode(e.target.checked)} />
                Ráfaga
              </label>
              <label className="pub-toggle">
                <input type="checkbox" checked={beepEnabled} onChange={e => setBeepEnabled(e.target.checked)} />
                {beepEnabled ? <FaVolumeUp size={11} /> : <FaVolumeMute size={11} />} Beep
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Lista */}
      <main className="pub-main">
        {loading ? (
          <div className="pub-loading">
            <div className="pub-spinner" />
            Cargando bienes…
          </div>
        ) : items.length === 0 ? (
          <div className="pub-empty">
            <FaSearch size={28} color="#cbd5e1" />
            <p>No se encontraron bienes.<br />Ajusta los filtros e intenta de nuevo.</p>
          </div>
        ) : (
          <>
            <div className="pub-result-info">
              {totalItems} resultados
              {filters.search && <> · búsqueda: <em>"{filters.search}"</em></>}
              {filters.id && <> · ID: <em>{filters.id}</em></>}
              {filters.estado && <> · estado: <em>{filters.estado}</em></>}
            </div>

            <div className="pub-cards-grid">
              {items.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onUpdate={updateEstadoForItem}
                  reviewedInSession={reviewedInSession}
                  online={online}
                />
              ))}
            </div>

            {hasMore && (
              <div className="pub-load-more">
                <button className="pub-btn-load-more" onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore
                    ? 'Cargando…'
                    : `Cargar más (${pagination.total - items.length} restantes)`}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}
