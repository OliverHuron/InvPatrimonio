// =====================================================
// VISTA ADMIN: Auditoría de Campo
// Protegida con JWT (igual que el resto del sistema)
// =====================================================

import React, { useState, useEffect, useCallback } from 'react'
import { FaPlus, FaTrash, FaCopy, FaListAlt, FaTimes, FaSync, FaEye, FaExternalLinkAlt, FaWhatsapp, FaEnvelope } from 'react-icons/fa'
import { MdAssignmentTurnedIn } from 'react-icons/md'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'react-toastify'
import { useAuth } from '../context/AuthContext'
import './AuditoriaAdmin.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')
const URES_KEY = 'patrimonio_ures_config'

function getUresCodes() {
  try { return JSON.parse(localStorage.getItem(URES_KEY) || '[]') } catch { return [] }
}

const ESTADO_COLORS = {
  'Localizado':    { bg: '#fefce8', color: '#854d0e' },
  'Sin asignar':   { bg: '#f8fafc', color: '#475569' },
  'Baja':          { bg: '#f0fdf4', color: '#166534' },
  'No Localizado': { bg: '#eff6ff', color: '#1e40af' },
}

function ProgressBar({ value }) {
  const pct = Math.min(100, Math.max(0, value))
  return (
    <div className="aud-progress-bar">
      <div className="aud-progress-fill" style={{ width: `${pct}%` }} />
      <span className="aud-progress-label">{pct}%</span>
    </div>
  )
}

function fmtExpiry(iso) {
  if (!iso) return '—'
  const d = new Date(iso.includes('Z') || iso.includes('+') ? iso : iso.replace(' ', 'T') + 'Z')
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
}

function SharePanel({ link, internName, expiresAt, expiresInHours, onDone }) {
  const waText = encodeURIComponent(`Enlace de acceso para auditoría de bienes patrimoniales:\n${link}`)
  const mailSub = encodeURIComponent('Acceso — Auditoría Patrimonial')
  const mailBody = encodeURIComponent(`Aquí tienes tu enlace de acceso para la auditoría:\n\n${link}\n\nVigencia: ${expiresInHours} hora(s).`)
  const copyLink = () => navigator.clipboard.writeText(link).then(() => toast.success('Enlace copiado'))
  return (
    <div className="aud-share-panel">
      <p className="aud-share-name">Acceso para <strong>{internName}</strong></p>
      <div className="aud-share-qr">
        <QRCodeSVG value={link} size={200} level="M" includeMargin />
      </div>
      <p className="aud-share-expiry">Expira: {fmtExpiry(expiresAt)}</p>
      <div className="aud-share-btns">
        <button className="aud-share-btn" onClick={() => window.open(link, '_blank', 'noopener')} title="Abrir enlace">
          <FaExternalLinkAlt size={16} />
        </button>
        <button className="aud-share-btn" onClick={copyLink} title="Copiar enlace">
          <FaCopy size={16} />
        </button>
        <a className="aud-share-btn aud-share-btn--wa" href={`https://wa.me/?text=${waText}`} target="_blank" rel="noopener noreferrer" title="Enviar por WhatsApp">
          <FaWhatsapp size={16} />
        </a>
        <a className="aud-share-btn aud-share-btn--mail" href={`mailto:?subject=${mailSub}&body=${mailBody}`} title="Enviar por correo">
          <FaEnvelope size={16} />
        </a>
      </div>
      {onDone && (
        <div className="aud-share-done">
          <button className="aud-btn-primary" onClick={onDone}>Listo</button>
        </div>
      )}
    </div>
  )
}

export default function AuditoriaAdmin() {
  const { user } = useAuth()
  const [sesiones, setSesiones] = useState([])
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(false)

  // Modal crear sesión
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ intern_name: '', expires_in_hours: 8 })
  const [creating, setCreating] = useState(false)
  const [newCreds, setNewCreds] = useState(null) // { link, expires_at, expires_in_hours }

  // Modal eventos
  const [showEvents, setShowEvents] = useState(false)
  const [selectedSesion, setSelectedSesion] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Modal "Ver acceso"
  const [showAccess, setShowAccess] = useState(false)
  const [accessData, setAccessData] = useState(null) // { intern_name, link, expires_at, ... }
  const [accessSesion, setAccessSesion] = useState(null)
  const [regenerated, setRegenerated] = useState(null) // { link, expires_at, expires_in_hours }
  const [regenerating, setRegenerating] = useState(false)
  const [refreshingJsession, setRefreshingJsession] = useState(false)

  const fetchSesiones = useCallback(async () => {
    setLoading(true)
    try {
      const ures = getUresCodes()
      const params = new URLSearchParams()
      if (ures.length) params.set('ures', ures.join(','))
      if (user?.username) params.set('admin_username', user.username)
      const uresParam = params.toString() ? `?${params.toString()}` : ''
      const res = await fetch(`${API_BASE}/auditoria/sesiones${uresParam}`, { credentials: 'include' })
      const data = await res.json()
      if (data.success) {
        setSesiones(data.data)
        setTotalItems(data.total_items)
      } else {
        console.error('[Auditoria] fetchSesiones error:', res.status, data.message)
        toast.error(`Error ${res.status}: ${data.message || 'No se pudo cargar la lista'}`)
      }
    } catch (err) {
      toast.error('Error de red: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchSesiones() }, [fetchSesiones])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!form.intern_name.trim()) return toast.warning('Ingresa el nombre del practicante')
    setCreating(true)
    try {
      const res = await fetch(`${API_BASE}/auditoria/sesiones`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ures_codes: getUresCodes(), admin_username: user?.username })
      })
      const data = await res.json()
      if (data.success) {
        setNewCreds({
          link: data.link,
          expires_at: data.expires_at,
          expires_in_hours: data.expires_in_hours,
          intern_name: String(form.intern_name).trim(),
        })
        fetchSesiones()
      } else {
        toast.error(`Error ${res.status}: ${data.message || 'Error creando sesión'}`)
      }
    } catch (err) {
      toast.error('Error de red: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id, name) => {
    if (!window.confirm(`¿Revocar el enlace de ${name}?`)) return
    try {
      const res = await fetch(`${API_BASE}/auditoria/sesiones/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) {
        toast.success('Enlace revocado')
        fetchSesiones()
      } else {
        toast.error(data.message)
      }
    } catch {
      toast.error('Error de red')
    }
  }

  const handleShowEvents = async (sesion) => {
    setSelectedSesion(sesion)
    setShowEvents(true)
    setLoadingEvents(true)
    try {
      const res = await fetch(`${API_BASE}/auditoria/sesiones/${sesion.id}/eventos`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) setEventos(data.data)
    } catch {
      toast.error('Error cargando eventos')
    } finally {
      setLoadingEvents(false)
    }
  }

  const copyText = (text, label = 'Copiado') => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(label))
      .catch(() => toast.error('No se pudo copiar'))
  }

  const handleShowAccess = async (sesion) => {
    setAccessSesion(sesion)
    setShowAccess(true)
    setAccessData(null)
    setRegenerated(null)
    try {
      const res = await fetch(`${API_BASE}/auditoria/sesiones/${sesion.id}/access`, {
        credentials: 'include'
      })
      const data = await res.json()
      if (data.success) setAccessData(data.data)
      else toast.error(data.message || 'No se pudo obtener acceso')
    } catch {
      toast.error('Error de red')
    }
  }

  const handleRegenerate = async () => {
    if (!accessSesion) return
    if (!window.confirm(
      'Esto invalidará el enlace y la contraseña actuales. ¿Continuar?'
    )) return
    setRegenerating(true)
    try {
      const res = await fetch(
        `${API_BASE}/auditoria/sesiones/${accessSesion.id}/regenerate`,
        { method: 'POST', credentials: 'include' }
      )
      const data = await res.json()
      if (data.success) {
        setRegenerated({
          link: data.link,
          expires_at: data.expires_at,
          expires_in_hours: data.expires_in_hours,
        })
        toast.success('Enlace regenerado')
        fetchSesiones()
      } else {
        toast.error(data.message || 'Error regenerando')
      }
    } catch {
      toast.error('Error de red')
    } finally {
      setRegenerating(false)
    }
  }

  const resetCreate = () => {
    setShowCreate(false)
    setNewCreds(null)
    setForm({ intern_name: '', expires_in_hours: 8 })
  }

  const handleRefreshJsession = async () => {
    if (!accessSesion) return
    setRefreshingJsession(true)
    try {
      const res = await fetch(
        `${API_BASE}/auditoria/sesiones/${accessSesion.id}/refresh-jsession`,
        { method: 'POST', credentials: 'include' }
      )
      const data = await res.json()
      if (data.success) toast.success('Sesión UMICH actualizada. Los bienes deberían cargar ahora.')
      else toast.error(data.message || 'Error al actualizar')
    } catch {
      toast.error('Error de red')
    } finally {
      setRefreshingJsession(false)
    }
  }

  const closeAccess = () => {
    setShowAccess(false)
    setAccessSesion(null)
    setAccessData(null)
    setRegenerated(null)
  }

  return (
    <div className="aud-admin">
      {/* Header */}
      <div className="aud-admin-header">
        <div className="aud-admin-title">
          <MdAssignmentTurnedIn size={22} />
          <h2>Auditoría</h2>
          <span className="aud-total-badge">{totalItems} bienes</span>
        </div>
        <button className="aud-btn-create" onClick={() => setShowCreate(true)}>
          <FaPlus size={13} /> Nueva sesión
        </button>
      </div>

      {/* Tabla de sesiones */}
      <div className="aud-table-wrap">
        {loading ? (
          <div className="aud-loading">Cargando sesiones…</div>
        ) : sesiones.length === 0 ? (
          <div className="aud-empty">
            <MdAssignmentTurnedIn size={40} color="#ccc" />
            <p>No hay sesiones activas.<br />Cree una para generar un enlace.</p>
          </div>
        ) : (
          <table className="aud-table">
            <thead>
              <tr>
                <th>Auditor</th>
                <th>Progreso</th>
                <th>Revisados</th>
                <th>Último acceso</th>
                <th>Expira</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {sesiones.map(s => {
                const estado = s.revocada ? 'Revocada'
                  : s.expirada ? 'Expirada'
                  : 'Activa'
                return (
                  <tr key={s.id} className={estado !== 'Activa' ? 'aud-row-inactive' : ''}>
                    <td className="aud-intern-name">{s.intern_name}</td>
                    <td><ProgressBar value={s.porcentaje} /></td>
                    <td className="aud-count">{s.items_revisados} / {totalItems}</td>
                    <td className="aud-date">{fmtExpiry(s.last_seen_at)}</td>
                    <td className="aud-date">{fmtExpiry(s.expires_at)}</td>
                    <td>
                      <span className={`aud-estado-badge aud-estado-${estado.toLowerCase()}`}>
                        {estado}
                      </span>
                    </td>
                    <td className="aud-actions-cell">
                      <button
                        className="aud-btn-icon"
                        title="Ver acceso (link + usuario)"
                        onClick={() => handleShowAccess(s)}
                      >
                        <FaEye size={14} />
                      </button>
                      <button
                        className="aud-btn-icon"
                        title="Ver actividad"
                        onClick={() => handleShowEvents(s)}
                      >
                        <FaListAlt size={14} />
                      </button>
                      {estado === 'Activa' && (
                        <button
                          className="aud-btn-icon aud-btn-danger"
                          title="Revocar enlace"
                          onClick={() => handleRevoke(s.id, s.intern_name)}
                        >
                          <FaTrash size={13} />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal: Crear sesión */}
      {showCreate && (
        <div className="aud-modal-backdrop" onClick={resetCreate}>
          <div className="aud-modal" onClick={e => e.stopPropagation()}>
            <div className="aud-modal-header">
              <h3>Nueva sesión de auditoría</h3>
              <button className="aud-modal-close" onClick={resetCreate}><FaTimes /></button>
            </div>

            {!newCreds ? (
              <form onSubmit={handleCreate} className="aud-create-form">
                <label>
                  Nombre del Auditor
                  <input
                    type="text"
                    value={form.intern_name}
                    onChange={e => setForm(f => ({ ...f, intern_name: e.target.value }))}
                    placeholder="Ej: Ana García"
                    autoFocus
                  />
                </label>
                <label>
                  Vigencia (horas, máximo 24)
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={form.expires_in_hours}
                    onChange={e => setForm(f => ({
                      ...f,
                      expires_in_hours: Math.min(24, Math.max(1, parseInt(e.target.value) || 8))
                    }))}
                  />
                </label>
                <div className="aud-modal-footer">
                  <button type="button" className="aud-btn-secondary" onClick={resetCreate}>
                    Cancelar
                  </button>
                  <button type="submit" className="aud-btn-primary" disabled={creating}>
                    {creating ? 'Creando…' : 'Crear acceso'}
                  </button>
                </div>
              </form>
            ) : (
              <SharePanel
                link={newCreds.link}
                internName={newCreds.intern_name}
                expiresAt={newCreds.expires_at}
                expiresInHours={newCreds.expires_in_hours}
                onDone={resetCreate}
              />
            )}
          </div>
        </div>
      )}

      {/* Modal: Ver acceso de una sesión existente */}
      {showAccess && accessSesion && (
        <div className="aud-modal-backdrop" onClick={closeAccess}>
          <div className="aud-modal" onClick={e => e.stopPropagation()}>
            <div className="aud-modal-header">
              <h3>Acceso — {accessSesion.intern_name}</h3>
              <button className="aud-modal-close" onClick={closeAccess}><FaTimes /></button>
            </div>

            {!accessData ? (
              <div className="aud-loading">Cargando…</div>
            ) : regenerated ? (
              <SharePanel
                link={regenerated.link}
                internName={accessSesion.intern_name}
                expiresAt={regenerated.expires_at}
                expiresInHours={regenerated.expires_in_hours}
                onDone={closeAccess}
              />
            ) : (
              <>
                {accessData.link && !accessData.revoked_at ? (
                  <SharePanel
                    link={accessData.link}
                    internName={accessSesion.intern_name}
                    expiresAt={accessData.expires_at}
                    expiresInHours={accessData.expires_in_hours}
                  />                ) : (
                  <p className="aud-result-intro" style={{ padding: '1rem' }}>
                    {accessData.revoked_at
                      ? 'Esta sesión está revocada. Crea una nueva.'
                      : 'No hay enlace disponible. Regenera el acceso.'}
                  </p>
                )}
                <div className="aud-modal-footer">
                  <button className="aud-btn-secondary" onClick={closeAccess}>Cerrar</button>
                  <button
                    className="aud-btn-secondary"
                    onClick={handleRefreshJsession}
                    disabled={refreshingJsession || !!accessData.revoked_at}
                    title="Actualiza la sesión UMICH con tu sesión activa"
                  >
                    <FaSync size={12} /> {refreshingJsession ? 'Actualizando…' : 'Actualizar UMICH'}
                  </button>
                  <button
                    className="aud-btn-primary"
                    onClick={handleRegenerate}
                    disabled={regenerating || !!accessData.revoked_at}
                    title={accessData.revoked_at ? 'Sesión revocada' : 'Generar nuevo enlace'}
                  >
                    <FaSync size={12} /> {regenerating ? 'Regenerando…' : 'Regenerar enlace'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal: Eventos de una sesión */}
      {showEvents && selectedSesion && (
        <div className="aud-modal-backdrop" onClick={() => setShowEvents(false)}>
          <div className="aud-modal aud-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="aud-modal-header">
              <h3>Actividad de {selectedSesion.intern_name}</h3>
              <button className="aud-modal-close" onClick={() => setShowEvents(false)}><FaTimes /></button>
            </div>
            {loadingEvents ? (
              <div className="aud-loading">Cargando…</div>
            ) : eventos.length === 0 ? (
              <div className="aud-empty">Sin actividad registrada.</div>
            ) : (
              <div className="aud-events-wrap">
                <table className="aud-table aud-events-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Descripción</th>
                      <th>Anterior</th>
                      <th>Nuevo</th>
                      <th>Observaciones</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {eventos.map(ev => (
                      <tr key={ev.id}>
                        <td>{ev.inventario_id || '—'}</td>
                        <td className="aud-desc">{ev.descripcion}</td>
                        <td>
                          <span
                            className="aud-estado-badge"
                            style={ESTADO_COLORS[ev.valor_anterior] || {}}
                          >
                            {ev.valor_anterior || '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            className="aud-estado-badge"
                            style={ESTADO_COLORS[ev.valor_nuevo] || {}}
                          >
                            {ev.valor_nuevo}
                          </span>
                        </td>
                        <td>{ev.observaciones || '—'}</td>
                        <td className="aud-date">{fmtExpiry(ev.ts)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
