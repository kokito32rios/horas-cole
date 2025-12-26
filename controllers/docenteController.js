const db = require('../config/database');

// ========================================
// ESTADÍSTICAS DEL DASHBOARD
// ========================================
const obtenerEstadisticas = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        
        // Total de grupos asignados
        const [grupos] = await db.query(
            `SELECT COUNT(*) as total FROM grupos WHERE id_docente = ? AND activo = 1`,
            [idDocente]
        );
        
        // Horas trabajadas este mes
        const [horas] = await db.query(
            `SELECT COALESCE(SUM(horas_trabajadas), 0) as total 
             FROM registros_horas 
             WHERE id_docente = ? 
             AND MONTH(fecha) = MONTH(CURRENT_DATE()) 
             AND YEAR(fecha) = YEAR(CURRENT_DATE())`,
            [idDocente]
        );
        
        // Total de clases este mes
        const [clases] = await db.query(
            `SELECT COUNT(*) as total 
             FROM registros_horas 
             WHERE id_docente = ? 
             AND MONTH(fecha) = MONTH(CURRENT_DATE()) 
             AND YEAR(fecha) = YEAR(CURRENT_DATE())`,
            [idDocente]
        );
        
        // Total a cobrar este mes
        const [total] = await db.query(
            `SELECT COALESCE(SUM(rh.horas_trabajadas * tc.valor_hora), 0) as total
             FROM registros_horas rh
             INNER JOIN grupos g ON rh.id_grupo = g.id_grupo
             INNER JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             WHERE rh.id_docente = ?
             AND MONTH(rh.fecha) = MONTH(CURRENT_DATE()) 
             AND YEAR(rh.fecha) = YEAR(CURRENT_DATE())`,
            [idDocente]
        );
        
        res.json({
            success: true,
            estadisticas: {
                totalGrupos: grupos[0].total,
                horasMes: parseFloat(horas[0].total),
                clasesMes: clases[0].total,
                totalPagar: parseFloat(total[0].total)
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

// ========================================
// MIS GRUPOS ASIGNADOS
// ========================================
const obtenerMisGrupos = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        
        const [grupos] = await db.query(
            `SELECT 
                g.id_grupo,
                g.codigo,
                g.nombre,
                g.activo,
                tc.modulo as tipo_curso,
                tc.programa,          -- NUEVO: agregamos el programa
                tc.valor_hora
             FROM grupos g
             INNER JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             WHERE g.id_docente = ?
             ORDER BY g.codigo`,
            [idDocente]
        );
        
        res.json({ success: true, grupos });
        
    } catch (error) {
        console.error('Error obteniendo grupos:', error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
};

// ========================================
// REGISTRAR HORA
// ========================================
const registrarHora = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { fecha, id_grupo, hora_ingreso, hora_salida, observaciones, tema_desarrollado } = req.body;
        
        // Validaciones
        if (!fecha || !id_grupo || !hora_ingreso || !hora_salida) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }
        
        if (!tema_desarrollado || tema_desarrollado.trim() === '') {
            return res.status(400).json({ error: 'El tema desarrollado es obligatorio' });
        }
        
        // Verificar que el grupo pertenece al docente
        const [grupo] = await db.query(
            'SELECT id_grupo FROM grupos WHERE id_grupo = ? AND id_docente = ?',
            [id_grupo, idDocente]
        );
        
        if (grupo.length === 0) {
            return res.status(403).json({ error: 'No tienes acceso a este grupo' });
        }
        
        // Calcular horas trabajadas
        const [h1, m1] = hora_ingreso.split(':').map(Number);
        const [h2, m2] = hora_salida.split(':').map(Number);
        const minutos1 = h1 * 60 + m1;
        const minutos2 = h2 * 60 + m2;
        let diferencia = minutos2 - minutos1;
        if (diferencia < 0) diferencia += 24 * 60;
        const horas_trabajadas = (diferencia / 60).toFixed(2);
        
        // Verificar si ya existe un registro para ese día y grupo
        const [existente] = await db.query(
            'SELECT id_registro FROM registros_horas WHERE id_docente = ? AND id_grupo = ? AND fecha = ?',
            [idDocente, id_grupo, fecha]
        );
        
        if (existente.length > 0) {
            // Actualizar registro existente
            await db.query(
                `UPDATE registros_horas 
                 SET hora_ingreso = ?, hora_salida = ?, horas_trabajadas = ?, 
                     observaciones = ?, tema_desarrollado = ?
                 WHERE id_registro = ?`,
                [hora_ingreso, hora_salida, horas_trabajadas, observaciones, tema_desarrollado, existente[0].id_registro]
            );
            
            return res.json({ 
                success: true, 
                mensaje: 'Registro actualizado exitosamente' 
            });
        }
        
        // Insertar nuevo registro
        await db.query(
            `INSERT INTO registros_horas 
             (id_docente, id_grupo, fecha, hora_ingreso, hora_salida, horas_trabajadas, observaciones, tema_desarrollado) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [idDocente, id_grupo, fecha, hora_ingreso, hora_salida, horas_trabajadas, observaciones, tema_desarrollado]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Hora registrada exitosamente' 
        });
        
    } catch (error) {
        console.error('Error registrando hora:', error);
        res.status(500).json({ error: 'Error al registrar hora' });
    }
};
// ========================================
// HISTORIAL DE HORAS
// ========================================
const obtenerHistorial = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { desde, hasta, grupo } = req.query;
        
        let query = `
            SELECT 
                rh.fecha,
                rh.hora_ingreso,
                rh.hora_salida,
                rh.horas_trabajadas,
                rh.observaciones,
                rh.tema_desarrollado,
                g.codigo,
                g.nombre as nombre_grupo,
                tc.programa,
                tc.modulo,
                tc.valor_hora,
                (rh.horas_trabajadas * tc.valor_hora) as valor
            FROM registros_horas rh
            INNER JOIN grupos g ON rh.id_grupo = g.id_grupo
            INNER JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
            WHERE rh.id_docente = ?
        `;
        
        const params = [idDocente];
        
        if (desde) {
            query += ' AND rh.fecha >= ?';
            params.push(desde);
        }
        
        if (hasta) {
            query += ' AND rh.fecha <= ?';
            params.push(hasta);
        }
        
        if (grupo) {
            query += ' AND rh.id_grupo = ?';
            params.push(grupo);
        }
        
        query += ' ORDER BY rh.fecha DESC, rh.hora_ingreso DESC';
        
        const [registros] = await db.query(query, params);
        
        res.json({ success: true, registros });
        
    } catch (error) {
        console.error('Error obteniendo historial:', error);
        res.status(500).json({ error: 'Error al obtener historial' });
    }
};

// ========================================
// GENERAR CUENTA DE COBRO
// ========================================
const generarCuentaCobro = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { mes, anio } = req.params;
        
        // Obtener registros del mes
        const [registros] = await db.query(
            `SELECT 
                rh.fecha,
                rh.horas_trabajadas,
                g.codigo,
                g.nombre as nombre_grupo,
                tc.valor_hora,
                (rh.horas_trabajadas * tc.valor_hora) as valor
             FROM registros_horas rh
             INNER JOIN grupos g ON rh.id_grupo = g.id_grupo
             INNER JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             WHERE rh.id_docente = ?
             AND MONTH(rh.fecha) = ?
             AND YEAR(rh.fecha) = ?
             ORDER BY rh.fecha`,
            [idDocente, mes, anio]
        );
        
        if (registros.length === 0) {
            return res.status(400).json({ 
                error: 'No hay registros de horas para este período' 
            });
        }
        
        // Calcular totales
        const totalHoras = registros.reduce((sum, r) => sum + parseFloat(r.horas_trabajadas), 0);
        const totalPagar = registros.reduce((sum, r) => sum + parseFloat(r.valor), 0);
        
        // Verificar si ya existe la cuenta
        const [existe] = await db.query(
            'SELECT id_cuenta FROM cuentas_cobro WHERE id_docente = ? AND mes = ? AND anio = ?',
            [idDocente, mes, anio]
        );
        
        let idCuenta;
        
        if (existe.length > 0) {
            // Actualizar
            idCuenta = existe[0].id_cuenta;
            await db.query(
                'UPDATE cuentas_cobro SET total_horas = ?, total_pagar = ? WHERE id_cuenta = ?',
                [totalHoras, totalPagar, idCuenta]
            );
        } else {
            // Insertar nueva cuenta
            const [result] = await db.query(
                'INSERT INTO cuentas_cobro (id_docente, mes, anio, total_horas, total_pagar) VALUES (?, ?, ?, ?, ?)',
                [idDocente, mes, anio, totalHoras, totalPagar]
            );
            idCuenta = result.insertId;
        }
        
        res.json({ 
            success: true, 
            mensaje: 'Cuenta de cobro generada',
            idCuenta,
            pdfUrl: `/api/docente/descargar-cuenta/${idCuenta}`
        });
        
    } catch (error) {
        console.error('Error generando cuenta:', error);
        res.status(500).json({ error: 'Error al generar cuenta de cobro' });
    }
};

// ========================================
// CUENTAS GENERADAS
// ========================================
const obtenerCuentasGeneradas = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        
        const [cuentas] = await db.query(
            `SELECT * FROM cuentas_cobro 
             WHERE id_docente = ? 
             ORDER BY anio DESC, mes DESC`,
            [idDocente]
        );
        
        res.json({ success: true, cuentas });
        
    } catch (error) {
        console.error('Error obteniendo cuentas:', error);
        res.status(500).json({ error: 'Error al obtener cuentas' });
    }
};

// ========================================
// DESCARGAR CUENTA (PDF)
// ========================================
const descargarCuenta = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { id } = req.params;
        
        // Verificar que la cuenta pertenece al docente
        const [cuenta] = await db.query(
            'SELECT * FROM cuentas_cobro WHERE id_cuenta = ? AND id_docente = ?',
            [id, idDocente]
        );
        
        if (cuenta.length === 0) {
            return res.status(404).json({ error: 'Cuenta no encontrada' });
        }
        
        // Por ahora retornamos un mensaje
        // En el siguiente paso implementaremos la generación de PDF
        res.json({ 
            success: true, 
            mensaje: 'Función de descarga de PDF pendiente de implementar',
            cuenta: cuenta[0]
        });
        
    } catch (error) {
        console.error('Error descargando cuenta:', error);
        res.status(500).json({ error: 'Error al descargar cuenta' });
    }
};

// ========================================
// MI PERFIL
// ========================================
const obtenerMiPerfil = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        
        const [perfil] = await db.query(
            `SELECT 
                u.nombre,
                u.documento,
                u.email,
                u.telefono,
                b.nombre as banco,
                tc.nombre as tipo_cuenta,
                u.numero_cuenta
             FROM usuarios u
             LEFT JOIN bancos b ON u.id_banco = b.id_banco
             LEFT JOIN tipos_cuenta tc ON u.id_tipo_cuenta = tc.id_tipo_cuenta
             WHERE u.id_usuario = ?`,
            [idDocente]
        );
        
        res.json({ success: true, perfil: perfil[0] });
        
    } catch (error) {
        console.error('Error obteniendo perfil:', error);
        res.status(500).json({ error: 'Error al obtener perfil' });
    }
};

// ========================================
// CAMBIAR CONTRASEÑA
// ========================================
const cambiarPassword = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { nuevaPassword } = req.body;
        
        if (!nuevaPassword || nuevaPassword.length < 6) {
            return res.status(400).json({ 
                error: 'La contraseña debe tener al menos 6 caracteres' 
            });
        }
        
        const bcrypt = require('bcrypt');
        const passwordHash = await bcrypt.hash(nuevaPassword, 10);
        
        await db.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordHash, idDocente]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Contraseña actualizada exitosamente' 
        });
        
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
};

module.exports = {
    obtenerEstadisticas,
    obtenerMisGrupos,
    registrarHora,
    obtenerHistorial,
    generarCuentaCobro,
    obtenerCuentasGeneradas,
    descargarCuenta,
    obtenerMiPerfil,
    cambiarPassword
};