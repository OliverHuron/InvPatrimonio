// =====================================================
// COMPONENTE: Documento de Solicitud de Baja CON PAGE BREAKS AUTOMÁTICOS
// Archivo: client/src/pages/Inventory/BajaRequestDocumentMultiPage.jsx
// Propósito: Generar documento HTML con múltiples páginas automáticas (FORMATO ORIGINAL)
// =====================================================

import React from 'react'
import './BajaRequestDocument.css'

const BajaRequestDocumentMultiPage = ({ 
  items = [], 
  solicitante = {},
  bajaData = {},
  isMultiple = false,
  pages = [],
  onClose 
}) => {
  // Formato de fecha actual - IGUAL AL ORIGINAL
  const today = new Date().toLocaleDateString('es-MX', {
    day: 'numeric', 
    month: 'long', 
    year: 'numeric'
  });

  // Rellenar una página hasta 15 elementos - IGUAL AL ORIGINAL
  const fillPageItems = (pageItems) => {
    const filled = [...pageItems];
    while (filled.length < 15) {
      filled.push({});
    }
    return filled;
  };

  const handlePrint = () => {
    window.print();
  };

  // Generar una página del documento - FORMATO ORIGINAL RESPETADO
  const generatePage = (pageItems, pageNumber, totalPages) => {
    const filledItems = fillPageItems(pageItems);
    
    return (
      <div key={pageNumber} className="document" style={{ 
        pageBreakAfter: pageNumber < totalPages ? 'always' : 'auto',
        marginBottom: pageNumber < totalPages ? '2cm' : '0'
      }}>
        {/* ENCABEZADO ORIGINAL */}
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

        {/* TÍTULO ORIGINAL */}
        <h1 className="title">
          Formulario de Oficio de Solicitud de Baja y Disposición Final de Bienes Muebles
        </h1>

        {/* FECHA ORIGINAL */}
        <div className="date">
          Fecha: {today}
        </div>

        {/* DESTINATARIO ORIGINAL */}
        <div className="recipient">
          <p className="ccp"><strong>C.P. J. Trinidad Ferreira Almanza</strong></p>
          <p className="ccp"><strong>Director de Patrimonio Universitario</strong></p>
          <p className="ccp"><strong>UMSNH</strong></p>
        </div>

        {/* CONTENIDO ORIGINAL */}
        <div className="content">
          <p className="reglamento">
            Conforme a lo establecido en los artículos: 43, 52, 53, 54, 55, 56, y 57 del Reglamento del 
            Patrimonio Universitario de la Universidad Michoacana de San Nicolás de Hidalgo, me permito 
            solicitar la baja para disposición final de los bienes muebles que se relacionan a continuación:
          </p>
        </div>

        {/* Solo mostrar número de página si hay múltiples páginas */}
        {totalPages > 1 && (
          <div style={{ textAlign: 'center', margin: '1rem 0', fontSize: '12pt', fontWeight: 'bold' }}>
            Página {pageNumber} de {totalPages}
          </div>
        )}

        {/* TABLA ORIGINAL */}
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
              <tr key={`${pageNumber}-${index}`}>
                <td>{item.id ? ((pageNumber - 1) * 15 + index + 1) : ''}</td>
                <td>{item.registro_patrimonial || item.registro_interno || ''}</td>
                <td>{item.descripcion || item.tipo_bien || ''}</td>
                <td>{item.marca || ''}</td>
                <td>{item.modelo || ''}</td>
                <td>{item.numero_serie || ''}</td>
                <td>{item.ur || (item.id ? '1' : '')}</td>
                <td>{item.observaciones || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* NOTA ORIGINAL */}
        <div className="table-note">
          <p>AGREGAR LAS FILAS QUE SEAN NECESARIAS.</p>
        </div>

        {/* CONTENIDO DE CIERRE ORIGINAL */}
        <div className="content-saludo">
          <p>Sin más por el momento me permito enviarle un cordial saludo.</p>
        </div>

        {/* FIRMA ORIGINAL - solo en la última página */}
        {pageNumber === totalPages && (
          <div className="cerrado">
            <p>FIRMA:<span>_________________________</span></p>
            <p>NOMBRE COMPLETO DEL SOLICITANTE: {bajaData.solicitante_nombre || solicitante.nombre || ''}</p>
            <p>CARGO: {bajaData.solicitante_cargo || solicitante.cargo || ''}</p>
            <p>NÚMERO DE EMPLEADO: {bajaData.numero_empleado || solicitante.numeroEmpleado || ''}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="document-modal-backdrop" onClick={onClose}>
      <div className="document-modal" onClick={(e) => e.stopPropagation()}>
        <div className="document-controls">
          <button onClick={handlePrint} className="print-btn">
            🖨️ Imprimir {isMultiple ? `(${pages.length} ${pages.length === 1 ? 'página' : 'páginas'})` : ''}
          </button>
          <button onClick={onClose} className="close-doc-btn">
            ✕ Cerrar
          </button>
        </div>
        
        <div className="document-container">
          {/* Generar todas las páginas */}
          {pages.map((pageItems, index) => 
            generatePage(pageItems, index + 1, pages.length)
          )}
        </div>
      </div>
    </div>
  );
};

export default BajaRequestDocumentMultiPage;