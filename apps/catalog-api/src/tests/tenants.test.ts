import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite - Tenants', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /api/v1/tenants returns all 23 tenants by default', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.meta.total, 23);
    assert.equal(body.data.length, 23);
  });

  test('GET /api/v1/tenants?floor=L3 returns Level 3 tenants', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants?floor=L3',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    body.data.forEach((t: any) => {
      assert.equal(t.floorLevel, 'L3');
    });
  });

  test('GET /api/v1/tenants?featured=true returns featured stores', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants?featured=true',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.data.length > 0);
    body.data.forEach((t: any) => {
      assert.equal(t.isFeatured, true);
    });
  });

  test('GET /api/v1/tenants/by-slug/my-drum-school returns full store profile', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants/by-slug/my-drum-school',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.data.slug, 'my-drum-school');
    assert.equal(body.data.name, 'My Drum School');
    assert.equal(body.data.floorLevel, 'L4');
    assert.equal(body.data.unitNumber, '#04-04/05');
    assert.ok(body.data.operatingHours.length > 0);
    assert.ok(body.data.amenities.length > 0);
  });

  test('GET /api/v1/tenants/by-slug/non-existent returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/tenants/by-slug/non-existent',
    });

    assert.equal(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'TENANT_NOT_FOUND');
  });
});
