const db = require('../config/database');
const bcrypt = require('bcrypt');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

// ========================================
// ESTADÍSTICAS DEL DASHBOARD
// ========================================
const obtenerEstadisticas = async (req, res) => {
    try {
        // Total docentes activos
        const [docentes] = await db.query(
            `SELECT COUNT(*) as total FROM usuarios u 
             INNER JOIN roles r ON u.id_rol = r.id_rol 
             WHERE r.nombre = 'docente' AND u.activo = 1`
        );
        
        // Total grupos activos
        const [grupos] = await db.query(
            `SELECT COUNT(*) as total FROM grupos WHERE activo = 1`
        );
        
        // Horas registradas este mes
        const [horas] = await db.query(
            `SELECT COALESCE(SUM(horas_trabajadas), 0) as total 
             FROM registros_horas 
             WHERE MONTH(fecha) = MONTH(CURRENT_DATE()) 
             AND YEAR(fecha) = YEAR(CURRENT_DATE())`
        );
        
        // Monto total a pagar este mes
        const [monto] = await db.query(
            `SELECT COALESCE(SUM(rh.horas_trabajadas * tc.valor_hora), 0) as total
             FROM registros_horas rh
             INNER JOIN grupos g ON rh.id_grupo = g.id_grupo
             INNER JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             WHERE MONTH(rh.fecha) = MONTH(CURRENT_DATE()) 
             AND YEAR(rh.fecha) = YEAR(CURRENT_DATE())`
        );
        
        res.json({
            success: true,
            estadisticas: {
                totalDocentes: docentes[0].total,
                totalGrupos: grupos[0].total,
                horasMes: parseFloat(horas[0].total),
                montoMes: parseFloat(monto[0].total)
            }
        });
        
    } catch (error) {
        console.error('Error obteniendo estadísticas:', error);
        res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
};

// ========================================
// CRUD DE USUARIOS
// ========================================
const obtenerUsuarios = async (req, res) => {
    try {
        const [usuarios] = await db.query(
            `SELECT 
                u.id_usuario,
                u.nombre,
                u.documento,
                u.email,
                u.telefono,
                u.activo,
                r.nombre as rol,
                r.id_rol,
                b.nombre as banco,
                u.id_banco,
                tc.nombre as tipo_cuenta,
                u.id_tipo_cuenta,
                u.numero_cuenta,
                u.creado_el
             FROM usuarios u
             INNER JOIN roles r ON u.id_rol = r.id_rol
             LEFT JOIN bancos b ON u.id_banco = b.id_banco
             LEFT JOIN tipos_cuenta tc ON u.id_tipo_cuenta = tc.id_tipo_cuenta
             ORDER BY u.nombre`
        );
        
        res.json({ success: true, usuarios });
        
    } catch (error) {
        console.error('Error obteniendo usuarios:', error);
        res.status(500).json({ error: 'Error al obtener usuarios' });
    }
};

const crearUsuario = async (req, res) => {
    try {
        const { nombre, documento, email, telefono, password, id_rol, id_banco, id_tipo_cuenta, numero_cuenta } = req.body;
        
        if (!nombre || !documento || !password || !id_rol) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }
        
        const [existente] = await db.query(
            'SELECT id_usuario FROM usuarios WHERE documento = ?',
            [documento]
        );
        
        if (existente.length > 0) {
            return res.status(400).json({ error: 'El documento ya está registrado' });
        }
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const [result] = await db.query(
            `INSERT INTO usuarios 
             (nombre, documento, email, telefono, password, id_rol, id_banco, id_tipo_cuenta, numero_cuenta) 
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [nombre, documento, email, telefono, passwordHash, id_rol, id_banco, id_tipo_cuenta, numero_cuenta]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Usuario creado exitosamente',
            id_usuario: result.insertId 
        });
        
    } catch (error) {
        console.error('Error creando usuario:', error);
        res.status(500).json({ error: 'Error al crear usuario' });
    }
};

const actualizarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre, documento, email, telefono, id_rol, id_banco, id_tipo_cuenta, numero_cuenta } = req.body;
        
        if (!nombre || !documento || !id_rol) {
            return res.status(400).json({ error: 'Faltan datos obligatorios' });
        }
        
        const [existente] = await db.query(
            'SELECT id_usuario FROM usuarios WHERE documento = ? AND id_usuario != ?',
            [documento, id]
        );
        
        if (existente.length > 0) {
            return res.status(400).json({ error: 'El documento ya está registrado en otro usuario' });
        }
        
        await db.query(
            `UPDATE usuarios SET 
             nombre = ?, documento = ?, email = ?, telefono = ?, 
             id_rol = ?, id_banco = ?, id_tipo_cuenta = ?, numero_cuenta = ?
             WHERE id_usuario = ?`,
            [nombre, documento, email, telefono, id_rol, id_banco, id_tipo_cuenta, numero_cuenta, id]
        );
        
        res.json({ success: true, mensaje: 'Usuario actualizado exitosamente' });
        
    } catch (error) {
        console.error('Error actualizando usuario:', error);
        res.status(500).json({ error: 'Error al actualizar usuario' });
    }
};

const cambiarEstadoUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        
        await db.query(
            'UPDATE usuarios SET activo = ? WHERE id_usuario = ?',
            [activo, id]
        );
        
        res.json({ 
            success: true, 
            mensaje: activo ? 'Usuario activado' : 'Usuario desactivado' 
        });
        
    } catch (error) {
        console.error('Error cambiando estado de usuario:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

const cambiarContrasena = async (req, res) => {
    try {
        const { id } = req.params;
        const { nuevaPassword } = req.body;
        
        if (!nuevaPassword || nuevaPassword.length < 6) {
            return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
        }
        
        const passwordHash = await bcrypt.hash(nuevaPassword, 10);
        
        await db.query(
            'UPDATE usuarios SET password = ? WHERE id_usuario = ?',
            [passwordHash, id]
        );
        
        res.json({ success: true, mensaje: 'Contraseña actualizada exitosamente' });
        
    } catch (error) {
        console.error('Error cambiando contraseña:', error);
        res.status(500).json({ error: 'Error al cambiar contraseña' });
    }
};

// ========================================
// CRUD DE BANCOS
// ========================================
const obtenerBancos = async (req, res) => {
    try {
        const [bancos] = await db.query(
            'SELECT * FROM bancos ORDER BY nombre'
        );
        res.json({ success: true, bancos });
    } catch (error) {
        console.error('Error obteniendo bancos:', error);
        res.status(500).json({ error: 'Error al obtener bancos' });
    }
};

const crearBanco = async (req, res) => {
    try {
        const { nombre } = req.body;
        
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        const [result] = await db.query(
            'INSERT INTO bancos (nombre) VALUES (?)',
            [nombre]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Banco creado exitosamente',
            id_banco: result.insertId 
        });
        
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El banco ya existe' });
        }
        console.error('Error creando banco:', error);
        res.status(500).json({ error: 'Error al crear banco' });
    }
};

const actualizarBanco = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        
        await db.query(
            'UPDATE bancos SET nombre = ? WHERE id_banco = ?',
            [nombre, id]
        );
        
        res.json({ success: true, mensaje: 'Banco actualizado exitosamente' });
        
    } catch (error) {
        console.error('Error actualizando banco:', error);
        res.status(500).json({ error: 'Error al actualizar banco' });
    }
};

const cambiarEstadoBanco = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        
        await db.query(
            'UPDATE bancos SET activo = ? WHERE id_banco = ?',
            [activo, id]
        );
        
        res.json({ success: true, mensaje: 'Estado actualizado' });
        
    } catch (error) {
        console.error('Error cambiando estado de banco:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

// ========================================
// CRUD DE TIPOS DE CUENTA
// ========================================
const obtenerTiposCuenta = async (req, res) => {
    try {
        const [tipos] = await db.query(
            'SELECT * FROM tipos_cuenta ORDER BY nombre'
        );
        res.json({ success: true, tipos });
    } catch (error) {
        console.error('Error obteniendo tipos de cuenta:', error);
        res.status(500).json({ error: 'Error al obtener tipos de cuenta' });
    }
};

const crearTipoCuenta = async (req, res) => {
    try {
        const { nombre } = req.body;
        
        if (!nombre) {
            return res.status(400).json({ error: 'El nombre es obligatorio' });
        }
        
        const [result] = await db.query(
            'INSERT INTO tipos_cuenta (nombre) VALUES (?)',
            [nombre]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Tipo de cuenta creado exitosamente',
            id_tipo_cuenta: result.insertId 
        });
        
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ error: 'El tipo de cuenta ya existe' });
        }
        console.error('Error creando tipo de cuenta:', error);
        res.status(500).json({ error: 'Error al crear tipo de cuenta' });
    }
};

const actualizarTipoCuenta = async (req, res) => {
    try {
        const { id } = req.params;
        const { nombre } = req.body;
        
        await db.query(
            'UPDATE tipos_cuenta SET nombre = ? WHERE id_tipo_cuenta = ?',
            [nombre, id]
        );
        
        res.json({ success: true, mensaje: 'Tipo de cuenta actualizado' });
        
    } catch (error) {
        console.error('Error actualizando tipo de cuenta:', error);
        res.status(500).json({ error: 'Error al actualizar tipo de cuenta' });
    }
};

const cambiarEstadoTipoCuenta = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        
        await db.query(
            'UPDATE tipos_cuenta SET activo = ? WHERE id_tipo_cuenta = ?',
            [activo, id]
        );
        
        res.json({ success: true, mensaje: 'Estado actualizado' });
        
    } catch (error) {
        console.error('Error cambiando estado:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

// ========================================
// CRUD DE TIPOS DE CURSO
// ========================================
const obtenerTiposCurso = async (req, res) => {
    try {
        const [tipos] = await db.query(
            'SELECT * FROM tipos_curso ORDER BY modulo'
        );
        res.json({ success: true, tipos });
    } catch (error) {
        console.error('Error obteniendo tipos de curso:', error);
        res.status(500).json({ error: 'Error al obtener tipos de curso' });
    }
};

const crearTipoCurso = async (req, res) => {
    try {
        const { programa, nombre, valor_hora } = req.body;
        
        if (!programa || !nombre || !valor_hora) {
            return res.status(400).json({ error: 'Programa, nombre y valor por hora son obligatorios' });
        }
        
        const [result] = await db.query(
            'INSERT INTO tipos_curso (programa, modulo, valor_hora) VALUES (?, ?, ?)',
            [programa, nombre, valor_hora]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Tipo de curso creado exitosamente',
            id_tipo: result.insertId 
        });
        
    } catch (error) {
        console.error('Error creando tipo de curso:', error);
        res.status(500).json({ error: 'Error al crear tipo de curso' });
    }
};

const actualizarTipoCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const { programa, nombre, valor_hora } = req.body;
        
        await db.query(
            'UPDATE tipos_curso SET programa = ?, modulo = ?, valor_hora = ? WHERE id_tipo = ?',
            [programa, nombre, valor_hora, id]
        );
        
        res.json({ success: true, mensaje: 'Tipo de curso actualizado' });
        
    } catch (error) {
        console.error('Error actualizando tipo de curso:', error);
        res.status(500).json({ error: 'Error al actualizar tipo de curso' });
    }
};

const cambiarEstadoTipoCurso = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        
        await db.query(
            'UPDATE tipos_curso SET activo = ? WHERE id_tipo = ?',
            [activo, id]
        );
        
        res.json({ success: true, mensaje: 'Estado actualizado' });
        
    } catch (error) {
        console.error('Error cambiando estado:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

// ========================================
// CRUD DE GRUPOS
// ========================================
const obtenerGrupos = async (req, res) => {
    try {
        const [grupos] = await db.query(
            `SELECT 
                g.id_grupo,
                g.codigo,
                g.nombre,
                g.activo,
                tc.modulo as tipo_curso,
                tc.programa,
                tc.id_tipo,
                tc.valor_hora,
                u.nombre as docente,
                u.id_usuario as id_docente,
                g.creado_el
             FROM grupos g
             INNER JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             INNER JOIN usuarios u ON g.id_docente = u.id_usuario
             ORDER BY g.codigo`
        );
        
        res.json({ success: true, grupos });
        
    } catch (error) {
        console.error('Error obteniendo grupos:', error);
        res.status(500).json({ error: 'Error al obtener grupos' });
    }
};

const crearGrupo = async (req, res) => {
    try {
        const { codigo, nombre, id_tipo, id_docente } = req.body;
        
        if (!codigo || !nombre || !id_tipo || !id_docente) {
            return res.status(400).json({ error: 'Todos los campos son obligatorios' });
        }
        
        const [existente] = await db.query(
            'SELECT id_grupo FROM grupos WHERE codigo = ?',
            [codigo]
        );
        
        if (existente.length > 0) {
            return res.status(400).json({ error: 'El código del grupo ya existe' });
        }
        
        const [result] = await db.query(
            'INSERT INTO grupos (codigo, nombre, id_tipo, id_docente) VALUES (?, ?, ?, ?)',
            [codigo, nombre, id_tipo, id_docente]
        );
        
        res.json({ 
            success: true, 
            mensaje: 'Grupo creado exitosamente',
            id_grupo: result.insertId 
        });
        
    } catch (error) {
        console.error('Error creando grupo:', error);
        res.status(500).json({ error: 'Error al crear grupo' });
    }
};

const actualizarGrupo = async (req, res) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, id_tipo, id_docente } = req.body;
        
        const [existente] = await db.query(
            'SELECT id_grupo FROM grupos WHERE codigo = ? AND id_grupo != ?',
            [codigo, id]
        );
        
        if (existente.length > 0) {
            return res.status(400).json({ error: 'El código del grupo ya existe' });
        }
        
        await db.query(
            'UPDATE grupos SET codigo = ?, nombre = ?, id_tipo = ?, id_docente = ? WHERE id_grupo = ?',
            [codigo, nombre, id_tipo, id_docente, id]
        );
        
        res.json({ success: true, mensaje: 'Grupo actualizado exitosamente' });
        
    } catch (error) {
        console.error('Error actualizando grupo:', error);
        res.status(500).json({ error: 'Error al actualizar grupo' });
    }
};

const cambiarEstadoGrupo = async (req, res) => {
    try {
        const { id } = req.params;
        const { activo } = req.body;
        
        await db.query(
            'UPDATE grupos SET activo = ? WHERE id_grupo = ?',
            [activo, id]
        );
        
        res.json({ success: true, mensaje: 'Estado actualizado' });
        
    } catch (error) {
        console.error('Error cambiando estado de grupo:', error);
        res.status(500).json({ error: 'Error al cambiar estado' });
    }
};

// ========================================
// OBTENER DOCENTES ACTIVOS
// ========================================
const obtenerDocentes = async (req, res) => {
    try {
        const [docentes] = await db.query(
            `SELECT u.id_usuario, u.nombre, u.documento
             FROM usuarios u
             INNER JOIN roles r ON u.id_rol = r.id_rol
             WHERE r.nombre = 'docente' AND u.activo = 1
             ORDER BY u.nombre`
        );
        
        res.json({ success: true, docentes });
        
    } catch (error) {
        console.error('Error obteniendo docentes:', error);
        res.status(500).json({ error: 'Error al obtener docentes' });
    }
};

// ========================================
// OBTENER ROLES
// ========================================
const obtenerRoles = async (req, res) => {
    try {
        const [roles] = await db.query('SELECT * FROM roles ORDER BY nombre');
        res.json({ success: true, roles });
    } catch (error) {
        console.error('Error obteniendo roles:', error);
        res.status(500).json({ error: 'Error al obtener roles' });
    }
};

const eliminarUsuario = async (req, res) => {
    try {
        const { id } = req.params;
        
        const [usuario] = await db.query(
            'SELECT nombre FROM usuarios WHERE id_usuario = ?',
            [id]
        );
        
        if (usuario.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }
        
        await db.query('DELETE FROM usuarios WHERE id_usuario = ?', [id]);
        
        res.json({ 
            success: true, 
            mensaje: 'Usuario eliminado permanentemente' 
        });
        
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                error: 'No se puede eliminar el usuario porque tiene registros asociados. Se recomienda desactivarlo en su lugar.' 
            });
        }
        
        res.status(500).json({ error: 'Error al eliminar usuario' });
    }
};

const eliminarGrupo = async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM grupos WHERE id_grupo = ?', [id]);
        
        res.json({ 
            success: true, 
            mensaje: 'Grupo eliminado permanentemente' 
        });
        
    } catch (error) {
        console.error('Error eliminando grupo:', error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                error: 'No se puede eliminar el grupo porque tiene registros de horas asociados.' 
            });
        }
        
        res.status(500).json({ error: 'Error al eliminar grupo' });
    }
};

const eliminarTipoCurso = async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM tipos_curso WHERE id_tipo = ?', [id]);
        
        res.json({ 
            success: true, 
            mensaje: 'Tipo de curso eliminado permanentemente' 
        });
        
    } catch (error) {
        console.error('Error eliminando tipo de curso:', error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                error: 'No se puede eliminar porque hay grupos usando este tipo de curso.' 
            });
        }
        
        res.status(500).json({ error: 'Error al eliminar tipo de curso' });
    }
};

const eliminarBanco = async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM bancos WHERE id_banco = ?', [id]);
        
        res.json({ 
            success: true, 
            mensaje: 'Banco eliminado permanentemente' 
        });
        
    } catch (error) {
        console.error('Error eliminando banco:', error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                error: 'No se puede eliminar porque hay usuarios usando este banco.' 
            });
        }
        
        res.status(500).json({ error: 'Error al eliminar banco' });
    }
};

const eliminarTipoCuenta = async (req, res) => {
    try {
        const { id } = req.params;
        
        await db.query('DELETE FROM tipos_cuenta WHERE id_tipo_cuenta = ?', [id]);
        
        res.json({ 
            success: true, 
            mensaje: 'Tipo de cuenta eliminado permanentemente' 
        });
        
    } catch (error) {
        console.error('Error eliminando tipo de cuenta:', error);
        
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return res.status(400).json({ 
                error: 'No se puede eliminar porque hay usuarios usando este tipo de cuenta.' 
            });
        }
        
        res.status(500).json({ error: 'Error al eliminar tipo de cuenta' });
    }
};

// ========================================
// CUENTAS DE COBRO GENERADAS
// ========================================
const obtenerCuentasCobro = async (req, res) => {
    try {
        const { mes, anio, docente_id } = req.query;

        let query = `
            SELECT 
                cc.id_cuenta,
                u.nombre AS docente,
                u.documento,
                cc.mes,
                cc.anio,
                cc.total_horas,
                cc.total_pagar,
                DATE_FORMAT(cc.generado_el, '%d/%m/%Y %H:%i') AS generado_el
            FROM cuentas_cobro cc
            JOIN usuarios u ON cc.id_docente = u.id_usuario
            WHERE u.id_rol = 2
        `;
        const params = [];

        if (mes) {
            query += ' AND cc.mes = ?';
            params.push(mes);
        }
        if (anio) {
            query += ' AND cc.anio = ?';
            params.push(anio);
        }
        if (docente_id) {
            query += ' AND cc.id_docente = ?';
            params.push(docente_id);
        }

        query += ' ORDER BY cc.anio DESC, cc.mes DESC, u.nombre';

        const [cuentas] = await db.query(query, params);

        res.json({ success: true, cuentas });
    } catch (error) {
        console.error('Error obteniendo cuentas de cobro:', error);
        res.status(500).json({ error: 'Error al obtener cuentas de cobro' });
    }
};

// ========================================
// HISTÓRICO DE REGISTROS DE HORAS
// ========================================
const obtenerHistoricoHoras = async (req, res) => {
    try {
        const { desde, hasta, docente_id } = req.query;

        let query = `
            SELECT 
                rh.id_registro,
                u.nombre AS docente,
                u.documento,
                g.codigo AS grupo_codigo,
                g.nombre AS grupo_nombre,
                tc.modulo,
                tc.programa,
                rh.fecha,
                rh.hora_ingreso,
                rh.hora_salida,
                rh.horas_trabajadas,
                rh.tema_desarrollado,
                rh.observaciones
            FROM registros_horas rh
            JOIN usuarios u ON rh.id_docente = u.id_usuario
            JOIN grupos g ON rh.id_grupo = g.id_grupo
            JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
            WHERE u.id_rol = 2
        `;

        const params = [];

        if (desde) {
            query += ' AND rh.fecha >= ?';
            params.push(desde);
        }
        if (hasta) {
            query += ' AND rh.fecha <= ?';
            params.push(hasta);
        }
        if (docente_id) {
            query += ' AND rh.id_docente = ?';
            params.push(docente_id);
        }

        query += ' ORDER BY rh.fecha DESC, u.nombre';

        const [registros] = await db.query(query, params);

        res.json({ success: true, registros });
    } catch (error) {
        console.error('Error obteniendo histórico de horas:', error);
        res.status(500).json({ error: 'Error al obtener histórico' });
    }
};

// ========================================
// PDF CUENTA DE COBRO PARA ADMIN (formato oficial, sin restricción de docente)
// ========================================
const generarPDFCuentaAdmin = async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: 'ID de cuenta requerido' });
        }

        const [cuentaRows] = await pool.query(`
            SELECT 
                cc.id_cuenta,
                cc.mes,
                cc.anio,
                cc.total_pagar,
                cc.generado_el,
                u.nombre,
                u.documento,
                u.numero_cuenta,
                b.nombre AS banco,
                tc.nombre AS tipo_cuenta
            FROM cuentas_cobro cc
            JOIN usuarios u ON cc.id_docente = u.id_usuario
            LEFT JOIN bancos b ON u.id_banco = b.id_banco
            LEFT JOIN tipos_cuenta tc ON u.id_tipo_cuenta = tc.id_tipo_cuenta
            WHERE cc.id_cuenta = ?
        `, [id]);

        if (cuentaRows.length === 0) {
            return res.status(404).json({ error: 'Cuenta de cobro no encontrada' });
        }

        const cuenta = cuentaRows[0];

        const mesesArray = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
                            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const nombreMes = mesesArray[cuenta.mes];

        const nombreDocente = cuenta.nombre.trim().toUpperCase();
        const nombreArchivo = `CUENTA DE COBRO ${nombreMes} - ${nombreDocente}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${nombreArchivo}"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

        const hoy = new Date();
        const mesesMinus = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
                            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const fechaTexto = `${hoy.getDate()} de ${mesesMinus[hoy.getMonth() + 1]} de ${hoy.getFullYear()}`;
        doc.fontSize(12).text(fechaTexto, { align: 'right' });
        doc.moveDown(2);

        doc.fontSize(18).text(`CUENTA DE COBRO N° ${String(cuenta.id_cuenta).padStart(3, '0')}`, { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(14).text('COLEGIATURA ANTIOQUEÑA DE BELLEZA SAS', { align: 'center' });
        doc.fontSize(12).text('NIT: 901.363.247-8', { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12).text('DEBE A:', { align: 'center' });
        doc.text(cuenta.nombre, { align: 'center' });
        doc.text(`C.C. ${cuenta.documento}`, { align: 'center' });
        doc.moveDown(2);

        const valorFormateado = new Intl.NumberFormat('es-CO').format(cuenta.total_pagar);
        const valorEnLetras = numeroALetras(cuenta.total_pagar);

        doc.fontSize(14).text('LA SUMA DE:', { align: 'center' });
        doc.fontSize(16).text(`$${valorFormateado}`, { align: 'center' });
        doc.fontSize(12).text(`${valorEnLetras} PESOS COP`, { align: 'center' });
        doc.moveDown(2);

        doc.fontSize(12).text('Por concepto de:', { align: 'center' });
        doc.text(`PRESTACIÓN DE SERVICIOS POR HORA CÁTEDRA MES DE ${nombreMes}`, { align: 'center' });

        doc.fontSize(10).text(
            'Nota aclaratoria: Solicito la aplicación de la tabla de retención en la fuente establecida en el artículo 383 del Estatuto Tributario, la cual se le aplica a los pagos o abonos en cuenta por concepto de ingresos por honorarios y por compensación por servicios personales.',
            { align: 'justify', indent: 20 }
        );
        doc.moveDown(4);

        doc.text('ATENTAMENTE,', { align: 'left' });
        doc.moveDown(3);
        doc.text('___________________________', { align: 'left' });
        doc.text(cuenta.nombre, { align: 'left' });
        doc.text(`C.c. ${cuenta.documento}`, { align: 'left' });
        doc.text(`Cuenta ${cuenta.tipo_cuenta || 'ahorros'} ${cuenta.banco || ''} ${cuenta.numero_cuenta || ''}`, { align: 'left' });

        doc.end();

    } catch (error) {
        console.error('Error generando PDF cuenta de cobro para admin:', error);
        res.status(500).json({ error: 'Error al generar PDF' });
    }
};

// Función número a letras
function numeroALetras(num) {
    if (num === 0) return 'CERO';

    const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const especiales = ['', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    function convertirMenor1000(n) {
        if (n === 100) return 'CIEN';
        if (n < 10) return unidades[n];
        if (n < 20) return especiales[n - 10];
        if (n < 100) {
            const dec = Math.floor(n / 10);
            const uni = n % 10;
            return decenas[dec] + (uni > 0 ? ' Y ' + unidades[uni] : '');
        }
        const cen = Math.floor(n / 100);
        const resto = n % 100;
        return centenas[cen] + (resto > 0 ? ' ' + convertirMenor1000(resto) : '');
    }

    let texto = '';
    const millones = Math.floor(num / 1000000);
    const miles = Math.floor((num % 1000000) / 1000);
    const cientos = num % 1000;

    if (millones > 0) {
        texto += (millones === 1 ? 'UN MILLÓN' : convertirMenor1000(millones) + ' MILLONES') + ' ';
    }

    if (miles > 0) {
        texto += (miles === 1 ? 'MIL' : convertirMenor1000(miles) + ' MIL') + ' ';
    }

    if (cientos > 0) {
        texto += convertirMenor1000(cientos);
    }

    return texto.trim();
}

module.exports = {
    obtenerEstadisticas,
    obtenerUsuarios,
    crearUsuario,
    actualizarUsuario,
    cambiarEstadoUsuario,
    cambiarContrasena,
    obtenerBancos,
    crearBanco,
    actualizarBanco,
    cambiarEstadoBanco,
    obtenerTiposCuenta,
    crearTipoCuenta,
    actualizarTipoCuenta,
    cambiarEstadoTipoCuenta,
    obtenerTiposCurso,
    crearTipoCurso,
    actualizarTipoCurso,
    cambiarEstadoTipoCurso,
    obtenerGrupos,
    crearGrupo,
    actualizarGrupo,
    cambiarEstadoGrupo,
    obtenerDocentes,
    obtenerRoles,
    eliminarUsuario,
    eliminarGrupo,
    eliminarTipoCurso,
    eliminarBanco,
    eliminarTipoCuenta,
    obtenerCuentasCobro,
    obtenerHistoricoHoras,
    generarPDFCuentaAdmin
};