import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlatformAccessory } from 'homebridge';

import type { FanResetServiceInterface } from '../src/fan/services/FanResetServiceInterface.js';
import {
  FanResetPlatformAccessory,
  type FanResetHomebridgePlatformInterface,
} from '../src/platformAccessory.js';

type Handler = (value: boolean) => void | Promise<void>;
type Getter = () => unknown;

class FakeCharacteristic {
  value = false;
  private setter?: Handler;
  private getter?: Getter;

  onSet(handler: Handler) {
    this.setter = handler;
    return this;
  }

  onGet(handler: Getter) {
    this.getter = handler;
    return this;
  }

  updateValue(value: boolean) {
    this.value = value;
    return this;
  }

  async write(value: boolean) {
    await this.setter?.(value);
  }

  read() {
    return this.getter?.() ?? this.value;
  }
}

class FakeService {
  readonly characteristics = new Map<unknown, FakeCharacteristic>();

  setCharacteristic(type: unknown, value: boolean) {
    this.getCharacteristic(type).updateValue(value);
    return this;
  }

  updateCharacteristic(type: unknown, value: boolean) {
    this.getCharacteristic(type).updateValue(value);
    return this;
  }

  getCharacteristic(type: unknown) {
    let characteristic = this.characteristics.get(type);
    if (!characteristic) {
      characteristic = new FakeCharacteristic();
      this.characteristics.set(type, characteristic);
    }
    return characteristic;
  }
}

class FakeAccessory {
  readonly services = new Map<unknown, FakeService>();
  readonly context = { device: {} };
  readonly displayName = 'Reset Fan';

  constructor() {
    this.services.set('AccessoryInformation', new FakeService());
  }

  getService(type: unknown) {
    return this.services.get(type);
  }

  addService(type: unknown) {
    const service = new FakeService();
    this.services.set(type, service);
    return service;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function fixture(reset: () => Promise<void>) {
  const logs = { info: [] as unknown[][], error: [] as unknown[][] };
  const platform = {
    api: {
      hap: {
        Service: { Switch: 'Switch', AccessoryInformation: 'AccessoryInformation' },
        Characteristic: { Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber', On: 'On', Name: 'Name' },
        HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
        HapStatusError: class extends Error {
          readonly hapStatus: number;

          constructor(status: number) {
            super(`HAP status ${status}`);
            this.hapStatus = status;
          }
        },
      },
    },
    log: {
      info: (...args: unknown[]) => logs.info.push(args),
      error: (...args: unknown[]) => logs.error.push(args),
    },
  } as unknown as FanResetHomebridgePlatformInterface;
  const accessory = new FakeAccessory();
  const resetService: FanResetServiceInterface = { reset };

  new FanResetPlatformAccessory(platform, accessory as unknown as PlatformAccessory, resetService);
  const service = accessory.services.get('Switch')!;
  const on = service.getCharacteristic('On');
  return { logs, on };
}

function coalescingResetService(reset: () => Promise<void>): FanResetServiceInterface {
  let inFlightReset: Promise<void> | undefined;

  return {
    reset() {
      if (inFlightReset) {
        return inFlightReset;
      }

      const resetPromise = reset().finally(() => {
        inFlightReset = undefined;
      });
      inFlightReset = resetPromise;
      return resetPromise;
    },
  };
}

test('reset Switch starts OFF and an idle OFF write is a no-op', async () => {
  let calls = 0;
  const view = fixture(async () => {
    calls += 1;
  });

  assert.equal(view.on.value, false);
  await view.on.write(false);
  assert.equal(calls, 0);
  assert.equal(view.on.value, false);
});

test('ON reports pending state, performs one reset, then returns OFF and logs success', async () => {
  const request = deferred<void>();
  let calls = 0;
  const view = fixture(() => {
    calls += 1;
    return request.promise;
  });

  const activation = view.on.write(true);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(view.on.value, true);

  request.resolve(undefined);
  await activation;
  assert.equal(view.on.value, false);
  assert.equal(view.logs.info.length, 1);
});

test('duplicate ON writes share the pending application reset', async () => {
  const request = deferred<void>();
  let calls = 0;
  const service = coalescingResetService(() => {
    calls += 1;
    return request.promise;
  });
  const view = fixture(service.reset);

  const first = view.on.write(true);
  const second = view.on.write(true);
  await Promise.resolve();
  assert.equal(calls, 1);
  assert.equal(view.on.value, true);

  request.resolve(undefined);
  await Promise.all([first, second]);
  assert.equal(view.on.value, false);
});

test('failed reset returns OFF and maps to a HomeKit communication error', async () => {
  const view = fixture(async () => {
    throw new Error('deterministic reset failure');
  });

  await assert.rejects(view.on.write(true), (error: { hapStatus?: number }) => {
    assert.equal(error.hapStatus, -70402);
    return true;
  });
  assert.equal(view.on.value, false);
  assert.equal(view.logs.error.length, 1);
});

test('a failed activation remains retryable', async () => {
  let calls = 0;
  const view = fixture(async () => {
    calls += 1;
    if (calls === 1) {
      throw new Error('first failure');
    }
  });

  await assert.rejects(view.on.write(true));
  await view.on.write(true);
  assert.equal(calls, 2);
  assert.equal(view.on.value, false);
});
