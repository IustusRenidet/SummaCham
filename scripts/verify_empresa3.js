/**
 * Script para verificar que empresa3 esté correctamente configurada en seed_users.json
 */

const fs = require('fs');
const path = require('path');

const seedPath = path.join(__dirname, '../src/config/seed_users.json');
const seedUsers = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

console.log('=== VERIFICACIÓN DE PERMISOS EMPRESA3 ===\n');

// Usuarios con permisos en empresa3
const usuariosConEmpresa3 = seedUsers.filter(user => 
    user.permissions.some(p => p.empresaId === 'empresa3')
);

console.log(`Total de usuarios en seed_users.json: ${seedUsers.length}`);
console.log(`Usuarios con permisos en empresa3: ${usuariosConEmpresa3.length}\n`);

// Módulos en empresa3
const modulosEmpresa3 = new Set();
usuariosConEmpresa3.forEach(user => {
    user.permissions
        .filter(p => p.empresaId === 'empresa3')
        .forEach(p => modulosEmpresa3.add(p.modulo));
});

console.log('Módulos en empresa3:');
Array.from(modulosEmpresa3).sort().forEach(modulo => {
    console.log(`  - ${modulo}`);
});

console.log('\n=== USUARIOS POR ROL EN EMPRESA3 ===\n');

// Clasificar por roles
const roles = {
    'Aprobadores (puede_aprobar)': [],
    'Revisores (puede_revisar)': [],
    'Editores (puede_cargar_guardar)': [],
    'Solo Lectura (puede_leer)': []
};

usuariosConEmpresa3.forEach(user => {
    const empresa3Perms = user.permissions.filter(p => p.empresaId === 'empresa3');
    
    const canApprove = empresa3Perms.some(p => p.puede_aprobar === 1);
    const canReview = empresa3Perms.some(p => p.puede_revisar === 1);
    const canEdit = empresa3Perms.some(p => p.puede_cargar_guardar === 1);
    const canRead = empresa3Perms.some(p => p.puede_leer === 1);
    
    if (canApprove) {
        roles['Aprobadores (puede_aprobar)'].push(user.username);
    } else if (canReview) {
        roles['Revisores (puede_revisar)'].push(user.username);
    } else if (canEdit) {
        roles['Editores (puede_cargar_guardar)'].push(user.username);
    } else if (canRead) {
        roles['Solo Lectura (puede_leer)'].push(user.username);
    }
});

Object.entries(roles).forEach(([role, users]) => {
    console.log(`${role}: ${users.length}`);
    users.forEach(username => {
        const user = usuariosConEmpresa3.find(u => u.username === username);
        const modulosCount = user.permissions.filter(p => p.empresaId === 'empresa3').length;
        console.log(`  - ${username} (${user.nombres} ${user.apellidoPrimero}) - ${modulosCount} módulos`);
    });
    console.log('');
});

// Detalles de usuarios clave
console.log('=== USUARIOS CLAVE CON EMPRESA3 ===\n');
const usuariosClave = ['PCA', 'AMB', 'FS', 'AQ', 'GB', 'GLINGOW', 'YB', 'AZ', 'PV', 'DM', 'MV', 'AO', 'CG', 'DI', 'GL'];

usuariosClave.forEach(username => {
    const user = seedUsers.find(u => u.username === username);
    if (user) {
        const empresa3Perms = user.permissions.filter(p => p.empresaId === 'empresa3');
        if (empresa3Perms.length > 0) {
            console.log(`✅ ${username} (${user.nombres} ${user.apellidoPrimero})`);
            console.log(`   Módulos en empresa3: ${empresa3Perms.length}`);
            empresa3Perms.forEach(p => {
                const roles = [];
                if (p.puede_aprobar) roles.push('APROBAR');
                if (p.puede_revisar) roles.push('REVISAR');
                if (p.puede_cargar_guardar) roles.push('EDITAR');
                if (p.puede_leer) roles.push('LEER');
                console.log(`     - ${p.modulo}: ${roles.join(', ')}`);
            });
        } else {
            console.log(`❌ ${username} (${user.nombres} ${user.apellidoPrimero}) - SIN permisos en empresa3`);
        }
        console.log('');
    } else {
        console.log(`⚠️  ${username} - No encontrado en seed_users.json\n`);
    }
});

// Comparar con otras empresas
console.log('\n=== COMPARACIÓN ENTRE EMPRESAS ===\n');
['empresa1', 'empresa2', 'empresa3', 'empresa4'].forEach(empresaId => {
    const usuariosConEmpresa = seedUsers.filter(user => 
        user.permissions.some(p => p.empresaId === empresaId)
    );
    const totalPermisos = usuariosConEmpresa.reduce((sum, user) => {
        return sum + user.permissions.filter(p => p.empresaId === empresaId).length;
    }, 0);
    
    console.log(`${empresaId}: ${usuariosConEmpresa.length} usuarios, ${totalPermisos} permisos totales`);
});

console.log('\n=== VERIFICACIÓN COMPLETADA ===');
