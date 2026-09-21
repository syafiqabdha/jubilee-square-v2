import { describe, test } from 'node:test';
import assert from 'node:assert';
import { ensureSyncFlow } from './bootstrap.js';

describe('ensureSyncFlow config generation', () => {
  test('ensureSyncFlow throws error when SYNC_SECRET is missing', async () => {
    let threw = false;
    try {
      await ensureSyncFlow('http://mock', 'token', 'http://tgt', '');
    } catch (err: any) {
      threw = true;
      assert.match(err.message, /SYNC_SECRET is not provided/);
    }
    assert.ok(threw, 'Should have thrown on missing SYNC_SECRET');
  });
});
