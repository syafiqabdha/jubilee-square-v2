import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite — Directus Sync & Resilient Health', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /health includes service status and uptime', async () => {
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

  test('POST /api/v1/sync triggers CMS webhook sync and resets circuit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: {
        event: 'items.update',
        collection: 'tenants',
        keys: ['b0000000-0000-0000-0000-000000000001'],
      },
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.message.includes('Sync event processed'));
    assert.ok(body.circuitState);
    assert.ok(body.syncedAt);
  });

  test('GET /api/v1/sync/status reports active sync status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/sync/status',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.activeBackend);
    assert.ok(body.circuitState);
    assert.ok(body.timestamp);
  });
});
