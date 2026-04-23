// =====================================================
// VISTA ADMIN: Auditoría de Campo
// Protegida con JWT (igual que el resto del sistema)
// =====================================================

import React, { useState, useEffect, useCallback } from 'react'
import { FaPlus, FaTrash, FaCopy, FaListAlt, FaCheck, FaTimes, FaKey, FaSync, FaEye } from 'react-icons/fa'
import { MdAssignmentTurnedIn } from 'react-icons/md'
import { toast } from 'react-toastify'
import './AuditoriaAdmin.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')

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

export default function AuditoriaAdmin() {
  const [sesiones, setSesiones] = useState([])
  const [totalItems, setTotalItems] = useState(0)
  const [loading, setLoading] = useState(false)

  // Modal crear sesión
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ intern_name: '', expires_in_hours: 8 })
  const [creating, setCreating] = useState(false)
  const [newCreds, setNewCreds] = useState(null) // { link, username, password, expires_in_hours }

  // Modal eventos
  const [showEvents, setShowEvents] = useState(false)
  const [selectedSesion, setSelectedSesion] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(false)

  // Modal "Ver acceso"
  const [showAccess, setShowAccess] = useState(false)
  const [accessData, setAccessData] = useState(null) // { intern_name, username, expires_at, ... }
  const [accessSesion, setAccessSesion] = useState(null)
  const [regenerated, setRegenerated] = useState(null) // { link, username, password }
  const [regenerating, setRegenerating] = useState(false)

  const fetchSesiones = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_BASE}/auditoria/sesiones`, { credentials: 'include' })
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
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (data.success) {
        setNewCreds({
          link: data.link,
          username: data.username,
          password: data.password,
          expires_in_hours: data.expires_in_hours,
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

  const copyAll = (creds) => {
    const text =
      `Auditoría de Campo — Acceso\n` +
      `Enlace: ${creds.link}\n` +
      `Usuario: ${creds.username}\n` +
      `Contraseña: ${creds.password}\n`
    copyText(text, 'Acceso completo copiado')
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
          username: data.username,
          password: data.password,
          expires_in_hours: data.expires_in_hours,
        })
        toast.success('Credenciales regeneradas')
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

  const closeAccess = () => {
    setShowAccess(false)
    setAccessSesion(null)
    setAccessData(null)
    setRegenerated(null)
  }

  const fmtDate = (iso) => iso
    ? new Date(iso).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })
    : '—'

  return (
    <div className="aud-admin">
      {/* Header */}
      <div className="aud-admin-header">
        <div className="aud-admin-title">
          <MdAssignmentTurnedIn size={22} />
          <h2>Auditoría de Campo</h2>
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
            <p>No hay sesiones activas.<br />Crea una para generar un enlace.</p>
          </div>
        ) : (
          <table className="aud-table">
            <thead>
              <tr>
                <th>Practicante</th>
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
                    <td className="aud-date">{fmtDate(s.last_seen_at)}</td>
                    <td className="aud-date">{fmtDate(s.expires_at)}</td>
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
                  Nombre del practicante
                  <input
                    type="text"
                    value={form.intern_name}
                    onChange={e => setForm(f => ({ ...f, intern_name: e.target.value }))}
                    placeholder="Ej: Ana García"
                    autoFocus
                  />
                </label>
                <label>
                  Vigencia (horas) — máx. 24
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
              <div className="aud-link-result">
                <FaCheck size={28} color="#2e7d32" />
                <p>Acceso generado para <strong>{form.intern_name}</strong></p>

                <div className="aud-cred-row">
                  <label>Enlace</label>
                  <div className="aud-link-box">
                    <span className="aud-link-text">{newCreds.link}</span>
                    <button onClick={() => copyText(newCreds.link, 'Enlace copiado')} title="Copiar enlace">
                      <FaCopy size={14} />
                    </button>
                  </div>
                </div>

                <div className="aud-cred-row">
                  <label>Usuario</label>
                  <div className="aud-link-box">
                    <span className="aud-link-text aud-mono">{newCreds.username}</span>
                    <button onClick={() => copyText(newCreds.username, 'Usuario copiado')} title="Copiar usuario">
                      <FaCopy size={14} />
                    </button>
                  </div>
                </div>

                <div className="aud-cred-row">
                  <label>Contraseña <span className="aud-cred-warn">(no se mostrará de nuevo)</span></label>
                  <div className="aud-link-box">
                    <span className="aud-link-text aud-mono">{newCreds.password}</span>
                    <button onClick={() => copyText(newCreds.password, 'Contraseña copiada')} title="Copiar contraseña">
                      <FaCopy size={14} />
                    </button>
                  </div>
                </div>

                <p className="aud-link-note">
                  Vigencia: {newCreds.expires_in_hours}h. Comparte el enlace y entrégale el usuario y contraseña por un canal aparte.
                </p>

                <div className="aud-modal-footer">
                  <button className="aud-btn-secondary" onClick={() => copyAll(newCreds)}>
                    <FaCopy size={12} /> Copiar todo
                  </button>
                  <button className="aud-btn-primary" onClick={resetCreate}>
                    Listo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Ver acceso de una sesión existente */}
      {showAccess && accessSesion && (
        <div className="aud-modal-backdrop" onClick={closeAccess}>
          <div className="aud-modal" onClick={e => e.stopPropagation()}>
            <div className="aud-modal-header">
              <h3><FaKey style={{ marginRight: 6 }} /> Acceso — {accessSesion.intern_name}</h3>
              <button className="aud-modal-close" onClick={closeAccess}><FaTimes /></button>
            </div>

            {!accessData ? (
              <div className="aud-loading">Cargando…</div>
            ) : regenerated ? (
              <div className="aud-link-result">
                <FaCheck size={28} color="#2e7d32" />
                <p><strong>Credenciales nuevas</strong> — entrégale ambos datos al practicante.</p>

                <div className="aud-cred-row">
                  <label>Enlace</label>
                  <div className="aud-link-box">
                    <span className="aud-link-text">{regenerated.link}</span>
                    <button onClick={() => copyText(regenerated.link, 'Enlace copiado')}><FaCopy size={14} /></button>
                  </div>
                </div>
                <div className="aud-cred-row">
                  <label>Usuario</label>
                  <div className="aud-link-box">
                    <span className="aud-link-text aud-mono">{regenerated.username}</span>
                    <button onClick={() => copyText(regenerated.username, 'Usuario copiado')}><FaCopy size={14} /></button>
                  </div>
                </div>
                <div className="aud-cred-row">
                  <label>Contraseña <span className="aud-cred-warn">(no se mostrará de nuevo)</span></label>
                  <div className="aud-link-box">
                    <span className="aud-link-text aud-mono">{regenerated.password}</span>
                    <button onClick={() => copyText(regenerated.password, 'Contraseña copiada')}><FaCopy size={14} /></button>
                  </div>
                </div>

                <div className="aud-modal-footer">
                  <button className="aud-btn-secondary" onClick={() => copyAll(regenerated)}>
                    <FaCopy size={12} /> Copiar todo
                  </button>
                  <button className="aud-btn-primary" onClick={closeAccess}>Listo</button>
                </div>
              </div>
            ) : (
              <div className="aud-link-result">
                <p>
                  <strong>Por seguridad</strong>, el enlace y la contraseña no se vuelven a mostrar.
                  Si el practicante los perdió, regenera credenciales nuevas.
                </p>

                <div className="aud-cred-row">
                  <label>Usuario</label>
                  <div className="aud-link-box">
                    <span className="aud-link-text aud-mono">{accessData.username || '— (sesión sin login)'}</span>
                    {accessData.username && (
                      <button onClick={() => copyText(accessData.username, 'Usuario copiado')}><FaCopy size={14} /></button>
                    )}
                  </div>
                </div>

                <div className="aud-cred-row">
                  <label>Vigencia</label>
                  <div className="aud-link-box">
                    <span className="aud-link-text">
                      {accessData.expires_in_hours}h · expira {fmtDate(accessData.expires_at)}
                    </span>
                  </div>
                </div>

                <div className="aud-modal-footer">
                  <button className="aud-btn-secondary" onClick={closeAccess}>Cerrar</button>
                  <button
                    className="aud-btn-primary"
                    onClick={handleRegenerate}
                    disabled={regenerating || !!accessData.revoked_at}
                    title={accessData.revoked_at ? 'Sesión revocada, crea una nueva' : 'Generar nuevo enlace y contraseña'}
                  >
                    <FaSync size={12} /> {regenerating ? 'Regenerando…' : 'Regenerar credenciales'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Eventos de una sesión */}
      {showEvents && selectedSesion && (
        <div className="aud-modal-backdrop" onClick={() => setShowEvents(false)}>
          <div className="aud-modal aud-modal-wide" onClick={e => e.stopPropagation()}>
            <div className="aud-modal-header">
              <h3>Actividad — {selectedSesion.intern_name}</h3>
              <button className="aud-modal-close" onClick={() => setShowEvents(false)}><FaTimes /></button>
            </div>
            {loadingEvents ? (
              <div className="aud-loading">Cargando…</div>
            ) : eventos.length === 0 ? (
              <div className="aud-empty">Sin actividad registrada aún.</div>
            ) : (
              <div className="aud-events-wrap">
                <table className="aud-table aud-events-table">
                  <thead>
                    <tr>
                      <th>Folio</th>
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
                        <td>{ev.folio || '—'}</td>
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
                        <td className="aud-date">{fmtDate(ev.ts)}</td>
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
