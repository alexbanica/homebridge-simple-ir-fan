#!/usr/bin/env node
/* global console, process */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const registry = 'https://forgejo.alexlab.nl/api/packages/public/npm/';
const registryAuthKey = '//forgejo.alexlab.nl/api/packages/public/npm/:_authToken';
const packageName = '@alexlab/homebridge-simple-ir-fan';
const packedPackageName = 'alexlab-homebridge-simple-ir-fan';
const registryTarballName = 'homebridge-simple-ir-fan';
const allowedFiles = [
  /^package\.json$/,
  /^README(?:\.[^/]+)?$/,
  /^LICENSE(?:\.[^/]+)?$/,
  /^config\.schema\.json$/,
  /^dist(?:\/.*)?$/,
];
const strippedAuthEnvKeys = [
  'NODE_AUTH_TOKEN',
  'NPM_TOKEN',
  'npm_config__authToken',
  'npm_config_authToken',
  'NPM_CONFIG_USERCONFIG',
  'npm_config_userconfig',
];

class ReleaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ReleaseError';
  }
}

function fail(message) {
  throw new ReleaseError(message);
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function validateReleaseTag(tag) {
  const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(beta)([1-9]\d*))?$/u.exec(tag);
  if (!match) {
    fail(
      'RELEASE_TAG must be MAJOR.MINOR.PATCH or MAJOR.MINOR.PATCH-betaN, for example 1.2.3 or 1.2.3-beta1.',
    );
  }

  return { version: tag, distTag: match[4] === 'beta' ? 'beta' : 'latest' };
}

function buildBaseEnv() {
  const env = { ...process.env };

  for (const key of strippedAuthEnvKeys) {
    delete env[key];
  }

  return env;
}

function runNpm(args, { token, userConfig } = {}) {
  const env = buildBaseEnv();
  if (token !== undefined) {
    env.NODE_AUTH_TOKEN = token;
  }
  if (userConfig !== undefined) {
    env.NPM_CONFIG_USERCONFIG = userConfig;
  }

  const result = spawnSync('npm', args, {
    cwd: process.cwd(),
    env,
    encoding: 'utf8',
  });

  if (result.error) {
    fail(`npm ${args.join(' ')} failed to start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    const stderr = (result.stderr || '').trim();
    const stdout = (result.stdout || '').trim();
    const details = stderr || stdout ? `: ${stderr || stdout}` : '';
    fail(`npm ${args.join(' ')} failed with exit code ${result.status}${details}`);
  }

  return result.stdout ?? '';
}

function publishPackage(filename, distTag, token) {
  const authDirectory = mkdtempSync(join(tmpdir(), 'homebridge-simple-ir-fan-npm-auth-'));
  const userConfig = join(authDirectory, '.npmrc');

  try {
    writeFileSync(userConfig, `${registryAuthKey}=\${NODE_AUTH_TOKEN}\n`, { mode: 0o600 });
    runNpm(
      ['publish', filename, '--registry', registry, '--tag', distTag, '--ignore-scripts'],
      { token, userConfig },
    );
  } finally {
    rmSync(authDirectory, { recursive: true, force: true });
  }
}

function updatePackageVersion(version) {
  const packagePath = join(process.cwd(), 'package.json');
  const lockPath = join(process.cwd(), 'package-lock.json');
  const manifest = readJson(packagePath);
  const lockfile = readJson(lockPath);

  if (manifest.name !== packageName) {
    fail(`Unexpected package name ${manifest.name ?? '<missing>'}.`);
  }

  manifest.version = version;
  lockfile.version = version;

  if (!lockfile.packages || typeof lockfile.packages !== 'object') {
    lockfile.packages = {};
  }
  if (!lockfile.packages[''] || typeof lockfile.packages[''] !== 'object') {
    lockfile.packages[''] = {};
  }
  lockfile.packages[''].version = version;

  writeJson(packagePath, manifest);
  writeJson(lockPath, lockfile);
}

function parsePackOutput(stdout) {
  const text = stdout.trim();
  if (!text) {
    fail('npm pack --json produced no package metadata.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    fail(`Unable to parse npm pack output: ${error.message}`);
  }

  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed).flatMap(([key, value]) => {
      const normalizeEntry = (entry) => {
        if (!entry || typeof entry !== 'object') {
          fail('npm pack --json returned malformed package metadata.');
        }

        if (entry.name !== undefined && entry.name !== key) {
          fail(`npm pack --json entry name mismatch: expected ${key}, got ${String(entry.name)}.`);
        }

        return { ...entry, name: key };
      };

      if (Array.isArray(value)) {
        return value.map(normalizeEntry);
      }
      if (value && typeof value === 'object') {
        return [normalizeEntry(value)];
      }

      fail('npm pack --json returned malformed package metadata.');
    });
  }

  fail('npm pack --json must return an array or package-keyed object.');
}

function normalizePackedFiles(entry) {
  if (!Array.isArray(entry.files)) {
    fail('Packed metadata is missing file listings.');
  }

  return entry.files.map((file) => {
    let filePath;
    if (typeof file === 'string') {
      filePath = file;
    } else if (file && typeof file.path === 'string') {
      filePath = file.path;
    } else {
      fail('Packed file metadata is malformed.');
    }

    return filePath.replace(/^package\//u, '');
  });
}

function ensureAllowlistedContents(filePaths) {
  const unexpected = filePaths.filter((filePath) => !allowedFiles.some((pattern) => pattern.test(filePath)));
  if (unexpected.length > 0) {
    fail(`Packed tarball contains disallowed files: ${unexpected.join(', ')}`);
  }

  const hasPackageJson = filePaths.some((filePath) => filePath === 'package.json');
  const hasReadme = filePaths.some((filePath) => /^README(?:\.[^/]+)?$/u.test(filePath));
  const hasLicense = filePaths.some((filePath) => /^LICENSE(?:\.[^/]+)?$/u.test(filePath));
  const hasSchema = filePaths.some((filePath) => filePath === 'config.schema.json');
  const hasDist = filePaths.some((filePath) => filePath === 'dist' || filePath.startsWith('dist/'));

  if (!hasPackageJson || !hasReadme || !hasLicense || !hasSchema || !hasDist) {
    const missingContent = [
      `package.json=${hasPackageJson}`,
      `README=${hasReadme}`,
      `LICENSE=${hasLicense}`,
      `config.schema.json=${hasSchema}`,
      `dist=${hasDist}`,
    ].join(', ');
    fail(`Packed tarball is missing required content: ${missingContent}.`);
  }
}

function selectPackageEntry(entries, version) {
  const matching = entries.filter((entry) => entry && entry.name === packageName && entry.version === version);
  if (matching.length !== 1) {
    fail(`Expected exactly one packed entry for ${packageName}@${version}.`);
  }

  return matching[0];
}

function verifyPublishedPackage(version, distTag) {
  const stdout = runNpm(
    [
      'view',
      `${packageName}@${version}`,
      'name',
      'version',
      `dist-tags.${distTag}`,
      'dist.tarball',
      '--json',
      '--registry',
      registry,
    ],
  );

  const text = stdout.trim();
  if (!text) {
    fail('npm view returned no JSON output.');
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (error) {
    fail(`Unable to parse npm view output: ${error.message}`);
  }

  const entries = Array.isArray(data) ? data : [data];
  if (entries.length === 0 || entries.some((entry) => !entry || typeof entry !== 'object' || Array.isArray(entry))) {
    fail('npm view returned malformed package metadata.');
  }

  const metadata = Object.assign({}, ...entries);
  const actualName = metadata.name;
  const actualVersion = metadata.version;
  const actualDistTag = metadata[`dist-tags.${distTag}`] ?? metadata['dist-tags']?.[distTag];
  const actualTarball = metadata['dist.tarball'] ?? metadata.dist?.tarball;

  if (actualName !== packageName) {
    fail(`Published package name mismatch: expected ${packageName}, got ${String(actualName)}.`);
  }
  if (actualVersion !== version) {
    fail(`Published package version mismatch: expected ${version}, got ${String(actualVersion)}.`);
  }
  if (actualDistTag !== version) {
    fail(`Published ${distTag} dist-tag mismatch: expected ${version}, got ${String(actualDistTag)}.`);
  }
  if (typeof actualTarball !== 'string' || !actualTarball.endsWith(`/${registryTarballName}-${version}.tgz`)) {
    fail(`Published tarball mismatch: expected ${registryTarballName}-${version}.tgz, got ${actualTarball}.`);
  }
}

function main() {
  const releaseTag = process.env.RELEASE_TAG;
  if (!releaseTag) {
    fail('RELEASE_TAG is required.');
  }

  const token = process.env.NODE_AUTH_TOKEN;
  if (!token) {
    fail('NODE_AUTH_TOKEN is required for publish:forgejo.');
  }

  const { version, distTag } = validateReleaseTag(releaseTag);
  updatePackageVersion(version);

  runNpm(['test']);
  runNpm(['run', 'lint']);
  runNpm(['run', 'build']);

  const packOutput = runNpm(['pack', '--json']);
  const packEntries = parsePackOutput(packOutput);
  const packedEntry = selectPackageEntry(packEntries, version);
  const expectedFilename = `${packedPackageName}-${version}.tgz`;
  const packedTarballPath = join(process.cwd(), expectedFilename);

  if (packedEntry.filename !== expectedFilename) {
    fail(`Packed tarball filename mismatch: expected ${expectedFilename}, got ${packedEntry.filename ?? '<missing>'}.`);
  }

  try {
    const packedFiles = normalizePackedFiles(packedEntry);
    ensureAllowlistedContents(packedFiles);
    publishPackage(packedEntry.filename, distTag, token);
    verifyPublishedPackage(version, distTag);
  } finally {
    try {
      rmSync(packedTarballPath);
    } catch {
      // Cleanup is best-effort and must not hide publish or verification errors.
    }
  }
}

try {
  main();
} catch (error) {
  if (error instanceof ReleaseError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
