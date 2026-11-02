import { promises as fs, constants } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, MAX_BYTES, readCatalog, validateEntry } from './build-catalog.mjs';

export async function addSkill(root, options) {
  if (!options.file || !path.isAbsolute(options.file)) throw new Error('--file must be an absolute .md or .zip path.');
  const extension = path.extname(options.file).toLowerCase();
  if (!['.md', '.zip'].includes(extension)) throw new Error('Choose an .md or .zip file.');
  const sourceStat = await fs.lstat(options.file);
  if (!sourceStat.isFile() || sourceStat.isSymbolicLink() || !sourceStat.size || sourceStat.size > MAX_BYTES) throw new Error('Choose a regular, nonempty file up to 10 MiB; symlinks are not supported.');
  const entries = await readCatalog(root);
  const slug = String(options.name || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'skill';
  const entry = {
    id: randomUUID(), name: options.name, description: options.description,
    category: options.category || 'Other', usage: options.usage || '',
    providers: options.providers ? options.providers.split(',').map(value => value.trim()).filter(Boolean) : [],
    filename: path.basename(options.file), createdAt: new Date().toISOString(), file: slug + extension,
  };
  validateEntry(entry);
  if (entries.some(existing => existing.file.toLowerCase() === entry.file.toLowerCase())) throw new Error('That skill filename already exists. Choose a distinct name.');
  const destinationDir = path.join(root, 'content', 'files');
  const destinationStat = await fs.lstat(destinationDir);
  if (destinationStat.isSymbolicLink() || !destinationStat.isDirectory()) throw new Error('content/files must be a real directory.');
  const destination = path.join(destinationDir, entry.file);
  await fs.copyFile(options.file, destination, constants.COPYFILE_EXCL);
  try {
    const copied = await fs.stat(destination);
    if (!copied.size || copied.size > MAX_BYTES) throw new Error('Copied skill has an invalid size.');
    await fs.writeFile(path.join(root, 'content', 'catalog.json'), JSON.stringify([...entries, entry], null, 2) + '\n');
  } catch (error) { await fs.unlink(destination); throw error; }
  return entry;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), options = {};
  try {
    for (let index = 0; index < args.length; index += 2) {
      const key = args[index]?.replace(/^--/, '');
      if (!args[index]?.startsWith('--') || !['file', 'name', 'description', 'category', 'providers', 'usage'].includes(key) || args[index + 1] === undefined || Object.hasOwn(options, key)) throw new Error('Use --file, --name, --description, and optional --category, --providers, --usage pairs.');
      options[key] = args[index + 1];
    }
    const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    await addSkill(root, options);
    console.log('Added skill to the public publishing manifest. Review, build, then commit and push.');
  } catch (error) { console.error(`${error.message}\nCategories: ${CATEGORIES.join(', ')}`); process.exitCode = 1; }
}
