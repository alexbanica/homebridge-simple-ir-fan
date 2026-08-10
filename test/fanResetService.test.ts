import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FanResetGatewayInterface } from '../src/fan/services/FanResetGatewayInterface.js';
import { FanResetService } from '../src/fan/services/FanResetService.js';

class Deferred<T> {
  readonly promise: Promise<T>;
  resolve!: (value: T | PromiseLike<T>) => void;
  reject!: (reason?: unknown) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class FakeFanResetGateway implements FanResetGatewayInterface {
  readonly requests: Array<Deferred<void>> = [];

  reset(): Promise<void> {
    const request = new Deferred<void>();
    this.requests.push(request);
    return request.promise;
  }
}

test('starts one gateway reset while idle', async () => {
  const gateway = new FakeFanResetGateway();
  const service = new FanResetService(gateway);

  const result = service.reset();

  assert.equal(gateway.requests.length, 1);
  gateway.requests[0].resolve(undefined);
  await result;
});

test('concurrent reset calls share the identical in-flight promise and request', async () => {
  const gateway = new FakeFanResetGateway();
  const service = new FanResetService(gateway);

  const first = service.reset();
  const second = service.reset();

  assert.strictEqual(second, first);
  assert.equal(gateway.requests.length, 1);
  gateway.requests[0].resolve(undefined);
  await Promise.all([first, second]);
});

test('a later reset after settlement produces a new request', async () => {
  const gateway = new FakeFanResetGateway();
  const service = new FanResetService(gateway);

  const first = service.reset();
  gateway.requests[0].resolve(undefined);
  await first;

  const second = service.reset();

  assert.notStrictEqual(second, first);
  assert.equal(gateway.requests.length, 2);
  gateway.requests[1].resolve(undefined);
  await second;
});

test('propagates a gateway error to every concurrent caller', async () => {
  const gateway = new FakeFanResetGateway();
  const service = new FanResetService(gateway);
  const expected = new Error('reset failed');

  const first = service.reset();
  const second = service.reset();
  gateway.requests[0].reject(expected);

  await assert.rejects(first, (error: unknown) => error === expected);
  await assert.rejects(second, (error: unknown) => error === expected);
});

test('recovers after a failed reset and permits a later request', async () => {
  const gateway = new FakeFanResetGateway();
  const service = new FanResetService(gateway);

  const failed = service.reset();
  gateway.requests[0].reject(new Error('temporary failure'));
  await assert.rejects(failed, /temporary failure/);

  const recovered = service.reset();

  assert.equal(gateway.requests.length, 2);
  gateway.requests[1].resolve(undefined);
  await recovered;
});
