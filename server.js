const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors'); // ← Agregado
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// === IMPORTANTE PARA PRODUCCIÓN ===
app.set('trust proxy', 1); // Necesario en Railway, Render, Aiven, etc.

 // CORS para permitir cookies en producción
app.use(cors({
    origin: true, // Permite el mismo origen (o pon tu URL exacta si quieres)
    credentials: true
}));

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// === CONFIGURACIÓN DE SESIÓN CORREGIDA ===
app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-cambia-en-produccion',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // true en producción (HTTPS)
        httpOnly: true,
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // ← CLAVE
        maxAge: 1000 * 60 * 60 * 8 // 8 horas
    }
}));

// Importar rutas
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const docenteRoutes = require('./routes/docenteRoutes');

// Rutas API
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/docente', docenteRoutes);

// Rutas HTML
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});

app.get('/docente', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'docente-dashboard.html'));
});

// 404
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════╗
║  🚀 Servidor corriendo en el puerto ${PORT}  ║
║  📍 https://tu-app.up.railway.app        ║
╚════════════════════════════════════════╝
    `);
});