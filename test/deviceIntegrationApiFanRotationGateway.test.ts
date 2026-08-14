import assert from 'node:assert/strict';
import { mock, test } from 'node:test';

import { DeviceIntegrationApiFanRotationGateway } from '../src/fan/infrastructures/DeviceIntegrationApiFanRotationGateway.js';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type GatewayOptions = { fetch?: FetchLike; timeoutMs?: number };

function gateway(uri: string, options: GatewayOptions = {}) {
  return new DeviceIntegrationApiFanRotationGateway(uri, options);
}

test('accepts a configured full rotation URI and posts bodylessly to it unchanged', async () => {
  let requestUrl: string | undefined;
  let requestInit: RequestInit | undefined;
  const fetch: FetchLike = async (input, init) => {
    requestUrl = String(input);
    requestInit = init;
    return new Response('ignored response body', { status: 202 });
  };

  await gateway('https://api.example.test/api/v1/fan/rotate', { fetch }).rotate();

  assert.equal(requestUrl, 'https://api.example.test/api/v1/fan/rotate');
  assert.equal(requestInit?.method, 'POST');
  assert.equal(requestInit?.body, undefined);
  assert.equal(requestInit?.headers, undefined);
});

test('rejects wrong path, non-http(s), query, fragment, and credentials', () => {
  for (const invalid of [
    'https://api.example.test/api/v1/fan/start',
    'https://api.example.test/',
    'ftp://api.example.test/api/v1/fan/rotate',
    'api.example.test/api/v1/fan/rotate',
    'https://api.example.test:bad/api/v1/fan/rotate',
    'https://api.example.test/api/v1/fan/rotate?debug=true',
    'https://api.example.test/api/v1/fan/rotate#fragment',
    'https://admin:secret@api.example.test/api/v1/fan/rotate',
  ]) {
    assert.throws(() => gateway(invalid));
  }
});

test('credential validation errors do not disclose the credential or endpoint URI', () => {
  assert.throws(
    () => gateway('https://admin:super-secret@api.example.test/api/v1/fan/rotate'),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes('super-secret'), false);
      assert.equal(error.message.includes('api.example.test'), false);
      return true;
    },
  );
});

test('only HTTP 202 is accepted as success and response bodies are ignored', async () => {
  for (const status of [200, 201, 204, 400, 500]) {
    const fetch: FetchLike = async () => new Response(null, { status });
    await assert.rejects(
      gateway('http://api.example.test/api/v1/fan/rotate', { fetch }).rotate(),
      /unexpected status/,
    );
  }

  const fetch: FetchLike = async () => new Response(null, { status: 202 });
  await gateway('http://api.example.test/api/v1/fan/rotate', { fetch }).rotate();
});

test('configured timeout aborts the request and does not retry', async () => {
  let calls = 0;
  let aborted = false;
  const fetch: FetchLike = async (_input, init) => {
    calls += 1;
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return new Promise<Response>(() => undefined);
  };

  mock.timers.enable();
  try {
    const result = gateway('http://api.example.test/api/v1/fan/rotate', { fetch, timeoutMs: 20 }).rotate();
    mock.timers.tick(20);
    await assert.rejects(result, /timed out/);
    assert.equal(aborted, true);
    assert.equal(calls, 1);
  } finally {
    mock.timers.reset();
  }
});

test('default timeout is five seconds and aborts without a real delay', async () => {
  let aborted = false;
  const fetch: FetchLike = async (_input, init) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return new Promise<Response>(() => undefined);
  };

  mock.timers.enable();
  try {
    const result = gateway('http://api.example.test/api/v1/fan/rotate', { fetch }).rotate();
    mock.timers.tick(4999);
    await Promise.resolve();
    assert.equal(aborted, false);
    mock.timers.tick(1);
    await assert.rejects(result, /timed out/);
    assert.equal(aborted, true);
  } finally {
    mock.timers.reset();
  }
});

test('network failures are contained, secret-safe, and never retried', async () => {
  let calls = 0;
  const fetch: FetchLike = async () => {
    calls += 1;
    throw new Error('upstream failed with token=super-secret');
  };

  await assert.rejects(
    gateway('http://api.example.test/api/v1/fan/rotate', { fetch }).rotate(),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message.includes('super-secret'), false);
      return true;
    },
  );
  assert.equal(calls, 1);
});
