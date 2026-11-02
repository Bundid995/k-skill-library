import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 10 * 1024 * 1024;
export const CATEGORIES = ['Development', 'Writing', 'Research', 'Design', 'Productivity', 'Other'];
const basenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(md|zip)$/i;

function text(value, key, max, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || (!allowEmpty && !value.trim())) {
    throw new Error(`Invalid ${key}: expected ${allowEmpty ? 'a' : 'a nonempty'} string up to ${max} characters.`);
  }
}

export function validateEntry(entry) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('Invalid catalog entry.');
  text(entry.id, 'id', 100);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(entry.id)) throw new Error('Invalid id.');
  text(entry.name, 'name', 100);
  text(entry.description, 'description', 500);
  if (!CATEGORIES.includes(entry.category)) throw new Error('Invalid category.');
  text(entry.usage, 'usage', 12000, true);
  if (!Array.isArray(entry.providers) || entry.providers.length > 20) throw new Error('Invalid providers.');
  for (const provider of entry.providers) text(provider, 'provider', 80);
  if (new Set(entry.providers).size !== entry.providers.length) throw new Error('Duplicate providers.');
  text(entry.filename, 'filename', 180);
  if (/[\\/\x00-\x1f]/.test(entry.filename) || !/\.(md|zip)$/i.test(entry.filename)) throw new Error('Invalid filename.');
  text(entry.file, 'file', 180);
  if (!basenamePattern.test(entry.file) || entry.file.includes('..')) throw new Error('Invalid file: use a safe basename without traversal.');
  text(entry.createdAt, 'createdAt', 40);
  if (!/^\d{4}-\d\d-\d\dT/.test(entry.createdAt) || !Number.isFinite(Date.parse(entry.createdAt))) throw new Error('Invalid createdAt.');
}

async function directoryWithoutSymlinks(directory, { create = false } = {}) {
  if (create) await fs.mkdir(directory, { recursive: true });
  const stat = await fs.lstat(directory);
  if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error(`Expected a real directory, no symlinks: ${directory}`);
}

export async function readCatalog(root) {
  root = path.resolve(root);
  await directoryWithoutSymlinks(root);
  await directoryWithoutSymlinks(path.join(root, 'content'));
  const manifest = path.join(root, 'content', 'catalog.json');
  const stat = await fs.lstat(manifest);
  if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Manifest must be a regular file, no symlinks.');
  const entries = JSON.parse(await fs.readFile(manifest, 'utf8'));
  if (!Array.isArray(entries)) throw new Error('Catalog must be an array.');
  const ids = new Set(), files = new Set();
  for (const entry of entries) {
    validateEntry(entry);
    if (ids.has(entry.id)) throw new Error(`Duplicate id: ${entry.id}`);
    if (files.has(entry.file.toLowerCase())) throw new Error(`Duplicate file: ${entry.file}`);
    ids.add(entry.id); files.add(entry.file.toLowerCase());
  }
  return entries;
}

export async function buildCatalog(root, output = path.join(root, 'public')) {
  root = path.resolve(root); output = path.resolve(output);
  const relative = path.relative(root, output);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || ['content', 'scripts', 'tests'].includes(relative.split(path.sep)[0])) {
    throw new Error('Output must be a generated directory within the project, outside content/scripts/tests.');
  }
  const entries = await readCatalog(root);
  const sourceDir = path.join(root, 'content', 'files');
  await directoryWithoutSymlinks(sourceDir);
  const verified = [];
  for (const entry of entries) {
    const source = path.join(sourceDir, entry.file);
    const stat = await fs.lstat(source);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error(`Skill must be a regular file, no symlinks: ${entry.file}`);
    if (!stat.size || stat.size > MAX_BYTES) throw new Error(`Skill must be nonempty and at most 10 MiB: ${entry.file}`);
    const bytes = await fs.readFile(source);
    if (!bytes.length || bytes.length > MAX_BYTES) throw new Error(`Invalid skill size: ${entry.file}`);
    verified.push({ entry, bytes });
  }
  // Check every output ancestor before creating or cleaning generated artifacts.
  let current = root;
  for (const component of relative.split(path.sep)) {
    current = path.join(current, component);
    await directoryWithoutSymlinks(current, { create: true });
  }
  const downloads = path.join(output, 'downloads');
  await directoryWithoutSymlinks(downloads, { create: true });
  const previous = await fs.readdir(downloads, { withFileTypes: true });
  for (const item of previous) {
    if (!item.isFile() || item.isSymbolicLink()) throw new Error('Generated downloads contains an unexpected directory or symlink.');
  }
  const catalogPath = path.join(output, 'catalog.json');
  try {
    const stat = await fs.lstat(catalogPath);
    if (stat.isSymbolicLink() || !stat.isFile()) throw new Error('Output catalog must be a regular file.');
  } catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const item of previous) await fs.unlink(path.join(downloads, item.name));
  const items = [];
  for (const { entry, bytes } of verified) {
    await fs.writeFile(path.join(downloads, entry.file), bytes, { flag: 'wx' });
    const { id, name, description, category, usage, providers, filename, createdAt } = entry;
    items.push({ id, name, description, category, usage, providers, filename, createdAt, size: bytes.length, download: `downloads/${entry.file}` });
  }
  const result = { items, cursor: null };
  await fs.writeFile(catalogPath, JSON.stringify(result, null, 2) + '\n');
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  buildCatalog(root).then(result => console.log(`Built ${result.items.length} published skills.`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
