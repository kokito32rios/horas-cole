const bcrypt = require('bcrypt');
const db = require('../config/database');

// Login de usuario
const login = async (req, res) => {
    try {
        const { documento, password } = req.body;

        // Validar datos
        if (!documento || !password) {
            return res.status(400).json({ 
                error: 'Datos incompletos',
                mensaje: 'Documento y contraseña son requeridos' 
            });
        }

        // Buscar usuario por documento
        const [usuarios] = await db.query(
            `SELECT u.*, r.nombre as rol 
             FROM usuarios u 
             INNER JOIN roles r ON u.id_rol = r.id_rol 
             WHERE u.documento = ?`,
            [documento]
        );

        // VALIDACIÓN 1: Usuario no existe en la base de datos
        if (usuarios.length === 0) {
            return res.status(404).json({ 
                error: 'Usuario no encontrado',
                mensaje: 'Usuario no registrado. Por favor solicita tu acceso con kokito rios',
                tipo: 'no_existe'
            });
        }

        const usuario = usuarios[0];

        // VALIDACIÓN 2: Usuario existe pero está inactivo
        if (usuario.activo === 0) {
            return res.status(403).json({ 
                error: 'Usuario inactivo',
                mensaje: 'Tu cuenta está inactiva. Contacta a la rectora para más información',
                tipo: 'inactivo'
            });
        }

        // VALIDACIÓN 3: Verificar contraseña
        const passwordValida = await bcrypt.compare(password, usuario.password);
        
        if (!passwordValida) {
            return res.status(401).json({ 
                error: 'Credenciales inválidas',
                mensaje: 'La contraseña ingresada es incorrecta. Por favor verifica e intenta nuevamente',
                tipo: 'password_incorrecta'
            });
        }

        // ✅ Todo correcto - Crear sesión
        req.session.usuario = {
            id: usuario.id_usuario,
            nombre: usuario.nombre,
            documento: usuario.documento,
            email: usuario.email,
            rol: usuario.rol
        };

        res.json({
            success: true,
            mensaje: 'Login exitoso',
            usuario: req.session.usuario
        });

    } catch (error) {
        console.error('Error en login:', error);
        res.status(500).json({ 
            error: 'Error del servidor',
            mensaje: 'Error al iniciar sesión. Por favor intenta nuevamente',
            tipo: 'error_servidor'
        });
    }
};

// Logout de usuario
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ 
                error: 'Error al cerrar sesión' 
            });
        }
        res.json({ 
            success: true,
            mensaje: 'Sesión cerrada exitosamente' 
        });
    });
};

// Verificar sesión actual
const verificarSesion = (req, res) => {
    if (req.session && req.session.usuario) {
        res.json({ 
            autenticado: true,
            usuario: req.session.usuario 
        });
    } else {
        res.json({ autenticado: false });
    }
};

module.exports = {
    login,
    logout,
    verificarSesion
};