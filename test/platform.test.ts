import assert from 'node:assert/strict';
import { test } from 'node:test';

import { SimpleIrFanPlatform } from '../src/platform.js';

type Listener = () => void;

class FakeCharacteristic {
  value: unknown;

  onSet() {
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
}

class FakeService {
  readonly characteristics = new Map<unknown, FakeCharacteristic>();

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

  addService(type: unknown) {
    const service = new FakeService();
    this.services.set(type, service);
    return service;
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

test('omitted API base URL uses the approved localhost default', () => {
  const view = fixture();
  assert.equal(view.platform.apiBaseUrl, 'http://localhost:3000');
});

test('invalid supplied API base URL is contained and exposes no reset trigger', () => {
  const view = fixture({ name: 'Reset Fan', devices: [], apiBaseUrl: 'http://api.example.test/v1' });
  assert.doesNotThrow(() => view.launch());
  assert.equal(view.registered.length, 0);
  assert.equal(view.logs.error.length, 1);
});

test('supplied non-string and null API base URLs are contained', () => {
  for (const apiBaseUrl of [42, null]) {
    const view = fixture({ name: 'Reset Fan', devices: [], apiBaseUrl });
    assert.doesNotThrow(() => view.launch());
    assert.equal(view.registered.length, 0);
    assert.equal(view.logs.error.length, 1);
  }
});

test('credentialed API base URL is rejected without exposing its secret', () => {
  const suppliedApiBaseUrl = 'http://admin:secret123@api.example.test/';
  const view = fixture({ name: 'Reset Fan', devices: [], apiBaseUrl: suppliedApiBaseUrl });
  view.launch();

  assert.equal(view.registered.length, 0);
  const logged = view.logs.error.flat().join(' ');
  assert.equal(logged.includes('secret123'), false);
  assert.equal(logged.includes(suppliedApiBaseUrl), false);
});

test('valid startup registers exactly one stable reset accessory', () => {
  const first = fixture({ name: 'Reset Fan', devices: [], apiBaseUrl: 'http://one.example.test/' });
  first.launch();
  assert.equal(first.registered.length, 1);
  assert.equal(first.registered[0].displayName, 'Reset Fan');
  assert.ok(first.registered[0].services.has(first.api.hap.Service.Switch));

  const second = fixture({ name: 'Reset Fan', devices: [], apiBaseUrl: 'https://two.example.test' });
  second.launch();
  assert.equal(second.registered[0].UUID, first.registered[0].UUID);
});

test('repeated discovery does not duplicate reset registration', () => {
  const view = fixture();
  view.launch();
  view.platform.discoverDevices();
  assert.equal(view.registered.length, 1);
});

test('restores the stable reset accessory and refreshes its configured name', () => {
  const view = fixture({ name: 'Current Name', devices: [] });
  const cached = new FakePlatformAccessory('Cached Name', view.api.hap.uuid.generate('fan-reset-trigger'));
  cached.context.device = { exampleDisplayName: 'Old Name', keep: 'value' };
  view.platform.configureAccessory(cached as never);
  view.launch();

  assert.equal(view.registered.length, 0);
  assert.equal(cached.displayName, 'Current Name');
  assert.deepEqual(cached.context.device, { exampleDisplayName: 'Current Name', keep: 'value' });
  assert.deepEqual(view.updated, [cached]);
});

test('removes cached accessories not present in the rebased configuration', () => {
  const view = fixture();
  for (const [uuid, name] of [['uuid:ABCD', 'Bedroom'], ['uuid:EFGH', 'Kitchen'], ['uuid:IJKL', 'Backyard']] as const) {
    view.platform.configureAccessory(new FakePlatformAccessory(name, uuid) as never);
  }
  view.launch();

  assert.equal(view.registered.length, 1);
  assert.deepEqual(view.unregistered.map((accessory) => accessory.UUID).sort(), ['uuid:ABCD', 'uuid:EFGH', 'uuid:IJKL']);
});

test('configured fan accessories remain registered alongside the reset trigger', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ isOn: false, speed: 0, isRotating: false }), { status: 200 });

  try {
    const view = fixture({
      name: 'SimpleIrFan',
      devices: [{
        name: 'Living Room Fan',
        manufacturer: 'Generic',
        model: 'IR Fan',
        serialNumber: 'FAN-001',
        endpoints: {
          getStatus: { uri: 'http://fan.example.test/state', method: 'GET' },
        },
      }],
    });
    view.launch();
    await Promise.resolve();

    assert.equal(view.registered.length, 2);
    const fan = view.registered.find((accessory) => accessory.displayName === 'Living Room Fan');
    assert.ok(fan);
    assert.equal(fan.category, view.api.hap.Categories.FAN);
    assert.ok(fan.services.has(view.api.hap.Service.Fanv2));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
