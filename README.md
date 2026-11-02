# Skill Library

A static public catalogue of skills, published through GitHub. The catalogue starts empty. Only files explicitly listed in `content/catalog.json` are copied into the website's generated downloads. There are no runtime uploads, runtime writes, or R2 storage resources.

Everything committed to the publishing repository should be considered public, including unlisted files. Keep private skills, secrets, and credentials outside this repository. The website does not provide an owner sign-in or upload form; ownership is controlled through GitHub repository access.

## Publish through GitHub in your browser

1. Open the repository on GitHub. Use **Add file → Upload files** in `content/files` to upload a nonempty `.md` or `.zip` file up to 10 MiB. Use a safe filename such as `my-skill.md`.
2. Edit `content/catalog.json` and add an entry using the schema below. Choose a unique `id` and set `file` to exactly the uploaded basename. `filename` is the download's display name. Use the current ISO timestamp for `createdAt`.
3. Commit the file and manifest changes to the publishing branch. The deployment rebuilds the catalogue; check the build and published page after it completes.

```json
[
  {
    "id": "my-skill",
    "name": "My Skill",
    "description": "What this skill helps you do.",
    "category": "Development",
    "usage": "Download and follow the instructions in the file.",
    "providers": ["Codex"],
    "filename": "my-skill.md",
    "file": "my-skill.md",
    "createdAt": "2026-11-02T00:00:00.000Z"
  }
]
```

Allowed categories: Development, Writing, Research, Design, Productivity, Other. Providers are an array of tool/provider names; use `[]` if unspecified. Every entry requires every field shown. Names are limited to 100 characters, descriptions to 500, usage to 12,000, and each provider to 80. Files must have `.md` or `.zip` extensions, be nonempty, and be at most 10 MiB. Paths and symlinks are rejected. File size is calculated from the actual published bytes.

## Publish from your computer

Run from this directory with Node.js:

```powershell
node scripts/add-skill.mjs --file "C:\absolute\path\my-skill.md" --name "My Skill" --description "What this skill does" --category "Development" --providers "Codex,Claude" --usage "How to use this skill"
node scripts/build-catalog.mjs
node --test tests/catalog.test.mjs
```

`--category`, `--providers`, and `--usage` are optional; defaults are Other, an empty provider list, and empty usage. The command copies the selected file into `content/files` and appends its manifest record. It refuses to overwrite an existing filename; choose a distinct skill name when adding another file. Review the changed file and manifest, then commit and push them to GitHub to publish.

To update a skill, replace its file and edit its existing manifest record. To remove a skill from the website, remove its manifest record and commit/push; the next build removes the generated download. Delete the source file too if it should no longer be present in the current repository tree. Previously public commits and downloads may remain available to others.

`node scripts/build-catalog.mjs` validates the entire manifest before generating `public/catalog.json` and `public/downloads`. Those paths are build outputs. The downloads directory belongs to the generator and stale files there are removed on successful rebuilds. Do not store hand-maintained assets there.
