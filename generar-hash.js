const bcrypt = require('bcrypt');

async function generarHash() {
    const password = '123'; // La contraseña que quieres
    const hash = await bcrypt.hash(password, 10);
    console.log('Hash generado:');
    console.log(hash);
}

generarHash();