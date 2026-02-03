/*
  Inventario.tsx
  - Página de ejemplo para mostrar una lista de bienes.
  - Comentarios explicativos por línea para aprender cómo funciona.
*/

// Importa React para poder usar JSX y tipos en TypeScript.
import React, { useState } from 'react'

interface Bien { id: number; clave: string; descripcion: string; marca: string; modelo?: string; serie?: string }

// Componente funcional que representa la página de Inventario.
const Inventario: React.FC = () => {
  // Estado local con lista simulada de bienes.
  const [bienes] = useState<Array<Bien>>([
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' },
    { id: 1, clave: '12345', descripcion: 'Laptop HP', marca: 'HP', modelo: 'ProBook 450 G3', serie: '5CD6273ABC' },
    { id: 2, clave: '67890', descripcion: 'Impresora Láser', marca: 'Brother', modelo: 'HL-5650DN', serie: 'U8756XY123' },
    { id: 3, clave: '11223', descripcion: 'Silla Ejecutiva', marca: 'Ofix', modelo: 'Ergo Plus', serie: '' }
  ])

  const [modalOpen, setModalOpen] = useState(false)

  return (
    <section>
      <h2>Inventario</h2>
      <p>Lista de bienes (datos simulados para demo).</p>

      <div className="siaf-table">
        <table>
          <thead>
            <tr>
              <th>Clave Patrimonial</th>
              <th>Descripción</th>
              <th>Marca</th>
              <th>Modelo</th>
              <th>Serie</th>
            </tr>
          </thead>
          <tbody>
            {bienes.map(b => (
              <tr key={b.id}>
                <td>{b.clave}</td>
                <td>{b.descripcion}</td>
                <td>{b.marca}</td>
                <td>{b.modelo}</td>
                <td>{b.serie}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: 12 }}>
        <button className="siaf-btn primary" onClick={() => setModalOpen(true)}>Generar y Confirmar Baja</button>
        <button className="siaf-btn secondary" style={{ marginLeft: 8 }} onClick={() => alert('Cancelar')}>Cancelar</button>
      </div>

      {modalOpen && (
        <div className="siaf-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="siaf-modal" onClick={e => e.stopPropagation()}>
            <header>Solicitud de Baja de Activo</header>
            <div>
              <p><strong>Dependencia:</strong> Facultad de Ciencias &nbsp; <strong>Fecha:</strong> 2026-02-01</p>
              <div style={{ background: '#fff', padding: 10 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Clave Patrimonial</th>
                      <th>Descripción</th>
                      <th>Marca</th>
                      <th>Modelo</th>
                      <th>Serie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bienes.map(b => (
                      <tr key={b.id}>
                        <td>{b.clave}</td>
                        <td>{b.descripcion}</td>
                        <td>{b.marca}</td>
                        <td>{b.modelo}</td>
                        <td>{b.serie}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="actions">
              <div className="siaf-modal-actions">
                <button className="siaf-btn primary" onClick={() => { setModalOpen(false); alert('Baja generada') }}>Generar y Confirmar Baja</button>
                <button className="siaf-btn secondary" onClick={() => setModalOpen(false)}>Cancelar</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

export default Inventario
