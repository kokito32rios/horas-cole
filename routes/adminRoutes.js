const express = require('express');
const router = express.Router();
const { isAuthenticated, isAdmin } = require('../middleware/auth');
const adminController = require('../controllers/adminController');

// Todas las rutas requieren autenticación y rol de admin
router.use(isAuthenticated);
router.use(isAdmin);

// ========================================
// DASHBOARD
// ========================================
router.get('/estadisticas', adminController.obtenerEstadisticas);

// ========================================
// GESTIÓN DE USUARIOS
// ========================================
router.get('/usuarios', adminController.obtenerUsuarios);
router.post('/usuarios', adminController.crearUsuario);
router.put('/usuarios/:id', adminController.actualizarUsuario);
router.patch('/usuarios/:id/estado', adminController.cambiarEstadoUsuario);
router.put('/usuarios/:id/password', adminController.cambiarContrasena);
router.delete('/usuarios/:id', adminController.eliminarUsuario);
router.get('/cuentas-cobro', adminController.obtenerCuentasCobro);
router.get('/historico-horas', adminController.obtenerHistoricoHoras);



// ========================================
// GESTIÓN BANCARIA
// ========================================
router.get('/bancos', adminController.obtenerBancos);
router.post('/bancos', adminController.crearBanco);
router.put('/bancos/:id', adminController.actualizarBanco);
router.patch('/bancos/:id/estado', adminController.cambiarEstadoBanco);
router.delete('/bancos/:id', adminController.eliminarBanco);

router.get('/tipos-cuenta', adminController.obtenerTiposCuenta);
router.post('/tipos-cuenta', adminController.crearTipoCuenta);
router.put('/tipos-cuenta/:id', adminController.actualizarTipoCuenta);
router.patch('/tipos-cuenta/:id/estado', adminController.cambiarEstadoTipoCuenta);
router.delete('/tipos-cuenta/:id', adminController.eliminarTipoCuenta);

// ========================================
// GESTIÓN DE CURSOS
// ========================================
router.get('/tipos-curso', adminController.obtenerTiposCurso);
router.post('/tipos-curso', adminController.crearTipoCurso);
router.put('/tipos-curso/:id', adminController.actualizarTipoCurso);
router.patch('/tipos-curso/:id/estado', adminController.cambiarEstadoTipoCurso);
router.delete('/tipos-curso/:id', adminController.eliminarTipoCurso);

// ========================================
// GESTIÓN DE GRUPOS
// ========================================
router.get('/grupos', adminController.obtenerGrupos);
router.post('/grupos', adminController.crearGrupo);
router.put('/grupos/:id', adminController.actualizarGrupo);
router.patch('/grupos/:id/estado', adminController.cambiarEstadoGrupo);
router.delete('/grupos/:id', adminController.eliminarGrupo);

// ========================================
// AUXILIARES
// ========================================
router.get('/docentes', adminController.obtenerDocentes);
router.get('/roles', adminController.obtenerRoles);

// ========================================
// PDF DE CUENTA DE COBRO PARA ADMIN (formato oficial, sin restricción)
// ========================================
router.get('/cuenta-cobro/pdf', adminController.generarPDFCuentaAdmin);



module.exports = router;