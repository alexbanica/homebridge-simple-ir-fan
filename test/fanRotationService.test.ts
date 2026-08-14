import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { FanRotationGatewayInterface } from '../src/fan/services/FanRotationGatewayInterface.js';
import { FanRotationService } from '../src/fan/services/FanRotationService.js';

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

class FakeFanRotationGateway implements FanRotationGatewayInterface {
  readonly requests: Array<Deferred<void>> = [];

  rotate(): Promise<void> {
    const request = new Deferred<void>();
    this.requests.push(request);
    return request.promise;
  }
}

test('starts one gateway rotation while idle', async () => {
  const gateway = new FakeFanRotationGateway();
  const service = new FanRotationService(gateway);

  const result = service.rotate();

  assert.equal(gateway.requests.length, 1);
  gateway.requests[0].resolve(undefined);
  await result;
});

test('concurrent rotation calls share the identical in-flight promise and request', async () => {
  const gateway = new FakeFanRotationGateway();
  const service = new FanRotationService(gateway);

  const first = service.rotate();
  const second = service.rotate();

  assert.strictEqual(second, first);
  assert.equal(gateway.requests.length, 1);
  gateway.requests[0].resolve(undefined);
  await Promise.all([first, second]);
});

test('a later rotation after settlement produces a new request', async () => {
  const gateway = new FakeFanRotationGateway();
  const service = new FanRotationService(gateway);

  const first = service.rotate();
  gateway.requests[0].resolve(undefined);
  await first;

  const second = service.rotate();

  assert.notStrictEqual(second, first);
  assert.equal(gateway.requests.length, 2);
  gateway.requests[1].resolve(undefined);
  await second;
});

test('propagates a gateway error to every concurrent caller', async () => {
  const gateway = new FakeFanRotationGateway();
  const service = new FanRotationService(gateway);
  const expected = new Error('rotation failed');

  const first = service.rotate();
  const second = service.rotate();
  gateway.requests[0].reject(expected);

  await assert.rejects(first, (error: unknown) => error === expected);
  await assert.rejects(second, (error: unknown) => error === expected);
});

test('recovers after a failed rotation and permits a later request', async () => {
  const gateway = new FakeFanRotationGateway();
  const service = new FanRotationService(gateway);

  const failed = service.rotate();
  gateway.requests[0].reject(new Error('temporary failure'));
  await assert.rejects(failed, /temporary failure/);

  const recovered = service.rotate();

  assert.equal(gateway.requests.length, 2);
  gateway.requests[1].resolve(undefined);
  await recovered;
});
