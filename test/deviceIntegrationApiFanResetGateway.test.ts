import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mock, test } from 'node:test';

import { DeviceIntegrationApiFanResetGateway } from '../src/fan/infrastructures/DeviceIntegrationApiFanResetGateway.js';

type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;
type GatewayOptions = { fetch?: FetchLike; timeoutMs?: number };

function gateway(baseUrl: string | undefined, options: GatewayOptions = {}) {
  return new DeviceIntegrationApiFanResetGateway(baseUrl, options);
}

async function withServer(
  handler: (request: import('node:http').IncomingMessage, response: import('node:http').ServerResponse) => void,
  callback: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const server: Server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');

  try {
    await callback(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test('omitted API base URL defaults to the OpenAPI localhost origin', async () => {
  let requestUrl: string | undefined;
  const fetch: FetchLike = async (input) => {
    requestUrl = String(input);
    return new Response(null, { status: 202 });
  };

  await gateway(undefined, { fetch }).reset();

  assert.equal(requestUrl, 'http://localhost:3000/api/v1/fan/reset');
});

test('valid origins are accepted and one trailing slash is normalized', async () => {
  const requests: string[] = [];
  const fetch: FetchLike = async (input) => {
    requests.push(String(input));
    return new Response(null, { status: 202 });
  };

  await gateway('http://api.example.test/', { fetch }).reset();
  await gateway('https://api.example.test', { fetch }).reset();

  assert.deepEqual(requests, [
    'http://api.example.test/api/v1/fan/reset',
    'https://api.example.test/api/v1/fan/reset',
  ]);
});

test('origins containing a path, query, fragment, or unsupported scheme are rejected', () => {
  for (const invalid of [
    'http://api.example.test/v1',
    'http://api.example.test/?debug=true',
    'http://api.example.test/#fragment',
    'ftp://api.example.test',
    'api.example.test',
  ]) {
    assert.throws(() => gateway(invalid), invalid);
  }
});

test('origins with embedded credentials are rejected', () => {
  for (const invalid of [
    'http://admin:secret@api.example.test',
    'http://admin@api.example.test',
    'http://:secret@api.example.test',
  ]) {
    assert.throws(
      () => gateway(invalid),
      /embedded credentials are not allowed/,
    );
  }
});

test('reset uses exactly one bodyless POST to the normalized endpoint', async () => {
  await withServer((request, response) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk: string) => {
      body += chunk;
    });
    request.on('end', () => {
      assert.equal(request.method, 'POST');
      assert.equal(request.url, '/api/v1/fan/reset');
      assert.equal(body, '');
      response.writeHead(202).end();
    });
  }, async (baseUrl) => {
    await gateway(`${baseUrl}/`, { timeoutMs: 100 }).reset();
  });
});

test('only HTTP 202 is accepted as success', async () => {
  for (const status of [200, 201, 204, 400, 500]) {
    const fetch: FetchLike = async () => new Response(null, { status });
    await assert.rejects(gateway('http://api.example.test', { fetch }).reset());
  }

  const fetch: FetchLike = async () => new Response(null, { status: 202 });
  await gateway('http://api.example.test', { fetch }).reset();
});

test('a request that exceeds the timeout is failed and aborted', async () => {
  let aborted = false;
  const fetch: FetchLike = async (_input, init) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    return new Promise<Response>(() => undefined);
  };

  await assert.rejects(gateway('http://api.example.test', { fetch, timeoutMs: 20 }).reset());
  assert.equal(aborted, true);
});

test('omitted timeout uses exactly 5 seconds and aborts without real delay', async () => {
  let aborted = false;
  let fetchCalls = 0;
  const fetch: FetchLike = async (_input, init) => {
    init?.signal?.addEventListener('abort', () => {
      aborted = true;
    });
    fetchCalls += 1;
    return new Promise<Response>(() => undefined);
  };

  let settled = false;
  mock.timers.enable();
  const resetResult = gateway('http://api.example.test', { fetch }).reset().finally(() => {
    settled = true;
  });

  try {
    mock.timers.tick(4999);
    await Promise.resolve();
    assert.equal(fetchCalls, 1);
    assert.equal(aborted, false);
    assert.equal(settled, false);

    mock.timers.tick(1);
    await assert.rejects(resetResult);
    assert.equal(aborted, true);
    assert.equal(fetchCalls, 1);
  } finally {
    mock.timers.reset();
  }
});

test('network and HTTP failures are contained and never retried', async () => {
  let networkCalls = 0;
  const networkFailureFetch: FetchLike = async () => {
    networkCalls += 1;
    throw new TypeError('simulated loopback network failure');
  };
  await assert.rejects(
    gateway('http://api.example.test', { fetch: networkFailureFetch }).reset(),
    /network failure/,
  );
  assert.equal(networkCalls, 1);

  let statusCalls = 0;
  const failureStatusFetch: FetchLike = async () => {
    statusCalls += 1;
    return new Response(null, { status: 500 });
  };
  await assert.rejects(
    gateway('http://api.example.test', { fetch: failureStatusFetch }).reset(),
    /unexpected status/,
  );
  assert.equal(statusCalls, 1);
});
