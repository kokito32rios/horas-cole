const mysql = require('mysql2');
require('dotenv').config();

// Crear pool de conexiones (mejor rendimiento que conexiones individuales)
const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Promisify para usar async/await
const promisePool = pool.promise();

// Probar conexión
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Error conectando a la base de datos:', err.message);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('   La conexión a la base de datos se perdió');
        }
        if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('   Demasiadas conexiones a la base de datos');
        }
        if (err.code === 'ECONNREFUSED') {
            console.error('   La conexión a la base de datos fue rechazada');
        }
        if (err.code === 'ER_ACCESS_DENIED_ERROR') {
            console.error('   Usuario o contraseña incorrectos');
        }
        return;
    }
    console.log('✅ Conexión exitosa a MySQL');
    connection.release();
});

// IMPORTANTE: Exportar promisePool, no pool
module.exports = promisePool;