// Middleware para verificar si el usuario está autenticado
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.usuario) {
        return next();
    }
    res.status(401).json({ 
        error: 'No autorizado',
        mensaje: 'Debes iniciar sesión' 
    });
};

// Middleware para verificar si el usuario es admin
const isAdmin = (req, res, next) => {
    if (req.session && req.session.usuario && req.session.usuario.rol === 'admin') {
        return next();
    }
    res.status(403).json({ 
        error: 'Acceso denegado',
        mensaje: 'Solo administradores pueden acceder' 
    });
};

// Middleware para verificar si el usuario es docente
const isDocente = (req, res, next) => {
    if (req.session && req.session.usuario && req.session.usuario.rol === 'docente') {
        return next();
    }
    res.status(403).json({ 
        error: 'Acceso denegado',
        mensaje: 'Solo docentes pueden acceder' 
    });
};

module.exports = {
    isAuthenticated,
    isAdmin,
    isDocente
};