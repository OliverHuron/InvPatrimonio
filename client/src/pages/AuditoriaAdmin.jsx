// =====================================================
// VISTA ADMIN: Auditoría de Campo
// Protegida con JWT (igual que el resto del sistema)
// =====================================================

import React, { useState, useEffect, useCallback } from 'react'
import { FaPlus, FaTrash, FaCopy, FaListAlt, FaCheck, FaTimes } from 'react-icons/fa'
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
  const [form, setForm] = useState({ intern_name: '', expires_in_days: 7 })
  const [creating, setCreating] = useState(false)
  const [newLink, setNewLink] = useState(null)

  // Modal eventos
  const [showEvents, setShowEvents] = useState(false)
  const [selectedSesion, setSelectedSesion] = useState(null)
  const [eventos, setEventos] = useState([])
  const [loadingEvents, setLoadingEvents] = useState(false)

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
        setNewLink(data.link)
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

  const copyLink = (link) => {
    navigator.clipboard.writeText(link)
      .then(() => toast.success('Enlace copiado'))
      .catch(() => toast.error('No se pudo copiar'))
  }

  const resetCreate = () => {
    setShowCreate(false)
    setNewLink(null)
    setForm({ intern_name: '', expires_in_days: 7 })
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

            {!newLink ? (
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
                  Vigencia (días)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={form.expires_in_days}
                    onChange={e => setForm(f => ({ ...f, expires_in_days: parseInt(e.target.value) || 7 }))}
                  />
                </label>
                <div className="aud-modal-footer">
                  <button type="button" className="aud-btn-secondary" onClick={resetCreate}>
                    Cancelar
                  </button>
                  <button type="submit" className="aud-btn-primary" disabled={creating}>
                    {creating ? 'Creando…' : 'Crear enlace'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="aud-link-result">
                <FaCheck size={28} color="#2e7d32" />
                <p>Enlace generado para <strong>{form.intern_name}</strong></p>
                <div className="aud-link-box">
                  <span>{newLink}</span>
                  <button onClick={() => copyLink(newLink)} title="Copiar">
                    <FaCopy size={14} />
                  </button>
                </div>
                <p className="aud-link-note">
                  Válido por {form.expires_in_days} días. Envíaselo al practicante por WhatsApp o correo.
                </p>
                <button className="aud-btn-primary" onClick={resetCreate}>
                  Listo
                </button>
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
