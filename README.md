# @cldmv/fix-headers

Multi-language source header normalizer for Node.js projects.

`@cldmv/fix-headers` scans project files, auto-detects project metadata (language, root, project name, git author/email), and inserts or updates standard file headers.

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] <!-- [![GitHub release]][github_release_url] -->[![GitHub downloads]][github_downloads_url] [![Last commit]][last_commit_url] <!-- [![Release date]][release_date_url] -->[![npm last update]][npm_last_update_url] [![Coverage]][coverage_url]

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

## Features

- Auto-detects project type by marker files (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`) and YAML files (`.yaml`, `.yml`)
- Auto-detects author and email from git config/commit history
- Supports per-run overrides for every detected value
- Supports folder inclusion and exclusion configuration, with project-root-scoped build/cache ignores and optional `.gitignore` respect
- Supports detector-based monorepo scanning with nearest config resolution per file
- Supports per-detector syntax overrides for line and block comment tokens
- Supports both ESM and CJS consumers

## Install

```bash
npm i @cldmv/fix-headers
```

## Usage

### ESM

```js
import fixHeaders from "@cldmv/fix-headers";

const result = await fixHeaders({ dryRun: true });
```

## CLI

After install, use the package binary:

```bash
fix-headers --dry-run --include-folder src --exclude-folder dist
```

Local development usage:

```bash
npm run cli -- --dry-run --json
```

Common CLI options:

- `--dry-run`
- `--check` - validate header dates without writing; exits `1` on date drift (see [Date checks](#date-checks))
- `--fix-created-date`
- `--normalize-date-format`
- `--json`
- `--verbose` - list updated files; together with `--sample-output` or `--diff`, also list each file's field differences (`authorName: found "X", expected "Y"`)
- `--sample-output` - print the previous/new header and detected values for each changed file
- `--diff` - print a unified diff of each changed file's header (implies sample output)
- `--force-author-update`
- `--force-last-modified-author-update`
- `--use-gpg-signer-author` (signer UID name, with the OpenPGP UID comment dropped)
- `--cwd <path>`
- `--input <path>`
- `--include-folder <path>` (repeatable)
- `--include-folder-non-recursive <path>` (repeatable) - include only that folder's own files, not its subfolders
- `--exclude-folder <path>` (repeatable)
- `--include-extension <ext>` (repeatable)
- `--enable-detector <id>` / `--disable-detector <id>` (repeatable)
- `--project-name <name>`
- `--author-name <name>` / `--author-email <email>`
- `--company-name <name>`
- `--copyright-start-year <year>`
- `--config <json-file>`

### CommonJS

```js
const fixHeaders = require("@cldmv/fix-headers");

const result = await fixHeaders({ dryRun: true });
```

## API

### `fixHeaders(options?)`

Runs header normalization. Project/language/author/email metadata is auto-detected internally on each run.

Important options:

- `cwd?: string` - start directory for project detection
- `input?: string` - explicit single file or folder path to process
- `dryRun?: boolean` - compute changes without writing files
- `check?: boolean` - validate each existing header's dates and write nothing (implies `dryRun`). Each result entry gets `dateIssues`, and the result gets `filesWithDateDrift` and `dateAdvisories`. See [Date checks](#date-checks)
- `fixCreatedDate?: boolean` - replace an existing `@Date` that is not the file's git first-commit instant with the git date. Off by default: an existing `@Date` is kept, because a file's first commit is not always its real creation (moved or copied in from another repository). Files without git history keep their `@Date`
- `normalizeDateFormat?: boolean` - write every header date in the git `%aI` form (`2026-03-01T17:59:32-08:00`), keeping each date's offset and instant. Off by default; the first run rewrites (and restamps) every managed file whose dates use the space form (`2026-03-01 17:59:32 -08:00`)
- `sampleOutput?: boolean` - include a `sample` for each changed file: previous/new header text, a unified `diff`, per-field `issues`, and `detectedValues` (see [Sample output](#sample-output))
- `configFile?: string` - load JSON options from file (resolved from `cwd`)
- `includeExtensions?: string[]` - file extensions to process
- `enabledDetectors?: string[]` - detector ids to enable (defaults to all)
- `disabledDetectors?: string[]` - detector ids to disable
- `detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>` - override detector comment syntax tokens
- `includeFolders?: Array<string | { path: string, recursive?: boolean }>` - project-relative folders to scan. A string entry is scanned recursively; `{ path, recursive: false }` includes only that folder's own files (for example `{ path: ".", recursive: false }` for the project-root files without the whole tree). Overlapping entries are collapsed, so every file is scanned once however the folders nest or are spelled (`"."` next to `"src"`, `"src"` next to `"src/core"`, `"./src"` next to `"src/"`)
- `excludeFolders?: string[]` - folder names or relative paths to exclude
- `gitignore?: boolean | string | string[]` - respect `.gitignore` during discovery. `false` disables; a path or array of paths loads those ignore files; anything else / omitted auto-detects `<projectRoot>/.gitignore`. Matched files and directories are skipped.
- `projectName?: string`
- `language?: string`
- `projectRoot?: string`
- `marker?: string | null`
- `authorName?: string`
- `authorEmail?: string`
- `company?: string` - appends to `@Author` as `Name <Company>`
- `forceAuthorUpdate?: boolean` - force update `@Author`/`@Email` to detected or overridden current values
- `forceLastModifiedAuthorUpdate?: boolean` - force update `@Last modified by` to detected or overridden current values. Without this, an existing header's recorded `@Last modified by` identity is preserved and does not by itself trigger an update just because the running author differs (e.g. a different `git config user.name` than whoever last touched the file)
- `useGpgSignerAuthor?: boolean` - use the last commit's signer UID (`%GS`) for the detected `@Author` name. The OpenPGP UID comment is dropped, so `Nate Corcoran (2023 PC) <nate@example.com>` becomes `Nate Corcoran` (with `company: "CLDMV"`: `Nate Corcoran <CLDMV>`). An unsigned commit falls back to `git config user.name`, then the last commit's author
- `companyName?: string` (default: `Catalyzed Motivation Inc.`)
- `copyrightStartYear?: number` (default: current year)

Example:

```js
const result = await fixHeaders({
	cwd: process.cwd(),
	dryRun: false,
	configFile: "fix-headers.config.json",
	includeFolders: ["src", "scripts", { path: ".", recursive: false }],
	excludeFolders: ["src/generated", "dist"],
	detectorSyntaxOverrides: {
		node: {
			blockStart: "/*",
			blockLinePrefix: " * ",
			blockEnd: " */"
		},
		python: {
			linePrefix: ";;",
			lineSeparator: " "
		}
	},
	projectName: "@scope/my-package",
	companyName: "Catalyzed Motivation Inc.",
	copyrightStartYear: 2013
});
```

## Date checks

`check: true` / `--check` validates the `@Date` and `@Last modified time` values of every existing header and writes nothing. It compares instants, not strings, so the same moment written with another offset or in the space/`T` form is not drift. It is independent of the rendered-header diff: an author, identity, copyright, or other content difference never fails the check.

| Check                                | Fails the run | Meaning                                                                                                                       |
| ------------------------------------ | ------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `created-format` / `modified-format` | yes           | the value is not a `<datetime> (<epoch>)` pair with a recognised datetime (a datetime without a UTC offset is not recognised) |
| `created-epoch` / `modified-epoch`   | yes           | the parenthesised epoch is not the instant the datetime text describes                                                        |
| `created-git`                        | yes           | `@Date` is not the file's git first-commit date. Skipped for files with no git history                                        |
| `modified-git`                       | no (advisory) | `@Last modified time` is not the file's git last-commit date                                                                  |

```bash
$ fix-headers --check --verbose
fix-headers check: scanned=5, drift=2, advisories=1
drift: src/epoch.mjs: @Date epoch 1758382412 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)
drift: src/invented.mjs: @Date 2026-09-20 00:00:00 -07:00 does not match the git first commit 2026-09-20T15:33:32+00:00 (1789918412)
advisory: src/invented.mjs: @Last modified time 2026-09-21 09:00:00 -07:00 does not match the git last commit 2026-09-20T15:33:32+00:00 (1789918412)
$ echo $?
1
```

Advisories are counted in the summary and listed with `--verbose`; `--json` prints the full result and uses the same exit code. `--dry-run` still always exits `0`.

In a normal (writing) run, an epoch that disagrees with its datetime text is recomputed from the text; the datetime text itself is left as written. `created-git` drift is corrected only with `fixCreatedDate` / `--fix-created-date`.

## Notes

- `excludeFolders` supports both folder-name and nested path matching.
- `includeFolders` entries never double-count a file. A folder that lies inside another recursive include is not walked a second time; the exception is a folder the outer walk never enters (for example one under `node_modules` or under a root build folder such as `dist`), which keeps being walked on its own because it was named explicitly.
- Built-in ignores are scoped: `.git` and `node_modules` are skipped at **any depth**, while build/cache directories (`dist`, `build`, `coverage`, `tmp`, `.next`, `.turbo`) are skipped **only at the project root** — so a source directory that happens to share a name (for example `tools/build`) is still processed.
- With `gitignore` enabled (the default, auto-detecting the project's `.gitignore`), anything the project ignores is skipped during discovery — generated paths are excluded by the project's own rules without hard-coding names. Pass `gitignore: false` to disable, or a path/array to use specific ignore files.
- For monorepos, each file resolves metadata from the closest detector config in its parent tree.
- With `sampleOutput` enabled, each changed file includes `previousValue`, `newValue`, `diff`, `issues`, and `detectedValues` in results.

## Sample output

With `sampleOutput: true` (CLI: `--sample-output` or `--diff`), every changed entry in `result.changes` carries a `sample` object. It costs nothing when the option is off.

- `previousValue` - the existing header block, or `null` when the file had none.
- `newValue` - the header block this run writes.
- `diff` - a ready-to-print unified diff of the header block. The `---`/`+++` lines name the file (`a/<file>` / `b/<file>`, or `/dev/null` when there was no previous header, in which case the whole new header shows as added), and hunk line numbers are file line numbers.
- `issues` - one `{ field, previous, detected }` entry per header field whose written value differs from the existing header, in header order. Fields: `projectName`, `filename`, `createdAt`, `authorName`, `authorEmail`, `lastModifiedByName`, `lastModifiedByEmail`, `lastModifiedAt`, `copyrightStartYear`, `copyrightEndYear`, `companyName`. Values are the field text as written in the header (dates keep their `date (timestamp)` form); `previous` is `null` when the field was missing.
- `detectedValues` - the metadata resolved for the file.

`issues` compares the existing header against what is actually written, not against the raw detected metadata. fix-headers preserves an existing `@Author`/`@Email` and `@Last modified by` identity unless `forceAuthorUpdate` / `forceLastModifiedAuthorUpdate` is set, so those fields only appear when they really change. An updated file always gets a fresh `@Last modified time`, so `lastModifiedAt` is listed for every changed file that already had a header.

```js
const { changes } = await fixHeaders({ dryRun: true, sampleOutput: true });
for (const { file, sample } of changes.filter((change) => change.sample)) {
	for (const issue of sample.issues) {
		console.log(`${file}: ${issue.field}: found ${issue.previous}, expected ${issue.detected}`);
	}
	console.log(sample.diff);
}
```

```text
$ fix-headers --dry-run --diff --verbose --input src/cli.mjs --company-name "CLDMV Inc."
fix-headers complete: scanned=1, updated=1, dryRun=true
updated: src/cli.mjs
issues: src/cli.mjs
  lastModifiedAt: found "2026-03-01T17:59:32-08:00 (1772416772)", expected "2026-09-28 09:20:28 -07:00 (1790612428)"
  companyName: found "Catalyzed Motivation Inc.", expected "CLDMV Inc."
--- a/src/cli.mjs
+++ b/src/cli.mjs
@@ -7,7 +7,7 @@
  *	@Email: <Shinrai@users.noreply.github.com>
  *	-----
  *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
- *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
+ *	@Last modified time: 2026-09-28 09:20:28 -07:00 (1790612428)
  *	-----
- *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
+ *	@Copyright: Copyright (c) 2026-2026 CLDMV Inc. All rights reserved.
  */
```

## License

Apache-2.0

<!-- Badge definitions -->
<!-- [github release]: https://img.shields.io/github/v/release/CLDMV/fix-headers?style=for-the-badge&logo=github&logoColor=white&labelColor=181717 -->
<!-- [github_release_url]: https://github.com/CLDMV/fix-headers/releases -->
<!-- [release date]: https://img.shields.io/github/release-date/CLDMV/fix-headers?style=for-the-badge&logo=github&logoColor=white&labelColor=181717 -->
<!-- [release_date_url]: https://github.com/CLDMV/fix-headers/releases -->

[npm version]: https://img.shields.io/npm/v/%40cldmv%2Ffix-headers.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_version_url]: https://www.npmjs.com/package/@cldmv/fix-headers
[npm downloads]: https://img.shields.io/npm/dm/%40cldmv%2Ffix-headers.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_downloads_url]: https://www.npmjs.com/package/@cldmv/fix-headers
[github downloads]: https://img.shields.io/github/downloads/CLDMV/fix-headers/total?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_downloads_url]: https://github.com/CLDMV/fix-headers/releases
[last commit]: https://img.shields.io/github/last-commit/CLDMV/fix-headers?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[last_commit_url]: https://github.com/CLDMV/fix-headers/commits
[npm last update]: https://img.shields.io/npm/last-update/%40cldmv%2Ffix-headers?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_last_update_url]: https://www.npmjs.com/package/@cldmv/fix-headers
[coverage]: https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FCLDMV%2Ffix-headers%2Fbadges%2Fcoverage.json&style=for-the-badge&logo=vitest&logoColor=white
[coverage_url]: https://github.com/CLDMV/fix-headers/blob/badges/coverage.json
[contributors]: https://img.shields.io/github/contributors/CLDMV/fix-headers.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[contributors_url]: https://github.com/CLDMV/fix-headers/graphs/contributors
[sponsor shinrai]: https://img.shields.io/github/sponsors/shinrai?style=for-the-badge&logo=githubsponsors&logoColor=white&labelColor=EA4AAA&label=Sponsor
[sponsor_url]: https://github.com/sponsors/shinrai
