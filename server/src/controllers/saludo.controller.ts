/*
  saludo.controller.ts
  - Aquí definimos la lógica (controller) que responde a la petición /saludo.
  - El controller es el "cerebro" que recibe la request y manda la response.
*/

// Importamos los tipos Request y Response para anotar parámetros y mejorar
// la seguridad y autocompletado en TypeScript.
import { Request, Response } from 'express'

// getSaludo: función que responde con un objeto JSON.
// - `req` contiene información de la petición entrante (headers, params, body...)
// - `res` se usa para enviar la respuesta al cliente.
export const getSaludo = (req: Request, res: Response) => {
  // Enviamos una respuesta JSON con la clave `mensaje`.
  res.json({ mensaje: 'Hola desde el servidor del SIAF' })
}
