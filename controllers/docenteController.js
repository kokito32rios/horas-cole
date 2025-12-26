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

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// ========================================
// DESCARGAR CUENTA DE COBRO COMO PDF
// ========================================
const descargarCuentaPDF = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { id } = req.params;

        // Verificar que la cuenta pertenece al docente
        const [cuentaRows] = await db.query(
            `SELECT cc.*, u.nombre, u.documento, u.numero_cuenta, b.nombre AS banco, tc.nombre AS tipo_cuenta
             FROM cuentas_cobro cc
             JOIN usuarios u ON cc.id_docente = u.id_usuario
             LEFT JOIN bancos b ON u.id_banco = b.id_banco
             LEFT JOIN tipos_cuenta tc ON u.id_tipo_cuenta = tc.id_tipo_cuenta
             WHERE cc.id_cuenta = ? AND cc.id_docente = ?`,
            [id, idDocente]
        );

        if (cuentaRows.length === 0) {
            return res.status(404).json({ error: 'Cuenta no encontrada o no tienes permiso' });
        }

        const cuenta = cuentaRows[0];

        // Obtener registros detallados del mes
        const [registros] = await db.query(
            `SELECT rh.fecha, rh.horas_trabajadas, rh.tema_desarrollado, g.codigo, g.nombre AS grupo_nombre,
                    tc.programa, tc.modulo, tc.valor_hora, (rh.horas_trabajadas * tc.valor_hora) AS subtotal
             FROM registros_horas rh
             JOIN grupos g ON rh.id_grupo = g.id_grupo
             JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             WHERE rh.id_docente = ? AND MONTH(rh.fecha) = ? AND YEAR(rh.fecha) = ?
             ORDER BY rh.fecha`,
            [idDocente, cuenta.mes, cuenta.anio]
        );

        // Configurar respuesta como PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="Cuenta_de_Cobro_${String(cuenta.id_cuenta).padStart(3, '0')}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

        // Fuentes (si tienes Roboto, sino usa Helvetica)
        const fontPath = path.join(__dirname, '../public/fonts/Roboto-Regular.ttf');
        const fontBoldPath = path.join(__dirname, '../public/fonts/Roboto-Bold.ttf');

        const regular = fs.existsSync(fontPath) ? fontPath : 'Helvetica';
        const bold = fs.existsSync(fontBoldPath) ? fontBoldPath : 'Helvetica-Bold';

        doc.font(regular);

        // Fecha de expedición
        const hoy = new Date();
        const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const fechaTexto = `${hoy.getDate()} de ${meses[hoy.getMonth() + 1]} de ${hoy.getFullYear()}`;
        doc.fontSize(12).text(fechaTexto, { align: 'right' });
        doc.moveDown(2);

        // Título
        doc.font(bold).fontSize(18).text(`CUENTA DE COBRO N° ${String(cuenta.id_cuenta).padStart(3, '0')}`, { align: 'center' });
        doc.moveDown(2);

        // Datos del colegio
        doc.font(bold).fontSize(14).text('COLEGIATURA ANTIOQUEÑA DE BELLEZA SAS', { align: 'center' });
        doc.font(regular).fontSize(12).text('NIT: 901.363.247-8', { align: 'center' });
        doc.moveDown(2);

        // DEBE A:
        doc.font(bold).fontSize(12).text('DEBE A:', { align: 'center' });
        doc.font(regular).fontSize(12).text(cuenta.nombre, { align: 'center' });
        doc.text(`C.C. ${cuenta.documento}`, { align: 'center' });
        doc.moveDown(2);

        // Valor en números y letras
        const valorFormateado = new Intl.NumberFormat('es-CO').format(cuenta.total_pagar);
        const valorEnLetras = numeroALetras(cuenta.total_pagar); // Función que agregamos abajo

        // LA SUMA DE: (centrado)
        doc.font(bold).fontSize(14).text('LA SUMA DE:', { align: 'center' });
        doc.font(regular).fontSize(16).text(`$${valorFormateado}`, { align: 'center' });
        doc.font(regular).fontSize(12).text(`${valorEnLetras} PESOS COP`, { align: 'center' });
        doc.moveDown(2);

        // Por concepto de: (centrado)
        const mesNombre = meses[cuenta.mes];
        doc.font(bold).fontSize(12).text('Por concepto de:', { align: 'center' });
        doc.font(regular).fontSize(12).text(`PRESTACIÓN DE SERVICIOS POR HORA CÁTEDRA MES DE ${mesNombre.toUpperCase()}`, { align: 'center' });

        // Nota aclaratoria
        doc.fontSize(10).text(
            'Nota aclaratoria: Solicito la aplicación de la tabla de retención en la fuente establecida en el artículo 383 del Estatuto Tributario, la cual se le aplica a los pagos o abonos en cuenta por concepto de ingresos por honorarios y por compensación por servicios personales.',
            { align: 'justify' }
        );
        doc.moveDown(4);

        // Firma
        doc.font(bold).text('ATENTAMENTE,');
        doc.moveDown(3);
        doc.text('___________________________');
        doc.font(regular).text(cuenta.nombre);
        doc.text(`C.c. ${cuenta.documento}`);
        doc.text(`Cuenta ${cuenta.tipo_cuenta || 'ahorros'} ${cuenta.banco || ''} ${cuenta.numero_cuenta || ''}`);

        doc.end();

    } catch (error) {
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error al generar el PDF' });
    }
};

// ========================================
// VER CUENTA DE COBRO COMO PDF (vista previa)
// ========================================
const verCuentaPDF = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { id } = req.params;

        // (Mismo código que descargarCuentaPDF hasta la parte de headers)
        const [cuentaRows] = await db.query(
            `SELECT cc.*, u.nombre, u.documento, u.numero_cuenta, b.nombre AS banco, tc.nombre AS tipo_cuenta
             FROM cuentas_cobro cc
             JOIN usuarios u ON cc.id_docente = u.id_usuario
             LEFT JOIN bancos b ON u.id_banco = b.id_banco
             LEFT JOIN tipos_cuenta tc ON u.id_tipo_cuenta = tc.id_tipo_cuenta
             WHERE cc.id_cuenta = ? AND cc.id_docente = ?`,
            [id, idDocente]
        );

        if (cuentaRows.length === 0) {
            return res.status(404).send('Cuenta no encontrada');
        }

        const cuenta = cuentaRows[0];

        const [registros] = await db.query(
            `SELECT rh.fecha, rh.horas_trabajadas, rh.tema_desarrollado, g.codigo, g.nombre AS grupo_nombre,
                    tc.programa, tc.modulo, tc.valor_hora, (rh.horas_trabajadas * tc.valor_hora) AS subtotal
             FROM registros_horas rh
             JOIN grupos g ON rh.id_grupo = g.id_grupo
             JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
             WHERE rh.id_docente = ? AND MONTH(rh.fecha) = ? AND YEAR(rh.fecha) = ?
             ORDER BY rh.fecha`,
            [idDocente, cuenta.mes, cuenta.anio]
        );

        // Headers para VISTA PREVIA (inline)
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="Cuenta_de_Cobro_${String(cuenta.id_cuenta).padStart(3, '0')}.pdf"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

        // (El mismo código de generación del PDF que en descargarCuentaPDF)
        const fontPath = path.join(__dirname, '../public/fonts/Roboto-Regular.ttf');
        const fontBoldPath = path.join(__dirname, '../public/fonts/Roboto-Bold.ttf');

        const regular = fs.existsSync(fontPath) ? fontPath : 'Helvetica';
        const bold = fs.existsSync(fontBoldPath) ? fontBoldPath : 'Helvetica-Bold';

        doc.font(regular);

        const hoy = new Date();
        const meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        const fechaTexto = `${hoy.getDate()} de ${meses[hoy.getMonth() + 1]} de ${hoy.getFullYear()}`;
        doc.fontSize(12).text(fechaTexto, { align: 'right' });
        doc.moveDown(2);

        doc.font(bold).fontSize(18).text(`CUENTA DE COBRO N° ${String(cuenta.id_cuenta).padStart(3, '0')}`, { align: 'center' });
        doc.moveDown(2);

        doc.font(bold).fontSize(14).text('COLEGIATURA ANTIOQUEÑA DE BELLEZA SAS', { align: 'center' });
        doc.font(regular).fontSize(12).text('NIT: 901.363.247-8', { align: 'center' });
        doc.moveDown(2);

        // DEBE A: (centrado)
        doc.font(bold).fontSize(12).text('DEBE A:', { align: 'center' });
        doc.font(regular).fontSize(12).text(cuenta.nombre, { align: 'center' });
        doc.text(`C.C. ${cuenta.documento}`, { align: 'center' });
        doc.moveDown(2);

        const valorFormateado = new Intl.NumberFormat('es-CO').format(cuenta.total_pagar);
        const valorEnLetras = numeroALetras(cuenta.total_pagar);

        // LA SUMA DE: (centrado)
        doc.font(bold).fontSize(14).text('LA SUMA DE:', { align: 'center' });
        doc.font(regular).fontSize(16).text(`$${valorFormateado}`, { align: 'center' });
        doc.font(regular).fontSize(12).text(`${valorEnLetras} PESOS COP`, { align: 'center' });
        doc.moveDown(2);

        // Por concepto de: (centrado)
        const mesNombre = meses[cuenta.mes];
        doc.font(bold).fontSize(12).text('Por concepto de:', { align: 'center' });
        doc.font(regular).fontSize(12).text(`PRESTACIÓN DE SERVICIOS POR HORA CÁTEDRA MES DE ${mesNombre.toUpperCase()}`, { align: 'center' });

        doc.fontSize(10).text(
            'Nota aclaratoria: Solicito la aplicación de la tabla de retención en la fuente establecida en el artículo 383 del Estatuto Tributario, la cual se le aplica a los pagos o abonos en cuenta por concepto de ingresos por honorarios y por compensación por servicios personales.',
            { align: 'justify' }
        );
        doc.moveDown(4);

        doc.font(bold).text('ATENTAMENTE,');
        doc.moveDown(3);
        doc.text('___________________________');
        doc.font(regular).text(cuenta.nombre);
        doc.text(`C.c. ${cuenta.documento}`);
        doc.text(`Cuenta ${cuenta.tipo_cuenta || 'ahorros'} ${cuenta.banco || ''} ${cuenta.numero_cuenta || ''}`);

        doc.end();

    } catch (error) {
        console.error('Error generando vista previa PDF:', error);
        res.status(500).send('Error al generar el PDF');
    }
};

// Función para convertir número a letras (español colombiano)
// Función corregida: número a letras en español colombiano
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
    // ... tus funciones anteriores
    descargarCuentaPDF  // ← Agrega esta
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
    cambiarPassword,
    descargarCuentaPDF,
    verCuentaPDF
};