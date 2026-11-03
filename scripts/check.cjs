'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const sourceRoots = ['engine', 'server', 'public', 'ui', 'scripts', 'test', 'api'];
const sourceFiles = [];

function collectJavaScript(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      collectJavaScript(absolute);
    } else if (entry.isFile() && /\.(?:js|cjs)$/.test(entry.name)) {
      sourceFiles.push(absolute);
    }
  }
}

function fail(message) {
  console.error('CHECK FAILED: ' + message);
  process.exitCode = 1;
}

for (const directory of sourceRoots) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) {
    fail('Missing source directory: ' + directory);
    continue;
  }
  collectJavaScript(absolute);
}

for (const file of sourceFiles.sort()) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    encoding: 'utf8'
  });
  if (result.status !== 0) {
    fail(path.relative(root, file) + '\n' + (result.stderr || result.stdout || 'Syntax check failed'));
  }
}

function readJson(relativePath) {
  const absolute = path.join(root, relativePath);
  try {
    return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  } catch (error) {
    fail('Invalid JSON in ' + relativePath + ': ' + error.message);
    return null;
  }
}

const projects = readJson('engine/dist/data/projects.json');
const manifest = readJson('ui/cards-manifest.json');

if (Array.isArray(projects)) {
  if (projects.length !== 25) fail('Expected 25 project records; found ' + projects.length);
  const ids = projects.map(project => project && project.id);
  if (new Set(ids).size !== ids.length) fail('Project IDs must be unique');

  for (const id of ids) {
    if (typeof id !== 'string' || !/^PROJ_\d{2}$/.test(id)) {
      fail('Invalid project ID: ' + String(id));
      continue;
    }
    for (const directory of ['ui/cards', 'ui/cards-hd']) {
      const asset = path.join(root, directory, id + '.png');
      if (!fs.existsSync(asset)) fail('Missing original card asset: ' + path.relative(root, asset));
    }
  }
}

if (manifest && manifest.cards && typeof manifest.cards === 'object') {
  const manifestIds = Object.keys(manifest.cards);
  if (manifestIds.length !== 32) fail('Expected 32 source pages in the Canva card manifest; found ' + manifestIds.length);
  if (Array.isArray(projects)) {
    for (const project of projects) {
      if (!Object.hasOwn(manifest.cards, project.id)) {
        fail('Project catalog ID is missing from the Canva card manifest: ' + project.id);
      }
    }
  }
} else if (manifest) {
  fail('Card manifest must contain a cards object');
}

for (const asset of [
  'ui/cards/GREENCOIN.png',
  'ui/cards/ROLE_PROTECTOR.png',
  'ui/cards/ROLE_SABOTEUR.png',
  'ui/brand/green-trap-detective.png',
  'ui/ending.html',
  'ui/ending.css',
  'ui/motion.js',
  'ui/motion.css',
  'ui/endings/good.mp4',
  'ui/endings/bad.mp4',
  'ui/endings/good-poster.jpg',
  'ui/endings/bad-poster.jpg'
]) {
  if (!fs.existsSync(path.join(root, asset))) fail('Missing required asset: ' + asset);
}

if (process.exitCode) process.exit(process.exitCode);

console.log('Repository checks passed.');
console.log('JavaScript files checked: ' + sourceFiles.length);
console.log('Project records and original card assets checked: 25.');
