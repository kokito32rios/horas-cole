// ========================================
// VARIABLES GLOBALES
// ========================================
let usuarioActual = null;

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSesion();
    configurarNavegacion();
    cargarDashboard();
    configurarFechaActual();
    calcularHorasAutomatico();
    llenarAnios();
});

// ========================================
// VERIFICAR SESIÓN
// ========================================
async function verificarSesion() {
    try {
        const response = await fetch('/api/auth/verificar');
        const data = await response.json();
        
        if (!data.autenticado || data.usuario.rol !== 'docente') {
            window.location.href = '/login';
            return;
        }
        
        usuarioActual = data.usuario;
        document.getElementById('nombreUsuario').textContent = data.usuario.nombre;
        
    } catch (error) {
        console.error('Error verificando sesión:', error);
        window.location.href = '/login';
    }
}

// ========================================
// NAVEGACIÓN POR PESTAÑAS
// ========================================
function configurarNavegacion() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevenir comportamiento por defecto si es necesario
            const tabName = btn.dataset.tab;
            cambiarTabDocente(tabName);
        });
    });
}

function toggleMenuDocente() {
    const nav = document.getElementById('adminNav');
    const overlay = document.getElementById('navOverlay');
    const hamburger = document.getElementById('hamburgerBtn');

    nav.classList.toggle('show');
    overlay.classList.toggle('show');
    hamburger.classList.toggle('active');
}

function cambiarTabDocente(tabName) {
    // Desactivar todos
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    
    // Activar el seleccionado
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    
    const tab = document.getElementById(`tab-${tabName}`);
    if (tab) tab.classList.add('active');
    
    // CERRAR MENÚ EN MÓVIL AUTOMÁTICAMENTE
    if (window.innerWidth <= 768) {
        toggleMenuDocente();
    }

    // ✅ CARGAR DATOS CON DELAY PARA QUE FUNCIONE EN MÓVIL (igual que admin)
    setTimeout(() => {
        if (tabName === 'dashboard') {
            cargarDashboard();
        } else if (tabName === 'grupos') {
            cargarMisGrupos();
        } else if (tabName === 'registrar') {
            cargarGruposSelect();
        } else if (tabName === 'historial') {
            cargarGruposSelectFiltro();
            cargarHistorial();
        } else if (tabName === 'cuentas') {
            cargarCuentasGeneradas();
        } else if (tabName === 'perfil') {
            cargarMiPerfil();  // ← AHORA CON DELAY
        } else if (tabName === 'planeadores') {
            llenarAniosPlaneador();
            cargarGruposPlaneador();
        }
    }, 200); // ← DELAY DE 200ms COMO EN ADMIN
}

// ========================================
// DASHBOARD
// ========================================
async function cargarDashboard() {
    try {
        const response = await fetch('/api/docente/estadisticas');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statMisGrupos').textContent = data.estadisticas.totalGrupos;
            document.getElementById('statHorasMes').textContent = data.estadisticas.horasMes.toFixed(2);
            document.getElementById('statClasesMes').textContent = data.estadisticas.clasesMes;
            document.getElementById('statTotalPagar').textContent = formatearMoneda(data.estadisticas.totalPagar);
        }
    } catch (error) {
        console.error('Error cargando dashboard:', error);
        mostrarNotificacion('Error al cargar estadísticas', 'error');
    }
}

// ========================================
// MIS GRUPOS
// ========================================
async function cargarMisGrupos() {
    const tbody = document.getElementById('tablaMisGrupos');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center">Cargando...</td></tr>';

    try {
        const response = await fetch('/api/docente/mis-grupos');
        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);
        
        const data = await response.json();
        
        if (data.success && data.grupos.length > 0) {
            tbody.innerHTML = data.grupos.map(g => `
                <tr>
                    <td data-label="Código:"><strong>${g.codigo}</strong></td>
                    <td data-label="Nombre:">${g.nombre}</td>
                    <td data-label="Programa:">${g.programa || '-'}</td> <!-- ← PROGRAMA AQUÍ -->
                    <td data-label="Valor/Hora:">${formatearMoneda(g.valor_hora)}</td>
                    <td data-label="Estado:">
                        <span class="badge ${g.activo ? 'badge-success' : 'badge-danger'}">
                            ${g.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                </tr>
            `).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No tienes grupos asignados</td></tr>';
        }
    } catch (error) {
        console.error('Error cargando mis grupos:', error);
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-error">Error al cargar grupos</td></tr>`;
        mostrarNotificacion('Error al cargar grupos', 'error');
    }
}
// ========================================
// REGISTRAR HORAS
// ========================================
function configurarFechaActual() {
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('registroFecha').value = hoy;
}

async function cargarGruposSelect() {
    try {
        const response = await fetch('/api/docente/mis-grupos');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('registroGrupo');
            select.innerHTML = '<option value="">Seleccionar grupo...</option>' +
                data.grupos.filter(g => g.activo).map(g => 
                    `<option value="${g.id_grupo}" data-programa="${g.programa || ''}" data-modulo="${g.tipo_curso || ''}">
                        ${g.codigo} - ${g.nombre}
                    </option>`
                ).join('');

            select.addEventListener('change', () => {
                const selected = select.options[select.selectedIndex];
                document.getElementById('registroPrograma').value = selected.dataset.programa || 'No definido';
                document.getElementById('registroModulo').value = selected.dataset.modulo || 'No definido';
            });
        }
    } catch (error) {
        console.error('Error cargando grupos:', error);
    }
}

function calcularHorasAutomatico() {
    const ingreso = document.getElementById('registroHoraIngreso');
    const salida = document.getElementById('registroHoraSalida');
    
    function calcular() {
        if (ingreso.value && salida.value) {
            const [h1, m1] = ingreso.value.split(':').map(Number);
            const [h2, m2] = salida.value.split(':').map(Number);
            
            let diferencia = (h2 * 60 + m2) - (h1 * 60 + m1);
            if (diferencia < 0) diferencia += 24 * 60;
            
            const horas = (diferencia / 60).toFixed(2);
            document.getElementById('horasCalculadas').textContent = horas;
        }
    }
    
    ingreso.addEventListener('change', calcular);
    salida.addEventListener('change', calcular);
}

document.getElementById('formRegistrarHora').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const datos = {
        fecha: document.getElementById('registroFecha').value,
        id_grupo: parseInt(document.getElementById('registroGrupo').value),
        hora_ingreso: document.getElementById('registroHoraIngreso').value,
        hora_salida: document.getElementById('registroHoraSalida').value,
        observaciones: document.getElementById('registroObservaciones').value,
        tema_desarrollado: document.getElementById('registroTema').value.trim()
    };
    
    try {
        const response = await fetch('/api/docente/registrar-hora', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            document.getElementById('formRegistrarHora').reset();
            configurarFechaActual();
            document.getElementById('horasCalculadas').textContent = '0.00';
            cargarDashboard();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar registro', 'error');
        }
    } catch (error) {
        console.error('Error registrando hora:', error);
        mostrarNotificacion('Error al registrar hora', 'error');
    }
});

// ========================================
// HISTORIAL
// ========================================
async function cargarGruposSelectFiltro() {
    try {
        const response = await fetch('/api/docente/mis-grupos');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('filtroGrupo');
            select.innerHTML = '<option value="">Todos los grupos</option>';
            
            const gruposActivos = data.grupos.filter(g => g.activo);
            
            if (gruposActivos.length === 0) {
                select.innerHTML += '<option value="" disabled>No tienes grupos activos</option>';
            } else {
                gruposActivos.forEach(g => {
                    const option = document.createElement('option');
                    option.value = g.id_grupo;
                    option.textContent = `${g.codigo} - ${g.nombre}`;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error cargando grupos para filtro:', error);
        mostrarNotificacion('Error al cargar los grupos', 'error');
    }
}

async function cargarHistorial() {
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    const grupo = document.getElementById('filtroGrupo').value;
    
    try {
        let url = '/api/docente/historial';
        const params = new URLSearchParams();
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        if (grupo) params.append('grupo', grupo);
        
        if (params.toString()) url += '?' + params.toString();
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaHistorial');
            const tfoot = document.getElementById('totalHistorial');
            
            if (data.registros.length === 0) {
                tbody.innerHTML = '<tr><td colspan="10" class="text-center">No hay registros</td></tr>';
                tfoot.style.display = 'none';
                return;
            }
            
            let totalHoras = 0;
            let totalValor = 0;
            
            tbody.innerHTML = data.registros.map(r => {
                totalHoras += parseFloat(r.horas_trabajadas);
                totalValor += parseFloat(r.valor);
                
                return `
                    <tr>
                        <td>${formatearFecha(r.fecha)}</td>
                        <td>${r.codigo} - ${r.nombre_grupo}</td>
                        <td>${r.programa || '-'}</td>
                        <td>${r.modulo || '-'}</td>
                        <td>${r.tema_desarrollado || '-'}</td>
                        <td>${r.hora_ingreso}</td>
                        <td>${r.hora_salida || '-'}</td>
                        <td>${parseFloat(r.horas_trabajadas).toFixed(2)}</td>
                        <td>${formatearMoneda(r.valor)}</td>
                        <td>${r.observaciones || '-'}</td>
                    </tr>
                `;
            }).join('');
            
            document.getElementById('totalHoras').textContent = totalHoras.toFixed(2);
            document.getElementById('totalValor').textContent = formatearMoneda(totalValor);
            tfoot.style.display = 'table-footer-group';
        }
    } catch (error) {
        console.error('Error cargando historial:', error);
        mostrarNotificacion('Error al cargar historial', 'error');
    }
}

function buscarHistorial() {
    cargarHistorial();
}

// ========================================
// CUENTAS DE COBRO
// ========================================
function llenarAnios() {
    const select = document.getElementById('cuentaAnio');
    const anioActual = new Date().getFullYear();
    
    for (let i = anioActual; i >= anioActual - 5; i--) {
        select.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    const mesActual = new Date().getMonth() + 1;
    document.getElementById('cuentaMes').value = mesActual;
}

async function generarCuentaCobro() {
    const mes = document.getElementById('cuentaMes').value;
    const anio = document.getElementById('cuentaAnio').value;
    
    try {
        const response = await fetch(`/api/docente/cuenta-cobro/${mes}/${anio}`, { method: 'POST' });
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion('Cuenta de cobro generada exitosamente', 'success');
            cargarCuentasGeneradas();
        } else {
            mostrarNotificacion(data.error || 'Error al generar cuenta de cobro', 'error');
        }
    } catch (error) {
        console.error('Error generando cuenta:', error);
        mostrarNotificacion('Error al generar cuenta de cobro', 'error');
    }
}

async function cargarCuentasGeneradas() {
    try {
        const response = await fetch('/api/docente/cuentas-generadas');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaCuentas');
            
            if (data.cuentas.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay cuentas generadas</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.cuentas.map(c => `
                <tr>
                    <td>${getNombreMes(c.mes)} ${c.anio}</td>
                    <td>${parseFloat(c.total_horas).toFixed(2)}</td>
                    <td>${formatearMoneda(c.total_pagar)}</td>
                    <td>${formatearFecha(c.generado_el)}</td>
                    <td class="action-btns">
                        <button class="btn btn-sm btn-info" onclick="verCuentaCobro(${c.id_cuenta})" title="Ver PDF">
                            👁️ Ver
                        </button>
                        <button class="btn btn-sm btn-primary" onclick="descargarCuenta(${c.id_cuenta})" title="Descargar PDF">
                            📥 Descargar
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    } catch (error) {
        console.error('Error cargando cuentas:', error);
    }
}

function verCuentaCobro(id) {
    window.open(`/api/docente/ver-cuenta-pdf/${id}`, '_blank');
}

function descargarCuenta(id) {
    window.location.href = `/api/docente/descargar-cuenta-pdf/${id}`;
}

// ========================================
// MI PERFIL
// ========================================
async function cargarMiPerfil() {
    console.log('========== INICIO cargarMiPerfil ==========');
    
    try {
        console.log('1. Haciendo fetch a /api/docente/mi-perfil...');
        const response = await fetch('/api/docente/mi-perfil');
        
        console.log('2. Response status:', response.status);
        console.log('3. Response OK?:', response.ok);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('ERROR en response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('4. Datos recibidos:', data);
        
        if (data.success && data.perfil) {
            const p = data.perfil;
            console.log('5. Perfil extraído:', p);
            
            // Verificar que los elementos existan
            const elementos = {
                nombre: document.getElementById('perfilNombre'),
                documento: document.getElementById('perfilDocumento'),
                email: document.getElementById('perfilEmail'),
                telefono: document.getElementById('perfilTelefono'),
                banco: document.getElementById('perfilBanco'),
                tipoCuenta: document.getElementById('perfilTipoCuenta'),
                numeroCuenta: document.getElementById('perfilNumeroCuenta')
            };
            
            console.log('6. Elementos encontrados:', elementos);
            
            // Verificar que TODOS los elementos existan
            const elementosFaltantes = Object.entries(elementos)
                .filter(([key, elem]) => !elem)
                .map(([key]) => key);
            
            if (elementosFaltantes.length > 0) {
                console.error('ELEMENTOS FALTANTES:', elementosFaltantes);
                mostrarNotificacion('Error: elementos del DOM no encontrados', 'error');
                return;
            }
            
            // Asignar valores
            console.log('7. Asignando valores...');
            elementos.nombre.textContent = p.nombre || 'Sin nombre';
            elementos.documento.textContent = p.documento || '-';
            elementos.email.textContent = p.email || 'No registrado';
            elementos.telefono.textContent = p.telefono || 'No registrado';
            elementos.banco.textContent = p.banco || 'No asignado';
            elementos.tipoCuenta.textContent = p.tipo_cuenta || 'No asignado';
            elementos.numeroCuenta.textContent = p.numero_cuenta || 'No asignado';
            
            console.log('8. ✅ Valores asignados correctamente');
            console.log('========== FIN cargarMiPerfil OK ==========');
        } else {
            console.error('DATOS INVÁLIDOS:', data);
            mostrarNotificacion('No se pudieron cargar los datos del perfil', 'warning');
        }
    } catch (error) {
        console.error('========== ERROR EN cargarMiPerfil ==========');
        console.error('Error completo:', error);
        console.error('Stack:', error.stack);
        mostrarNotificacion('Error al cargar el perfil. Revisa la consola.', 'error');
    }
}

function cambiarMiContrasenaDocente() {
    document.getElementById('formPasswordDocente').reset();
    document.getElementById('modalPassword').classList.add('show');
}

document.getElementById('formPasswordDocente').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const nuevaPassword = document.getElementById('passwordNueva').value;
    const confirmar = document.getElementById('passwordConfirmar').value;
    
    if (nuevaPassword !== confirmar) {
        mostrarNotificacion('Las contraseñas no coinciden', 'error');
        return;
    }
    
    if (nuevaPassword.length < 6) {
        mostrarNotificacion('La contraseña debe tener al menos 6 caracteres', 'error');
        return;
    }
    
    try {
        const response = await fetch('/api/docente/cambiar-password', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevaPassword })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModalDocente('modalPassword');
        } else {
            mostrarNotificacion(data.error || 'Error al cambiar contraseña', 'error');
        }
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al cambiar contraseña', 'error');
    }
});

// ========================================
// PLANEADORES
// ========================================
function llenarAniosPlaneador() {
    const select = document.getElementById('planeadorAnio');
    const anioActual = new Date().getFullYear();
    
    select.innerHTML = '';
    for (let i = anioActual; i >= anioActual - 5; i--) {
        select.innerHTML += `<option value="${i}">${i}</option>`;
    }
    
    select.value = anioActual;
}

async function cargarGruposPlaneador() {
    try {
        const response = await fetch('/api/docente/mis-grupos');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('planeadorGrupo');
            select.innerHTML = '<option value="todos">Todos los grupos</option>' +
                data.grupos.filter(g => g.activo).map(g => 
                    `<option value="${g.id_grupo}">${g.codigo} - ${g.nombre}</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error cargando grupos para planeador:', error);
    }
}

function generarPlaneadorExcel() {
    const mes = document.getElementById('planeadorMes').value;
    const anio = document.getElementById('planeadorAnio').value;
    const grupo = document.getElementById('planeadorGrupo').value;

    if (!mes || !anio) {
        mostrarNotificacion('Selecciona mes y año', 'error');
        return;
    }

    let url = `/api/docente/generar-planeador/${mes}/${anio}`;
    if (grupo && grupo !== 'todos') {
        url += `/${grupo}`;
    }

    window.location.href = url;
}

async function verPlaneadorExcel() {
    const mes = document.getElementById('planeadorMes').value;
    const anio = document.getElementById('planeadorAnio').value;
    const grupoId = document.getElementById('planeadorGrupo').value;

    if (!mes || !anio) {
        mostrarNotificacion('Selecciona mes y año', 'error');
        return;
    }

    const ultimoDia = new Date(anio, mes, 0).getDate();

    try {
        let url = '/api/docente/historial';
        const params = new URLSearchParams();
        params.append('desde', `${anio}-${mes.padStart(2, '0')}-01`);
        params.append('hasta', `${anio}-${mes.padStart(2, '0')}-${ultimoDia}`);
        if (grupoId && grupoId !== 'todos') {
            params.append('grupo', grupoId);
        }
        url += '?' + params.toString();

        const response = await fetch(url);
        const data = await response.json();

        if (!data.success || data.registros.length === 0) {
            document.getElementById('tablaPreviewPlaneador').innerHTML = '<tr><td colspan="6" class="text-center">No hay registros para este período</td></tr>';
            document.getElementById('modalPlaneadorPreview').classList.add('show');
            return;
        }

        const tbody = document.getElementById('tablaPreviewPlaneador');
        tbody.innerHTML = data.registros.map(r => `
            <tr>
                <td>${formatearFecha(r.fecha)}</td>
                <td>${r.hora_ingreso}</td>
                <td>${r.hora_salida || '—'}</td>
                <td>${parseFloat(r.horas_trabajadas).toFixed(2)}</td>
                <td>${r.tema_desarrollado || '-'}</td>
                <td>${r.observaciones || '-'}</td>
            </tr>
        `).join('');

        document.getElementById('modalPlaneadorPreview').classList.add('show');

    } catch (error) {
        console.error('Error cargando vista previa:', error);
        mostrarNotificacion('Error al cargar la vista previa', 'error');
    }
}

function cerrarModalPlaneador() {
    document.getElementById('modalPlaneadorPreview').classList.remove('show');
}

// ========================================
// UTILIDADES
// ========================================
function cerrarModalDocente(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
}

function formatearFecha(fecha) {
    if (!fecha) return '-';
    const d = new Date(fecha.includes('T') || fecha.includes(' ') ? fecha : fecha + 'T00:00:00');
    if (isNaN(d)) return '-';
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getNombreMes(num) {
    const meses = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
                   'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[num - 1];
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 4000);
}

function cerrarSesionDocente() {
    document.getElementById('modalCerrarSesion').classList.add('show');
}

async function confirmarCerrarSesionDocente() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        window.location.href = '/login';
    }
}

// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});