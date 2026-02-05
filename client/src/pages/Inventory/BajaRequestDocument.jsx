// =====================================================
// COMPONENTE: Documento de Solicitud de Baja
// Archivo: client/src/pages/Inventory/BajaRequestDocument.jsx
// Propósito: Generar documento HTML para solicitud de baja (formato original)
// =====================================================

import React from 'react'
import './BajaRequestDocument.css'

const BajaRequestDocument = ({ items = [], solicitante = {}, onClose }) => {
  // Rellenar hasta 15 filas si hay menos items
  const filledItems = [...items];
  while (filledItems.length < 15) {
    filledItems.push({});
  }

  // Formato de fecha actual
  const today = new Date().toLocaleDateString('es-MX', {
    day: 'numeric', 
    month: 'long', 
    year: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="document-modal-backdrop" onClick={onClose}>
      <div className="document-modal" onClick={(e) => e.stopPropagation()}>
        <div className="document-controls">
          <button onClick={handlePrint} className="print-btn">
            🖨️ Imprimir
          </button>
          <button onClick={onClose} className="close-doc-btn">
            ✕ Cerrar
          </button>
        </div>
        
        <div className="document-container">
          <div className="document">
            <div className="contenedor-titulos">
              <img 
                className="imagen-columna" 
                src="https://drive.google.com/thumbnail?id=1wiZCnNICCD5ahb6cEQ-cDAkwstoup4zI&sz=w1000" 
                alt="logo patrimonio 2" 
              />
              <div>
                <p className="titulo">Universidad Michoacana de San Nicolás de Hidalgo</p>
                <p className="titulo">Dirección de Patrimonio Universitario</p>
                <p className="titulo">Departamento de Control de Bienes Muebles</p>
              </div>
              <img 
                className="imagen-columna" 
                src="https://drive.google.com/thumbnail?id=1hqVKBDKSpxaZKtGrQOHS4cwCbUeNpliZ&sz=w1000" 
                alt="logo patrimonio" 
              />
            </div>

            <h1 className="title">
              Formulario de Oficio de Solicitud de Baja y Disposición Final de Bienes Muebles
            </h1>

            <div className="date">
              Fecha: {today}
            </div>

            <div className="recipient">
              <p className="ccp"><strong>C.P. J. Trinidad Ferreira Almanza</strong></p>
              <p className="ccp"><strong>Director de Patrimonio Universitario</strong></p>
              <p className="ccp"><strong>UMSNH</strong></p>
            </div>

            <div className="content">
              <p className="reglamento">
                Conforme a lo establecido en los artículos: 43, 52, 53, 54, 55, 56, y 57 del Reglamento del 
                Patrimonio Universitario de la Universidad Michoacana de San Nicolás de Hidalgo, me permito 
                solicitar la baja para disposición final de los bienes muebles que se relacionan a continuación:
              </p>
            </div>

            <table className="tabla">
              <thead>
                <tr className="fila-encabezado">
                  <th className="encabezados">Número consecutivo</th>
                  <th className="encabezados">Clave patrimonial</th>
                  <th className="encabezados">Descripción</th>
                  <th className="encabezados">Marca</th>
                  <th className="encabezados">Modelo</th>
                  <th className="encabezados">Número de serie</th>
                  <th className="encabezados">Unidad</th>
                  <th className="encabezados">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {filledItems.map((item, index) => (
                  <tr key={index}>
                    <td>{index + 1}</td>
                    <td>{item.registro_patrimonial || item.registro_interno || ''}</td>
                    <td>{item.descripcion || item.tipo_bien || ''}</td>
                    <td>{item.marca || ''}</td>
                    <td>{item.modelo || ''}</td>
                    <td>{item.numero_serie || ''}</td>
                    <td>{item.ur || '1'}</td>
                    <td>{item.observaciones || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="table-note">
              <p>AGREGAR LAS FILAS QUE SEAN NECESARIAS.</p>
            </div>

            <div className="content-saludo">
              <p>Sin más por el momento me permito enviarle un cordial saludo.</p>
            </div>

            <div className="cerrado">
              <p>FIRMA:<span>_________________________</span></p>
              <p>NOMBRE COMPLETO DEL SOLICITANTE: {solicitante.nombre || ''}</p>
              <p>CARGO: {solicitante.cargo || ''}</p>
              <p>NÚMERO DE EMPLEADO: {solicitante.numeroEmpleado || ''}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BajaRequestDocument;