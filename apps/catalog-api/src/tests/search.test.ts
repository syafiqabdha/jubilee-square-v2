import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite - Multi-Field Instant Search', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /api/v1/search?q=drum returns My Drum School', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=drum',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.data.count >= 1);
    assert.equal(body.data.results[0].slug, 'my-drum-school');
  });

  test('GET /api/v1/search?q=kaya returns Ya Kun Kaya Toast', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=kaya',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.data.count >= 1);
    assert.equal(body.data.results[0].slug, 'ya-kun-kaya-toast');
  });

  test('GET /api/v1/search?q=02-01 finds tenant by unit number', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=02-01',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.data.count >= 1);
    assert.equal(body.data.results[0].slug, 'bantianyao-grilled-fish');
  });

  test('GET /api/v1/search?q=empty returns empty results gracefully', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/search?q=nonexistentkeyword12345',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.data.count, 0);
    assert.equal(body.data.results.length, 0);
  });
});
