import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const workflowPath = join(projectRoot, '.github', 'workflows', 'publish.yml');

function workflow(): string {
  assert.ok(existsSync(workflowPath), 'publish.yml must exist');
  return readFileSync(workflowPath, 'utf8');
}

function workflowLines(source: string): string[] {
  return source.split(/\r?\n/);
}

function stepBlock(source: string, stepName: string): string {
  const lines = workflowLines(source);
  const start = lines.findIndex((line) => line.trim() === `- name: ${stepName}`);

  assert.ok(start >= 0, `workflow must include a "${stepName}" step`);

  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('      - name: ')) {
      end = index;
      break;
    }
  }

  return lines.slice(start, end).join('\n');
}

test('publish workflow is limited to pushed numeric release tags', () => {
  const source = workflow();

  assert.match(source, /on:\s*[\s\S]*push:/, 'workflow must trigger from push');
  assert.match(
    source,
    /tags:\s*\n(?:[^\S\r\n]*.*\n)*?[^\S\r\n]*-\s*["']?\[0-9\]\*\.\[0-9\]\*\.\[0-9\]\*["']?/m,
    'workflow must use the coarse numeric release tag filter',
  );
  assert.doesNotMatch(source, /pull_request:/, 'workflow must not trigger pull requests');
  assert.doesNotMatch(source, /branches:/, 'workflow must not trigger branch pushes');
  assert.doesNotMatch(source, /workflow_dispatch:/, 'workflow must not be manually dispatched');
  assert.doesNotMatch(source, /schedule:/, 'workflow must not be scheduled');
});

test('publish workflow uses read-only contents, serialized tags, and a single Node 22 publish job', () => {
  const source = workflow();
  const checkoutStep = stepBlock(source, 'Check out release tag');
  const runnerLines = workflowLines(source).filter((line) => /^\s+runs-on:/.test(line));

  assert.deepEqual(
    runnerLines.map((line) => line.trim()),
    ['runs-on: ubuntu-slim'],
    'release workflow must use exactly the ubuntu-slim runner',
  );
  assert.match(source, /permissions:\s*\n\s+contents:\s*read\b/);
  assert.match(source, /concurrency:\s*[\s\S]*group:\s*publish-forgejo-\$\{\{\s*github\.ref\s*\}\}[\s\S]*cancel-in-progress:\s*false/);
  assert.match(checkoutStep, /uses:\s*actions\/checkout@v7\b/);
  assert.match(checkoutStep, /ref:\s*\$\{\{\s*github\.ref\s*\}\}/);
  assert.doesNotMatch(checkoutStep, /github\.ref_name/);
  assert.doesNotMatch(source, /^\s+strategy:/m, 'publish workflow must not use a job matrix');
  assert.doesNotMatch(source, /matrix\.node-version/);
  assert.match(source, /name:\s*Use Node\.js 22/);
  assert.match(source, /actions\/setup-node@v6[\s\S]*node-version:\s*['"]?22(?:\.x)?['"]?/);
  assert.match(
    source,
    /run:\s*npm ci --registry=https:\/\/registry\.npmjs\.org\/?\s*$/m,
    'dependency installation must bypass the authenticated Forgejo publish registry',
  );
});

test('build and publish workflows use Node 24-based official actions', () => {
  const publishSource = workflow();
  const buildSource = readFileSync(join(projectRoot, '.github', 'workflows', 'build.yml'), 'utf8');

  for (const source of [buildSource, publishSource]) {
    assert.match(source, /uses:\s*actions\/checkout@v7\b/);
    assert.doesNotMatch(source, /uses:\s*actions\/checkout@v(?:4|5|6)\b/);
  }

  assert.match(buildSource, /uses:\s*actions\/setup-node@v6\b/);
  assert.doesNotMatch(buildSource, /uses:\s*actions\/setup-node@v4\b/);
  assert.match(publishSource, /uses:\s*actions\/setup-node@v6\b/);
});

test('publish workflow passes the exact tag and token only to the publish command', () => {
  const source = workflow();
  const publishStep = stepBlock(source, 'Publish to Forgejo');
  const outsidePublishStep = source.replace(publishStep, '');

  assert.match(source, /RELEASE_TAG:\s*\$\{\{\s*github\.ref_name\s*\}\}/);
  assert.match(source, /NODE_AUTH_TOKEN:\s*\$\{\{\s*secrets\.FORGEJO_PACKAGE_TOKEN\s*\}\}/);
  assert.match(source, /run:\s*npm run publish:forgejo\b/);
  assert.match(publishStep, /RELEASE_TAG:/);
  assert.match(publishStep, /NODE_AUTH_TOKEN:/);
  assert.match(publishStep, /run:\s*npm run publish:forgejo\b/);
  assert.doesNotMatch(outsidePublishStep, /RELEASE_TAG|NODE_AUTH_TOKEN|FORGEJO_PACKAGE_TOKEN/);
});

test('publish workflow remains isolated and has no mutating or insecure release behavior', () => {
  const source = workflow();
  const existingBuildWorkflow = readFileSync(join(projectRoot, '.github', 'workflows', 'build.yml'), 'utf8');

  assert.notEqual(source.trim(), existingBuildWorkflow.trim());
  assert.doesNotMatch(source, /npm audit fix\b/);
  assert.doesNotMatch(source, /curl\s+-k\b|NODE_TLS_REJECT_UNAUTHORIZED\s*[:=]\s*['"]?0|strict-ssl\s*[:=]\s*false/);
  assert.doesNotMatch(source, /git\s+(tag|push|commit)\b|force-update|force push/i);
  assert.doesNotMatch(source, /npm\s+(unpublish|deprecate)\b|delete-package|overwrite|retry/i);
});
