import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite — Directus Sync & Resilient Health', () => {
  let app: FastifyInstance;

  before(async () => {
    process.env.SYNC_SECRET = 'test-sync-secret';
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
    delete process.env.SYNC_SECRET;
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

  test('POST /api/v1/sync rejects requests without x-sync-secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      payload: {
        event: 'items.update',
        collection: 'tenants',
        keys: ['b0000000-0000-0000-0000-000000000001'],
      },
    });

    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.match(body.message, /Unauthorized|missing or invalid/i);
  });

  test('POST /api/v1/sync rejects requests with wrong x-sync-secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { 'x-sync-secret': 'wrong-secret' },
      payload: {
        event: 'items.update',
        collection: 'tenants',
        keys: ['b0000000-0000-0000-0000-000000000001'],
      },
    });

    assert.equal(response.statusCode, 401);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
  });

  test('POST /api/v1/sync triggers CMS webhook sync and resets circuit with valid secret', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/sync',
      headers: { 'x-sync-secret': 'test-sync-secret' },
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
