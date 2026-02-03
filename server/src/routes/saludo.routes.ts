/*
	saludo.routes.ts
	- Define las rutas relacionadas con el saludo y las exporta para que
		`index.ts` las monte con un prefijo (/api).
*/

// Importamos Router para crear un conjunto de rutas independientes.
import { Router } from 'express'
// Importamos el controller que contiene la lógica para la ruta.
import { getSaludo } from '../controllers/saludo.controller'

// Creamos una instancia de Router. Esto nos permite agrupar rutas
// relacionadas y mantener `index.ts` limpio.
const router = Router()

// Definimos una ruta GET en /saludo que delega la lógica a getSaludo.
// Cuando el servidor reciba GET /api/saludo, se ejecutará getSaludo.
router.get('/saludo', getSaludo)

// Exportamos el router para que `index.ts` haga `app.use('/api', saludoRoutes)`.
export default router
