import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildCatalog, MAX_BYTES } from '../scripts/build-catalog.mjs';
import { addSkill } from '../scripts/add-skill.mjs';

async function fixture(t, entries = []) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'skill-catalog-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, 'content', 'files'), { recursive: true });
  await fs.writeFile(path.join(root, 'content', 'catalog.json'), JSON.stringify(entries));
  return root;
}
const entry = overrides => ({ id: 'example', name: 'Example', description: 'A useful skill.', category: 'Development', usage: 'Read the instructions.', providers: ['Codex'], filename: 'Original.md', file: 'example.md', createdAt: '2026-11-02T00:00:00.000Z', ...overrides });
const source = (root, filename) => path.join(root, 'content', 'files', filename);

test('empty manifest publishes nothing, including unlisted private files', async t => {
  const root = await fixture(t);
  await fs.writeFile(source(root, 'private.md'), 'must stay private');
  assert.deepEqual(await buildCatalog(root), { items: [], cursor: null });
  assert.deepEqual(await fs.readdir(path.join(root, 'public', 'downloads')), []);
});

test('published bytes are exact and size is derived rather than trusting metadata', async t => {
  const root = await fixture(t, [entry({ size: 999, ownerSecret: 'never emit extra keys' })]);
  const bytes = Buffer.from([0xef, 0xbb, 0xbf, 35, 13, 10, 0, 255]);
  await fs.writeFile(source(root, 'example.md'), bytes);
  const result = await buildCatalog(root);
  assert.equal(result.items[0].size, bytes.length);
  assert.equal(result.items[0].download, 'downloads/example.md');
  assert.equal(result.items[0].ownerSecret, undefined);
  assert.deepEqual(await fs.readFile(path.join(root, 'public', result.items[0].download)), bytes);
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'public', 'catalog.json'), 'utf8')), result);
});

test('rejects traversal and absolute paths before modifying generated output', async t => {
  for (const file of ['../private.md', '..\\private.md', '/private.md', 'C:\\private.md']) {
    const root = await fixture(t, [entry({ file })]);
    await assert.rejects(buildCatalog(root), /Invalid file/);
    await assert.rejects(fs.access(path.join(root, 'public')));
  }
});

test('rejects duplicate ids and files', async t => {
  const duplicateId = await fixture(t, [entry(), entry({ file: 'second.md' })]);
  await assert.rejects(buildCatalog(duplicateId), /Duplicate id/);
  const duplicateFile = await fixture(t, [entry(), entry({ id: 'second', file: 'EXAMPLE.md' })]);
  await assert.rejects(buildCatalog(duplicateFile), /Duplicate file/);
});

test('validates category, providers, and metadata types', async t => {
  for (const overrides of [{ category: 'Hidden' }, { providers: 'Codex' }, { providers: [4] }, { providers: ['Codex', 'Codex'] }, { description: 7 }, { usage: null }, { createdAt: 'tomorrow' }, { filename: '../example.md' }]) {
    const root = await fixture(t, [entry(overrides)]);
    await assert.rejects(buildCatalog(root), /Invalid|Duplicate/);
  }
});

test('removes stale downloads after the manifest removes the entry', async t => {
  const root = await fixture(t, [entry()]);
  await fs.writeFile(source(root, 'example.md'), 'published');
  await buildCatalog(root);
  await fs.writeFile(path.join(root, 'content', 'catalog.json'), '[]');
  await buildCatalog(root);
  assert.deepEqual(await fs.readdir(path.join(root, 'public', 'downloads')), []);
  assert.equal(await fs.readFile(source(root, 'example.md'), 'utf8'), 'published');
});

test('rejects empty and oversized files', async t => {
  for (const size of [0, MAX_BYTES + 1]) {
    const root = await fixture(t, [entry()]);
    await fs.writeFile(source(root, 'example.md'), Buffer.alloc(size));
    await assert.rejects(buildCatalog(root), /nonempty/);
  }
});

test('rejects unexpected nested output without deleting it', async t => {
  const root = await fixture(t);
  const nested = path.join(root, 'public', 'downloads', 'keep');
  await fs.mkdir(nested, { recursive: true });
  await fs.writeFile(path.join(nested, 'important.md'), 'keep');
  await assert.rejects(buildCatalog(root), /unexpected directory/);
  assert.equal(await fs.readFile(path.join(nested, 'important.md'), 'utf8'), 'keep');
});

test('rejects source symlinks', async t => {
  const root = await fixture(t, [entry()]);
  const target = path.join(root, 'real.md');
  await fs.writeFile(target, 'private');
  try { await fs.symlink(target, source(root, 'example.md')); }
  catch (error) {
    if (error.code === 'EPERM') { t.skip('Windows requires symlink privileges.'); return; }
    throw error;
  }
  await assert.rejects(buildCatalog(root), /symlink/);
});

test('rejects output directory junctions without touching their targets', async t => {
  const root = await fixture(t);
  const elsewhere = path.join(root, 'elsewhere');
  await fs.mkdir(elsewhere);
  try { await fs.symlink(elsewhere, path.join(root, 'public'), 'junction'); }
  catch (error) {
    if (error.code === 'EPERM') { t.skip('Sandbox does not allow directory junctions.'); return; }
    throw error;
  }
  await assert.rejects(buildCatalog(root), /symlink/);
  assert.deepEqual(await fs.readdir(elsewhere), []);
});

test('add-skill copies exact bytes, supplies defaults, and refuses collisions', async t => {
  const root = await fixture(t);
  const original = path.join(root, 'Upload.MD');
  await fs.writeFile(original, '# Hello\r\n');
  const options = { file: original, name: 'My Skill', description: 'Useful', providers: 'Codex, Claude' };
  const added = await addSkill(root, options);
  assert.equal(added.file, 'my-skill.md');
  assert.equal(added.category, 'Other');
  assert.deepEqual(added.providers, ['Codex', 'Claude']);
  assert.deepEqual(await fs.readFile(source(root, added.file)), await fs.readFile(original));
  await assert.rejects(addSkill(root, options), /already exists/);
  assert.equal((await buildCatalog(root)).items.length, 1);
});

test('add-skill refuses an unlisted existing file without overwriting it', async t => {
  const root = await fixture(t);
  const original = path.join(root, 'Upload.md');
  await fs.writeFile(original, 'new');
  await fs.writeFile(source(root, 'my-skill.md'), 'keep');
  await assert.rejects(addSkill(root, { file: original, name: 'My Skill', description: 'Useful' }), /EEXIST/);
  assert.equal(await fs.readFile(source(root, 'my-skill.md'), 'utf8'), 'keep');
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(root, 'content', 'catalog.json'), 'utf8')), []);
});
