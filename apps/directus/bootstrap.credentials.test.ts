/**
 * Guard tests for Directus bootstrap credential handling (PAN-45 remediation).
 *
 * Finding: bootstrap.ts fell back to hardcoded, publicly-known admin credentials
 * whenever ADMIN_EMAIL / ADMIN_PASSWORD were unset. These tests lock in
 * fail-closed behaviour so a default login cannot be reintroduced silently.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAdminCredentials, isDirectusReachable } from './bootstrap.js';

describe('resolveAdminCredentials — no default credentials', () => {
  test('throws when both ADMIN_EMAIL and ADMIN_PASSWORD are missing', () => {
    assert.throws(
      () => resolveAdminCredentials({}),
      /ADMIN_EMAIL and ADMIN_PASSWORD must be set/,
    );
  });

  test('throws when only ADMIN_PASSWORD is missing', () => {
    assert.throws(() => resolveAdminCredentials({ ADMIN_EMAIL: 'ops@example.com' }));
  });

  test('throws when only ADMIN_EMAIL is missing', () => {
    assert.throws(() => resolveAdminCredentials({ ADMIN_PASSWORD: 'not-a-default' }));
  });

  test('treats whitespace-only ADMIN_EMAIL as unset', () => {
    assert.throws(() => resolveAdminCredentials({ ADMIN_EMAIL: '   ', ADMIN_PASSWORD: 'not-a-default' }));
  });

  test('returns the configured credentials unchanged', () => {
    const creds = resolveAdminCredentials({
      ADMIN_EMAIL: 'ops@example.com',
      ADMIN_PASSWORD: 'not-a-default',
    });
    assert.deepEqual(creds, { email: 'ops@example.com', password: 'not-a-default' });
  });

  test('throws a fail-closed error pointing operators at .env.example', () => {
    assert.throws(
      () => resolveAdminCredentials({}),
      (err: Error) => {
        assert.match(err.message, /ADMIN_EMAIL and ADMIN_PASSWORD must be set/);
        assert.match(err.message, /\.env\.example/);
        return true;
      },
    );
  });
});

describe('isDirectusReachable', () => {
  test('reports offline mode instead of throwing when no runtime is listening', async () => {
    assert.equal(await isDirectusReachable('http://127.0.0.1:59999', 500), false);
  });
});
