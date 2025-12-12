const http = require('http');

const path = '/api/layouts?empresaId=empresa1&modulo=Serv%20Membres%C3%ADa&anio=2025';
const options = { hostname: 'localhost', port: 3005, path, method: 'GET' };

const req = http.request(options, (res) => {
  console.log('STATUS:', res.statusCode);
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log('BODY:', data.slice(0, 400));
  });
});

req.on('error', (e) => console.error('Error:', e.message));
req.end();
