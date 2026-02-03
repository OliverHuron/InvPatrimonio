/*
  Home.tsx
  - Página sencilla 'Home' para la demo.
  - Aquí explicamos cada línea: qué importa, qué devuelve y para qué sirve.
*/

// Importa la librería React. Aunque con JSX moderno no siempre es necesario
// la importación para runtime, la usamos para los tipos de TypeScript.
import React from 'react'

// Definición del componente funcional Home.
// `React.FC` declara que este componente es una Function Component de React.
const Home: React.FC = () => {
  // El componente devuelve JSX que será renderizado en el DOM.
  return (
    <div>
      {/* <h2> es un título de segundo nivel que muestra el nombre de la página. */}
      <h2>Inicio</h2>

      {/* <p> muestra una breve descripción o contenido explicativo. */}
      <p>Esta es la página principal (Home).</p>
      <button>Click me</button>
    </div>
  )
}

// Exporta el componente para que otros archivos (ej. App.tsx) lo importen.
export default Home
