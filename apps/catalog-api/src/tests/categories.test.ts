import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../app.js';
import type { FastifyInstance } from 'fastify';

describe('Jubilee Square API Suite - Categories', () => {
  let app: FastifyInstance;

  before(async () => {
    app = await buildApp();
    await app.ready();
  });

  after(async () => {
    await app.close();
  });

  test('GET /api/v1/categories returns 5 verticals with accurate tenant counts', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/categories',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.data.length, 5);

    const dine = body.data.find((c: any) => c.slug === 'dine');
    const learn = body.data.find((c: any) => c.slug === 'learn');
    const relax = body.data.find((c: any) => c.slug === 'relax');
    const shop = body.data.find((c: any) => c.slug === 'shop');
    const services = body.data.find((c: any) => c.slug === 'services');

    assert.ok(dine);
    assert.equal(dine.tenantCount, 6);

    assert.ok(learn);
    assert.equal(learn.tenantCount, 9);

    assert.ok(relax);
    assert.equal(relax.tenantCount, 5);

    assert.ok(shop);
    assert.equal(shop.tenantCount, 2);

    assert.ok(services);
    assert.equal(services.tenantCount, 1);

    // Verify total count = 23 tenants
    const totalTenants = body.data.reduce((sum: number, c: any) => sum + c.tenantCount, 0);
    assert.equal(totalTenants, 23);
  });

  test('GET /api/v1/categories/learn/tenants returns all 9 education centres', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/categories/learn/tenants',
    });

    assert.equal(response.statusCode, 200);
    const body = JSON.parse(response.body);
    assert.equal(body.success, true);
    assert.equal(body.data.category.slug, 'learn');
    assert.equal(body.data.tenants.length, 9);

    const names = body.data.tenants.map((t: any) => t.name);
    assert.ok(names.includes('My Drum School'));
    assert.ok(names.includes('AGrader Learning Centre'));
    assert.ok(names.includes('Jeong-In Taekwondo Education Centre'));
    assert.ok(names.includes('LCentral'));
  });

  test('GET /api/v1/categories/unknown/tenants returns 404', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/v1/categories/unknown/tenants',
    });

    assert.equal(response.statusCode, 404);
    const body = JSON.parse(response.body);
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'CATEGORY_NOT_FOUND');
  });
});
