import React, { useState, useRef, useCallback, useEffect } from 'react'
import * as XLSX from 'xlsx-js-style'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { FaTimes, FaFileExcel, FaFilePdf } from 'react-icons/fa'
import { normalizeInterno, RM_COLUMNS, ALL_COLUMNS } from '../utils/inventoryUtils'
import './SmartExportModal.css'

const API_BASE = (process.env.REACT_APP_API_URL || '/api').replace(/\/$/, '')
const PAGE_FETCH = 200

const cloneColumns = (cols) => cols.map((c, i) => ({ ...c, _id: `${c.key}_${i}`, hidden: false }))

export default function SmartExportModal({
  onClose,
  filters,
  filterOptions,
  previewItems = [],
  getUresCodes,
  getEstadoLocalizacion,
  allowManualSelection = true,
  inline = false,
  initialSelectedItems = null,
}) {
  const loggedUsername = (() => {
    try { return JSON.parse(localStorage.getItem('userData') || '{}').username || '' } catch { return '' }
  })()

  // Static defaults for columns whose values don't come from the API
  const COLUMN_STATIC_DEFAULTS = {
    numero_empleado_usuario: loggedUsername,
    puesto: 'Director',
  }

  const [exportMode, setExportMode]     = useState('rm')
  const [exportFormat, setExportFormat] = useState('excel')
  const [columns, setColumns]           = useState(() => cloneColumns(RM_COLUMNS))
  const [scope, setScope]               = useState(() => (initialSelectedItems && initialSelectedItems.size > 0) ? 'manual' : 'all')
  const [localFilters, setLocalFilters] = useState({
    q: filters?.q || '',
    responsable: filters?.responsable || '',
    ubicacion: filters?.ubicacion || '',
    ejercicio: filters?.ejercicio || '',
    estado: filters?.estado || '',
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState(null)

  // Column value overrides for export
  const [columnOverrides, setColumnOverrides] = useState({})
  const setColMode = (key, mode) =>
    setColumnOverrides(prev => ({ ...prev, [key]: { mode, value: prev[key]?.value || '' } }))
  const setColValue = (key, value) =>
    setColumnOverrides(prev => ({ ...prev, [key]: { ...prev[key], value } }))

  // Filter options (derived from prop or fetched internally)
  const [resolvedFilterOptions, setResolvedFilterOptions] = useState(filterOptions || null)

  // Manual selection state
  const [manualRows, setManualRows]         = useState([])
  const [manualLoading, setManualLoading]   = useState(false)
  const [manualSelected, setManualSelected] = useState(() => initialSelectedItems ? new Map(initialSelectedItems) : new Map())
  const [manualSearch, setManualSearch]     = useState('')

  // Drag & drop
  const dragSrcRef = useRef(null)
  const [dragOverId, setDragOverId] = useState(null)

  // ── Fetch filter options when needed and not provided via prop ────────────
  useEffect(() => {
    if (filterOptions) { setResolvedFilterOptions(filterOptions); return }
    if (scope !== 'filters') return
    if (resolvedFilterOptions) return
    let cancelled = false
    const load = async () => {
      try {
        const ures = getUresCodes ? getUresCodes() : ''
        const params = new URLSearchParams({ page: '1', limit: '10000' })
        if (ures) params.set('ures', ures)
        const res = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, { credentials: 'include' })
        if (!res.ok || cancelled) return
        const data = await res.json()
        const records = (data?.data?.items || []).map(normalizeInterno)
        if (!cancelled) setResolvedFilterOptions({
          responsables: [...new Set(records.map(x => x.responsable).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          ubicaciones:  [...new Set(records.map(x => x.ubicacion).filter(Boolean))].sort((a,b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
          aniosElaboracion: [...new Set(records.map(x => x.ejercicio ? String(x.ejercicio) : '').filter(y => /^\d{4}$/.test(y)))].sort((a,b) => Number(b) - Number(a)),
        })
      } catch { /* ignore */ }
    }
    load()
    return () => { cancelled = true }
  }, [scope, filterOptions, getUresCodes, resolvedFilterOptions])

  // ── Mode ──────────────────────────────────────────────────────────────────
  const handleModeChange = (mode) => {
    setExportMode(mode)
    setColumns(cloneColumns(mode === 'rm' ? RM_COLUMNS : ALL_COLUMNS))
    setColumnOverrides({})
  }

  // ── Columns ───────────────────────────────────────────────────────────────
  const hideColumn   = (id) => setColumns(prev => prev.map(c => c._id === id ? { ...c, hidden: true }  : c))
  const restoreColumn = (id) => setColumns(prev => prev.map(c => c._id === id ? { ...c, hidden: false } : c))
  const restoreAll   = ()   => setColumns(prev => prev.map(c => ({ ...c, hidden: false })))

  // ── Drag & drop ───────────────────────────────────────────────────────────
  const handleDragStart = (e, id) => { dragSrcRef.current = id; e.dataTransfer.effectAllowed = 'move' }
  const handleDragOver  = (e, id) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; if (dragOverId !== id) setDragOverId(id) }
  const handleDragLeave = () => setDragOverId(null)
  const handleDrop = (e, targetId) => {
    e.preventDefault(); setDragOverId(null)
    const srcId = dragSrcRef.current
    if (!srcId || srcId === targetId) return
    setColumns(prev => {
      const arr = [...prev]
      const si = arr.findIndex(c => c._id === srcId)
      const ti = arr.findIndex(c => c._id === targetId)
      if (si < 0 || ti < 0) return prev
      const [removed] = arr.splice(si, 1)
      arr.splice(ti, 0, removed)
      return arr
    })
    dragSrcRef.current = null
  }
  const handleDragEnd = () => { dragSrcRef.current = null; setDragOverId(null) }

  // ── Manual selection: fetch rows when scope=manual ────────────────────────
  useEffect(() => {
    if (scope !== 'manual') return
    let cancelled = false
    const load = async () => {
      setManualLoading(true)
      try {
        const ures = getUresCodes ? getUresCodes() : ''
        const allRows = []
        let page = 1, totalPages = 1
        while (page <= totalPages) {
          const params = new URLSearchParams({ page: String(page), limit: '100' })
          if (ures) params.set('ures', ures)
          const res = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, { credentials: 'include' })
          if (!res.ok) break
          const data = await res.json()
          const payload = data?.data || {}
          allRows.push(...(payload.items || []).map(normalizeInterno))
          totalPages = payload.pages || 1
          page++
        }
        if (!cancelled) setManualRows(allRows)
      } catch { /* ignore */ }
      finally { if (!cancelled) setManualLoading(false) }
    }
    load()
    return () => { cancelled = true }
  }, [scope, getUresCodes])

  const toggleManualRow = (row) => {
    setManualSelected(prev => {
      const next = new Map(prev)
      if (next.has(row.id)) next.delete(row.id)
      else next.set(row.id, row)
      return next
    })
  }

  const clearManualSelection = () => setManualSelected(new Map())

  // ── Data fetch for export ─────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (scope === 'manual') return Array.from(manualSelected.values())
    const ures = getUresCodes ? getUresCodes() : ''
    const allRows = []
    let page = 1, totalPages = 1
    while (page <= totalPages) {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_FETCH) })
      if (ures) params.set('ures', ures)
      if (scope === 'filters') {
        Object.entries(localFilters).forEach(([k, v]) => { if (v) params.set(k, v) })
      }
      const res = await fetch(`${API_BASE}/patrimonioci?${params.toString()}`, { credentials: 'include' })
      if (!res.ok) throw new Error(`Error ${res.status}`)
      const data = await res.json()
      const payload = data?.data || {}
      allRows.push(...(payload.items || []).map(normalizeInterno))
      totalPages = payload.pages || 1
      page++
    }
    return allRows
  }, [scope, localFilters, manualSelected, getUresCodes])

  const getCellValue = (col, row) => {
    if (col.getValue) return col.getValue(row, getEstadoLocalizacion) ?? ''
    return row[col.key] ?? ''
  }

  const getExportCellValue = (col, row) => {
    const ov = columnOverrides[col.key]
    if (ov?.mode === 'empty') return ''
    if (ov?.mode === 'manual') return ov.value ?? ''
    // default: static overrides take priority over API value
    if (col.key in COLUMN_STATIC_DEFAULTS) return COLUMN_STATIC_DEFAULTS[col.key]
    return getCellValue(col, row)
  }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format) => {
    setIsExporting(true)
    setExportError(null)
    try {
      const rows = await fetchData()
      if (rows.length === 0) { setExportError('No se encontraron registros para exportar.'); return }
      const visibleCols = columns.filter(c => !c.hidden)
      const headers = visibleCols.map(c => c.label)
      const body = rows.map(row => visibleCols.map(col => String(getExportCellValue(col, row) ?? '')))
      const date = new Date().toISOString().slice(0, 10)
      const suf = exportMode === 'rm' ? 'rm' : 'completo'

      if (format === 'excel') {
        const ws = XLSX.utils.aoa_to_sheet([headers, ...body])
        ws['!cols'] = headers.map((h, i) => ({
          wch: Math.max(h.length, ...body.slice(0, 200).map(r => String(r[i] || '').length), 8)
        }))
        headers.forEach((_, ci) => {
          const cellRef = XLSX.utils.encode_cell({ r: 0, c: ci })
          if (!ws[cellRef]) return
          ws[cellRef].s = {
            fill: { fgColor: { rgb: 'DCDCDC' } },
            font: { bold: true, color: { rgb: '323232' } },
            alignment: { horizontal: 'center' },
          }
        })
        const wb = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(wb, ws, 'Inventario')
        XLSX.writeFile(wb, `inventario_${suf}_${date}.xlsx`, { cellStyles: true })
      } else {
        const orientation = visibleCols.length > 8 ? 'landscape' : 'portrait'
        const doc = new jsPDF({ orientation, unit: 'pt', format: 'a4' })
        doc.setFontSize(10)
        doc.text(`Inventario Patrimonial — ${exportMode === 'rm' ? 'RM-01' : 'Completo'} — ${date}`, 40, 30)
        autoTable(doc, {
          head: [headers], body,
          startY: 45,
          styles: { fontSize: 6.5, cellPadding: 2, overflow: 'linebreak' },
          headStyles: { fillColor: [220, 220, 220], textColor: 50, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 252] },
          margin: { left: 30, right: 30 },
        })
        doc.save(`inventario_${suf}_${date}.pdf`)
      }
      if (!inline) onClose()
    } catch (err) {
      console.error('[SmartExport]', err)
      setExportError(`Error al exportar: ${err.message}`)
    } finally {
      setIsExporting(false)
    }
  }

  const visibleCols  = columns.filter(c => !c.hidden)
  const hiddenCols   = columns.filter(c => c.hidden)
  const manualCount  = manualSelected.size

  // ── Shared body ───────────────────────────────────────────────────────────
  const bodyContent = (
    <>
      {/* ── Table: preview or manual selection ── */}
      <div className="sem-section sem-section--table">
        <div className="sem-section-label">
          {scope === 'manual' ? 'Selección manual' : 'Previsualización'}
          {scope !== 'manual' && <span className="sem-section-hint">≡ arrastra · × oculta</span>}
          {scope === 'manual' && manualLoading && <span className="sem-section-hint">Cargando…</span>}
        </div>

        {scope === 'manual' && !manualLoading && (
          <input
            className="sem-filter-input sem-manual-search"
            placeholder="Buscar en la lista…"
            value={manualSearch}
            onChange={e => setManualSearch(e.target.value)}
          />
        )}

        <div className={`sem-table-wrap${scope === 'manual' ? ' sem-table-wrap--selectable' : ''}`}>
          <table className="sem-preview-table">
            <thead>
              <tr>
                {visibleCols.map(col => (
                  <th
                    key={col._id}
                    draggable={scope !== 'manual'}
                    onDragStart={scope !== 'manual' ? e => handleDragStart(e, col._id) : undefined}
                    onDragOver={scope !== 'manual' ? e => handleDragOver(e, col._id) : undefined}
                    onDragLeave={scope !== 'manual' ? handleDragLeave : undefined}
                    onDrop={scope !== 'manual' ? e => handleDrop(e, col._id) : undefined}
                    onDragEnd={scope !== 'manual' ? handleDragEnd : undefined}
                    className={`sem-th${dragOverId === col._id ? ' sem-th--drag-over' : ''}${scope === 'manual' ? ' sem-th--static' : ''}`}
                  >
                    {scope !== 'manual' && <span className="sem-th-grip">≡</span>}
                    <span className="sem-th-label">{col.label}</span>
                    {scope !== 'manual' && (
                      <button className="sem-th-remove" onMouseDown={e => e.stopPropagation()} onClick={() => hideColumn(col._id)} title="Ocultar columna">×</button>
                    )}
                  </th>
                ))}
                {visibleCols.length === 0 && <th className="sem-th sem-th--empty">— sin columnas —</th>}
              </tr>
            </thead>
            <tbody>
              {scope === 'manual'
                ? manualLoading
                  ? [0,1,2,3,4].map(i => (
                      <tr key={i} className="sem-tr--placeholder">
                        {visibleCols.map(col => (
                          <td key={col._id} className="sem-td">
                            <div className="sem-placeholder-line" style={{ width: `${55 + (col._id.charCodeAt(0) % 4) * 12}%` }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  : manualRows
                    .filter(row => {
                      if (!manualSearch.trim()) return true
                      const q = manualSearch.toLowerCase()
                      return visibleCols.some(col =>
                        String(getCellValue(col, row) || '').toLowerCase().includes(q)
                      )
                    })
                    .map(row => (
                      <tr
                        key={row.id}
                        className={`sem-tr--selectable${manualSelected.has(row.id) ? ' sem-tr--selected' : ''}`}
                        onClick={() => toggleManualRow(row)}
                      >
                        {visibleCols.map(col => (
                          <td key={col._id} className="sem-td">
                            {String(getCellValue(col, row) || '—').slice(0, 35)}
                          </td>
                        ))}
                      </tr>
                    ))
                : (
                  <tr>
                    {visibleCols.map(col => {
                      const ov = columnOverrides[col.key]
                      const mode = ov?.mode || 'default'
                      const staticVal = COLUMN_STATIC_DEFAULTS[col.key]
                      const sampleVal = staticVal !== undefined
                        ? String(staticVal)
                        : (previewItems[0] ? String(getCellValue(col, previewItems[0]) || '') : '')
                      return (
                        <td key={col._id} className={`sem-td sem-td--config sem-td--config-${mode}`}>
                          <select
                            className="sem-col-mode-select"
                            value={mode}
                            onChange={e => setColMode(col.key, e.target.value)}
                          >
                            <option value="default">Predeterminado</option>
                            <option value="empty">Vacío</option>
                            <option value="manual">Manual…</option>
                          </select>
                          {mode === 'manual' && (
                            <input
                              className="sem-col-manual-input"
                              value={ov?.value ?? ''}
                              onChange={e => setColValue(col.key, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              autoFocus
                              placeholder="Valor fijo…"
                            />
                          )}
                          {mode === 'default' && sampleVal && (
                            <span className="sem-col-preview-val" title={sampleVal}>
                              {sampleVal.slice(0, 22)}
                            </span>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              }
            </tbody>
          </table>
        </div>

        {hiddenCols.length > 0 && scope !== 'manual' && (
          <button className="sem-restore-all-btn" onClick={restoreAll}>↺ Restaurar todo</button>
        )}
      </div>

      {/* ── Filtros expandibles ── */}
      {scope === 'filters' && (
        <div className="sem-filters">

          {resolvedFilterOptions?.responsables?.length > 0
            ? <select className="sem-filter-input" value={localFilters.responsable} onChange={e => setLocalFilters(f => ({ ...f, responsable: e.target.value }))}>
                <option value="">Responsable (todos)</option>
                {resolvedFilterOptions.responsables.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            : <input className="sem-filter-input" placeholder="Responsable..." value={localFilters.responsable}
                onChange={e => setLocalFilters(f => ({ ...f, responsable: e.target.value }))} />
          }

          {resolvedFilterOptions?.ubicaciones?.length > 0
            ? <select className="sem-filter-input" value={localFilters.ubicacion} onChange={e => setLocalFilters(f => ({ ...f, ubicacion: e.target.value }))}>
                <option value="">Ubicación (todas)</option>
                {resolvedFilterOptions.ubicaciones.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            : <input className="sem-filter-input" placeholder="Ubicación..." value={localFilters.ubicacion}
                onChange={e => setLocalFilters(f => ({ ...f, ubicacion: e.target.value }))} />
          }

          {resolvedFilterOptions?.aniosElaboracion?.length > 0
            ? <select className="sem-filter-input" value={localFilters.ejercicio} onChange={e => setLocalFilters(f => ({ ...f, ejercicio: e.target.value }))}>
                <option value="">Ejercicio (todos)</option>
                {resolvedFilterOptions.aniosElaboracion.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            : <input className="sem-filter-input" placeholder="Ejercicio..." value={localFilters.ejercicio}
                onChange={e => setLocalFilters(f => ({ ...f, ejercicio: e.target.value }))} />
          }

          <select className="sem-filter-input" value={localFilters.estado} onChange={e => setLocalFilters(f => ({ ...f, estado: e.target.value }))}>
            <option value="">Estado (todos)</option>
            <option value="Sin asignar">Sin asignar</option>
            <option value="Localizado">Localizado</option>
            <option value="Baja">Baja</option>
            <option value="No Localizado">No Localizado</option>
          </select>

          <button className="sem-clear-filters" onClick={() => setLocalFilters({ q:'', responsable:'', ubicacion:'', ejercicio:'', estado:'' })}>
            Limpiar
          </button>
        </div>
      )}

      {exportError && <div className="sem-error">{exportError}</div>}

      {/* ── Barra inferior ── */}
      <div className="sem-bottom-bar">
        <div className="sem-pill-switch">
          <button className={`sem-pill-btn${exportMode === 'rm'  ? ' sem-pill-btn--active' : ''}`} onClick={() => handleModeChange('rm')}>
            RM-01 <span className="sem-pill-sub">11</span>
          </button>
          <button className={`sem-pill-btn${exportMode === 'all' ? ' sem-pill-btn--active' : ''}`} onClick={() => handleModeChange('all')}>
            Todos <span className="sem-pill-sub">34</span>
          </button>
        </div>

        <div className="sem-pill-switch sem-pill-switch--scope">
          <button className={`sem-pill-btn${scope === 'all'     ? ' sem-pill-btn--active' : ''}`} onClick={() => setScope('all')}>Todos</button>
          <button className={`sem-pill-btn${scope === 'filters' ? ' sem-pill-btn--active' : ''}`} onClick={() => setScope('filters')}>Filtros</button>
          {allowManualSelection && (
            <button className={`sem-pill-btn${scope === 'manual' ? ' sem-pill-btn--active' : ''}`} onClick={() => setScope('manual')}>Manual</button>
          )}
        </div>

        <div className="sem-pill-switch sem-pill-switch--export">
          <button className={`sem-pill-btn${exportFormat === 'excel' ? ' sem-pill-btn--active' : ''}`} onClick={() => setExportFormat('excel')}>
            <FaFileExcel /> Excel
          </button>
          <button className={`sem-pill-btn${exportFormat === 'pdf' ? ' sem-pill-btn--active' : ''}`} onClick={() => setExportFormat('pdf')}>
            <FaFilePdf /> PDF
          </button>
        </div>

        <button className="sem-btn-export" onClick={() => handleExport(exportFormat)}
          disabled={isExporting || visibleCols.length === 0 || (scope === 'manual' && manualCount === 0)}>
          {isExporting ? <span className="sem-spin" /> : null}
          {isExporting ? 'Exportando…' : `Exportar ${exportFormat === 'excel' ? '.xlsx' : 'PDF'}`}
        </button>
      </div>

      {/* ── Floating selection chip ── */}
      {scope === 'manual' && manualCount > 0 && (
        <div className="sem-selection-chip">
          <span className="sem-selection-count">{manualCount} seleccionado{manualCount !== 1 ? 's' : ''}</span>
          <button className="sem-selection-clear" onClick={clearManualSelection} title="Quitar selección">
            <FaTimes />
          </button>
        </div>
      )}
    </>
  )

  if (inline) return <div className="sem-body sem-body--inline">{bodyContent}</div>

  return (
    <>
      <div className="sem-overlay" onClick={onClose} />
      <div className="sem-modal" role="dialog" aria-modal="true">
        <div className="sem-header">
          <h2 className="sem-title">Exportación Inteligente</h2>
          <button className="sem-close" onClick={onClose} title="Cerrar"><FaTimes /></button>
        </div>
        <div className="sem-body">{bodyContent}</div>
      </div>
    </>
  )
}
