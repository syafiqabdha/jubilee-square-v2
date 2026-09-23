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

  test('ensureSyncFlow configures operation with JSON body and Content-Type', async () => {
    let operationPayload: any = null;
    const originalFetch = globalThis.fetch;
    
    // Mock fetch
    globalThis.fetch = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const urlStr = url.toString();
      
      if (urlStr.endsWith('/flows') && init?.method === undefined) {
        return { ok: true, json: async () => ({ data: [] }) } as Response;
      }
      
      if (urlStr.endsWith('/flows') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ data: { id: 'mock-flow-id' } }) } as Response;
      }
      
      if (urlStr.endsWith('/operations') && init?.method === 'POST') {
        const body = JSON.parse(init.body as string);
        operationPayload = body;
        return { ok: true, json: async () => ({ data: { id: 'mock-operation-id' } }) } as Response;
      }
      
      if (urlStr.includes('/flows/') && init?.method === 'PATCH') {
        return { ok: true, json: async () => ({}) } as Response;
      }
      
      return { ok: true, json: async () => ({}) } as Response;
    };
    
    try {
      await ensureSyncFlow('http://mock', 'token', 'http://tgt', 'secret');
      
      assert.ok(operationPayload, 'Operation payload should have been intercepted');
      assert.strictEqual(operationPayload.options.method, 'POST');
      assert.strictEqual(typeof operationPayload.options.body, 'string');
      
      const headers = operationPayload.options.headers || [];
      const contentTypeHeader = headers.find((h: any) => h.header === 'Content-Type');
      assert.ok(contentTypeHeader, 'Content-Type header must be present');
      assert.strictEqual(contentTypeHeader.value, 'application/json');
      
      const secretHeader = headers.find((h: any) => h.header === 'x-sync-secret');
      assert.ok(secretHeader, 'x-sync-secret header must be present');
      assert.strictEqual(secretHeader.value, 'secret');
      
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
