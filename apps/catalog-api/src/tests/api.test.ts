import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite - Base & Health', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /health returns healthy status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.status, 'healthy');
    assert.equal(body.version, '2.0.0');
    assert.ok(typeof body.uptime === 'number');
  });

  test('GET /docs returns OpenAPI HTML swagger UI', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/',
    });

    assert.equal(response.statusCode, 200);
    assert.ok(response.body.includes('swagger-ui'));
  });

  test('GET /docs/json returns valid OpenAPI v3 schema spec', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/docs/json',
    });

    assert.equal(response.statusCode, 200);
    const spec = JSON.parse(response.body);
    assert.equal(spec.openapi, '3.0.3');
    assert.equal(spec.info.title, 'Jubilee Square v2 Store Catalog & Digital Signage API');
    assert.ok(spec.paths['/api/v1/tenants']);
    assert.ok(spec.paths['/api/v1/categories']);
    assert.ok(spec.paths['/api/v1/signage/featured']);
    assert.ok(spec.paths['/api/v1/signage/directory']);
    assert.ok(spec.paths['/api/v1/search']);
  });
});
