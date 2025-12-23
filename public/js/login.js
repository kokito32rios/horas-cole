// Función para mostrar el modal de registro
function mostrarModal(event) {
    event.preventDefault();
    const modal = document.getElementById('modalRegistro');
    modal.classList.add('show');
}

// Función para cerrar el modal
function cerrarModal() {
    const modal = document.getElementById('modalRegistro');
    modal.classList.remove('show');
}

// Cerrar modal al hacer clic en la X
document.querySelector('.close-modal').addEventListener('click', cerrarModal);

// Cerrar modal al hacer clic fuera del contenido
document.getElementById('modalRegistro').addEventListener('click', function(event) {
    if (event.target === this) {
        cerrarModal();
    }
});

// Cerrar modal con la tecla ESC
document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') {
        cerrarModal();
    }
});

// Manejo del formulario de login
document.getElementById('loginForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    const documento = document.getElementById('documento').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('errorMessage');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    // Limpiar mensaje de error previo
    errorMessage.classList.remove('show');
    errorMessage.textContent = '';
    
    // Validaciones básicas
    if (!documento || !password) {
        mostrarError('Por favor completa todos los campos', 'warning');
        return;
    }
    
    // Deshabilitar botón mientras se procesa
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Ingresando...</span>';
    
    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ documento, password })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            // Login exitoso
            mostrarExito('¡Bienvenida! Redirigiendo...');
            
            // Redirigir según el rol
            setTimeout(() => {
                if (data.usuario.rol === 'admin') {
                    window.location.href = '/admin';
                } else if (data.usuario.rol === 'docente') {
                    window.location.href = '/docente';
                } else {
                    window.location.href = '/';
                }
            }, 1000);
            
        } else {
            // Manejar diferentes tipos de error
            if (data.tipo === 'no_existe') {
                // Usuario no registrado - Mostrar mensaje especial
                mostrarErrorEspecial(data.mensaje);
            } else if (data.tipo === 'inactivo') {
                // Usuario inactivo
                mostrarError(data.mensaje, 'warning');
            } else if (data.tipo === 'password_incorrecta') {
                // Contraseña incorrecta
                mostrarError(data.mensaje, 'error');
            } else {
                // Error genérico
                mostrarError(data.mensaje || 'Error al iniciar sesión', 'error');
            }
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<span>Iniciar Sesión</span><span class="btn-icon">→</span>';
        }
        
    } catch (error) {
        console.error('Error en login:', error);
        mostrarError('Error de conexión. Por favor intenta nuevamente.', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Iniciar Sesión</span><span class="btn-icon">→</span>';
    }
});

// Función para mostrar errores normales
function mostrarError(mensaje, tipo = 'error') {
    const errorMessage = document.getElementById('errorMessage');
    
    if (tipo === 'warning') {
        errorMessage.style.background = '#fff3cd';
        errorMessage.style.color = '#856404';
        errorMessage.style.borderColor = '#ffc107';
        errorMessage.textContent = '⚠️ ' + mensaje;
    } else {
        errorMessage.style.background = '#fee';
        errorMessage.style.color = '#c33';
        errorMessage.style.borderColor = '#c33';
        errorMessage.textContent = '❌ ' + mensaje;
    }
    
    errorMessage.classList.add('show');
    
    // Auto-ocultar después de 8 segundos
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 8000);
}

// Función para mostrar error especial de usuario no registrado
function mostrarErrorEspecial(mensaje) {
    const errorMessage = document.getElementById('errorMessage');
    
    errorMessage.style.background = 'linear-gradient(135deg, #fff9e6 0%, #ffe5f0 100%)';
    errorMessage.style.color = '#570861';
    errorMessage.style.borderColor = '#570861';
    errorMessage.style.borderWidth = '3px';
    errorMessage.style.fontWeight = '600';
    
    errorMessage.innerHTML = `
        <div style="display: flex; align-items: center; gap: 1rem;">
            <span style="font-size: 2rem;">👑</span>
            <div style="text-align: left;">
                <strong style="display: block; margin-bottom: 0.5rem; font-size: 1.1rem;">Usuario no encontrado</strong>
                <p style="margin: 0; font-weight: 400;">${mensaje}</p>
            </div>
        </div>
    `;
    
    errorMessage.classList.add('show');
    
    // Auto-ocultar después de 10 segundos (más tiempo para leer)
    setTimeout(() => {
        errorMessage.classList.remove('show');
    }, 10000);
}

// Función para mostrar mensaje de éxito
function mostrarExito(mensaje) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.style.background = '#d4edda';
    errorMessage.style.color = '#155724';
    errorMessage.style.borderColor = '#28a745';
    errorMessage.style.fontWeight = '600';
    errorMessage.textContent = '✅ ' + mensaje;
    errorMessage.classList.add('show');
}