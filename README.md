# @cldmv/fix-headers

Multi-language source header normalizer for Node.js projects.

`@cldmv/fix-headers` scans project files, auto-detects project metadata (language, root, project name, git author/email), and inserts or updates standard file headers.

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] <!-- [![GitHub release]][github_release_url] -->[![GitHub downloads]][github_downloads_url] [![Last commit]][last_commit_url] <!-- [![Release date]][release_date_url] -->[![npm last update]][npm_last_update_url] [![Coverage]][coverage_url]

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

## ✨ What's New

### Latest: v2.0.0 (September 2026)

- **Breaking: built package, discovery and `@Project`** — npm now ships a tsup-built `dist/` and `bin/` instead of `src/`, so deep imports into `src/` stop resolving; the package entry point and the `fix-headers` binary work as before ([#56](https://github.com/CLDMV/fix-headers/pull/56), [#65](https://github.com/CLDMV/fix-headers/pull/65), [#78](https://github.com/CLDMV/fix-headers/pull/78)). Nothing is skipped by name any more: `node_modules`, `dist`, `build`, `coverage`, `tmp`, `.next` and `.turbo` are processed unless an ignore file (everything git honours) or `excludeFolders` excludes them ([#73](https://github.com/CLDMV/fix-headers/pull/73)). `@Project` and the project root come from the project's manifest (`package.json`, `pyproject.toml`, `Cargo.toml`, …) whatever the file's type, so some CSS, HTML, YAML, JSON and Python headers are rewritten on the next run ([#72](https://github.com/CLDMV/fix-headers/pull/72), [#75](https://github.com/CLDMV/fix-headers/pull/75)). Preview the first run with `--dry-run --diff --verbose`.
- **Date checks, time zones, header diffs and include options** — `--check` validates header dates without writing and exits `1` on drift, `@Date` follows "oldest wins" across the header, git and the filesystem, and mismatched epochs are repaired ([#67](https://github.com/CLDMV/fix-headers/pull/67)); an opt-in `--timezone` writes, and `--convert-timezone` sweeps, header dates into one IANA zone ([#81](https://github.com/CLDMV/fix-headers/pull/81)). `--diff` prints a unified header diff and `sampleOutput` lists per-field issues ([#66](https://github.com/CLDMV/fix-headers/pull/66)); `includeFolders` takes non-recursive entries and never processes a file twice ([#60](https://github.com/CLDMV/fix-headers/pull/60)).
- [View full v2.0.0 Changelog](https://github.com/CLDMV/fix-headers/blob/master/docs/changelog/v2/v2.0.0.md)

### Recent Releases

- **v1.3.12** (September 2026) — `engines.node` raised to `>=22.12.0` with the move to vitest 5; `ignore` bumped to 7.0.8 ([#38](https://github.com/CLDMV/fix-headers/pull/38), [#40](https://github.com/CLDMV/fix-headers/pull/40), [#43](https://github.com/CLDMV/fix-headers/pull/43)) ([Release](https://github.com/CLDMV/fix-headers/releases/tag/v1.3.12))
- **v1.3.11** (September 2026) — CI and release automation only, no runtime change: bot identity and GPG secrets passed to the v4 release and hotfix-redirect workflows ([#32](https://github.com/CLDMV/fix-headers/pull/32), [#36](https://github.com/CLDMV/fix-headers/pull/36)) ([Release](https://github.com/CLDMV/fix-headers/releases/tag/v1.3.11))
- **v1.3.10** (August 2026) — tests only, no runtime change: fallback-path tests run in a workspace with no project ancestry ([#28](https://github.com/CLDMV/fix-headers/pull/28)) ([Release](https://github.com/CLDMV/fix-headers/releases/tag/v1.3.10))
- **v1.3.9** (August 2026) — an existing header's `@Last modified by` identity is preserved unless `forceLastModifiedAuthorUpdate` / `--force-last-modified-author-update` is set, so a different local git identity no longer rewrites headers tree-wide ([#25](https://github.com/CLDMV/fix-headers/pull/25)) ([Release](https://github.com/CLDMV/fix-headers/releases/tag/v1.3.9))

📚 For complete release notes, see the [docs/changelog/](https://github.com/CLDMV/fix-headers/tree/master/docs/changelog/) folder and the [GitHub Releases](https://github.com/CLDMV/fix-headers/releases).

## Features

- Finds the project each file belongs to from its manifest (`package.json`, `pyproject.toml` / `setup.cfg` / `setup.py`, `composer.json`, `Cargo.toml`, `go.mod`), whatever the file's type
- `@Project` is the name from that project's manifest, so a CSS, HTML, YAML or JSON file in a Python, PHP, Rust or Go project gets that project's name too; the folder name is used only when no manifest provides one. Override it with `projectName`. See [Project name and root](#project-name-and-root)
- Auto-detects author and email from git config/commit history
- Supports per-run overrides for every detected value
- Supports folder inclusion and exclusion configuration; skips only what the project's ignore files (everything git honours) or your own exclusions say
- Supports monorepos: every file resolves its own project from the nearest manifest in its parent tree
- Supports per-detector syntax overrides for line and block comment tokens
- Config files can use `extends` to build on a shared config (an https URL, an npm package path or a file path), so one organisation-wide config serves every repository. See [Shared configs](#shared-configs)
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
- `--strict-created-date`
- `--normalize-date-format`
- `--timezone <name>` - write new header dates in an IANA time zone (see [Time zone](#time-zone))
- `--convert-timezone` - with `--timezone`, also rewrite existing header dates into that zone
- `--json`
- `--verbose` - list updated files; together with `--sample-output` or `--diff`, also list each file's field differences (`authorName: found "X", expected "Y"`)
- `--sample-output` - print the previous/new header and detected values for each changed file
- `--diff` - print a unified diff of each changed file's header (implies sample output)
- `--force-author-update`
- `--force-last-modified-author-update`
- `--use-gpg-signer-author` (the signing key's UID name, with the OpenPGP UID comment dropped)
- `--cwd <path>`
- `--input <path>`
- `--include-folder <path>` (repeatable)
- `--include-folder-non-recursive <path>` (repeatable) - include only that folder's own files, not its subfolders
- `--exclude-folder <path>` (repeatable)
- `--include-extension <ext>` (repeatable)
- `--enable-detector <id>` / `--disable-detector <id>` (repeatable)
- `--project-name <name>`
- `--author-name <name>` / `--author-email <email>`
- `--company-name <name>` - the `@Copyright` holder for every file, instead of the one the manifests provide (see [Copyright holder](#copyright-holder))
- `--copyright-start-year <year>`
- `--config <json-file>` - load options from a JSON file, which may use `extends` to build on shared configs (see [Shared configs](#shared-configs)); flags on the command line win over the file

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
- `fixCreatedDate?: boolean` - move an existing `@Date` back to the oldest of itself, the file's git first commit, and its filesystem creation time (see [Creation date](#creation-date)). It only ever moves `@Date` earlier. Off by default: an existing `@Date` is kept as written
- `strictCreatedDate?: boolean` - with `check`, count a `@Date` later than the file's git first commit or filesystem creation time as drift (fails the run). Off by default, where it is an advisory
- `normalizeDateFormat?: boolean` - write every header date in the git `%aI` form (`2026-03-01T17:59:32-08:00`), keeping each date's offset and instant. Off by default; the first run rewrites (and restamps) every managed file whose dates use the space form (`2026-03-01 17:59:32 -08:00`)
- `timezone?: string` - an IANA time zone name (`America/Los_Angeles`, `UTC`, `Asia/Kolkata`, ...). Every date fix-headers writes (a new header's `@Date`, and `@Last modified time`) is expressed in that zone; the instant and its epoch never change. Unset (the default): dates are written as today. An unknown zone name throws. See [Time zone](#time-zone)
- `convertTimezone?: boolean` - with `timezone`, also rewrite the existing `@Date` and `@Last modified time` values of every header into that zone, keeping each instant. Throws when `timezone` is not set. See [Time zone](#time-zone)
- `sampleOutput?: boolean` - include a `sample` for each changed file: previous/new header text, a unified `diff`, per-field `issues`, and `detectedValues` (see [Sample output](#sample-output))
- `configFile?: string` - load JSON options from file (resolved from `cwd`). The file may use `extends` to build on shared configs by URL, npm package path or file path (see [Shared configs](#shared-configs)); options passed in the call win over everything from files
- `includeExtensions?: string[]` - file extensions to process
- `enabledDetectors?: string[]` - detector ids to enable (defaults to all)
- `disabledDetectors?: string[]` - detector ids to disable
- `detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>` - override detector comment syntax tokens
- `includeFolders?: Array<string | { path: string, recursive?: boolean }>` - project-relative folders to scan. A string entry is scanned recursively; `{ path, recursive: false }` includes only that folder's own files (for example `{ path: ".", recursive: false }` for the project-root files without the whole tree). Overlapping entries are collapsed, so every file is scanned once however the folders nest or are spelled (`"."` next to `"src"`, `"src"` next to `"src/core"`, `"./src"` next to `"src/"`)
- `excludeFolders?: string[]` - folder names or relative paths to exclude, on top of what the ignore files exclude
- `gitignore?: boolean | string | string[]` - which ignore files decide what discovery skips. Omitted (or `true`): every ignore file git honours (see [Which files are processed](#which-files-are-processed)). `false`: no ignore files, every file is processed. A path or array of paths (relative to the project root): exactly those files, parsed with `.gitignore` syntax, without asking git.
- `projectName?: string` - the `@Project` value for every file, instead of the manifest name
- `language?: string` - the reported `language` for every file (does not change comment syntax or project resolution)
- `projectRoot?: string` - the project root for every file (the base of `@Filename` and of git history lookups) and the scan root
- `marker?: string | null` - the reported `marker` for every file
- `authorName?: string`
- `authorEmail?: string`
- `company?: string` - appends to `@Author` as `Name <Company>`
- `forceAuthorUpdate?: boolean` - force update `@Author`/`@Email` to detected or overridden current values
- `forceLastModifiedAuthorUpdate?: boolean` - force update `@Last modified by` to detected or overridden current values. Without this, an existing header's recorded `@Last modified by` identity is preserved and does not by itself trigger an update just because the running author differs (e.g. a different `git config user.name` than whoever last touched the file)
- `useGpgSignerAuthor?: boolean` - take the detected `@Author` name from the user ID of the OpenPGP key git signs commits with (`user.signingkey`, read through `gpg.openpgp.program` / `gpg.program` / `gpg`; the first user ID that is not revoked or expired). The OpenPGP UID comment is dropped, so `Nate Corcoran (2023 PC) <nate@example.com>` becomes `Nate Corcoran` (with `company: "CLDMV"`: `Nate Corcoran <CLDMV>`). It describes whoever runs the tool, whatever the last commit is — a squash merge made by GitHub or a bot has no locally verifiable signer. With no readable OpenPGP signing key (none configured, `gpg.format` is `ssh`/`x509`, or gpg is unavailable) it falls back to the last commit's signer (`%GS`), then `git config user.name`, then the last commit's author
- `companyName?: string` - the `@Copyright` holder for every file, instead of the one the project's manifests provide. There is no built-in default: unset, the holder comes from the manifests, and with none it is left out of the line (see [Copyright holder](#copyright-holder))
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

## Shared configs

A config file (`--config <path>` on the CLI, `configFile` in the API) can extend other configs with `extends`, so an organisation keeps its header settings in one place instead of copying them into every repository. `extends` is a string or an array of strings, and each entry is one of:

- **An https URL**, fetched on every run. There is no local cache, so every run uses the current shared config. A failed request, a non-2xx response or a body that is not a JSON object fails the run with an error naming the URL. Plain `http://` is accepted only for the local machine (`localhost`, `127.0.0.1`, `[::1]`).
- **An npm package path**, such as `@cldmv/configs/fix-headers.json`, resolved from the config file's own folder the way Node resolves packages (`require.resolve`), so the package's `exports` map is honoured. Install the package as a dev dependency.
- **A relative or absolute file path**, resolved from the config file's folder. Relative paths start with `./` or `../`; anything else that is not a URL or an absolute path is treated as a package path.

Merge rules:

- Extended configs apply in order, then the file's own settings on top, so the repository's file overrides what it extends, and a later `extends` entry overrides an earlier one.
- Plain objects (such as `detectorSyntaxOverrides`) merge key by key; arrays (such as `includeFolders`) and scalars replace.
- Extended configs can extend others in turn. A cycle (`a` → `b` → `a`) is an error. Inside a fetched config, relative references (`./base.json`, `../base.json`, `/base.json`) resolve against that config's URL; a fetched config cannot reference an npm package.
- Options passed directly on the command line or in the `fixHeaders()` call win over everything from files.

The CLDMV repositories share one config published as `@cldmv/configs`. A repository's `.configs/fix-headers.json` extends it and adds its own settings:

```json
{
	"extends": "@cldmv/configs/fix-headers.json",
	"includeFolders": ["src", "tests", { "path": ".", "recursive": false }],
	"excludeFolders": ["tests/fixtures"]
}
```

```bash
npm install --save-dev @cldmv/configs
fix-headers --config .configs/fix-headers.json
```

A shared config can also be served from a URL, and mixed with local files:

```json
{
	"extends": ["https://example.com/configs/fix-headers.json", "./fix-headers.local.json"],
	"projectName": "@scope/my-package"
}
```

## Project name and root

Which project a file belongs to depends on the manifests around it, not on the file's type. Comment syntax is the only thing the file's type decides.

Each ecosystem has a manifest driver in `src/drivers/`:

| Driver   | Claims a folder holding                     | Name                                                                                                                      | Copyright holder                                                                                                                                                | Native files                  |
| -------- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `node`   | `package.json`                              | `name`                                                                                                                    | `author.company`, else `author.name`, else the name part of a string `author` (`"Name <email> (url)"`)                                                          | `.js .mjs .cjs .ts .tsx .jsx` |
| `python` | `pyproject.toml`, `setup.cfg` or `setup.py` | `pyproject.toml` `[project].name`, then `[tool.poetry].name`; `setup.cfg` `[metadata] name`; `setup.py` `setup(name=...)` | `pyproject.toml` `[project].authors[0].name`, then the name part of `[tool.poetry].authors[0]`; `setup.cfg` `[metadata] author`; `setup.py` `setup(author=...)` | `.py`                         |
| `php`    | `composer.json`                             | `name`                                                                                                                    | `authors[0].name`                                                                                                                                               | `.php`                        |
| `rust`   | `Cargo.toml`                                | `[package].name`                                                                                                          | the name part of `[package].authors[0]`                                                                                                                         | `.rs`                         |
| `go`     | `go.mod`                                    | the `module` path                                                                                                         | none (`go.mod` has no author)                                                                                                                                   | `.go`                         |

A manifest claims its folder as soon as it exists and can be read, even when it is malformed or has no name. `requirements.txt` does not claim a folder: it carries no name and often sits in folders that are not projects of their own (`docs/requirements.txt`).

For each file:

1. **Project root.** Walk up from the file's folder. The nearest folder that at least one driver claims is the project root. `@Filename` is the file's path relative to it, and git history (`@Date`, `@Last modified time`) is looked up from it.
2. **Order.** When several drivers claim that folder, the file's native driver is read first (a `.py` file reads `python` first), then the fixed order `node`, `python`, `php`, `rust`, `go`. Language-neutral files (CSS, HTML, YAML, JSON, …) use the fixed order.
3. **Per-field fallback.** Each value is taken from the first driver in that order whose manifest provides it. In a folder with a nameless `package.json` and a named `pyproject.toml`, every file gets the `pyproject.toml` name.
4. **Climbing.** A value no driver at the project root provides is looked up the same way in each ancestor folder a driver claims, up to and including the scan root (`projectRoot`, else `cwd`), never above it. A nameless sub-package therefore takes the name of the repository around it. Only values climb: the project root, and with it `@Filename` and the git lookups, stays the nearest claimed folder.
5. **Folder name.** When nothing up to the scan root provides a name, `@Project` is the project root's folder name.

A folder holding `.git` is a repository boundary: neither the root search nor the climb goes past it, so a nested repository without a manifest is a project of its own. With no manifest up to the repository root, that repository root is the project root and its folder name is the name. With neither a manifest nor a repository anywhere above the file, the file's own folder is the project root: `@Project` is that folder's name and `@Filename` is `/<file name>`.

`projectName`, `projectRoot`, `language` and `marker` override the detected values for every file. The copyright holder is resolved from the same manifests by the same rules, see [Copyright holder](#copyright-holder).

For example, scanning `repo/`:

```text
repo/
├── package.json            { "name": "@scope/repo" }
├── pyproject.toml          [project] name = "repo-py"
├── scripts/build.py        → @Project: repo-py        @Filename: /scripts/build.py
├── site/main.css           → @Project: @scope/repo    @Filename: /site/main.css
└── packages/
    ├── a/
    │   ├── package.json    { "private": true }
    │   └── src/x.mjs       → @Project: @scope/repo    @Filename: /src/x.mjs
    └── b/
        ├── Cargo.toml      [package] name = "b-crate"
        └── src/lib.rs      → @Project: b-crate        @Filename: /src/lib.rs
```

To support another ecosystem, add a module to `src/drivers/` that exports a `driver` with `id`, `languages` (the file-type detector ids native to it), `manifests` (filenames that claim a folder, in reading order), `detect(dirPath)` (returns `detectManifests(dirPath, manifests)` from `src/drivers/shared.mjs`) and `read(detection)` (returns `{ name, company }`, each `undefined` when the manifest has none), then add it to `MANIFEST_DRIVERS` in `src/drivers/index.mjs` at its place in the fixed order.

## Copyright holder

The holder on the `@Copyright` line (`companyName`) comes from the manifest of the project the file belongs to, read by the same drivers and with the same rules as the project name: the nearest claimed folder, the file's native driver first, the per-field fallback, and climbing up to the scan root (never past a `.git` folder). The holder climbs on its own, so a sub-package whose `package.json` has a name but no author takes the repository's author while keeping its own `@Project`. The field each driver reads is in the table above.

- **`companyName`** (CLI `--company-name`) overrides the manifests for every file.
- **No holder** anywhere up to the scan root: the holder is left out of the line, which reads `Copyright (c) 2019-2026 All rights reserved.`

For example, scanning `repo/`:

```text
repo/
├── package.json            { "name": "@scope/repo", "author": { "name": "Jane Doe", "company": "ACME Inc." } }
├── src/main.mjs            → @Copyright: Copyright (c) 2026-2026 ACME Inc. All rights reserved.
└── packages/
    ├── a/
    │   ├── package.json    { "name": "@scope/a" }
    │   └── src/x.mjs       → @Copyright: Copyright (c) 2026-2026 ACME Inc. All rights reserved.
    └── b/
        ├── Cargo.toml      [package] authors = ["Rust Dev <dev@example.com>"]
        └── src/lib.rs      → @Copyright: Copyright (c) 2026-2026 Rust Dev All rights reserved.
```

With `companyName: "Example Co"` every file gets `Copyright (c) 2026-2026 Example Co All rights reserved.`; with no author in any manifest every file gets `Copyright (c) 2026-2026 All rights reserved.`

With `sampleOutput`, `detectedValues.companyName` is the resolved holder (`null` when there is none) and `detectedValues.companyNameSource` says where it came from: `{ from: "manifest", driver, manifest, dir }`, `{ from: "option" }` (`companyName`) or `{ from: "none" }`. `result.metadata` carries the same two values for the scan root. The `@Author` suffix set by `company` (`Name <Company>`) is a separate option and does not affect the holder.

## Creation date

`@Date` is "oldest wins": a file cannot have been created later than its first commit or than the time the filesystem first saw it, and an `@Date` older than both (a file brought in from elsewhere, or dated before it was committed) is kept.

- **New header** (no `@Date`, or one without a `(epoch)`): the older of the git first-commit date and the filesystem creation time. Git wins a tie.
- **Existing `@Date`**: kept exactly as written. Only its epoch is repaired when it disagrees with the datetime text.
- **Existing `@Date` with `fixCreatedDate`**: the oldest of the existing `@Date`, the git first commit, and the filesystem creation time. The existing value wins a tie, so the correction only ever moves `@Date` earlier. An existing value whose datetime is not recognised is replaced.

The filesystem creation time is the earlier of the file's birth time and its modification time. Content last written at the modification time existed by then, so it bounds creation even when the birth time is later (an extracted archive or a `cp -p` copy keeps the source's modification time). Where the platform reports no birth time, the modification time is used. A fresh clone or CI checkout gives every file a current filesystem time, so there the git first commit decides.

## Date checks

`check: true` / `--check` validates the `@Date` and `@Last modified time` values of every existing header and writes nothing. It compares instants, not strings, so the same moment written with another offset or in the space/`T` form is not drift. It is independent of the rendered-header diff: an author, identity, copyright, or other content difference never fails the check. Files without a header are skipped.

| Check                                | Fails the run                           | Meaning                                                                                                                                                  |
| ------------------------------------ | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `created-format` / `modified-format` | yes                                     | the value is not a `<datetime> (<epoch>)` pair with a recognised datetime (a datetime without a UTC offset is not recognised)                            |
| `created-epoch` / `modified-epoch`   | yes                                     | the parenthesised epoch is not the instant the datetime text describes                                                                                   |
| `created-newer-than-source`          | with `strictCreatedDate`, else advisory | `@Date` is later than the older of the git first commit and the filesystem creation time; the message names the older source. An earlier `@Date` is fine |
| `modified-git`                       | no (advisory)                           | `@Last modified time` is not the file's git last-commit date                                                                                             |

```bash
$ fix-headers --check --verbose
fix-headers check: scanned=3, drift=1, advisories=2
drift: src/epoch.mjs: @Date epoch 1758382412 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)
advisory: src/later.mjs: @Date 2026-09-21 09:00:00 -07:00 is later than the git first commit 2026-09-20T15:33:32+00:00 (1789918412)
advisory: src/later.mjs: @Last modified time 2026-09-21 09:00:00 -07:00 does not match the git last commit 2026-09-20T15:33:32+00:00 (1789918412)
$ echo $?
1
$ fix-headers --check --strict-created-date
fix-headers check: scanned=3, drift=2, advisories=1
drift: src/epoch.mjs: @Date epoch 1758382412 does not match 2026-09-20T15:33:32+00:00 (expected 1789918412)
drift: src/later.mjs: @Date 2026-09-21 09:00:00 -07:00 is later than the git first commit 2026-09-20T15:33:32+00:00 (1789918412)
```

A third file, `src/early.mjs`, has `@Date: 2026-09-20 08:28:32 -07:00`: five minutes before its first commit, as stamped from the file's creation time before it was committed. That is not drift, strict or not.

To make the created-date check fail CI, set `"strictCreatedDate": true` in the config file or pass `--strict-created-date`.

Advisories are counted in the summary and listed with `--verbose`; `--json` prints the full result and uses the same exit code. `--dry-run` still always exits `0`.

In a normal (writing) run, an epoch that disagrees with its datetime text is recomputed from the text; the datetime text itself is left as written. `created-newer-than-source` is corrected only with `fixCreatedDate` / `--fix-created-date`.

## Time zone

A header date is correct in any zone: the offset is only how the instant is shown, and the epoch in parentheses is the instant. So nothing is converted by default. `timezone` / `--timezone <name>` is for projects that want every date shown in one zone:

- **Dates fix-headers writes** are expressed in the zone: a new header's `@Date` (from the git first commit or the filesystem, see [Creation date](#creation-date)), an `@Date` moved by `fixCreatedDate`, and the `@Last modified time` stamped on every changed file.
- **Dates already in a header** are kept as written, unless `convertTimezone` / `--convert-timezone` is also set. That sweep rewrites existing `@Date` and `@Last modified time` values into the zone. A value whose datetime is not recognised is left alone, and so is one already in the zone's offset at that instant.

Only the wall-clock time and the offset change; the instant and the epoch stay the same. The offset is the zone's offset at that instant, from the time zone data built into Node (`Intl`), so daylight saving time is applied per date: with `America/Los_Angeles`, a January date is written at `-08:00` and a July date at `-07:00`. Half-hour and other zones work the same way (`Asia/Kolkata` is `+05:30`, `Pacific/Kiritimati` is `+14:00`). The zone name is validated with `Intl`, and an unknown name fails the run.

A converted value keeps its shape: the space form (`2026-01-18 20:39:48 -08:00`) stays in the space form, and the T-form (`2026-01-18T20:39:48-08:00`, as git dates are written) stays in the T-form. With `normalizeDateFormat` every date is then written in the T-form, in the zone.

Rewriting a date is a header change like any other, so a file the sweep rewrites also gets a fresh `@Last modified time`, the same as a file whose epoch is repaired or whose dates `normalizeDateFormat` rewrites. The first `--convert-timezone` run therefore restamps every managed file with a date outside the zone. A file whose dates are all in the zone already (or unrecognised) and whose header is otherwise current is not touched.

`--check` compares instants, so a date shown in another zone than `timezone` is not drift, and the check has no time zone rule.

```bash
$ fix-headers --timezone America/Los_Angeles --convert-timezone
```

```diff
- *	@Date: 2026-01-19 04:39:48 +00:00 (1768797588)
+ *	@Date: 2026-01-18 20:39:48 -08:00 (1768797588)
  ...
- *	@Last modified time: 2026-07-19T04:39:48+00:00 (1784435988)
+ *	@Last modified time: 2026-09-28 10:15:02 -07:00 (1790615702)
```

The `@Date` instant is unchanged; `@Last modified time` is restamped with the time of the run, in the zone.

## Which files are processed

By default every file with a supported extension is processed. Nothing is skipped because of its name: `node_modules`, `dist`, `build`, `coverage`, `tmp` and the like are processed unless something excludes them. Files are skipped only when:

- the project's ignore files ignore them, or
- you exclude them with `excludeFolders` / `--exclude-folder`.

The one exception is `.git`, git's own storage, which is never walked.

"Ignore files" means everything git itself honours: the root `.gitignore`, `.gitignore` files in subfolders (each applying to its own folder), `.git/info/exclude`, and the global excludes file (`core.excludesFile`), including negation patterns.

- **Inside a git work tree**, git decides. Discovery runs `git ls-files --cached --others --exclude-standard` once per repository and processes the files it lists. Tracked files are always processed, even when an ignore pattern matches them, because git does not treat tracked files as ignored. Starting discovery in a subfolder of a repository applies that repository's rules.
- **Outside a git work tree** (or when git is not installed), the `.gitignore` files found under the discovery root are parsed instead, each one scoped to its own folder, with deeper files taking precedence. `.git/info/exclude` and `core.excludesFile` belong to a repository, so they do not apply here.
- **A folder holding several repositories** is walked as usual, and every repository found inside it (a folder containing `.git`, including submodules and nested clones) applies its own ignore rules to its own files. The rules of the folder around a nested repository still decide whether that repository is walked at all.
- **A discovery root that the enclosing repository ignores** (for example `--input vendor/lib` when `vendor/` is in the repository's `.gitignore`) was asked for explicitly, so it is treated as a standalone folder: its own `.gitignore` files apply, the enclosing repository's do not.

`gitignore: false` turns all of this off, and `gitignore: "<file>"` / `["<file>", ...]` replaces it with exactly the listed files.

## Notes

- `excludeFolders` supports both folder-name and nested path matching.
- `includeFolders` entries never double-count a file. A folder that lies inside another recursive include is not walked a second time; the exception is a folder the outer walk never enters because `excludeFolders` excludes it (for example `node_modules/pkg` listed explicitly while `node_modules` is excluded), which keeps being walked on its own because it was named explicitly. An `includeFolders` entry does not override the ignore files: a folder they ignore contributes no files.
- File discovery is described in [Which files are processed](#which-files-are-processed).
- For monorepos, each file resolves its project from the nearest manifest in its parent tree (see [Project name and root](#project-name-and-root)).
- With `sampleOutput` enabled, each changed file includes `previousValue`, `newValue`, `diff`, `issues`, and `detectedValues` in results.

## Sample output

With `sampleOutput: true` (CLI: `--sample-output` or `--diff`), every changed entry in `result.changes` carries a `sample` object. It costs nothing when the option is off.

- `previousValue` - the existing header block, or `null` when the file had none.
- `newValue` - the header block this run writes.
- `diff` - a ready-to-print unified diff of the header block. The `---`/`+++` lines name the file (`a/<file>` / `b/<file>`, or `/dev/null` when there was no previous header, in which case the whole new header shows as added), and hunk line numbers are file line numbers.
- `issues` - one `{ field, previous, detected }` entry per header field whose written value differs from the existing header, in header order. Fields: `projectName`, `filename`, `createdAt`, `authorName`, `authorEmail`, `lastModifiedByName`, `lastModifiedByEmail`, `lastModifiedAt`, `copyrightStartYear`, `copyrightEndYear`, `companyName`. Values are the field text as written in the header (dates keep their `date (timestamp)` form); `previous` is `null` when the field was missing.
- `detectedValues` - the metadata resolved for the file. `projectNameSource` says where `projectName` came from: `{ from: "manifest", driver, manifest, dir }` (the driver, its manifest and the folder it sits in), `{ from: "folder", dir }` (the project root's folder name) or `{ from: "option" }` (`projectName`).

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
