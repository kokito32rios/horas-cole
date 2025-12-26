const db = require('../config/database');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');

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
                tc.programa,
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
            idCuenta
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

// ========================================
// DESCARGAR CUENTA DE COBRO COMO PDF
// ========================================
const descargarCuentaPDF = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { id } = req.params;

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

        const mesesArray = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
        const nombreMes = mesesArray[cuenta.mes];

        const nombreDocente = cuenta.nombre.trim().toUpperCase();

        const nombreArchivo = `CUENTA DE COBRO ${nombreMes} - ${nombreDocente}.pdf`;

        const esVistaPrevia = req.path.includes('ver');
        const disposicion = esVistaPrevia ? 'inline' : 'attachment';

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${disposicion}; filename="${nombreArchivo}"`);

        const doc = new PDFDocument({ size: 'A4', margin: 50 });
        doc.pipe(res);

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

        doc.font(bold).fontSize(12).text('DEBE A:', { align: 'center' });
        doc.font(regular).fontSize(12).text(cuenta.nombre, { align: 'center' });
        doc.text(`C.C. ${cuenta.documento}`, { align: 'center' });
        doc.moveDown(2);

        const valorFormateado = new Intl.NumberFormat('es-CO').format(cuenta.total_pagar);
        const valorEnLetras = numeroALetras(cuenta.total_pagar);

        doc.font(bold).fontSize(14).text('LA SUMA DE:', { align: 'center' });
        doc.font(regular).fontSize(16).text(`$${valorFormateado}`, { align: 'center' });
        doc.font(regular).fontSize(12).text(`${valorEnLetras} PESOS COP`, { align: 'center' });
        doc.moveDown(2);

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
        console.error('Error generando PDF:', error);
        res.status(500).json({ error: 'Error al generar el PDF' });
    }
};

// ========================================
// VER CUENTA DE COBRO COMO PDF (vista previa)
// ========================================
const verCuentaPDF = async (req, res) => {
    await descargarCuentaPDF(req, res); // Usa la misma lógica, solo cambia el header a inline (ya lo hace dentro de la función)
};

// ========================================
// GENERAR PLANEADOR EXCEL
// ========================================
const generarPlaneadorExcel = async (req, res) => {
    try {
        const idDocente = req.session.usuario.id;
        const { mes, anio, id_grupo } = req.params;

        const mesNum = parseInt(mes);
        const anioNum = parseInt(anio);
        if (isNaN(mesNum) || isNaN(anioNum) || mesNum < 1 || mesNum > 12) {
            return res.status(400).send('Mes o año inválido');
        }

        const [docenteRows] = await db.query(
            `SELECT u.nombre, u.documento 
             FROM usuarios u 
             WHERE u.id_usuario = ?`,
            [idDocente]
        );
        const docente = docenteRows[0];

        const esTodos = id_grupo === undefined || id_grupo === 'todos';

        let gruposQuery;
        let params = [idDocente];
        if (esTodos) {
            gruposQuery = `
                SELECT DISTINCT g.id_grupo, g.codigo, g.nombre AS grupo_nombre, tc.programa, tc.modulo
                FROM grupos g
                JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
                WHERE g.id_docente = ? AND g.activo = 1`;
        } else {
            gruposQuery = `
                SELECT g.id_grupo, g.codigo, g.nombre AS grupo_nombre, tc.programa, tc.modulo
                FROM grupos g
                JOIN tipos_curso tc ON g.id_tipo = tc.id_tipo
                WHERE g.id_grupo = ? AND g.id_docente = ? AND g.activo = 1`;
            params = [parseInt(id_grupo), idDocente];
        }

        const [grupos] = await db.query(gruposQuery, params);

        if (grupos.length === 0) {
            return res.status(404).send('No hay grupos activos o datos para este período');
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema Registro Horas';
        workbook.created = new Date();

        const mesesLetra = ['', 'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 
                            'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];

        for (const grupo of grupos) {
            const [registros] = await db.query(
                `SELECT rh.fecha, rh.hora_ingreso, rh.hora_salida, rh.horas_trabajadas,
                        rh.tema_desarrollado, rh.observaciones
                 FROM registros_horas rh
                 WHERE rh.id_docente = ? AND rh.id_grupo = ? 
                 AND MONTH(rh.fecha) = ? AND YEAR(rh.fecha) = ?
                 ORDER BY rh.fecha`,
                [idDocente, grupo.id_grupo, mesNum, anioNum]
            );

            const sheet = workbook.addWorksheet(grupo.codigo || 'Grupo');

            sheet.columns = [
                { header: '', key: 'a', width: 15 },
                { header: '', key: 'b', width: 20 },
                { header: '', key: 'c', width: 20 },
                { header: '', key: 'd', width: 15 },
                { header: '', key: 'e', width: 50 },
                { header: '', key: 'f', width: 40 }
            ];

                        // Encabezado fijo - ORDEN CRÍTICO PARA EVITAR SOLAPAMIENTOS
            // 1. Primero la combinación vertical grande (F1:F3)
            sheet.mergeCells('F1:F3');
            sheet.getCell('F1').value = 'PROCESO GESTION ACADEMICA';
            sheet.getCell('F1').font = { bold: true };
            sheet.getCell('F1').alignment = { vertical: 'middle', horizontal: 'center' };

            // 2. Luego las horizontales que no tocan F2/F3
            sheet.mergeCells('B1:E1');
            sheet.getCell('B1').value = 'COLEGIATURA ANTIOQUEÑA DE BELLEZA';
            sheet.getCell('B1').font = { bold: true, size: 14 };
            sheet.getCell('B1').alignment = { horizontal: 'center' };

            // 3. Título grande (B2:E2) - NO toca F2 porque F2 ya está en F1:F3
            sheet.mergeCells('B2:E2');
            sheet.getCell('B2').value = 'DIARIO DE CAMPO DOCENTE';
            sheet.getCell('B2').font = { bold: true, size: 16 };
            sheet.getCell('B2').alignment = { horizontal: 'center' };

            // 4. Fila 3 - textos individuales
            sheet.getCell('B3').value = 'CODIGO: MGA-F-30';
            sheet.getCell('C3').value = 'VERSIÓN: 1';
            sheet.getCell('E3').value = 'FECHA: 29/11/2024';

            // 5. Fila 4
            sheet.mergeCells('A4:B4');
            sheet.getCell('A4').value = 'NOMBRE DEL DOCENTE:';
            sheet.getCell('A4').font = { bold: true };

            sheet.mergeCells('C4:F4');
            sheet.getCell('C4').value = docente.nombre.toUpperCase();

            // 6. Fila 5
            sheet.mergeCells('A5:B5');
            sheet.getCell('A5').value = 'PROGRAMA';
            sheet.getCell('A5').font = { bold: true };

            sheet.mergeCells('C5:F5');
            sheet.getCell('C5').value = grupo.programa || '';

            // 7. Fila 6
            sheet.mergeCells('A6:B6');
            sheet.getCell('A6').value = 'MÓDULO';
            sheet.getCell('A6').font = { bold: true };

            sheet.mergeCells('C6:D6');
            sheet.getCell('C6').value = grupo.modulo || '';

            sheet.getCell('E6').value = 'GRUPO / JORNADA';
            sheet.getCell('E6').font = { bold: true };

            sheet.getCell('F6').value = grupo.grupo_nombre || '';

            // Encabezados tabla con bordes gruesos
            const headerRow = sheet.getRow(7);
            headerRow.values = ['', 'FECHA', 'HORA ENTRADA', 'HORA SALIDA', 'Q HORAS', 'TEMA DESARROLLADO EN CLASE', 'OBSERVACIONES'];
            headerRow.font = { bold: true };

            headerRow.eachCell((cell) => {
                cell.border = {
                    top: { style: 'medium' },
                    left: { style: 'medium' },
                    bottom: { style: 'medium' },
                    right: { style: 'medium' }
                };
            });

            // Datos registros
            let totalHorasMes = 0;
            registros.forEach((r, index) => {
                const row = sheet.getRow(8 + index);
                row.values = [
                    '',
                    new Date(r.fecha).toLocaleDateString('es-CO'),
                    r.hora_ingreso,
                    r.hora_salida || '',
                    parseFloat(r.horas_trabajadas).toFixed(2),
                    r.tema_desarrollado || '',
                    r.observaciones || ''
                ];

                row.eachCell((cell) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                });

                totalHorasMes += parseFloat(r.horas_trabajadas);
            });

            // Totales con bordes gruesos
            const totalRowIndex = 8 + registros.length + 1;
            const totalRow = sheet.getRow(totalRowIndex);
            totalRow.getCell('A').value = 'TOTAL HORAS SEMANA: 4 HORAS';
            sheet.mergeCells(`C${totalRowIndex}:D${totalRowIndex}`);
            totalRow.getCell('C').value = 'TOTAL MES';
            totalRow.getCell('D').value = totalHorasMes.toFixed(2);

            totalRow.eachCell((cell, colNumber) => {
                if (colNumber >= 1 && colNumber <= 6) {
                    cell.border = {
                        top: { style: 'medium' },
                        left: { style: 'medium' },
                        bottom: { style: 'medium' },
                        right: { style: 'medium' }
                    };
                }
            });

            // Pie sin bordes
            const pieRow1 = totalRowIndex + 1;
            sheet.getCell(`A${pieRow1}`).value = 'Revisado por:';

            const pieRow2 = pieRow1 + 1;
            sheet.getCell(`A${pieRow2}`).value = 'Fecha de Revisión:';
            sheet.mergeCells(`E${pieRow2}:F${pieRow2}`);
            sheet.getCell(`E${pieRow2}`).value = 'Fecha de Aprobación y Autorización:';
        }

        // Nombre del archivo
        const nombreDocente = docente.nombre.trim().toUpperCase().replace(/[^A-Z\s]/g, '');
        const mesNombre = mesesLetra[mesNum];
        const sufijoGrupo = esTodos ? 'TODOS GRUPOS' : grupos[0].codigo.replace(/\s/g, '_');
        const nombreArchivo = `PLANEADOR ${mesNombre} - ${sufijoGrupo} - ${nombreDocente}.xlsx`;

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generando planeador Excel:', error);
        res.status(500).send('Error al generar el planeador');
    }
};

// ========================================
// VER PLANEADOR EXCEL (vista previa)
// ========================================
const verPlaneadorExcel = async (req, res) => {
    await generarPlaneadorExcel(req, res); // Reutiliza la misma lógica, solo cambia el header a inline en la función principal
    // Pero para forzar inline, sobrescribimos el header
    res.setHeader('Content-Disposition', res.getHeader('Content-Disposition').replace('attachment', 'inline'));
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
    obtenerMisGrupos,
    registrarHora,
    obtenerHistorial,
    generarCuentaCobro,
    obtenerCuentasGeneradas,
    obtenerMiPerfil,
    cambiarPassword,
    descargarCuentaPDF,
    verCuentaPDF,
    generarPlaneadorExcel,
    verPlaneadorExcel
};