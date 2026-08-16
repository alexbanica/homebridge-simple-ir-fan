import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { PlatformAccessory } from 'homebridge';

import { SimpleIrFanAccessory } from '../src/platformAccessory.js';

type Handler = (value: unknown) => void | Promise<void>;

class FakeCharacteristic {
  value: unknown;
  private setter?: Handler;
  private getter?: () => unknown;

  onSet(handler: Handler) {
    this.setter = handler;
    return this;
  }
  onGet(handler: () => unknown) {
    this.getter = handler;
    return this;
  }
  setProps() {
    return this;
  }
  updateValue(value: unknown) {
    this.value = value;
    return this;
  }
  async write(value: unknown) {
    await this.setter?.(value);
  }
  read() {
    return this.getter?.() ?? this.value;
  }
}

class FakeService {
  readonly characteristics = new Map<unknown, FakeCharacteristic>();

  constructor(
    readonly type: unknown,
    readonly displayName = '',
    readonly subtype?: string,
  ) {}

  setCharacteristic(type: unknown, value: unknown) {
    return this.getCharacteristic(type).updateValue(value) && this;
  }
  updateCharacteristic(type: unknown, value: unknown) {
    return this.getCharacteristic(type).updateValue(value) && this;
  }
  getCharacteristic(type: unknown) {
    let characteristic = this.characteristics.get(type);
    if (!characteristic) {
      characteristic = new FakeCharacteristic();
      this.characteristics.set(type, characteristic);
    }
    return characteristic;
  }

  removeCharacteristic(characteristic: FakeCharacteristic) {
    for (const [type, current] of this.characteristics) {
      if (current === characteristic) {
        this.characteristics.delete(type);
      }
    }
    return this;
  }
}

class FakeAccessory {
  readonly context = { device: {} };
  readonly displayName = 'Living Room Fan';
  readonly services: FakeService[] = [new FakeService('AccessoryInformation')];

  getService(type: unknown, subtype?: string) {
    return this.services.find((service) => service.type === type && (subtype === undefined || service.subtype === subtype));
  }

  addService(type: unknown, displayName?: string, subtype?: string) {
    const service = new FakeService(type, displayName, subtype);
    this.services.push(service);
    return service;
  }

  removeService(service: FakeService) {
    const index = this.services.indexOf(service);
    if (index >= 0) {
      this.services.splice(index, 1);
    }
  }
}

function fixture(
  reset?: { uri: string; method: 'POST' },
  timeoutMs?: number,
  identity: { name?: string; serialNumber?: string } = {},
  rotate?: { uri: string; method: 'POST' },
) {
  const logs = { info: [] as unknown[][], error: [] as unknown[][] };
  const api = {
    hap: {
      Service: { Fanv2: 'Fanv2', Switch: 'Switch', AccessoryInformation: 'AccessoryInformation' },
      Characteristic: {
        Active: 'Active', RotationSpeed: 'RotationSpeed', SwingMode: 'SwingMode', On: 'On',
        Name: 'Name', Manufacturer: 'Manufacturer', Model: 'Model', SerialNumber: 'SerialNumber',
      },
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
      HapStatusError: class extends Error {
        readonly hapStatus: number;

        constructor(status: number) {
          super(`HAP ${status}`);
          this.hapStatus = status;
        }
      },
    },
    log: { info: (...args: unknown[]) => logs.info.push(args), error: (...args: unknown[]) => logs.error.push(args) },
  };
  const platform = { api, log: api.log } as never;
  const accessory = new FakeAccessory();
  const device = {
    name: identity.name ?? accessory.displayName, manufacturer: 'Generic', model: 'IR Fan',
    serialNumber: identity.serialNumber ?? 'FAN-001', timeoutMs,
    endpoints: {
      getStatus: { uri: 'http://fan.example.test/state', method: 'GET' as const },
      ...(reset ? { reset } : {}),
      ...(rotate ? { rotate } : {}),
    },
  };
  new SimpleIrFanAccessory(platform, accessory as unknown as PlatformAccessory, device);
  return {
    accessory,
    api,
    logs,
    resetService: accessory.services.find((service) => service.type === 'Switch' && service.subtype === 'fan-reset'),
    rotationService: accessory.services.find((service) => service.type === 'Switch' && service.subtype === 'fan-rotation-toggle'),
  };
}

function resetCharacteristic(view: ReturnType<typeof fixture>) {
  assert.ok(view.resetService, 'expected a reset Switch service');
  return view.resetService.getCharacteristic(view.api.hap.Characteristic.On);
}

function rotationCharacteristic(view: ReturnType<typeof fixture>) {
  assert.ok(view.rotationService, 'expected a rotation Switch service');
  return view.rotationService.getCharacteristic(view.api.hap.Characteristic.On);
}

test('fan without reset endpoint has no reset Switch and retains Fanv2', () => {
  const view = fixture();
  assert.equal(view.resetService, undefined);
  assert.ok(view.accessory.services.some((service) => service.type === view.api.hap.Service.Fanv2));
});
test('configured reset is a single stable-subtype Switch on the existing fan accessory', () => {
  const first = fixture({ uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' });
  const subtype = first.resetService?.subtype;
  assert.ok(subtype);
  assert.equal(first.accessory.services.filter((service) => service.type === 'Switch').length, 1);
  const second = fixture({ uri: 'https://fan.example.test/api/v1/fan/reset', method: 'POST' });
  assert.equal(second.resetService?.subtype, subtype);
  assert.equal(second.accessory.services.filter((service) => service.type === 'Fanv2').length, 1);
});

test('reset Switch writes are momentary, OFF is a no-op, and successful reset logs without changing Fanv2', async () => {
  const originalFetch = globalThis.fetch;
  let resetPosts = 0;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'POST') {
      resetPosts += 1;
      assert.equal(init.body, undefined);
      return new Response('ignored body', { status: 202 });
    }
    return new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  };
  try {
    const view = fixture({ uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' });
    const on = resetCharacteristic(view);
    await on.write(false);
    assert.equal(resetPosts, 0);
    await on.write(true);
    assert.equal(resetPosts, 1);
    assert.equal(on.value, false);
    assert.equal(view.logs.info.length, 1);
    assert.equal(view.accessory.services.filter((service) => service.type === 'Fanv2').length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reset Switch remains ON while the shared request is pending, then returns OFF', async () => {
  const originalFetch = globalThis.fetch;
  let resolveRequest!: (response: Response) => void;
  globalThis.fetch = (_input, init) => {
    if (init?.method !== 'POST') {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    return new Promise<Response>((resolve) => {
      resolveRequest = resolve;
    });
  };
  try {
    const view = fixture({ uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' });
    const on = resetCharacteristic(view);
    const write = on.write(true);
    await Promise.resolve();
    assert.equal(on.value, true);
    resolveRequest(new Response('{}', { status: 202 }));
    await write;
    assert.equal(on.value, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('same-fan concurrent failures coalesce, map both writes to communication failure, and remain retryable', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveRequest!: (response: Response) => void;
  globalThis.fetch = (_input, init) => {
    if (init?.method !== 'POST') {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    calls += 1;
    if (calls === 1) {
      return new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      });
    }
    return Promise.resolve(new Response('{}', { status: 500 }));
  };
  try {
    const view = fixture({ uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' });
    const on = resetCharacteristic(view);
    const first = on.write(true);
    const second = on.write(true);
    await Promise.resolve();
    assert.equal(calls, 1);
    resolveRequest(new Response('{}', { status: 500 }));
    await Promise.all([
      assert.rejects(first, (error: { hapStatus?: number }) => error.hapStatus === -70402),
      assert.rejects(second, (error: { hapStatus?: number }) => error.hapStatus === -70402),
    ]);
    assert.equal(on.value, false);
    assert.equal(view.logs.error.length, 1);
    await assert.rejects(on.write(true), (error: { hapStatus?: number }) => error.hapStatus === -70402);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached fan gains exactly one stable reset Switch when reset configuration is added', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const view = fixture();
    const fan = view.accessory;
    const resetEndpoint = { uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' as const };
    new SimpleIrFanAccessory({ api: view.api, log: view.logs } as never, fan as never, {
      name: fan.displayName, manufacturer: 'Generic', model: 'IR Fan', serialNumber: 'FAN-001',
      endpoints: { getStatus: { uri: 'http://fan.example.test/state', method: 'GET' }, reset: resetEndpoint },
    });
    const reset = fan.services.filter((service) => service.type === 'Switch');
    assert.equal(reset.length, 1);
    const subtype = reset[0]?.subtype;
    assert.equal(subtype, 'fan-reset');

    new SimpleIrFanAccessory({ api: view.api, log: view.logs } as never, fan as never, {
      name: fan.displayName, manufacturer: 'Generic', model: 'IR Fan', serialNumber: 'FAN-001',
      endpoints: { getStatus: { uri: 'http://fan.example.test/state', method: 'GET' }, reset: resetEndpoint },
    });
    assert.equal(fan.services.filter((service) => service.type === 'Switch').length, 1);
    assert.equal(fan.services.find((service) => service.type === 'Switch')?.subtype, subtype);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached reset service is removed when reset configuration is absent', () => {
  const view = fixture();
  const stale = view.accessory.addService(view.api.hap.Service.Switch, 'Reset', 'fan-reset');
  assert.ok(stale);
  // Reconciliation is performed by reconstructing the accessory with current config.
  new SimpleIrFanAccessory({ api: view.api, log: view.logs } as never, view.accessory as never, {
    name: view.accessory.displayName, manufacturer: 'Generic', model: 'IR Fan', serialNumber: 'FAN-001',
    endpoints: { getStatus: { uri: 'http://fan.example.test/state', method: 'GET' } },
  });
  assert.equal(view.accessory.services.some((service) => service.subtype === 'fan-reset'), false);
  assert.ok(view.accessory.services.some((service) => service.type === 'Fanv2'));
});

test('different fan reset writes remain independent', async () => {
  const originalFetch = globalThis.fetch;
  const pending = new Map<string, (response: Response) => void>();
  const resetPosts: string[] = [];
  globalThis.fetch = (input, init) => {
    if (init?.method !== 'POST') {
      return Promise.resolve(new Response('{}', { status: 200 }));
    }
    const uri = String(input);
    resetPosts.push(uri);
    return new Promise<Response>((resolve) => pending.set(uri, resolve));
  };
  try {
    const first = fixture({ uri: 'http://first.example.test/api/v1/fan/reset', method: 'POST' }, undefined, { serialNumber: 'FAN-001' });
    const second = fixture({ uri: 'http://second.example.test/api/v1/fan/reset', method: 'POST' }, undefined, { serialNumber: 'FAN-002' });
    const firstWrite = resetCharacteristic(first).write(true);
    const secondWrite = resetCharacteristic(second).write(true);
    await Promise.resolve();
    assert.deepEqual(resetPosts.sort(), [
      'http://first.example.test/api/v1/fan/reset',
      'http://second.example.test/api/v1/fan/reset',
    ]);
    pending.get('http://first.example.test/api/v1/fan/reset')?.(new Response('{}', { status: 202 }));
    pending.get('http://second.example.test/api/v1/fan/reset')?.(new Response('{}', { status: 202 }));
    await Promise.all([firstWrite, secondWrite]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reset uses the configured timeout and defaults to five seconds', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof timeout === 'number') {
      delays.push(timeout);
    }
    return originalSetTimeout(handler, timeout, ...args);
  }) as typeof setTimeout;
  globalThis.fetch = async (_input, init) => {
    assert.ok(init?.signal);
    return new Response('{}', { status: 202 });
  };
  try {
    await resetCharacteristic(fixture({ uri: 'http://custom.example.test/api/v1/fan/reset', method: 'POST' }, 1234)).write(true);
    await resetCharacteristic(fixture({ uri: 'http://default.example.test/api/v1/fan/reset', method: 'POST' })).write(true);
    // Each fixture also refreshes Fanv2 status during construction.
    assert.deepEqual(delays, [1234, 1234, 5000, 5000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('invalid reset configuration removes reset Switch, preserves Fanv2, and does not log secrets', () => {
  const view = fixture({
    uri: 'http://user:super-secret@example.test/api/v1/fan/reset',
    method: 'POST',
  });
  assert.equal(view.resetService, undefined);
  assert.ok(view.accessory.services.some((service) => service.type === 'Fanv2'));
  assert.ok(view.logs.error.length > 0);
  assert.equal(JSON.stringify(view.logs.error).includes('super-secret'), false);
  assert.equal(JSON.stringify(view.logs.error).includes('example.test'), false);
  assert.equal(JSON.stringify(view.logs.error).includes('FAN-001'), true);
});

test('configured rotation is one stable-subtype Switch on the existing fan and has no active SwingMode control', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'POST') {
      return new Response('{}', { status: 202 });
    }
    return new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  };
  try {
    const first = fixture(undefined, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    assert.ok(first.rotationService);
    assert.equal(first.rotationService.subtype, 'fan-rotation-toggle');
    assert.equal(first.accessory.services.filter((service) => service.type === 'Switch').length, 1);
    assert.equal(first.accessory.services.filter((service) => service.type === 'Fanv2').length, 1);
    const second = fixture(undefined, undefined, {}, {
      uri: 'https://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    assert.equal(second.rotationService?.subtype, first.rotationService.subtype);
    const fan = first.accessory.services.find((service) => service.type === 'Fanv2');
    assert.ok(fan);
    assert.equal(fan.characteristics.has(first.api.hap.Characteristic.SwingMode), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached fan SwingMode characteristic instance is removed when rotation is configured', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    if (init?.method === 'POST') {
      return new Response('{}', { status: 202 });
    }
    return new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  };
  try {
    const view = fixture(undefined, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    const fan = view.accessory.services.find((service) => service.type === 'Fanv2');
    assert.ok(fan);
    const swingModeCharacteristic = fan.getCharacteristic(view.api.hap.Characteristic.SwingMode);
    swingModeCharacteristic.updateValue(1);
    assert.equal(fan.characteristics.has(view.api.hap.Characteristic.SwingMode), true);

    new SimpleIrFanAccessory({ api: view.api, log: view.logs } as never, view.accessory as never, {
      name: view.accessory.displayName,
      manufacturer: 'Generic',
      model: 'IR Fan',
      serialNumber: 'FAN-001',
      endpoints: {
        getStatus: { uri: 'http://fan.example.test/state', method: 'GET' },
        rotate: { uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST' },
      },
    });

    assert.equal(fan.characteristics.has(view.api.hap.Characteristic.SwingMode), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rotation-only accessories refresh API-backed rotation state on startup', async () => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ input: String(input), init });
    return new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: true }), { status: 200 });
  };
  try {
    const view = fixture(undefined, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(requests[0]?.input, 'http://fan.example.test/state');
    assert.equal(requests[0]?.init?.method, 'GET');
    assert.equal(rotationCharacteristic(view).value, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rotation Switch reads isRotating and preserves its last state when status omits it', async () => {
  const originalFetch = globalThis.fetch;
  let status: { isOn: boolean; speed: number; isRotating?: boolean } = {
    isOn: false,
    speed: 0,
    isRotating: true,
  };
  globalThis.fetch = async () => new Response(JSON.stringify(status), { status: 200 });
  try {
    const view = fixture(undefined, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    const on = rotationCharacteristic(view);
    assert.equal(await on.read(), true);

    status = { isOn: false, speed: 0 };
    assert.equal(await on.read(), true);

    status = { isOn: false, speed: 0, isRotating: false };
    assert.equal(await on.read(), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rotation Switch toggles only when requested state differs and keeps accepted state', async () => {
  const originalFetch = globalThis.fetch;
  let isRotating = false;
  const pending: Array<(response: Response) => void> = [];
  const requests: Array<{ input: string; init?: RequestInit }> = [];
  globalThis.fetch = (input, init) => {
    if (init?.method === 'POST') {
      requests.push({ input: String(input), init });
      return new Promise<Response>((resolve) => {
        pending.push(resolve);
      });
    }
    return Promise.resolve(new Response(JSON.stringify({ isOn: false, speed: 0, isRotating }), { status: 200 }));
  };
  try {
    const view = fixture(undefined, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    const on = rotationCharacteristic(view);
    await on.write(false);
    assert.equal(requests.length, 0);
    const startWrite = on.write(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(on.value, true);
    assert.equal(requests.length, 1);
    assert.equal(requests[0]?.input, 'http://fan.example.test/api/v1/fan/rotate');
    assert.equal(requests[0]?.init?.method, 'POST');
    assert.equal(requests[0]?.init?.body, undefined);
    pending.shift()?.(new Response('ignored response body', { status: 202 }));
    await startWrite;
    assert.equal(on.value, true);

    isRotating = true;
    await on.write(true);
    assert.equal(requests.length, 1);

    const stopWrite = on.write(false);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(on.value, false);
    assert.equal(requests.length, 2);
    pending.shift()?.(new Response('ignored response body', { status: 202 }));
    await stopWrite;
    assert.equal(on.value, false);
    assert.equal(view.logs.info.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rotation writes coalesce per fan, failures map to HAP, and a later write retries', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolveRequest!: (response: Response) => void;
  globalThis.fetch = (_input, init) => {
    if (init?.method !== 'POST') {
      return Promise.resolve(new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 }));
    }
    calls += 1;
    if (calls === 1) {
      return new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      });
    }
    return Promise.resolve(new Response('{}', { status: 202 }));
  };
  try {
    const view = fixture(undefined, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    const on = rotationCharacteristic(view);
    const first = on.write(true);
    const second = on.write(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(calls, 1);
    resolveRequest(new Response('{}', { status: 500 }));
    await Promise.all([
      assert.rejects(first, (error: { hapStatus?: number }) => error.hapStatus === -70402),
      assert.rejects(second, (error: { hapStatus?: number }) => error.hapStatus === -70402),
    ]);
    assert.equal(on.value, false);
    assert.equal(view.logs.error.length, 1);
    await on.write(true);
    assert.equal(calls, 2);
    assert.equal(on.value, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rotation and reset remain independent on one fan, and cached rotation service is reconciled', async () => {
  const originalFetch = globalThis.fetch;
  const pending = new Map<string, (response: Response) => void>();
  globalThis.fetch = (input, init) => {
    const url = String(input);
    if (init?.method !== 'POST') {
      return Promise.resolve(new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 }));
    }
    return new Promise<Response>((resolve) => pending.set(url, resolve));
  };
  try {
    const view = fixture({ uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' }, undefined, {}, {
      uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST',
    });
    assert.equal(view.accessory.services.filter((service) => service.type === 'Switch').length, 2);
    assert.equal(view.resetService?.subtype, 'fan-reset');
    assert.equal(view.rotationService?.subtype, 'fan-rotation-toggle');

    const resetWrite = resetCharacteristic(view).write(true);
    const rotationWrite = rotationCharacteristic(view).write(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(resetCharacteristic(view).value, true);
    assert.equal(rotationCharacteristic(view).value, true);
    pending.get('http://fan.example.test/api/v1/fan/reset')?.(new Response('{}', { status: 202 }));
    pending.get('http://fan.example.test/api/v1/fan/rotate')?.(new Response('{}', { status: 202 }));
    await Promise.all([resetWrite, rotationWrite]);

    new SimpleIrFanAccessory({ api: view.api, log: view.logs } as never, view.accessory as never, {
      name: view.accessory.displayName, manufacturer: 'Generic', model: 'IR Fan', serialNumber: 'FAN-001',
      endpoints: {
        getStatus: { uri: 'http://fan.example.test/state', method: 'GET' },
        reset: { uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' },
      },
    });
    assert.equal(view.accessory.services.some((service) => service.subtype === 'fan-rotation-toggle'), false);
    assert.equal(view.accessory.services.some((service) => service.subtype === 'fan-reset'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rotation timeout uses configured value and defaults to five seconds', async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const delays: number[] = [];
  globalThis.setTimeout = ((handler: TimerHandler, timeout?: number, ...args: unknown[]) => {
    if (typeof timeout === 'number') {
      delays.push(timeout);
    }
    return originalSetTimeout(handler, timeout, ...args);
  }) as typeof setTimeout;
  globalThis.fetch = async () => new Response('{}', { status: 202 });
  try {
    await rotationCharacteristic(fixture(undefined, 1234, {}, {
      uri: 'http://custom.example.test/api/v1/fan/rotate', method: 'POST',
    })).write(true);
    await rotationCharacteristic(fixture(undefined, undefined, {}, {
      uri: 'http://default.example.test/api/v1/fan/rotate', method: 'POST',
    })).write(true);
    assert.deepEqual(delays, [1234, 1234, 1234, 5000, 5000, 5000]);
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }
});

test('different fans rotation writes remain independent', async () => {
  const originalFetch = globalThis.fetch;
  const pending = new Map<string, (response: Response) => void>();
  const rotationPosts: string[] = [];
  globalThis.fetch = (input, init) => {
    const url = String(input);
    if (init?.method !== 'POST') {
      return Promise.resolve(new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 }));
    }
    rotationPosts.push(url);
    return new Promise<Response>((resolve) => pending.set(url, resolve));
  };
  try {
    const first = fixture(undefined, undefined, { serialNumber: 'FAN-001' }, {
      uri: 'http://first.example.test/api/v1/fan/rotate', method: 'POST',
    });
    const second = fixture(undefined, undefined, { serialNumber: 'FAN-002' }, {
      uri: 'http://second.example.test/api/v1/fan/rotate', method: 'POST',
    });
    const firstWrite = rotationCharacteristic(first).write(true);
    const secondWrite = rotationCharacteristic(second).write(true);
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.deepEqual(rotationPosts.sort(), [
      'http://first.example.test/api/v1/fan/rotate',
      'http://second.example.test/api/v1/fan/rotate',
    ]);
    pending.get('http://first.example.test/api/v1/fan/rotate')?.(new Response('{}', { status: 202 }));
    pending.get('http://second.example.test/api/v1/fan/rotate')?.(new Response('{}', { status: 202 }));
    await Promise.all([firstWrite, secondWrite]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
