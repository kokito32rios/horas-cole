// ========================================
// VARIABLES GLOBALES
// ========================================
let usuarioActual = null;

// ========================================
// INICIALIZACIÓN
// ========================================
document.addEventListener('DOMContentLoaded', async () => {
    await verificarSesion();
    await cargarEstadisticas();
    configurarNavegacion();
});

// ========================================
// VERIFICAR SESIÓN
// ========================================
async function verificarSesion() {
    try {
        const response = await fetch('/api/auth/verificar');
        const data = await response.json();
        
        if (!data.autenticado || data.usuario.rol !== 'admin') {
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
// NAVEGACIÓN POR PESTAÑAS (CORREGIDA PARA MÓVIL)
// ========================================
function configurarNavegacion() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Desactivar todos
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
            
            // Activar el seleccionado
            btn.classList.add('active');
            document.getElementById(`tab-${tabName}`).classList.add('active');
            
            // CERRAR MENÚ HAMBURGUESA EN MÓVIL
            if (window.innerWidth <= 768) {
                document.getElementById('hamburgerBtn').classList.remove('active');
                document.getElementById('adminNav').classList.remove('show');
                document.getElementById('navOverlay').classList.remove('show');
            }
            
            // CARGAR DATOS CON DELAY PARA QUE FUNCIONE EN MÓVIL
            setTimeout(() => {
                if (tabName === 'dashboard') {
                    cargarEstadisticas();
                } else if (tabName === 'usuarios') {
                    cargarUsuarios();
                    cargarSelectores();
                } else if (tabName === 'grupos') {
                    cargarGrupos();
                    cargarTiposCursoSelect();
                    cargarDocentesSelect();
                } else if (tabName === 'cursos') {
                    cargarTiposCurso();
                } else if (tabName === 'bancos') {
                    cargarBancos();
                    cargarTiposCuenta();
                } else if (tabName === 'perfil') {
                    cargarMiPerfil();
                } else if (tabName === 'cuentas-cobro') {
                    cargarDocentesFiltroCuenta();
                    cargarCuentasCobro();
                } else if (tabName === 'historico') {
                    cargarDocentesFiltro();
                    cargarHistoricoHoras();
                } else if (tabName === 'planeadores') {
                    cargarDocentesFiltroPlaneador();
                    cargarPlaneadores();
                }
            }, 200); // 200ms es suficiente para que el DOM se actualice
        });
    });

    // Eventos de filtro del histórico
    document.getElementById('btnFiltrarHistorico')?.addEventListener('click', cargarHistoricoHoras);
    document.getElementById('btnLimpiarFiltros')?.addEventListener('click', () => {
        document.getElementById('filtroDesde').value = '';
        document.getElementById('filtroHasta').value = '';
        document.getElementById('filtroDocente').value = '';
        cargarHistoricoHoras();
    });

    // Eventos de filtro cuentas de cobro
    document.getElementById('btnFiltrarCuentas')?.addEventListener('click', cargarCuentasCobro);
    document.getElementById('btnLimpiarCuentas')?.addEventListener('click', () => {
        document.getElementById('filtroMesCuenta').value = '';
        document.getElementById('filtroAnioCuenta').value = '';
        document.getElementById('filtroDocenteCuenta').value = '';
        cargarCuentasCobro();
    });
}

// ========================================
// DASHBOARD - ESTADÍSTICAS
// ========================================
async function cargarEstadisticas() {
    try {
        const response = await fetch('/api/admin/estadisticas');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('statDocentes').textContent = data.estadisticas.totalDocentes;
            document.getElementById('statGrupos').textContent = data.estadisticas.totalGrupos;
            document.getElementById('statHoras').textContent = data.estadisticas.horasMes.toFixed(2);
            document.getElementById('statMonto').textContent = formatearMoneda(data.estadisticas.montoMes);
        }
        
    } catch (error) {
        console.error('Error cargando estadísticas:', error);
        mostrarNotificacion('Error al cargar estadísticas', 'error');
    }
}

// ========================================
// GESTIÓN DE USUARIOS
// ========================================
async function cargarUsuarios() {
    try {
        const response = await fetch('/api/admin/usuarios');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaUsuarios');
            
            if (data.usuarios.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay usuarios registrados</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.usuarios.map(u => `
    <tr>
        <td>${u.nombre}</td>
        <td>${u.documento}</td>
        <td>${u.email || '-'}</td>
        <td><span class="badge ${u.rol === 'admin' ? 'badge-danger' : 'badge-success'}">${u.rol}</span></td>
        <td>${u.banco || '-'}</td>
        <td>
            <span class="badge ${u.activo ? 'badge-success' : 'badge-danger'}">
                ${u.activo ? 'Activo' : 'Inactivo'}
            </span>
        </td>
        <td class="action-btns">
            <button class="btn-icon btn-edit" onclick="editarUsuario(${u.id_usuario})" title="Editar">✏️</button>
            <button class="btn-icon btn-password" onclick="abrirCambiarPassword(${u.id_usuario})" title="Cambiar contraseña">🔒</button>
            <button class="btn-icon ${u.activo ? 'btn-delete' : 'btn-toggle'}" 
                    onclick="abrirModalEstado(${u.id_usuario}, ${!u.activo}, '${u.nombre}')" 
                    title="${u.activo ? 'Desactivar' : 'Activar'}">
                ${u.activo ? '🚫' : '✅'}
            </button>
            <button class="btn-icon btn-delete" onclick="abrirModalEliminar(${u.id_usuario}, '${u.nombre}')" title="Eliminar permanentemente">🗑️</button>
        </td>
    </tr>
`).join('');
        }
        
    } catch (error) {
        console.error('Error cargando usuarios:', error);
        mostrarNotificacion('Error al cargar usuarios', 'error');
    }
}

function abrirModalUsuario(id = null) {
    const modal = document.getElementById('modalUsuario');
    const titulo = document.getElementById('modalUsuarioTitulo');
    const form = document.getElementById('formUsuario');
    
    form.reset();
    document.getElementById('usuarioId').value = id || '';
    
    if (id) {
        titulo.textContent = 'Editar Usuario';
        document.getElementById('grupoPassword').style.display = 'none';
        document.getElementById('usuarioPassword').removeAttribute('required');
        cargarDatosUsuario(id);
    } else {
        titulo.textContent = 'Nuevo Usuario';
        document.getElementById('grupoPassword').style.display = 'block';
        document.getElementById('usuarioPassword').setAttribute('required', 'required');
    }
    
    modal.classList.add('show');
}

async function cargarDatosUsuario(id) {
    try {
        const response = await fetch('/api/admin/usuarios');
        const data = await response.json();
        
        if (data.success) {
            const usuario = data.usuarios.find(u => u.id_usuario === id);
            if (usuario) {
                document.getElementById('usuarioNombre').value = usuario.nombre;
                document.getElementById('usuarioDocumento').value = usuario.documento;
                document.getElementById('usuarioEmail').value = usuario.email || '';
                document.getElementById('usuarioTelefono').value = usuario.telefono || '';
                document.getElementById('usuarioRol').value = usuario.id_rol;
                document.getElementById('usuarioBanco').value = usuario.id_banco || '';
                document.getElementById('usuarioTipoCuenta').value = usuario.id_tipo_cuenta || '';
                document.getElementById('usuarioNumeroCuenta').value = usuario.numero_cuenta || '';
            }
        }
    } catch (error) {
        console.error('Error cargando datos del usuario:', error);
    }
}

function editarUsuario(id) {
    abrirModalUsuario(id);
}

document.getElementById('formUsuario').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('usuarioId').value;
    const datos = {
        nombre: document.getElementById('usuarioNombre').value,
        documento: document.getElementById('usuarioDocumento').value,
        email: document.getElementById('usuarioEmail').value,
        telefono: document.getElementById('usuarioTelefono').value,
        id_rol: parseInt(document.getElementById('usuarioRol').value),
        id_banco: document.getElementById('usuarioBanco').value || null,
        id_tipo_cuenta: document.getElementById('usuarioTipoCuenta').value || null,
        numero_cuenta: document.getElementById('usuarioNumeroCuenta').value || null
    };
    
    if (!id) {
        datos.password = document.getElementById('usuarioPassword').value;
    }
    
    try {
        const url = id ? `/api/admin/usuarios/${id}` : '/api/admin/usuarios';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalUsuario');
            cargarUsuarios();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar', 'error');
        }
        
    } catch (error) {
        console.error('Error guardando usuario:', error);
        mostrarNotificacion('Error al guardar usuario', 'error');
    }
});

async function toggleEstadoUsuario(id, nuevoEstado) {
    if (!confirm(`¿Estás segur@ de ${nuevoEstado ? 'activar' : 'desactivar'} este usuario?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/usuarios/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstado ? 1 : 0 })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cargarUsuarios();
        } else {
            mostrarNotificacion(data.error || 'Error al cambiar estado', 'error');
        }
        
    } catch (error) {
        console.error('Error cambiando estado:', error);
        mostrarNotificacion('Error al cambiar estado', 'error');
    }
}

function abrirCambiarPassword(userId) {
    document.getElementById('passwordUserId').value = userId;
    document.getElementById('formPassword').reset();
    document.getElementById('modalPassword').classList.add('show');
}

document.getElementById('formPassword').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('passwordUserId').value;
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
        const response = await fetch(`/api/admin/usuarios/${userId}/password`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nuevaPassword })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalPassword');
        } else {
            mostrarNotificacion(data.error || 'Error al cambiar contraseña', 'error');
        }
        
    } catch (error) {
        console.error('Error:', error);
        mostrarNotificacion('Error al cambiar contraseña', 'error');
    }
});

async function cargarSelectores() {
    await cargarRoles();
    await cargarBancosSelect();
    await cargarTiposCuentaSelect();
}

async function cargarRoles() {
    try {
        const response = await fetch('/api/admin/roles');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('usuarioRol');
            select.innerHTML = '<option value="">Seleccionar...</option>' +
                data.roles.map(r => `<option value="${r.id_rol}">${r.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando roles:', error);
    }
}

async function cargarBancosSelect() {
    try {
        const response = await fetch('/api/admin/bancos');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('usuarioBanco');
            select.innerHTML = '<option value="">Seleccionar...</option>' +
                data.bancos.filter(b => b.activo).map(b => `<option value="${b.id_banco}">${b.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando bancos:', error);
    }
}

async function cargarTiposCuentaSelect() {
    try {
        const response = await fetch('/api/admin/tipos-cuenta');
        const data = await response.json();
        
        if (data.success) {
            const select = document.getElementById('usuarioTipoCuenta');
            select.innerHTML = '<option value="">Seleccionar...</option>' +
                data.tipos.filter(t => t.activo).map(t => `<option value="${t.id_tipo_cuenta}">${t.nombre}</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando tipos de cuenta:', error);
    }
}

// ========================================
// UTILIDADES
// ========================================
function cerrarModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
}

function formatearMoneda(valor) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(valor);
}

function mostrarNotificacion(mensaje, tipo = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensaje;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 4000);
}

function cerrarSesion() {
    document.getElementById('modalCerrarSesion').classList.add('show');
}

async function confirmarCerrarSesion() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Error cerrando sesión:', error);
        window.location.href = '/login';
    }
}

// Cerrar modales al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        e.target.classList.remove('show');
    }
});

// Variables para confirmación
let usuarioEstadoTemp = null;

function abrirModalEstado(id, nuevoEstado, nombre) {
    usuarioEstadoTemp = { id, nuevoEstado };
    
    const modal = document.getElementById('modalConfirmarEstado');
    const icono = document.getElementById('iconoEstado');
    const titulo = document.getElementById('tituloEstado');
    const mensaje = document.getElementById('mensajeEstado');
    
    if (nuevoEstado) {
        icono.textContent = '✅';
        titulo.textContent = 'Activar Usuario';
        mensaje.innerHTML = `¿Estás segur@ de <strong>activar</strong> a:<br><strong>${nombre}</strong>?`;
    } else {
        icono.textContent = '🚫';
        titulo.textContent = 'Desactivar Usuario';
        mensaje.innerHTML = `¿Estás segur@ de <strong>desactivar</strong> a:<br><strong>${nombre}</strong>?<br><br>El usuario no podrá iniciar sesión pero se mantendrá su historial.`;
    }
    
    modal.classList.add('show');
}

document.getElementById('btnConfirmarEstado').addEventListener('click', async () => {
    if (!usuarioEstadoTemp) return;
    
    const { id, nuevoEstado } = usuarioEstadoTemp;
    
    try {
        const response = await fetch(`/api/admin/usuarios/${id}/estado`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ activo: nuevoEstado ? 1 : 0 })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalConfirmarEstado');
            cargarUsuarios();
            usuarioEstadoTemp = null;
        } else {
            mostrarNotificacion(data.error || 'Error al cambiar estado', 'error');
        }
        
    } catch (error) {
        console.error('Error cambiando estado:', error);
        mostrarNotificacion('Error al cambiar estado', 'error');
    }
});

// Variables para eliminar
let usuarioEliminarTemp = null;

function abrirModalEliminar(id, nombre) {
    usuarioEliminarTemp = { id, nombre };
    document.getElementById('modalEliminarUsuario').classList.add('show');
}

document.getElementById('btnConfirmarEliminar').addEventListener('click', async () => {
    if (!usuarioEliminarTemp) return;
    
    const { id } = usuarioEliminarTemp;
    
    try {
        const response = await fetch(`/api/admin/usuarios/${id}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalEliminarUsuario');
            cargarUsuarios();
            usuarioEliminarTemp = null;
        } else {
            mostrarNotificacion(data.error || 'Error al eliminar usuario', 'error');
        }
        
    } catch (error) {
        console.error('Error eliminando usuario:', error);
        mostrarNotificacion('Error al eliminar usuario', 'error');
    }
});

// ========================================
// GESTIÓN DE GRUPOS
// ========================================
async function cargarGrupos() {
    try {
        const response = await fetch('/api/admin/grupos');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaGrupos');
            
            if (data.grupos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="8" class="text-center">No hay grupos registrados</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.grupos.map(g => `
                <tr>
                    <td><strong>${g.codigo}</strong></td>
                    <td>${g.nombre}</td>
                    <td>${g.tipo_curso}</td>
                    <td>${g.programa}</td>
                    <td>${formatearMoneda(g.valor_hora)}</td>
                    <td>${g.docente}</td>
                    <td>
                        <span class="badge ${g.activo ? 'badge-success' : 'badge-danger'}">
                            ${g.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td class="action-btns">
                        <button class="btn-icon btn-edit" onclick="editarGrupo(${g.id_grupo})" title="Editar">✏️</button>
                        <button class="btn-icon ${g.activo ? 'btn-delete' : 'btn-toggle'}" 
                                onclick="abrirModalEstadoGrupo(${g.id_grupo}, ${!g.activo}, '${g.codigo}')" 
                                title="${g.activo ? 'Desactivar' : 'Activar'}">
                            ${g.activo ? '🚫' : '✅'}
                        </button>
                        <button class="btn-icon btn-delete" onclick="abrirModalEliminarGrupo(${g.id_grupo}, '${g.codigo}')" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error cargando grupos:', error);
        mostrarNotificacion('Error al cargar grupos', 'error');
    }
}

function abrirModalGrupo(id = null) {
    const modal = document.getElementById('modalGrupo');
    const titulo = document.getElementById('modalGrupoTitulo');
    const form = document.getElementById('formGrupo');
    
    form.reset();
    document.getElementById('grupoId').value = id || '';
    
    if (id) {
        titulo.textContent = 'Editar Grupo';
        cargarDatosGrupo(id);
    } else {
        titulo.textContent = 'Nuevo Grupo';
    }
    
    modal.classList.add('show');
}

async function cargarDatosGrupo(id) {
    try {
        const response = await fetch('/api/admin/grupos');
        const data = await response.json();
        
        if (data.success) {
            const grupo = data.grupos.find(g => g.id_grupo === id);
            if (grupo) {
                document.getElementById('grupoCodigo').value = grupo.codigo;
                document.getElementById('grupoNombre').value = grupo.nombre;
                document.getElementById('grupoTipo').value = grupo.id_tipo;
                document.getElementById('grupoDocente').value = grupo.id_docente;
            }
        }
    } catch (error) {
        console.error('Error cargando datos del grupo:', error);
    }
}

function editarGrupo(id) {
    abrirModalGrupo(id);
}

document.getElementById('formGrupo')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('grupoId')?.value || '';
    const codigo = document.getElementById('grupoCodigo')?.value.trim();
    const nombre = document.getElementById('grupoNombre')?.value.trim();
    const tipo = document.getElementById('grupoTipo')?.value;
    const docente = document.getElementById('grupoDocente')?.value;

    if (!codigo || !nombre || !tipo || !docente) {
        mostrarNotificacion('Todos los campos son obligatorios', 'error');
        return;
    }

    const datos = {
        codigo,
        nombre,
        id_tipo: parseInt(tipo),
        id_docente: parseInt(docente)
    };
    
    try {
        const url = id ? `/api/admin/grupos/${id}` : '/api/admin/grupos';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalGrupo');
            cargarGrupos();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar grupo', 'error');
        }
        
    } catch (error) {
        console.error('Error guardando grupo:', error);
        mostrarNotificacion('Error al guardar grupo', 'error');
    }
});

// Modal de estado para grupos
let grupoEstadoTemp = null;

function abrirModalEstadoGrupo(id, nuevoEstado, codigo) {
    grupoEstadoTemp = { id, nuevoEstado };
    
    const modal = document.getElementById('modalConfirmarEstado');
    const icono = document.getElementById('iconoEstado');
    const titulo = document.getElementById('tituloEstado');
    const mensaje = document.getElementById('mensajeEstado');
    
    if (nuevoEstado) {
        icono.textContent = '✅';
        titulo.textContent = 'Activar Grupo';
        mensaje.innerHTML = `¿Estás segur@ de <strong>activar</strong> el grupo:<br><strong>${codigo}</strong>?`;
    } else {
        icono.textContent = '🚫';
        titulo.textContent = 'Desactivar Grupo';
        mensaje.innerHTML = `¿Estás segur@ de <strong>desactivar</strong> el grupo:<br><strong>${codigo}</strong>?<br><br>El grupo no aparecerá en los registros pero se mantendrá su historial.`;
    }
    
    const btnConfirmar = document.getElementById('btnConfirmarEstado');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!grupoEstadoTemp) return;
        
        const { id, nuevoEstado } = grupoEstadoTemp;
        
        try {
            const response = await fetch(`/api/admin/grupos/${id}/estado`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: nuevoEstado ? 1 : 0 })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalConfirmarEstado');
                cargarGrupos();
                grupoEstadoTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al cambiar estado', 'error');
            }
            
        } catch (error) {
            console.error('Error cambiando estado:', error);
            mostrarNotificacion('Error al cambiar estado', 'error');
        }
    });
    
    modal.classList.add('show');
}

// Modal de eliminar para grupos
let grupoEliminarTemp = null;

function abrirModalEliminarGrupo(id, codigo) {
    grupoEliminarTemp = { id, codigo };
    
    const modal = document.getElementById('modalEliminarUsuario');
    modal.querySelector('h2').textContent = '¡Atención!';
    modal.querySelector('p strong').textContent = `¿Estás segur@ de eliminar el grupo ${codigo}?`;
    
    const btnConfirmar = document.getElementById('btnConfirmarEliminar');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!grupoEliminarTemp) return;
        
        const { id } = grupoEliminarTemp;
        
        try {
            const response = await fetch(`/api/admin/grupos/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalEliminarUsuario');
                cargarGrupos();
                grupoEliminarTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al eliminar grupo', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando grupo:', error);
            mostrarNotificacion('Error al eliminar grupo', 'error');
        }
    });
    
    modal.classList.add('show');
}

// Cargar selectores para el formulario de grupos
async function cargarTiposCursoSelect() {
    const selectTipo = document.getElementById('grupoTipo');

    if (!selectTipo) return;

    try {
        const response = await fetch('/api/admin/tipos-curso');
        const data = await response.json();
        
        if (data.success) {
            selectTipo.innerHTML = '<option value="">Seleccionar...</option>' +
                data.tipos.filter(t => t.activo).map(t => 
                    `<option value="${t.id_tipo}">${t.modulo} - ${formatearMoneda(t.valor_hora)}/hora</option>`
                ).join('');
        }
    } catch (error) {
        console.error('Error cargando tipos de curso:', error);
    }
}

async function cargarDocentesSelect() {
    const select = document.getElementById('grupoDocente');
    if (!select) return;

    try {
        const response = await fetch('/api/admin/docentes');
        const data = await response.json();
        
        if (data.success) {
            select.innerHTML = '<option value="">Seleccionar...</option>' +
                data.docentes.map(d => `<option value="${d.id_usuario}">${d.nombre} (${d.documento})</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando docentes:', error);
    }
}

// ========================================
// GESTIÓN DE TIPOS DE CURSO
// ========================================
async function cargarTiposCurso() {
    try {
        const response = await fetch('/api/admin/tipos-curso');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaCursos');
            
            if (data.tipos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center">No hay módulos registrados</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.tipos.map(t => `
    <tr>
        <td data-label="Programa:">${t.programa || '-'}</td>
        <td data-label="Módulo:"><strong>${t.modulo || 'Sin nombre'}</strong></td>
        <td data-label="Valor/Hora:">${formatearMoneda(t.valor_hora)}</td>
        <td data-label="Estado:">
            <span class="badge ${t.activo ? 'badge-success' : 'badge-danger'}">
                ${t.activo ? 'Activo' : 'Inactivo'}
            </span>
        </td>
        <td class="action-btns">
            <button class="btn-icon btn-edit" onclick="editarCurso(${t.id_tipo})" title="Editar">✏️</button>
            <button class="btn-icon ${t.activo ? 'btn-delete' : 'btn-toggle'}" 
                    onclick="abrirModalEstadoCurso(${t.id_tipo}, ${!t.activo}, '${t.modulo}')" 
                    title="${t.activo ? 'Desactivar' : 'Activar'}">
                ${t.activo ? '🚫' : '✅'}
            </button>
            <button class="btn-icon btn-delete" onclick="abrirModalEliminarCurso(${t.id_tipo}, '${t.modulo}')" title="Eliminar">🗑️</button>
        </td>
    </tr>
`).join('');
        }
        
    } catch (error) {
        console.error('Error cargando módulos:', error);
        mostrarNotificacion('Error al cargar módulos', 'error');
    }
}

function abrirModalCurso(id = null) {
    const modal = document.getElementById('modalCurso');
    const titulo = document.getElementById('modalCursoTitulo');
    const form = document.getElementById('formCurso');
    
    form.reset();
    document.getElementById('cursoId').value = id || '';
    
    if (id) {
        titulo.textContent = 'Editar Tipo de Curso';
        cargarDatosCurso(id);
    } else {
        titulo.textContent = 'Nuevo Tipo de Curso';
    }
    
    modal.classList.add('show');
}

async function cargarDatosCurso(id) {
    try {
        const response = await fetch('/api/admin/tipos-curso');
        const data = await response.json();
        
        if (data.success) {
            const curso = data.tipos.find(c => c.id_tipo === id);
            if (curso) {
                document.getElementById('cursoPrograma').value = curso.programa;
                document.getElementById('cursoNombre').value = curso.modulo;
                document.getElementById('cursoValor').value = curso.valor_hora;
            }
        }
    } catch (error) {
        console.error('Error cargando datos del curso:', error);
    }
}

function editarCurso(id) {
    abrirModalCurso(id);
}

document.getElementById('formCurso').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('cursoId').value;
    const datos = {
        programa: document.getElementById('cursoPrograma').value,
        nombre: document.getElementById('cursoNombre').value,
        valor_hora: parseFloat(document.getElementById('cursoValor').value)
    };
    
    if (datos.valor_hora <= 0) {
        mostrarNotificacion('El valor por hora debe ser mayor a 0', 'error');
        return;
    }
    
    try {
        const url = id ? `/api/admin/tipos-curso/${id}` : '/api/admin/tipos-curso';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalCurso');
            cargarTiposCurso();
            cargarTiposCursoSelect();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar', 'error');
        }
        
    } catch (error) {
        console.error('Error guardando tipo de curso:', error);
        mostrarNotificacion('Error al guardar tipo de curso', 'error');
    }
});

// Modal de estado para cursos
let cursoEstadoTemp = null;

function abrirModalEstadoCurso(id, nuevoEstado, nombre) {
    cursoEstadoTemp = { id, nuevoEstado };
    
    const modal = document.getElementById('modalConfirmarEstado');
    const icono = document.getElementById('iconoEstado');
    const titulo = document.getElementById('tituloEstado');
    const mensaje = document.getElementById('mensajeEstado');
    
    if (nuevoEstado) {
        icono.textContent = '✅';
        titulo.textContent = 'Activar Tipo de Curso';
        mensaje.innerHTML = `¿Estás segur@ de <strong>activar</strong> el tipo de curso:<br><strong>${nombre}</strong>?`;
    } else {
        icono.textContent = '🚫';
        titulo.textContent = 'Desactivar Tipo de Curso';
        mensaje.innerHTML = `¿Estás segur@ de <strong>desactivar</strong> el tipo de curso:<br><strong>${nombre}</strong>?<br><br>Los grupos con este tipo de curso no se verán afectados.`;
    }
    
    const btnConfirmar = document.getElementById('btnConfirmarEstado');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!cursoEstadoTemp) return;
        
        const { id, nuevoEstado } = cursoEstadoTemp;
        
        try {
            const response = await fetch(`/api/admin/tipos-curso/${id}/estado`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: nuevoEstado ? 1 : 0 })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalConfirmarEstado');
                cargarTiposCurso();
                cursoEstadoTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al cambiar estado', 'error');
            }
            
        } catch (error) {
            console.error('Error cambiando estado:', error);
            mostrarNotificacion('Error al cambiar estado', 'error');
        }
    });
    
    modal.classList.add('show');
}

// Modal de eliminar para cursos
let cursoEliminarTemp = null;

function abrirModalEliminarCurso(id, nombre) {
    cursoEliminarTemp = { id, nombre };
    
    const modal = document.getElementById('modalEliminarUsuario');
    modal.querySelector('h2').textContent = '¡Atención!';
    modal.querySelector('p strong').textContent = `¿Estás segur@ de eliminar el tipo de curso "${nombre}"?`;
    
    const btnConfirmar = document.getElementById('btnConfirmarEliminar');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!cursoEliminarTemp) return;
        
        const { id } = cursoEliminarTemp;
        
        try {
            const response = await fetch(`/api/admin/tipos-curso/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalEliminarUsuario');
                cargarTiposCurso();
                cursoEliminarTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al eliminar tipo de curso', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando tipo de curso:', error);
            mostrarNotificacion('Error al eliminar tipo de curso', 'error');
        }
    });
    
    modal.classList.add('show');
}

// ========================================
// GESTIÓN DE BANCOS
// ========================================
async function cargarBancos() {
    try {
        const response = await fetch('/api/admin/bancos');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaBancos');
            
            if (data.bancos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay bancos registrados</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.bancos.map(b => `
                <tr>
                    <td>${b.nombre}</td>
                    <td>
                        <span class="badge ${b.activo ? 'badge-success' : 'badge-danger'}">
                            ${b.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td class="action-btns">
                        <button class="btn-icon btn-edit" onclick="editarBanco(${b.id_banco})" title="Editar">✏️</button>
                        <button class="btn-icon ${b.activo ? 'btn-delete' : 'btn-toggle'}" 
                                onclick="abrirModalEstadoBanco(${b.id_banco}, ${!b.activo}, '${b.nombre}')" 
                                title="${b.activo ? 'Desactivar' : 'Activar'}">
                            ${b.activo ? '🚫' : '✅'}
                        </button>
                        <button class="btn-icon btn-delete" onclick="abrirModalEliminarBanco(${b.id_banco}, '${b.nombre}')" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error cargando bancos:', error);
        mostrarNotificacion('Error al cargar bancos', 'error');
    }
}

function abrirModalBanco(id = null) {
    const modal = document.getElementById('modalBanco');
    const titulo = document.getElementById('modalBancoTitulo');
    const form = document.getElementById('formBanco');
    
    form.reset();
    document.getElementById('bancoId').value = id || '';
    
    if (id) {
        titulo.textContent = 'Editar Banco';
        cargarDatosBanco(id);
    } else {
        titulo.textContent = 'Nuevo Banco';
    }
    
    modal.classList.add('show');
}

async function cargarDatosBanco(id) {
    try {
        const response = await fetch('/api/admin/bancos');
        const data = await response.json();
        
        if (data.success) {
            const banco = data.bancos.find(b => b.id_banco === id);
            if (banco) {
                document.getElementById('bancoNombre').value = banco.nombre;
            }
        }
    } catch (error) {
        console.error('Error cargando datos del banco:', error);
    }
}

function editarBanco(id) {
    abrirModalBanco(id);
}

document.getElementById('formBanco').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('bancoId').value;
    const datos = {
        nombre: document.getElementById('bancoNombre').value
    };
    
    try {
        const url = id ? `/api/admin/bancos/${id}` : '/api/admin/bancos';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalBanco');
            cargarBancos();
            cargarBancosSelect();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar', 'error');
        }
        
    } catch (error) {
        console.error('Error guardando banco:', error);
        mostrarNotificacion('Error al guardar banco', 'error');
    }
});

// Modal de estado para bancos
let bancoEstadoTemp = null;

function abrirModalEstadoBanco(id, nuevoEstado, nombre) {
    bancoEstadoTemp = { id, nuevoEstado };
    
    const modal = document.getElementById('modalConfirmarEstado');
    const icono = document.getElementById('iconoEstado');
    const titulo = document.getElementById('tituloEstado');
    const mensaje = document.getElementById('mensajeEstado');
    
    if (nuevoEstado) {
        icono.textContent = '✅';
        titulo.textContent = 'Activar Banco';
        mensaje.innerHTML = `¿Estás segur@ de <strong>activar</strong> el banco:<br><strong>${nombre}</strong>?`;
    } else {
        icono.textContent = '🚫';
        titulo.textContent = 'Desactivar Banco';
        mensaje.innerHTML = `¿Estás segur@ de <strong>desactivar</strong> el banco:<br><strong>${nombre}</strong>?<br><br>Los usuarios con este banco no se verán afectados.`;
    }
    
    const btnConfirmar = document.getElementById('btnConfirmarEstado');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!bancoEstadoTemp) return;
        
        const { id, nuevoEstado } = bancoEstadoTemp;
        
        try {
            const response = await fetch(`/api/admin/bancos/${id}/estado`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: nuevoEstado ? 1 : 0 })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalConfirmarEstado');
                cargarBancos();
                bancoEstadoTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al cambiar estado', 'error');
            }
            
        } catch (error) {
            console.error('Error cambiando estado:', error);
            mostrarNotificacion('Error al cambiar estado', 'error');
        }
    });
    
    modal.classList.add('show');
}

// Modal de eliminar para bancos
let bancoEliminarTemp = null;

function abrirModalEliminarBanco(id, nombre) {
    bancoEliminarTemp = { id, nombre };
    
    const modal = document.getElementById('modalEliminarUsuario');
    modal.querySelector('h2').textContent = '¡Atención!';
    modal.querySelector('p strong').textContent = `¿Estás segur@ de eliminar el banco "${nombre}"?`;
    
    const btnConfirmar = document.getElementById('btnConfirmarEliminar');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!bancoEliminarTemp) return;
        
        const { id } = bancoEliminarTemp;
        
        try {
            const response = await fetch(`/api/admin/bancos/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalEliminarUsuario');
                cargarBancos();
                bancoEliminarTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al eliminar banco', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando banco:', error);
            mostrarNotificacion('Error al eliminar banco', 'error');
        }
    });
    
    modal.classList.add('show');
}

// ========================================
// GESTIÓN DE TIPOS DE CUENTA
// ========================================
async function cargarTiposCuenta() {
    try {
        const response = await fetch('/api/admin/tipos-cuenta');
        const data = await response.json();
        
        if (data.success) {
            const tbody = document.getElementById('tablaTiposCuenta');
            
            if (data.tipos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="3" class="text-center">No hay tipos de cuenta registrados</td></tr>';
                return;
            }
            
            tbody.innerHTML = data.tipos.map(t => `
                <tr>
                    <td>${t.nombre}</td>
                    <td>
                        <span class="badge ${t.activo ? 'badge-success' : 'badge-danger'}">
                            ${t.activo ? 'Activo' : 'Inactivo'}
                        </span>
                    </td>
                    <td class="action-btns">
                        <button class="btn-icon btn-edit" onclick="editarTipoCuenta(${t.id_tipo_cuenta})" title="Editar">✏️</button>
                        <button class="btn-icon ${t.activo ? 'btn-delete' : 'btn-toggle'}" 
                                onclick="abrirModalEstadoTipoCuenta(${t.id_tipo_cuenta}, ${!t.activo}, '${t.nombre}')" 
                                title="${t.activo ? 'Desactivar' : 'Activar'}">
                            ${t.activo ? '🚫' : '✅'}
                        </button>
                        <button class="btn-icon btn-delete" onclick="abrirModalEliminarTipoCuenta(${t.id_tipo_cuenta}, '${t.nombre}')" title="Eliminar">🗑️</button>
                    </td>
                </tr>
            `).join('');
        }
        
    } catch (error) {
        console.error('Error cargando tipos de cuenta:', error);
        mostrarNotificacion('Error al cargar tipos de cuenta', 'error');
    }
}

function abrirModalTipoCuenta(id = null) {
    const modal = document.getElementById('modalTipoCuenta');
    const titulo = document.getElementById('modalTipoCuentaTitulo');
    const form = document.getElementById('formTipoCuenta');
    
    form.reset();
    document.getElementById('tipoCuentaId').value = id || '';
    
    if (id) {
        titulo.textContent = 'Editar Tipo de Cuenta';
        cargarDatosTipoCuenta(id);
    } else {
        titulo.textContent = 'Nuevo Tipo de Cuenta';
    }
    
    modal.classList.add('show');
}

async function cargarDatosTipoCuenta(id) {
    try {
        const response = await fetch('/api/admin/tipos-cuenta');
        const data = await response.json();
        
        if (data.success) {
            const tipo = data.tipos.find(t => t.id_tipo_cuenta === id);
            if (tipo) {
                document.getElementById('tipoCuentaNombre').value = tipo.nombre;
            }
        }
    } catch (error) {
        console.error('Error cargando datos del tipo de cuenta:', error);
    }
}

function editarTipoCuenta(id) {
    abrirModalTipoCuenta(id);
}

document.getElementById('formTipoCuenta').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const id = document.getElementById('tipoCuentaId').value;
    const datos = {
        nombre: document.getElementById('tipoCuentaNombre').value
    };
    
    try {
        const url = id ? `/api/admin/tipos-cuenta/${id}` : '/api/admin/tipos-cuenta';
        const method = id ? 'PUT' : 'POST';
        
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            mostrarNotificacion(data.mensaje, 'success');
            cerrarModal('modalTipoCuenta');
            cargarTiposCuenta();
            cargarTiposCuentaSelect();
        } else {
            mostrarNotificacion(data.error || 'Error al guardar', 'error');
        }
        
    } catch (error) {
        console.error('Error guardando tipo de cuenta:', error);
        mostrarNotificacion('Error al guardar tipo de cuenta', 'error');
    }
});

// Modal de estado para tipos de cuenta
let tipoCuentaEstadoTemp = null;

function abrirModalEstadoTipoCuenta(id, nuevoEstado, nombre) {
    tipoCuentaEstadoTemp = { id, nuevoEstado };
    
    const modal = document.getElementById('modalConfirmarEstado');
    const icono = document.getElementById('iconoEstado');
    const titulo = document.getElementById('tituloEstado');
    const mensaje = document.getElementById('mensajeEstado');
    
    if (nuevoEstado) {
        icono.textContent = '✅';
        titulo.textContent = 'Activar Tipo de Cuenta';
        mensaje.innerHTML = `¿Estás segur@ de <strong>activar</strong> el tipo de cuenta:<br><strong>${nombre}</strong>?`;
    } else {
        icono.textContent = '🚫';
        titulo.textContent = 'Desactivar Tipo de Cuenta';
        mensaje.innerHTML = `¿Estás segur@ de <strong>desactivar</strong> el tipo de cuenta:<br><strong>${nombre}</strong>?`;
    }
    
    const btnConfirmar = document.getElementById('btnConfirmarEstado');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!tipoCuentaEstadoTemp) return;
        
        const { id, nuevoEstado } = tipoCuentaEstadoTemp;
        
        try {
            const response = await fetch(`/api/admin/tipos-cuenta/${id}/estado`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activo: nuevoEstado ? 1 : 0 })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalConfirmarEstado');
                cargarTiposCuenta();
                tipoCuentaEstadoTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al cambiar estado', 'error');
            }
            
        } catch (error) {
            console.error('Error cambiando estado:', error);
            mostrarNotificacion('Error al cambiar estado', 'error');
        }
    });
    
    modal.classList.add('show');
}

// Modal de eliminar para tipos de cuenta
let tipoCuentaEliminarTemp = null;

function abrirModalEliminarTipoCuenta(id, nombre) {
    tipoCuentaEliminarTemp = { id, nombre };
    
    const modal = document.getElementById('modalEliminarUsuario');
    modal.querySelector('h2').textContent = '¡Atención!';
    modal.querySelector('p strong').textContent = `¿Estás segur@ de eliminar el tipo de cuenta "${nombre}"?`;
    
    const btnConfirmar = document.getElementById('btnConfirmarEliminar');
    const nuevoBtn = btnConfirmar.cloneNode(true);
    btnConfirmar.parentNode.replaceChild(nuevoBtn, btnConfirmar);
    
    nuevoBtn.addEventListener('click', async () => {
        if (!tipoCuentaEliminarTemp) return;
        
        const { id } = tipoCuentaEliminarTemp;
        
        try {
            const response = await fetch(`/api/admin/tipos-cuenta/${id}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                mostrarNotificacion(data.mensaje, 'success');
                cerrarModal('modalEliminarUsuario');
                cargarTiposCuenta();
                tipoCuentaEliminarTemp = null;
            } else {
                mostrarNotificacion(data.error || 'Error al eliminar tipo de cuenta', 'error');
            }
            
        } catch (error) {
            console.error('Error eliminando tipo de cuenta:', error);
            mostrarNotificacion('Error al eliminar tipo de cuenta', 'error');
        }
    });
    
    modal.classList.add('show');
}

// ========================================
// MI PERFIL
// ========================================
async function cargarMiPerfil() {
    if (!usuarioActual) return;
    
    try {
        const response = await fetch('/api/admin/usuarios');
        const data = await response.json();
        
        if (data.success) {
            const misDatos = data.usuarios.find(u => u.id_usuario === usuarioActual.id);
            
            if (misDatos) {
                document.getElementById('perfilNombre').textContent = misDatos.nombre;
                document.getElementById('perfilRol').textContent = misDatos.rol.charAt(0).toUpperCase() + misDatos.rol.slice(1);
                document.getElementById('perfilDocumento').textContent = misDatos.documento;
                document.getElementById('perfilEmail').textContent = misDatos.email || '-';
                document.getElementById('perfilTelefono').textContent = misDatos.telefono || '-';
                document.getElementById('perfilBanco').textContent = misDatos.banco || '-';
                document.getElementById('perfilTipoCuenta').textContent = misDatos.tipo_cuenta || '-';
                document.getElementById('perfilNumeroCuenta').textContent = misDatos.numero_cuenta || '-';
            }
        }
    } catch (error) {
        console.error('Error cargando perfil:', error);
    }
}

function editarMiPerfil() {
    if (usuarioActual) {
        abrirModalUsuario(usuarioActual.id);
    }
}

function cambiarMiContrasena() {
    if (usuarioActual) {
        abrirCambiarPassword(usuarioActual.id);
    }
}

// ========================================
// NUEVAS FUNCIONES: CUENTAS DE COBRO Y HISTÓRICO
// ========================================
async function cargarCuentasCobro() {
    try {
        const mes = document.getElementById('filtroMesCuenta').value || '';
        const anio = document.getElementById('filtroAnioCuenta').value || '';
        const docente_id = document.getElementById('filtroDocenteCuenta').value || '';

        let url = '/api/admin/cuentas-cobro';
        const params = new URLSearchParams();
        if (mes) params.append('mes', mes);
        if (anio) params.append('anio', anio);
        if (docente_id) params.append('docente_id', docente_id);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('tablaCuentasCobro');

        if (!data.success || data.cuentas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center">No hay cuentas de cobro con los filtros aplicados</td></tr>';
            return;
        }

                tbody.innerHTML = data.cuentas.map(c => `
    <tr>
        <td>${c.docente}</td>
        <td>${c.documento}</td>
        <td><strong>${obtenerNombreMes(c.mes)} ${c.anio}</strong></td>
        <td>${parseFloat(c.total_horas).toFixed(2)}</td>
        <td>${formatearMoneda(c.total_pagar)}</td>
        <td>${c.generado_el}</td>
        <td class="action-btns">
            <button class="btn-icon" onclick="abrirVistaPreviaCuenta('/api/admin/cuenta-cobro/pdf?id=${c.id_cuenta}')" title="Vista Previa">👁️</button>
            <a href="/api/admin/cuenta-cobro/pdf?id=${c.id_cuenta}" target="_blank" class="btn-icon" title="Descargar PDF">📄</a>
        </td>
    </tr>
`).join('');

    } catch (error) {
        console.error('Error cargando cuentas de cobro:', error);
        mostrarNotificacion('Error al cargar cuentas de cobro', 'error');
    }
}

function obtenerNombreMes(numeroMes) {
    const meses = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return meses[parseInt(numeroMes)] || '';
}

async function cargarDocentesFiltroCuenta() {
    try {
        const response = await fetch('/api/admin/docentes');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('filtroDocenteCuenta');
            select.innerHTML = '<option value="">Todos los docentes</option>' +
                data.docentes.map(d => `<option value="${d.id_usuario}">${d.nombre} (${d.documento})</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando docentes para filtro de cuentas:', error);
    }
}

async function cargarHistoricoHoras() {
    try {
        const desde = document.getElementById('filtroDesde').value || '';
        const hasta = document.getElementById('filtroHasta').value || '';
        const docente_id = document.getElementById('filtroDocente').value || '';

        let url = '/api/admin/historico-horas';
        const params = new URLSearchParams();
        if (desde) params.append('desde', desde);
        if (hasta) params.append('hasta', hasta);
        if (docente_id) params.append('docente_id', docente_id);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('tablaHistorico');

        if (!data.success || data.registros.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="text-center">No hay registros con los filtros aplicados</td></tr>';
            return;
        }

        tbody.innerHTML = data.registros.map(r => `
            <tr>
                <td>${formatearFecha(r.fecha)}</td>
                <td>${r.docente}</td>
                <td>${r.documento}</td>
                <td>${r.grupo_codigo} - ${r.grupo_nombre}</td>
                <td>${r.modulo}</td>
                <td>${r.programa || '-'}</td>
                <td>${parseFloat(r.horas_trabajadas).toFixed(2)}</td>
                <td>${r.hora_ingreso}</td>
                <td>${r.hora_salida || '—'}</td>
                <td>${r.tema_desarrollado || '-'}</td>
                <td>${r.observaciones || '-'}</td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error cargando histórico:', error);
        mostrarNotificacion('Error al cargar histórico', 'error');
    }
}

async function cargarDocentesFiltro() {
    try {
        const response = await fetch('/api/admin/docentes');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('filtroDocente');
            select.innerHTML = '<option value="">Todos los docentes</option>' +
                data.docentes.map(d => `<option value="${d.id_usuario}">${d.nombre} (${d.documento})</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando docentes para filtro:', error);
    }
}

function formatearFecha(fecha) {
    if (!fecha) return '-';

    let d;

    if (fecha.includes('T') || fecha.includes(' ')) {
        d = new Date(fecha);
    } else {
        d = new Date(fecha + 'T00:00:00');
    }

    if (isNaN(d)) return '-';

    return d.toLocaleDateString('es-CO', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

// ========================================
// PLANEADORES REALIZADOS
// ========================================
async function cargarPlaneadores() {
    try {
        const mes = document.getElementById('filtroMesPlaneador').value || '';
        const anio = document.getElementById('filtroAnioPlaneador').value || '';
        const docente_id = document.getElementById('filtroDocentePlaneador').value || '';

        let url = '/api/admin/planeadores';
        const params = new URLSearchParams();
        if (mes) params.append('mes', mes);
        if (anio) params.append('anio', anio);
        if (docente_id) params.append('docente_id', docente_id);
        if (params.toString()) url += '?' + params.toString();

        const response = await fetch(url);
        const data = await response.json();

        const tbody = document.getElementById('tablaPlaneadores');

        if (!data.success || data.planeadores.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No hay planeadores generados con los filtros aplicados</td></tr>';
            return;
        }

        tbody.innerHTML = data.planeadores.map(p => `
            <tr>
                <td>${p.docente}</td>
                <td>${p.documento}</td>
                <td><strong>${obtenerNombreMes(p.mes)} ${p.anio}</strong></td>
                <td>${p.grupo_codigo} - ${p.grupo_nombre}</td>
                <td>${p.generado_el}</td>
                <td class="action-btns">
                    <button class="btn-icon" onclick="abrirVistaPreviaPlaneador('/api/docente/planeador/pdf?planeador_id=${p.id_planeador}')" title="Vista Previa">👁️</button>
                    <a href="/api/docente/planeador/pdf?planeador_id=${p.id_planeador}" target="_blank" class="btn-icon" title="Descargar PDF">📄</a>
                </td>
            </tr>
        `).join('');

    } catch (error) {
        console.error('Error cargando planeadores:', error);
        mostrarNotificacion('Error al cargar planeadores', 'error');
    }
}

async function cargarDocentesFiltroPlaneador() {
    try {
        const response = await fetch('/api/admin/docentes');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('filtroDocentePlaneador');
            select.innerHTML = '<option value="">Todos los docentes</option>' +
                data.docentes.map(d => `<option value="${d.id_usuario}">${d.nombre} (${d.documento})</option>`).join('');
        }
    } catch (error) {
        console.error('Error cargando docentes para filtro de planeadores:', error);
    }
}

// Vista previa del planeador
function abrirVistaPreviaPlaneador(pdfUrl) {
    const modal = document.getElementById('modalVistaPreviaPlaneador');
    const iframe = document.getElementById('iframePlaneadorPreview');
    
    iframe.src = pdfUrl;
    modal.classList.add('show');
}

// Mejorar cerrarModal para limpiar el iframe
const originalCerrarModal = cerrarModal;
cerrarModal = function(modalId) {
    originalCerrarModal(modalId);
    if (modalId === 'modalVistaPreviaPlaneador') {
        document.getElementById('iframePlaneadorPreview').src = '';
    }
};

function abrirVistaPreviaCuenta(pdfUrl) {
    // Reutilizamos el mismo modal de planeadores
    document.querySelector('#modalVistaPreviaPlaneador h2').textContent = 'Vista Previa de Cuenta de Cobro';
    const iframe = document.getElementById('iframePlaneadorPreview');
    iframe.src = pdfUrl;
    document.getElementById('modalVistaPreviaPlaneador').classList.add('show');
}