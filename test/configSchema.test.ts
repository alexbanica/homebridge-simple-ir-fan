import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

import type { FanEndpoints } from '../src/dtos/FanEndpoints.js';
import { PLATFORM_NAME, PLUGIN_NAME } from '../src/settings.js';

type JsonObject = Record<string, unknown>;

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');
const externalSchema = JSON.parse(readFileSync(join(projectRoot, 'config.schema.json'), 'utf8')) as JsonObject;
const packageJson = JSON.parse(readFileSync(join(projectRoot, 'package.json'), 'utf8')) as JsonObject;
const embeddedSchema = ((packageJson.homebridge as JsonObject).schema as JsonObject).schema as JsonObject;
const example = JSON.parse(readFileSync(join(projectRoot, 'config.example.json'), 'utf8')) as JsonObject;

test('configuration selects the scoped plugin when the platform alias is duplicated', () => {
  const packageName = packageJson.name as string;
  const qualifiedPlatformName = `${packageName}.${PLATFORM_NAME}`;
  const externalPlatform = ((externalSchema.schema as JsonObject).properties as JsonObject).platform as JsonObject;
  const homebridge = packageJson.homebridge as JsonObject;

  assert.equal(PLUGIN_NAME, packageName, 'runtime plugin identifier must match package.json');
  assert.equal(externalSchema.pluginAlias, PLATFORM_NAME);
  assert.equal(homebridge.alias, PLATFORM_NAME);
  assert.equal(homebridge.platform, PLATFORM_NAME);
  assert.equal(externalPlatform.const, qualifiedPlatformName);
  assert.equal(externalPlatform.default, qualifiedPlatformName);
  assert.equal(example.platform, qualifiedPlatformName);
});

const fanEndpointsCompileTimeCheck = {
  getStatus: { uri: 'http://fan.example.test/api/ventilator/state', method: 'GET' },
  reset: { uri: 'http://fan.example.test/api/v1/fan/reset', method: 'POST' },
  rotate: { uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST' },
} satisfies FanEndpoints;
void fanEndpointsCompileTimeCheck;

const legacyStartRotationFanEndpointsCompileTimeCheck: FanEndpoints = {
  getStatus: { uri: 'http://fan.example.test/api/ventilator/state', method: 'GET' },
  // @ts-expect-error legacy startRotation must not be assignable to FanEndpoints
  startRotation: { uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST' },
};
void legacyStartRotationFanEndpointsCompileTimeCheck;

const legacyStopRotationFanEndpointsCompileTimeCheck: FanEndpoints = {
  getStatus: { uri: 'http://fan.example.test/api/ventilator/state', method: 'GET' },
  // @ts-expect-error legacy stopRotation must not be assignable to FanEndpoints
  stopRotation: { uri: 'http://fan.example.test/api/v1/fan/rotate', method: 'POST' },
};
void legacyStopRotationFanEndpointsCompileTimeCheck;

function deviceProperties(schema: JsonObject): JsonObject {
  const properties = schema.properties as JsonObject;
  const devices = properties.devices as JsonObject;
  return (devices.items as JsonObject).properties as JsonObject;
}

function resetSchema(schema: JsonObject): JsonObject {
  const endpoints = deviceProperties(schema).endpoints as JsonObject;
  const reset = ((endpoints.properties as JsonObject).reset) as JsonObject | undefined;
  assert.ok(reset, 'devices[].endpoints.reset must be declared');
  return reset;
}

function rotateSchema(schema: JsonObject): JsonObject {
  const endpoints = deviceProperties(schema).endpoints as JsonObject;
  const rotate = ((endpoints.properties as JsonObject).rotate) as JsonObject | undefined;
  assert.ok(rotate, 'devices[].endpoints.rotate must be declared');
  return rotate;
}

function resetUriPattern(device: JsonObject): string {
  const endpoints = device.endpoints as JsonObject;
  const reset = ((endpoints.properties as JsonObject).reset) as JsonObject;
  const uri = reset.properties as JsonObject;
  return (uri.uri as JsonObject).pattern as string;
}

function rotateUriPattern(device: JsonObject): string {
  const endpoints = device.endpoints as JsonObject;
  const rotate = ((endpoints.properties as JsonObject).rotate) as JsonObject;
  const uri = rotate.properties as JsonObject;
  return (uri.uri as JsonObject).pattern as string;
}

function deviceRequired(schema: JsonObject): string[] {
  const properties = schema.properties as JsonObject;
  const devices = properties.devices as JsonObject;
  return ((devices.items as JsonObject).required as string[]).slice().sort();
}

function endpointsRequired(schema: JsonObject): string[] {
  const endpoints = deviceProperties(schema).endpoints as JsonObject;
  return ((endpoints.required as string[] | undefined) ?? []).slice().sort();
}

function timeoutMsConstraints(schema: JsonObject): JsonObject {
  const timeoutMs = deviceProperties(schema).timeoutMs as JsonObject;
  return {
    type: timeoutMs.type,
    minimum: timeoutMs.minimum,
    default: timeoutMs.default,
    required: deviceRequired(schema).includes('timeoutMs'),
  };
}

function assertDeviceConfigurationContract(schema: JsonObject, label: string): void {
  const devices = (schema.properties as JsonObject).devices as JsonObject;
  const device = devices.items as JsonObject;
  const endpoints = (device.properties as JsonObject).endpoints as JsonObject;
  assert.equal(device.additionalProperties, false, `${label} device items must reject unknown fields`);
  assert.equal(endpoints.additionalProperties, false, `${label} endpoints must reject unknown fields`);
  assert.deepEqual(
    deviceRequired(schema),
    ['endpoints', 'manufacturer', 'model', 'name', 'serialNumber'],
    `${label} device required fields must match the runtime contract`,
  );
  assert.deepEqual(endpointsRequired(schema), ['getStatus'], `${label} endpoints required fields must match`);

  const timeoutMs = deviceProperties(schema).timeoutMs as JsonObject;
  assert.equal(timeoutMs.type, 'integer', `${label} timeoutMs must remain an integer`);
  assert.equal(timeoutMs.minimum, 1, `${label} timeoutMs must be at least one millisecond`);
  assert.equal(timeoutMs.default, 5000, `${label} timeoutMs must represent the five-second default`);
  assert.equal(
    deviceRequired(schema).includes('timeoutMs'),
    false,
    `${label} timeoutMs must be optional so runtime defaulting applies`,
  );
}

function assertResetContract(schema: JsonObject, label: string): void {
  const rootProperties = schema.properties as JsonObject;
  assert.equal('apiBaseUrl' in rootProperties, false, `${label} must remove top-level apiBaseUrl`);

  const reset = resetSchema(schema);
  assert.equal(reset.type, 'object', `${label} reset must be an object`);
  assert.deepEqual(reset.required, ['uri', 'method'], `${label} reset fields must be required`);
  assert.equal(reset.additionalProperties, false, `${label} reset must reject extra fields`);
  const resetProperties = reset.properties as JsonObject;
  const uri = resetProperties.uri as JsonObject;
  assert.deepEqual(Object.keys(resetProperties).sort(), ['method', 'uri']);
  assert.equal((resetProperties.method as JsonObject).const, 'POST', `${label} reset method must be POST`);
  assert.equal(uri.format, 'uri', `${label} reset URI must use URI format`);
  assert.equal(typeof uri.pattern, 'string', `${label} reset URI needs constraints`);

  const uriPattern = new RegExp(uri.pattern as string);
  for (const uri of [
    'http://fan.example.test/api/v1/fan/reset',
    'https://fan.example.test:8443/api/v1/fan/reset',
    'https://fan.example.test:65535/api/v1/fan/reset',
    'http://[::1]/api/v1/fan/reset',
    'https://[2001:db8::1]:8443/api/v1/fan/reset',
  ]) {
    assert.match(uri, uriPattern, `${label} should accept ${uri}`);
  }
  for (const uri of [
    'ftp://fan.example.test/api/v1/fan/reset',
    'http://fan.example.test/api/v1/fan/state',
    'http://fan.example.test/api/v1/fan/reset?token=secret',
    'http://fan.example.test/api/v1/fan/reset#fragment',
    'http://user:password@fan.example.test/api/v1/fan/reset',
    'http://:8443/api/v1/fan/reset',
    'http://fan.example.test:/api/v1/fan/reset',
    'http://fan.example.test:abc/api/v1/fan/reset',
    'http://fan.example.test:12x/api/v1/fan/reset',
    'http://fan.example.test:99999/api/v1/fan/reset',
  ]) {
    assert.doesNotMatch(uri, uriPattern, `${label} should reject ${uri}`);
  }
}

function assertRotateContract(schema: JsonObject, label: string): void {
  const rotate = rotateSchema(schema);
  assert.equal(rotate.type, 'object', `${label} rotate must be an object`);
  assert.deepEqual(rotate.required, ['uri', 'method'], `${label} rotate fields must be required`);
  assert.equal(rotate.additionalProperties, false, `${label} rotate must reject extra fields`);
  const rotateProperties = rotate.properties as JsonObject;
  assert.deepEqual(Object.keys(rotateProperties).sort(), ['method', 'uri']);
  const method = rotateProperties.method as JsonObject;
  const uri = rotateProperties.uri as JsonObject;
  assert.equal(method.const, 'POST', `${label} rotate method must be POST`);
  assert.equal(uri.format, 'uri', `${label} rotate URI must use URI format`);
  assert.equal(typeof uri.pattern, 'string', `${label} rotate URI needs constraints`);

  const uriPattern = new RegExp(uri.pattern as string);
  for (const value of [
    'http://fan.example.test/api/v1/fan/rotate',
    'https://fan.example.test:8443/api/v1/fan/rotate',
    'https://fan.example.test:65535/api/v1/fan/rotate',
    'http://[::1]/api/v1/fan/rotate',
    'https://[2001:db8::1]:8443/api/v1/fan/rotate',
  ]) {
    assert.match(value, uriPattern, `${label} should accept ${value}`);
  }
  for (const value of [
    'ftp://fan.example.test/api/v1/fan/rotate',
    'http://fan.example.test/api/v1/fan/state',
    'http://fan.example.test/api/v1/fan/rotate?token=secret',
    'http://fan.example.test/api/v1/fan/rotate#fragment',
    'http://user:password@fan.example.test/api/v1/fan/rotate',
    'http://:8443/api/v1/fan/rotate',
    'http://fan.example.test:/api/v1/fan/rotate',
    'http://fan.example.test:abc/api/v1/fan/rotate',
    'http://fan.example.test:12x/api/v1/fan/rotate',
    'http://fan.example.test:99999/api/v1/fan/rotate',
  ]) {
    assert.doesNotMatch(value, uriPattern, `${label} should reject ${value}`);
  }
}

test('external and package-embedded schemas expose the same strict reset contract', () => {
  const external = externalSchema.schema as JsonObject;
  assert.equal(external.additionalProperties, false, 'config.schema.json root must reject unknown fields');
  assert.equal(embeddedSchema.additionalProperties, false, 'package.json embedded schema root must reject unknown fields');
  assert.equal(
    external.additionalProperties,
    embeddedSchema.additionalProperties,
    'config.schema.json and package.json must enforce the same root strictness',
  );
  assertDeviceConfigurationContract(external, 'config.schema.json');
  assertDeviceConfigurationContract(embeddedSchema, 'package.json');
  assert.deepEqual(
    timeoutMsConstraints(external),
    timeoutMsConstraints(embeddedSchema),
    'config.schema.json and package.json must constrain timeoutMs identically',
  );
  assertResetContract(externalSchema.schema as JsonObject, 'config.schema.json');
  assertResetContract(embeddedSchema, 'package.json');
  assertRotateContract(external, 'config.schema.json');
  assertRotateContract(embeddedSchema, 'package.json');

  const externalEndpoints = (deviceProperties(external).endpoints as JsonObject).properties as JsonObject;
  const embeddedEndpoints = (deviceProperties(embeddedSchema).endpoints as JsonObject).properties as JsonObject;
  for (const legacyField of ['startRotation', 'stopRotation']) {
    assert.equal(legacyField in externalEndpoints, false, `config.schema.json must remove ${legacyField}`);
    assert.equal(legacyField in embeddedEndpoints, false, `package.json must remove ${legacyField}`);
  }
  const externalRotate = rotateSchema(external);
  const embeddedRotate = rotateSchema(embeddedSchema);
  assert.deepEqual(externalRotate.required, embeddedRotate.required, 'rotate required fields must match across schemas');
  assert.equal(externalRotate.additionalProperties, embeddedRotate.additionalProperties);
  assert.deepEqual(
    (externalRotate.properties as JsonObject).method,
    (embeddedRotate.properties as JsonObject).method,
    'rotate method constraints must match across schemas',
  );
  assert.deepEqual(
    (externalRotate.properties as JsonObject).uri,
    (embeddedRotate.properties as JsonObject).uri,
    'rotate URI constraints must match across schemas',
  );
});

test('reset is optional and the example configuration agrees with both schemas', () => {
  const externalDevice = deviceProperties(externalSchema.schema as JsonObject);
  const embeddedDevice = deviceProperties(embeddedSchema);
  assert.equal(((externalDevice.endpoints as JsonObject).required as string[] | undefined)?.includes('reset') ?? false, false);
  assert.equal(((embeddedDevice.endpoints as JsonObject).required as string[] | undefined)?.includes('reset') ?? false, false);
  assert.ok(Array.isArray(example.devices) && example.devices.length > 0);
  assert.equal('apiBaseUrl' in example, false, 'example must not use top-level apiBaseUrl');

  const resetDevices = (example.devices as JsonObject[]).filter((device) => {
    const endpoints = device.endpoints as JsonObject | undefined;
    return endpoints?.reset;
  });
  assert.ok(resetDevices.length > 0, 'example should demonstrate an optional reset endpoint');
  for (const device of resetDevices) {
    const reset = (device.endpoints as JsonObject).reset as JsonObject;
    assert.deepEqual(Object.keys(reset).sort(), ['method', 'uri']);
    assert.equal(reset.method, 'POST');
    assert.match(reset.uri as string, new RegExp(resetUriPattern(externalDevice)));
    assert.match(reset.uri as string, new RegExp(resetUriPattern(embeddedDevice)));
  }

  const externalEndpoints = (externalDevice.endpoints as JsonObject).properties as JsonObject;
  const embeddedEndpoints = (embeddedDevice.endpoints as JsonObject).properties as JsonObject;
  assert.equal(((externalDevice.endpoints as JsonObject).required as string[] | undefined)?.includes('rotate') ?? false, false);
  assert.equal(((embeddedDevice.endpoints as JsonObject).required as string[] | undefined)?.includes('rotate') ?? false, false);
  const rotateDevices = (example.devices as JsonObject[]).filter((device) => {
    const endpoints = device.endpoints as JsonObject | undefined;
    return endpoints?.rotate;
  });
  assert.ok(rotateDevices.length > 0, 'example should demonstrate an optional rotate endpoint');
  for (const device of rotateDevices) {
    const endpoints = device.endpoints as JsonObject;
    const rotate = endpoints.rotate as JsonObject;
    assert.deepEqual(Object.keys(rotate).sort(), ['method', 'uri']);
    assert.equal(rotate.method, 'POST');
    assert.match(rotate.uri as string, new RegExp(rotateUriPattern(externalDevice)));
    assert.match(rotate.uri as string, new RegExp(rotateUriPattern(embeddedDevice)));
    assert.equal('startRotation' in endpoints, false, 'example must remove startRotation');
    assert.equal('stopRotation' in endpoints, false, 'example must remove stopRotation');
  }
  assert.equal('startRotation' in externalEndpoints, false);
  assert.equal('stopRotation' in externalEndpoints, false);
  assert.equal('startRotation' in embeddedEndpoints, false);
  assert.equal('stopRotation' in embeddedEndpoints, false);
});
