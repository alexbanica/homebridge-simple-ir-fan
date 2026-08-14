import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

const repository = existsSync(join(import.meta.dirname, '..', 'scripts'))
  ? join(import.meta.dirname, '..')
  : join(import.meta.dirname, '..', '..');
const command = join(repository, 'scripts', 'publish-forgejo.mjs');

type Invocation = { status: number | null; stdout: string; stderr: string };

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'forgejo-release-'));
  mkdirSync(join(root, 'dist'));
  writeFileSync(join(root, 'dist', 'index.js'), 'export default 1;\n');
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  writeFileSync(join(root, 'LICENSE'), 'license\n');
  writeFileSync(join(root, 'config.schema.json'), '{}\n');
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: '@alexlab/homebridge-simple-ir-fan', version: '1.0.0' }));
  writeFileSync(
    join(root, 'package-lock.json'),
    JSON.stringify({
      name: '@alexlab/homebridge-simple-ir-fan',
      version: '1.0.0',
      lockfileVersion: 3,
      packages: { '': { name: '@alexlab/homebridge-simple-ir-fan', version: '1.0.0' } },
    }),
  );
  const fakeBin = join(root, 'fake-bin');
  mkdirSync(fakeBin);
  writeFileSync(join(fakeBin, 'npm'), `#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const args = process.argv.slice(2);
const userConfig = process.env.NPM_CONFIG_USERCONFIG ?? null;
const userConfigContents = userConfig && fs.existsSync(userConfig) ? fs.readFileSync(userConfig, 'utf8') : null;
const userConfigMode = userConfig && fs.existsSync(userConfig) ? fs.statSync(userConfig).mode & 0o777 : null;
fs.appendFileSync(
  process.env.NPM_CALLS,
  JSON.stringify({ args, token: process.env.NODE_AUTH_TOKEN ?? null, userConfig, userConfigContents, userConfigMode }) + '\\n',
);
if (process.env.FAIL_NPM === args[0] || process.env.FAIL_NPM === args.slice(0, 2).join(' ')) process.exit(17);
if (args[0] === 'pack') {
  const version = process.env.PACK_VERSION || '1.2.3';
  const filename = 'alexlab-homebridge-simple-ir-fan-' + version + '.tgz';
  fs.writeFileSync(path.join(process.cwd(), filename), 'tarball\\n');
  const pathPrefix = process.env.PACK_PATH_PREFIX === 'unprefixed' ? '' : 'package/';
  const makePath = (relativePath) => pathPrefix + relativePath;
  const baseFiles = [
    makePath('package.json'),
    makePath('dist/index.js'),
    makePath('README.md'),
    makePath('LICENSE'),
    makePath('config.schema.json'),
  ];
  const forbidden = process.env.PACK_FORBIDDEN ? [{ path: makePath('test/secret.test.js') }] : [];
  const entry = {
    filename,
    name: '@alexlab/homebridge-simple-ir-fan',
    version,
    files: [...baseFiles, ...forbidden],
  };
  if (process.env.PACK_MISSING) {
    entry.files = entry.files.filter((file) => {
      const pathValue = typeof file === 'string' ? file : file.path;
      return !pathValue.endsWith(process.env.PACK_MISSING);
    });
  }
  if (process.env.PACK_SHAPE === 'object') {
    const payload = {
      '@alexlab/homebridge-simple-ir-fan': [entry],
    };
    if (process.env.PACK_EXTRA) {
      payload.other = [
        {
          filename: 'other-0.0.1.tgz',
          name: 'other',
          version: '0.0.1',
          files: [makePath('package.json')],
        },
      ];
    }
    process.stdout.write(JSON.stringify(payload) + '\\n');
  } else {
    const entries = process.env.PACK_EXTRA
      ? [{
          filename: 'other-0.0.1.tgz',
          name: 'other',
          version: '0.0.1',
          files: [makePath('package.json')],
        }]
      : [];
    entries.push(entry);
    process.stdout.write(JSON.stringify(entries) + '\\n');
  }
  process.exit(0);
}
if (args[0] === 'view') {
  if (process.env.VIEW_EMPTY === '1') {
    process.stdout.write('[]\\n');
    process.exit(0);
  }
  const version = process.env.VIEW_VERSION || '1.2.3';
  const distTag = args.find((arg) => arg.startsWith('dist-tags.'))?.slice('dist-tags.'.length) || 'latest';
  const distTagVersion = process.env.VIEW_DIST_TAG_VERSION || version;
  const tarball =
    process.env.VIEW_TARBALL ||
    'https://forgejo.alexlab.nl/api/packages/public/npm/@alexlab/homebridge-simple-ir-fan/-/homebridge-simple-ir-fan-' +
      version +
      '.tgz';
  const name = process.env.VIEW_NAME || '@alexlab/homebridge-simple-ir-fan';
  process.stdout.write(JSON.stringify([
    { name },
    { version },
    { ['dist-tags.' + distTag]: distTagVersion },
    { 'dist.tarball': tarball },
  ]) + '\\n');
  process.exit(0);
}
`, { mode: 0o755 });
  writeFileSync(join(fakeBin, 'git'), `#!/usr/bin/env node
const fs = require('node:fs');
fs.appendFileSync(process.env.GIT_CALLS, JSON.stringify(process.argv.slice(2)) + '\\n');
`, { mode: 0o755 });
  return { root, fakeBin, calls: join(root, 'calls.log'), gitCalls: join(root, 'git-calls.log') };
}

function tarballPath(root: string, version: string) {
  return join(root, `alexlab-homebridge-simple-ir-fan-${version}.tgz`);
}

function readCalls(path: string) {
  return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as {
    args: string[];
    token: string | null;
    userConfig: string | null;
    userConfigContents: string | null;
    userConfigMode: number | null;
  });
}

function run(root: string, env: Record<string, string | undefined>): Invocation {
  const childEnv: NodeJS.ProcessEnv = { ...process.env, GIT_CALLS: join(root, 'git-calls.log') };
  delete childEnv.NODE_TEST_CONTEXT;
  delete childEnv.NODE_TEST_WORKER_ID;
  delete childEnv.RELEASE_TAG;
  delete childEnv.NODE_AUTH_TOKEN;

  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete childEnv[key];
    } else {
      childEnv[key] = value;
    }
  }

  const result = spawnSync(process.execPath, [command], {
    cwd: root,
    env: childEnv,
    encoding: 'utf8',
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

test('rejects a missing release tag before invoking npm or changing manifests', () => {
  const view = fixture();
  const before = readFileSync(join(view.root, 'package.json'), 'utf8');
  const result = run(view.root, { NODE_AUTH_TOKEN: 'secret', PATH: `${view.fakeBin}:${process.env.PATH}`, NPM_CALLS: view.calls });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /RELEASE_TAG/i);
  assert.equal(existsSync(view.calls), false);
  assert.equal(readFileSync(join(view.root, 'package.json'), 'utf8'), before);
});

test('rejects every unsupported tag class named by the release contract', () => {
  for (const tag of ['v1.0.0', 'release-1.0.0', '01.0.0', '1.0', '1.0.0-beta.1', '1.0.0-beta0', '1.0.0+build.1']) {
    const view = fixture();
    const result = run(view.root, { RELEASE_TAG: tag, NODE_AUTH_TOKEN: 'secret', PATH: `${view.fakeBin}:${process.env.PATH}`, NPM_CALLS: view.calls });
    assert.notEqual(result.status, 0, tag);
    assert.equal(existsSync(view.calls), false, tag);
  }
});

test('requires authentication before release work begins', () => {
  const view = fixture();
  const result = run(view.root, { RELEASE_TAG: '1.2.3', PATH: `${view.fakeBin}:${process.env.PATH}`, NPM_CALLS: view.calls });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}${result.stderr}`, /NODE_AUTH_TOKEN|token|auth/i);
  assert.equal(existsSync(view.calls), false);
});

test('derives the exact version, aligns package and lockfile, and scopes the token to publish', () => {
  const view = fixture();
  const result = run(view.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret-token',
    PACK_VERSION: '1.2.3',
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const pkg = JSON.parse(readFileSync(join(view.root, 'package.json'), 'utf8')) as { version: string };
  const lock = JSON.parse(readFileSync(join(view.root, 'package-lock.json'), 'utf8')) as { version: string; packages: { '': { version: string } } };
  assert.equal(pkg.version, '1.2.3');
  assert.equal(lock.version, '1.2.3');
  assert.equal(lock.packages[''].version, '1.2.3');
  const calls = readCalls(view.calls);
  const publish = calls.find((call) => call.args[0] === 'publish');
  assert.ok(publish);
  assert.equal(publish.token, 'secret-token');
  assert.equal(
    publish.userConfigContents,
    '//forgejo.alexlab.nl/api/packages/public/npm/:_authToken=${NODE_AUTH_TOKEN}\n',
  );
  assert.equal(publish.userConfigMode, 0o600);
  assert.ok(calls.filter((call) => call.args[0] !== 'publish').every((call) => call.token === null));
  assert.ok(calls.filter((call) => call.args[0] !== 'publish').every((call) => call.userConfig === null));
  assert.ok(calls.some((call) => call.args.includes('https://forgejo.alexlab.nl/api/packages/public/npm/')));
  assert.ok(calls.some((call) => call.args.includes('--tag') && call.args.includes('latest')));
  assert.ok(calls.some((call) => call.args[0] === 'publish' && call.args.includes('--ignore-scripts')));
  assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false);
});

test('accepts stable tag examples as the exact package version', () => {
  for (const [tag, version] of [['0.1.0', '0.1.0'], ['1.0.0', '1.0.0'], ['12.34.56', '12.34.56']]) {
    const view = fixture();
    const result = run(view.root, {
      RELEASE_TAG: tag,
      NODE_AUTH_TOKEN: 'secret',
      PACK_VERSION: version,
      VIEW_VERSION: version,
      VIEW_DIST_TAG_VERSION: version,
      VIEW_TARBALL: `https://forgejo.alexlab.nl/api/packages/public/npm/@alexlab/homebridge-simple-ir-fan/-/homebridge-simple-ir-fan-${version}.tgz`,
      PATH: `${view.fakeBin}:${process.env.PATH}`,
      NPM_CALLS: view.calls,
    });
    assert.equal(result.status, 0, `${tag}: ${result.stdout}\n${result.stderr}`);
    assert.equal(JSON.parse(readFileSync(join(view.root, 'package.json'), 'utf8')).version, version);
  }
});

test('accepts beta tags as the exact package version and publishes them under the beta dist-tag', () => {
  const view = fixture();
  const version = '1.2.3-beta1';
  const result = run(view.root, {
    RELEASE_TAG: version,
    NODE_AUTH_TOKEN: 'secret',
    PACK_VERSION: version,
    VIEW_VERSION: version,
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.equal(JSON.parse(readFileSync(join(view.root, 'package.json'), 'utf8')).version, version);
  const publish = readCalls(view.calls).find((call) => call.args[0] === 'publish');
  assert.ok(publish);
  assert.ok(publish.args.includes('--tag') && publish.args.includes('beta'));
  const viewCall = readCalls(view.calls).find((call) => call.args[0] === 'view');
  assert.ok(viewCall?.args.includes('dist-tags.beta'));
});

test('rejects whitespace and extra-suffix tag variants before invoking npm', () => {
  for (const tag of [' 1.0.0', '1.0.0 ', '1.0.0\n', '1.0.0-extra', '1.0.0/foo', 'v1.0.0']) {
    const view = fixture();
    const result = run(view.root, {
      RELEASE_TAG: tag,
      NODE_AUTH_TOKEN: 'secret',
      PATH: `${view.fakeBin}:${process.env.PATH}`,
      NPM_CALLS: view.calls,
    });
    assert.notEqual(result.status, 0, tag);
    assert.equal(existsSync(view.calls), false, tag);
  }
});

test('selects the matching package from machine-readable npm pack output', () => {
  const view = fixture();
  const result = run(view.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret',
    PACK_EXTRA: '1',
    PACK_PATH_PREFIX: 'package',
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const calls = readCalls(view.calls);
  const publish = calls.find((call) => call.args[0] === 'publish');
  assert.ok(publish);
  assert.ok(publish.args.includes('alexlab-homebridge-simple-ir-fan-1.2.3.tgz'));
  assert.ok(!publish.args.includes('other-0.0.1.tgz'));
  assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false);
});

test('selects the matching package from package-keyed pack output with unprefixed paths', () => {
  const view = fixture();
  const result = run(view.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret',
    PACK_SHAPE: 'object',
    PACK_PATH_PREFIX: 'unprefixed',
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  const calls = readCalls(view.calls);
  const publish = calls.find((call) => call.args[0] === 'publish');
  assert.ok(publish);
  assert.ok(publish.args.includes('alexlab-homebridge-simple-ir-fan-1.2.3.tgz'));
  assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false);
});

test('rejects a packed file outside the approved allowlist before publishing', () => {
  const view = fixture();
  const result = run(view.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret',
    PACK_FORBIDDEN: '1',
    PACK_PATH_PREFIX: 'unprefixed',
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.notEqual(result.status, 0);
  const calls = readCalls(view.calls);
  assert.equal(calls.some((call) => call.args[0] === 'publish'), false);
  assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false);
});

test('rejects packed output that omits required package metadata, docs, license, schema, or dist files', () => {
  for (const missing of ['package.json', 'README.md', 'LICENSE', 'config.schema.json', 'dist/index.js']) {
    const view = fixture();
    const result = run(view.root, {
      RELEASE_TAG: '1.2.3',
      NODE_AUTH_TOKEN: 'secret',
      PACK_MISSING: missing,
      PACK_PATH_PREFIX: 'package',
      PATH: `${view.fakeBin}:${process.env.PATH}`,
      NPM_CALLS: view.calls,
    });
    assert.notEqual(result.status, 0, missing);
    const calls = readCalls(view.calls);
    assert.equal(calls.some((call) => call.args[0] === 'publish'), false, missing);
    assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false, missing);
  }
});

test('verifies published metadata and rejects empty or mismatched verification responses', () => {
  const success = fixture();
  const successResult = run(success.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret',
    PACK_VERSION: '1.2.3',
    PATH: `${success.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: success.calls,
  });
  assert.equal(successResult.status, 0, `${successResult.stdout}\n${successResult.stderr}`);
  assert.equal(existsSync(tarballPath(success.root, '1.2.3')), false);
  assert.ok(readCalls(success.calls).some((call) =>
    call.args[0] === 'view' &&
    call.args.includes('@alexlab/homebridge-simple-ir-fan@1.2.3') &&
    call.args.includes('--json')));

  for (const env of [
    { VIEW_EMPTY: '1' },
    { VIEW_DIST_TAG_VERSION: '9.9.9' },
    {
      VIEW_TARBALL:
        'https://forgejo.alexlab.nl/api/packages/public/npm/homebridge-simple-ir-fan/-/wrong-1.2.3.tgz',
    },
  ] as const) {
    const view = fixture();
    const result = run(view.root, {
      RELEASE_TAG: '1.2.3',
      NODE_AUTH_TOKEN: 'secret',
      PACK_VERSION: '1.2.3',
      PATH: `${view.fakeBin}:${process.env.PATH}`,
      NPM_CALLS: view.calls,
      ...env,
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}${result.stderr}`, /npm view|published package|dist-tag|tarball/i);
    assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false);
  }
});

test('propagates validation, build, pack, publish, and post-publish verification failures', () => {
  for (const failure of ['test', 'run lint', 'run build', 'pack', 'publish', 'view']) {
    const view = fixture();
    const result = run(view.root, {
      RELEASE_TAG: '1.2.3',
      NODE_AUTH_TOKEN: 'secret',
      PACK_VERSION: '1.2.3',
      FAIL_NPM: failure,
      PATH: `${view.fakeBin}:${process.env.PATH}`,
      NPM_CALLS: view.calls,
    });
    assert.notEqual(result.status, 0, failure);
    assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false, failure);
  }
});

test('does not delete, unpublish, or overwrite an existing package version', () => {
  const view = fixture();
  const result = run(view.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret',
    PACK_VERSION: '1.2.3',
    FAIL_NPM: 'publish',
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.notEqual(result.status, 0);
  const calls = readCalls(view.calls);
  assert.equal(calls.some((call) => /^(unpublish|delete|deprecate)$/.test(call.args[0])), false);
  assert.equal(calls.some((call) => call.args.includes('--force') || call.args.includes('--overwrite')), false);
  assert.equal(existsSync(tarballPath(view.root, '1.2.3')), false);
});

test('removes temporary authentication state after both success and failure', () => {
  for (const [extra, shouldFail] of [[{}, false], [{ FAIL_NPM: 'publish' }, true]] as const) {
    const view = fixture();
    const result = run(view.root, {
      RELEASE_TAG: '1.2.3',
      NODE_AUTH_TOKEN: 'secret',
      PACK_VERSION: '1.2.3',
      PATH: `${view.fakeBin}:${process.env.PATH}`,
      NPM_CALLS: view.calls,
      ...extra,
    });
    assert.equal(result.status === 0, !shouldFail);
    const authConfigPaths = readCalls(view.calls)
      .map((call) => call.userConfig)
      .filter((path): path is string => path !== null);
    assert.equal(authConfigPaths.length, 1);
    assert.ok(authConfigPaths.every((path) => !existsSync(path)));
    assert.deepEqual(readdirSync(view.root).filter((name) => name === '.npmrc' || name.includes('npm-auth')), []);
  }
});

test('does not perform git commit or tag activity and passes publish arguments without shell expansion', () => {
  const view = fixture();
  const result = run(view.root, {
    RELEASE_TAG: '1.2.3',
    NODE_AUTH_TOKEN: 'secret',
    PACK_VERSION: '1.2.3',
    PATH: `${view.fakeBin}:${process.env.PATH}`,
    NPM_CALLS: view.calls,
  });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  if (existsSync(view.gitCalls)) {
    const gitCalls = readFileSync(view.gitCalls, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as string[]);
    assert.equal(gitCalls.some((args) => args[0] === 'commit' || args[0] === 'tag'), false);
  }
  const calls = readCalls(view.calls);
  const publish = calls.find((call) => call.args[0] === 'publish');
  assert.ok(publish);
  assert.equal(publish.args.some((arg) => /[;&|`$]/.test(arg)), false);
});
