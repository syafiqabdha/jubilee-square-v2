import { describe, it } from 'node:test';
import assert from 'node:assert';
import { JubileeApiClient } from '../src/lib/api-client.js';

describe('Jubilee Square Web API Client Suite (with Resilient Fallback)', () => {
  // Client pointing to an offline port to verify pure resilient fallback behavior
  const client = new JubileeApiClient('http://127.0.0.1:59999');

  it('getCategories returns 5 verticals with accurate metadata', async () => {
    const categories = await client.getCategories();
    assert.strictEqual(categories.length, 5);
    const slugs = categories.map((c) => c.slug);
    assert.ok(slugs.includes('dine'));
    assert.ok(slugs.includes('learn'));
    assert.ok(slugs.includes('relax'));
    assert.ok(slugs.includes('shop'));
    assert.ok(slugs.includes('services'));
  });

  it('getTenants returns all 23 active verified tenants by default', async () => {
    const { tenants, total } = await client.getTenants();
    assert.strictEqual(tenants.length, 23);
    assert.strictEqual(total, 23);
  });

  it('getTenants by category "learn" returns 9 enrichment centres', async () => {
    const { tenants, total } = await client.getTenants({ category: 'learn' });
    assert.strictEqual(tenants.length, 9);
    assert.strictEqual(total, 9);
    assert.ok(tenants.every((t) => t.categorySlug === 'learn'));
  });

  it('getTenants by category "dine" returns 6 food & beverage stores', async () => {
    const { tenants } = await client.getTenants({ category: 'dine' });
    assert.strictEqual(tenants.length, 6);
  });

  it('getTenants by floor Level 3 returns 6 tenants', async () => {
    const { tenants } = await client.getTenants({ floor: 'L3' });
    assert.strictEqual(tenants.length, 6);
  });

  it('getTenantBySlug returns Bantianyao Grilled Fish store profile', async () => {
    const tenant = await client.getTenantBySlug('bantianyao-grilled-fish');
    assert.strictEqual(tenant.name, 'BANTIANYAO GRILLED FISH');
    assert.strictEqual(tenant.unitNumber, '#02-01/02');
    assert.strictEqual(tenant.floorLevel, 'L2');
  });

  it('getTenantBySlug throws error for non-existent slug', async () => {
    await assert.rejects(
      async () => {
        await client.getTenantBySlug('non-existent-shop-12345');
      },
      { message: /Tenant not found/ }
    );
  });

  it('search matches keyword "drum" returning My Drum School', async () => {
    const results = await client.search('drum');
    assert.ok(results.length >= 1);
    assert.strictEqual(results[0].slug, 'my-drum-school');
  });

  it('search matches unit number "01-08" returning Max-See', async () => {
    const results = await client.search('01-08');
    assert.ok(results.length >= 1);
    assert.strictEqual(results[0].slug, 'max-see-veggie-house');
  });

  it('search returns empty array on non-matching query', async () => {
    const results = await client.search('nonexistentquery999');
    assert.strictEqual(results.length, 0);
  });

  it('getSignageDirectory returns 4 floor groups', async () => {
    const directory = await client.getSignageDirectory();
    assert.strictEqual(directory.mallName, 'Jubilee Square');
    assert.strictEqual(directory.floors.length, 4);
  });

  it('getSignageFeatured returns slides array', async () => {
    const res = await client.getSignageFeatured('all');
    assert.ok(res.slides.length > 0);
  });
});
