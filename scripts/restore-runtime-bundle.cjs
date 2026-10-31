'use strict';

const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const ROOT = path.resolve(__dirname, '..');
const PARTS = [1, 2, 3].map(n => path.join(ROOT, `runtime.bundle.part${String(n).padStart(2, '0')}`));
const EXPECTED = [
  'engine/dist/data/projects.json',
  'public/index.html',
  'public/app.js',
  'public/style.css'
];
const MAX_FILE_SIZE = 2 * 1024 * 1024;

function tarString(header, start, length) {
  const field = header.subarray(start, start + length);
  const end = field.indexOf(0);
  return field.subarray(0, end < 0 ? field.length : end).toString('utf8');
}

function tarOctal(header, start, length) {
  const value = tarString(header, start, length).trim();
  if (!value) return 0;
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error('Invalid tar entry size');
  return parsed;
}

function extractExpectedFiles(archiveBytes) {
  const found = new Map();
  let offset = 0;

  while (offset + 512 <= archiveBytes.length) {
    const header = archiveBytes.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;

    const name = tarString(header, 0, 100);
    const prefix = tarString(header, 345, 155);
    const entryName = prefix ? `${prefix}/${name}` : name;
    const size = tarOctal(header, 124, 12);
    const type = header[156];
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;

    if (size > MAX_FILE_SIZE || dataEnd > archiveBytes.length) {
      throw new Error(`Invalid or oversized bundle entry: ${entryName}`);
    }
    if (EXPECTED.includes(entryName)) {
      if (type !== 0 && type !== 48) throw new Error(`Expected a regular file: ${entryName}`);
      if (entryName.startsWith('/') || entryName.split('/').includes('..')) {
        throw new Error(`Unsafe bundle path: ${entryName}`);
      }
      found.set(entryName, Buffer.from(archiveBytes.subarray(dataStart, dataEnd)));
    }

    offset = dataStart + Math.ceil(size / 512) * 512;
  }

  const missing = EXPECTED.filter(name => !found.has(name));
  if (missing.length) throw new Error('Bundle is missing required files: ' + missing.join(', '));

  const projects = JSON.parse(found.get('engine/dist/data/projects.json').toString('utf8'));
  if (!Array.isArray(projects) || projects.length !== 10 ||
      projects.some(project => !project || !/^PROJ_\\d{2}$/.test(project.id || ''))) {
    throw new Error('Bundled project data failed validation (expected 10 project records)');
  }
  return found;
}

function restoreRuntimeBundle({ checkOnly = false, force = false } = {}) {
  const missing = EXPECTED.filter(name => !fs.existsSync(path.join(ROOT, name)));
  if (!checkOnly && !force && missing.length === 0) {
    console.log('Runtime source and project data are already present; nothing to restore.');
    return;
  }

  const encoded = PARTS.map(file => {
    if (!fs.existsSync(file)) throw new Error(`Missing runtime bundle part: ${path.basename(file)}`);
    return fs.readFileSync(file, 'ascii').trim();
  }).join('');
  const compressed = Buffer.from(encoded, 'base64');
  const archiveBytes = zlib.gunzipSync(compressed);
  const files = extractExpectedFiles(archiveBytes);

  if (checkOnly) {
    console.log(`Runtime bundle verified: ${files.size} files, 10 project records.`);
    return;
  }

  const targets = force ? EXPECTED : missing;
  for (const name of targets) {
    const target = path.join(ROOT, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, files.get(name), { flag: force ? 'w' : 'wx' });
    console.log(`Restored ${name} (${files.get(name).length} bytes)`);
  }
}

if (require.main === module) {
  try {
    restoreRuntimeBundle({
      checkOnly: process.argv.includes('--check'),
      force: process.argv.includes('--force')
    });
  } catch (error) {
    console.error('Runtime bundle restoration failed:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { restoreRuntimeBundle, extractExpectedFiles };
