import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SimpleIrFanPlatform } from '../src/platform.js';

type Listener = () => void;

class FakeCharacteristic {
  value: unknown;
  private setter?: (value: unknown) => void | Promise<void>;

  onSet(handler: (value: unknown) => void | Promise<void>) {
    this.setter = handler;
    return this;
  }

  onGet() {
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
}

class FakeService {
  readonly characteristics = new Map<unknown, FakeCharacteristic>();

  constructor(readonly type?: unknown, readonly subtype?: string) {}

  setCharacteristic(type: unknown, value: unknown) {
    this.getCharacteristic(type).updateValue(value);
    return this;
  }

  updateCharacteristic(type: unknown, value: unknown) {
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

class FakePlatformAccessory {
  readonly context: Record<string, unknown> = {};
  readonly services = new Map<unknown, FakeService>();
  category?: number;

  constructor(public displayName: string, public readonly UUID: string) {
    this.services.set('AccessoryInformation', new FakeService());
  }

  getService(type: unknown) {
    return this.services.get(type);
  }

  addService(type: unknown, _displayName?: string, subtype?: string) {
    const service = new FakeService(type, subtype);
    this.services.set(type, service);
    return service;
  }

  removeService(service: FakeService) {
    for (const [type, current] of this.services) {
      if (current === service) {
        this.services.delete(type);
      }
    }
  }
}

function fixture(config: Record<string, unknown> = { name: 'Reset Fan', devices: [] }) {
  let launch: Listener | undefined;
  const registered: FakePlatformAccessory[] = [];
  const unregistered: FakePlatformAccessory[] = [];
  const updated: FakePlatformAccessory[] = [];
  const logs = { info: [] as unknown[][], error: [] as unknown[][] };
  const api = {
    hap: {
      Service: { Switch: 'Switch', Fanv2: 'Fanv2', AccessoryInformation: 'AccessoryInformation' },
      Characteristic: {
        Active: 'Active',
        RotationSpeed: 'RotationSpeed',
        SwingMode: 'SwingMode',
        On: 'On',
        Name: 'Name',
        Manufacturer: 'Manufacturer',
        Model: 'Model',
        SerialNumber: 'SerialNumber',
      },
      Categories: { FAN: 3 },
      HAPStatus: { SERVICE_COMMUNICATION_FAILURE: -70402 },
      HapStatusError: class extends Error {},
      uuid: { generate: (value: string) => `uuid:${value}` },
    },
    platformAccessory: FakePlatformAccessory,
    on: (event: string, listener: Listener) => {
      assert.equal(event, 'didFinishLaunching');
      launch = listener;
      return api;
    },
    registerPlatformAccessories: (_plugin: string, _platform: string, accessories: FakePlatformAccessory[]) => registered.push(...accessories),
    unregisterPlatformAccessories: (_plugin: string, _platform: string, accessories: FakePlatformAccessory[]) => unregistered.push(...accessories),
    updatePlatformAccessories: (accessories: FakePlatformAccessory[]) => updated.push(...accessories),
  };
  const log = {
    debug: () => undefined,
    info: (...args: unknown[]) => logs.info.push(args),
    error: (...args: unknown[]) => logs.error.push(args),
    warn: () => undefined,
  };
  const platform = new SimpleIrFanPlatform(log as never, config as never, api as never);

  return {
    platform,
    launch: () => {
      assert.ok(launch);
      launch();
    },
    registered,
    unregistered,
    updated,
    logs,
    api,
  };
}

const fanConfig = (name = 'Living Room Fan', reset = true, rotate = false) => ({
  name,
  manufacturer: 'Generic',
  model: 'IR Fan',
  serialNumber: 'FAN-001',
  endpoints: {
    getStatus: { uri: 'http://fan.example.test/state', method: 'GET' },
    ...(reset ? { reset: { uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' } } : {}),
    ...(rotate ? { rotate: { uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST' } } : {}),
  },
});

test('configured reset stays on the fan accessory and creates no separate accessory', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });

  try {
    const view = fixture({
      name: 'SimpleIrFan',
      devices: [fanConfig()],
    });
    view.launch();
    await Promise.resolve();

    assert.equal(view.registered.length, 1);
    const fan = view.registered.find((accessory) => accessory.displayName === 'Living Room Fan');
    assert.ok(fan);
    assert.equal(fan.category, view.api.hap.Categories.FAN);
    assert.ok(fan.services.has(view.api.hap.Service.Fanv2));
    assert.ok(fan.services.has(view.api.hap.Service.Switch));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fans without reset preserve fan registration and expose no reset service', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const view = fixture({ name: 'SimpleIrFan', devices: [fanConfig('Bedroom Fan', false)] });
    view.launch();
    await Promise.resolve();
    assert.equal(view.registered.length, 1);
    assert.ok(view.registered[0].services.has(view.api.hap.Service.Fanv2));
    assert.equal(view.registered[0].services.has(view.api.hap.Service.Switch), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('successful reset refreshes and pushes status for every configured fan accessory', async () => {
  const originalFetch = globalThis.fetch;
  const statusRequests: string[] = [];
  let resetRequests = 0;
  let refreshed = false;
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (init?.method === 'POST') {
      resetRequests += 1;
      refreshed = true;
      return new Response('{}', { status: 202 });
    }
    statusRequests.push(url);
    return new Response(JSON.stringify({
      isOn: refreshed,
      speed: refreshed ? (url.includes('bedroom') ? 2 : 1) : 0,
      isRotating: refreshed,
    }), { status: 200 });
  };

  try {
    const livingRoomFan = fanConfig();
    const bedroomFan = {
      ...fanConfig('Bedroom Fan', false, true),
      serialNumber: 'FAN-002',
      endpoints: {
        ...fanConfig('Bedroom Fan', false, true).endpoints,
        getStatus: { uri: 'http://bedroom.example.test/state', method: 'GET' },
      },
    };
    const view = fixture({ name: 'SimpleIrFan', devices: [livingRoomFan, bedroomFan] });
    view.launch();
    await new Promise<void>((resolve) => setImmediate(resolve));
    statusRequests.length = 0;

    const reset = view.registered[0]?.services.get(view.api.hap.Service.Switch);
    assert.ok(reset);
    await reset.getCharacteristic(view.api.hap.Characteristic.On).write(true);

    assert.equal(resetRequests, 1);
    assert.deepEqual(statusRequests.sort(), [
      'http://bedroom.example.test/state',
      'http://fan.example.test/state',
    ]);
    const livingRoomService = view.registered[0]?.services.get(view.api.hap.Service.Fanv2);
    const bedroomService = view.registered[1]?.services.get(view.api.hap.Service.Fanv2);
    assert.equal(livingRoomService?.getCharacteristic(view.api.hap.Characteristic.Active).value, 1);
    assert.equal(livingRoomService?.getCharacteristic(view.api.hap.Characteristic.RotationSpeed).value, 33);
    assert.equal(bedroomService?.getCharacteristic(view.api.hap.Characteristic.Active).value, 1);
    assert.equal(bedroomService?.getCharacteristic(view.api.hap.Characteristic.RotationSpeed).value, 66);
    assert.equal(
      view.registered[1]?.services.get(view.api.hap.Service.Switch)
        ?.getCharacteristic(view.api.hap.Characteristic.On).value,
      true,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached superseded global reset accessory is removed during reconciliation', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const view = fixture({ name: 'SimpleIrFan', devices: [fanConfig()] });
    const stale = new FakePlatformAccessory('Old Reset', view.api.hap.uuid.generate('fan-reset-trigger'));
    view.platform.configureAccessory(stale as never);
    view.launch();
    await Promise.resolve();
    assert.ok(view.unregistered.some((accessory) => accessory.UUID === stale.UUID));
    assert.equal(view.registered.some((accessory) => accessory.UUID === stale.UUID), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('fan UUID remains stable and cached fan registration is restored and removable', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const first = fixture({ name: 'SimpleIrFan', devices: [fanConfig()] });
    first.launch();
    await Promise.resolve();
    const uuid = first.api.hap.uuid.generate('FAN-001:Living Room Fan');
    const firstFan = first.registered.find((accessory) => accessory.displayName === 'Living Room Fan');
    assert.ok(firstFan);
    assert.equal(firstFan.UUID, uuid);

    const restored = fixture({ name: 'SimpleIrFan', devices: [fanConfig('Living Room Fan', false)] });
    const cached = new FakePlatformAccessory('Cached Fan', uuid);
    restored.platform.configureAccessory(cached as never);
    restored.launch();
    await Promise.resolve();
    assert.equal(restored.registered.length, 0);
    assert.equal(restored.unregistered.length, 0);

    const removed = fixture({ name: 'SimpleIrFan', devices: [] });
    removed.platform.configureAccessory(cached as never);
    removed.launch();
    assert.deepEqual(removed.unregistered.map((accessory) => accessory.UUID), [uuid]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached fan reset service is reconciled through platform lifecycle when reset is removed', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const view = fixture({ name: 'SimpleIrFan', devices: [fanConfig('Living Room Fan', false)] });
    const uuid = view.api.hap.uuid.generate('FAN-001:Living Room Fan');
    const cached = new FakePlatformAccessory('Living Room Fan', uuid);
    cached.services.set(view.api.hap.Service.Switch, new FakeService(view.api.hap.Service.Switch, 'fan-reset'));
    view.platform.configureAccessory(cached as never);
    view.launch();
    await Promise.resolve();

    assert.equal(cached.services.has(view.api.hap.Service.Fanv2), true);
    assert.equal(cached.services.has(view.api.hap.Service.Switch), false);
    assert.equal(view.unregistered.length, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached fan gains one stable reset service through platform lifecycle when reset is added', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const view = fixture({ name: 'SimpleIrFan', devices: [fanConfig()] });
    const uuid = view.api.hap.uuid.generate('FAN-001:Living Room Fan');
    const cached = new FakePlatformAccessory('Living Room Fan', uuid);
    view.platform.configureAccessory(cached as never);
    view.launch();
    await Promise.resolve();

    assert.equal(cached.services.get(view.api.hap.Service.Switch)?.subtype, 'fan-reset');
    assert.equal(cached.services.size, 3);
    view.platform.discoverDevices();
    assert.equal(cached.services.size, 3);
    assert.equal(cached.services.get(view.api.hap.Service.Switch)?.subtype, 'fan-reset');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('configured rotation stays on the fan accessory and creates no separate accessory', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const view = fixture({ name: 'SimpleIrFan', devices: [fanConfig('Living Room Fan', false, true)] });
    view.launch();
    await Promise.resolve();
    assert.equal(view.registered.length, 1);
    assert.equal(view.registered[0]?.UUID, view.api.hap.uuid.generate('FAN-001:Living Room Fan'));
    assert.equal(view.registered[0]?.services.get(view.api.hap.Service.Switch)?.subtype, 'fan-rotation-toggle');
    assert.equal(view.registered.some((accessory) => accessory.UUID === view.api.hap.uuid.generate('fan-rotation-trigger')), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('cached fan rotation service is removed or added through platform lifecycle without changing fan UUID', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });
  try {
    const uuid = `uuid:${'FAN-001:Living Room Fan'}`;
    const removed = fixture({ name: 'SimpleIrFan', devices: [fanConfig('Living Room Fan', false, false)] });
    const cached = new FakePlatformAccessory('Living Room Fan', uuid);
    cached.services.set(removed.api.hap.Service.Switch, new FakeService(removed.api.hap.Service.Switch, 'fan-rotation-toggle'));
    removed.platform.configureAccessory(cached as never);
    removed.launch();
    await Promise.resolve();
    assert.equal(cached.UUID, uuid);
    assert.equal(cached.services.has(removed.api.hap.Service.Switch), false);

    const added = fixture({ name: 'SimpleIrFan', devices: [fanConfig('Living Room Fan', false, true)] });
    added.platform.configureAccessory(cached as never);
    added.launch();
    await Promise.resolve();
    assert.equal(cached.UUID, uuid);
    assert.equal(cached.services.get(added.api.hap.Service.Switch)?.subtype, 'fan-rotation-toggle');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
