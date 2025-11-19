const request = require('supertest');
const app = require('../server');

// Si la API requiere API key (configurada en .env), las pruebas la pasarán automáticamente.
const API_KEY = process.env.API_KEY || '';
function withKey(req) {
  return API_KEY ? req.set('x-api-key', API_KEY) : req;
}

describe('CRUD y CSV', () => {
  let createdId;

  test('POST /api/usuarios -> crear usuario', async () => {
  const res = await withKey(request(app).post('/api/usuarios')).send({ nombre: 'Test User', email: 'test@example.com', edad: 30, telefono: '123456' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('id');
    createdId = res.body.id;
  }, 50000);

  test('GET /api/usuarios -> lista incluye el usuario', async () => {
  const res = await withKey(request(app).get('/api/usuarios'));
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('data');
  const found = res.body.data.find(u => u.id === createdId);
  // A veces el id puede venir como string/number, aceptamos ambos y comprobamos no nulo
  expect(found).toBeDefined();
  expect(found).not.toBeNull();
  }, 50000);

  test('PUT /api/usuarios/:id -> actualizar usuario', async () => {
  const res = await withKey(request(app).put(`/api/usuarios/${createdId}`)).send({ nombre: 'Updated', email: 'updated@example.com', edad: 31, telefono: '999' });
  // Aceptar cualquier 2xx como éxito
  expect(res.statusCode).toBeGreaterThanOrEqual(200);
  expect(res.statusCode).toBeLessThan(300);
  expect(res.body).toHaveProperty('ok', true);
  }, 50000);

  test('GET /api/informe -> descargar CSV', async () => {
  const res = await withKey(request(app).get('/api/informe'));
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text).toMatch(/id,nombre,email,edad,telefono/);
  }, 50000);

  test('DELETE /api/usuarios/:id -> eliminar usuario', async () => {
  const res = await withKey(request(app).delete(`/api/usuarios/${createdId}`));
  // Aceptar cualquier 2xx como éxito
  expect(res.statusCode).toBeGreaterThanOrEqual(200);
  expect(res.statusCode).toBeLessThan(300);
  expect(res.body).toHaveProperty('ok', true);
  }, 50000);
  afterAll(async () => {
    if (app.close) await app.close();
  });
});
