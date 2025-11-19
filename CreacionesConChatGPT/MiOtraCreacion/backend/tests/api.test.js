const request = require('supertest');
const app = require('../server');

describe('API basic', () => {
  test('GET /api/test-db should return ok true', async () => {
    const res = await request(app).get('/api/test-db');
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('resultado');
  }, 10000);
  afterAll(async () => {
    if (app.close) await app.close();
  });
});
