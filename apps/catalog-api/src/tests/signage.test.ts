import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite - Digital Signage & Directory Kiosks', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /api/v1/signage/featured returns active rotating slides', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/signage/featured',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.ok(body.data.slides.length > 0);
    assert.ok(body.data.slides.some((s: any) => s.title.includes('Welcome')));
  });

  test('GET /api/v1/signage/featured?location=L1_lift filters slides for L1 lift display', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/signage/featured?location=L1_lift',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    body.data.slides.forEach((s: any) => {
      assert.ok(s.targetLocations.includes('all') || s.targetLocations.includes('L1_lift'));
    });
  });

  test('GET /api/v1/signage/directory returns structured floor-by-floor wayfinding grouping', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/signage/directory',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.data.mallName, 'Jubilee Square (Ang Mo Kio)');
    assert.equal(body.data.floors.length, 4); // L1, L2, L3, L4

    const l1 = body.data.floors.find((f: any) => f.floorLevel === 'L1');
    const l2 = body.data.floors.find((f: any) => f.floorLevel === 'L2');
    const l3 = body.data.floors.find((f: any) => f.floorLevel === 'L3');
    const l4 = body.data.floors.find((f: any) => f.floorLevel === 'L4');

    assert.ok(l1);
    assert.ok(l2);
    assert.ok(l3);
    assert.ok(l4);

    const totalStoresOnFloors = body.data.floors.reduce((sum: number, f: any) => sum + f.tenants.length, 0);
    assert.equal(totalStoresOnFloors, 23);
  });
});
