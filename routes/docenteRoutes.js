const express = require('express');
const router = express.Router();
const { isAuthenticated, isDocente } = require('../middleware/auth');
const docenteController = require('../controllers/docenteController');

// Todas las rutas requieren autenticación y rol de docente
router.use(isAuthenticated);
router.use(isDocente);

// Dashboard
router.get('/estadisticas', docenteController.obtenerEstadisticas);

// Mis grupos
router.get('/mis-grupos', docenteController.obtenerMisGrupos);

// Registrar horas
router.post('/registrar-hora', docenteController.registrarHora);

// Historial
router.get('/historial', docenteController.obtenerHistorial);

// Cuentas de cobro
router.post('/cuenta-cobro/:mes/:anio', docenteController.generarCuentaCobro);
router.get('/cuentas-generadas', docenteController.obtenerCuentasGeneradas);
router.get('/descargar-cuenta-pdf/:id', docenteController.descargarCuentaPDF);
router.get('/ver-cuenta-pdf/:id', docenteController.verCuentaPDF);
// router.get('/descargar-cuenta/:id', docenteController.descargarCuenta);

// Planeadores
router.get('/generar-planeador/:mes/:anio', docenteController.generarPlaneadorExcel);
router.get('/generar-planeador/:mes/:anio/:id_grupo', docenteController.generarPlaneadorExcel);

// Vista previa del planeador
router.get('/ver-planeador/:mes/:anio', docenteController.verPlaneadorExcel);
router.get('/ver-planeador/:mes/:anio/:id_grupo', docenteController.verPlaneadorExcel);


// Perfil
router.get('/mi-perfil', docenteController.obtenerMiPerfil);
router.put('/cambiar-password', docenteController.cambiarPassword);

module.exports = router;