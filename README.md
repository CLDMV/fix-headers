# @cldmv/fix-headers

**@cldmv/fix-headers** is a multi-language source header normalizer for Node.js projects. It scans a project's files, works out which project each file belongs to from the manifests around it (`package.json`, `pyproject.toml`, `composer.json`, `Cargo.toml`, `go.mod`, …), detects the author from git, and inserts or updates a standard header at the top of every file in that file's own comment syntax.

Headers stay correct without hand-editing: `@Date` follows the file's real creation time, `@Author` keeps the original author, `@Last modified by` names whoever last edited the file's content and `@Last modified time` only moves when the header changes, the `@Copyright` holder and years come from the manifest and the file's history, and `--check` validates existing headers in CI without writing anything. It runs as a `fix-headers` command line tool or as a library from ESM and CommonJS, and one shared config can serve every repository in an organisation.

> _One header format for every file in every repository, detected from the project itself and kept current by a single command._

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] <!-- [![GitHub release]][github_release_url] -->[![GitHub downloads]][github_downloads_url] [![Last commit]][last_commit_url] <!-- [![Release date]][release_date_url] -->[![npm last update]][npm_last_update_url] [![Coverage]][coverage_url]

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## ✨ What's New

### Latest: v2.2.1 (October 2026)

- **Development-setup patch, nothing the package ships changed** — the repository's own `fix:headers` run moves to `@cldmv/configs` 1.2.4, whose shared config no longer forces author updates; `dist/`, `bin/`, the types and the runtime dependency are exactly as in v2.2.0.
- [View full v2.2.1 Changelog](https://github.com/CLDMV/fix-headers/blob/master/docs/changelog/v2/v2.2.1.md)

### Recent Releases

- **v2.2.0** (October 2026) — `@Last modified by` names whoever last edited the file's content: a run that only rewrites a header keeps the recorded editor instead of writing the run's identity ([Changelog](https://github.com/CLDMV/fix-headers/blob/master/docs/changelog/v2/v2.2.0.md))
- **v2.1.4** (October 2026) — strict JSON, Markdown named with `--input` and files with no or an unhandled extension are skipped and reported instead of getting a JavaScript comment; `--input` is repeatable; dependency folders are never walked; `require()` fails clearly where Node.js cannot load ES modules ([Changelog](https://github.com/CLDMV/fix-headers/blob/master/docs/changelog/v2/v2.1.4.md))
- **v2.1.3** (October 2026) — CI and development-dependency maintenance with no runtime change: a skipped PR run can no longer satisfy `✅ Required PR Check` and let a pull request merge before its tests finish ([Changelog](https://github.com/CLDMV/fix-headers/blob/master/docs/changelog/v2/v2.1.3.md))
- **v2.1.2** (October 2026) — no runtime change: the repository adopts the shared CLDMV fix-headers config from `@cldmv/configs` and stamps uniform file headers across its own sources ([Changelog](https://github.com/CLDMV/fix-headers/blob/master/docs/changelog/v2/v2.1.2.md))

📚 For complete release notes, see the [docs/changelog/](https://github.com/CLDMV/fix-headers/tree/master/docs/changelog/) folder.

---

## 🚀 Key Features

- Finds the project each file belongs to from its manifest (`package.json`, `pyproject.toml` / `setup.cfg` / `setup.py`, `composer.json`, `Cargo.toml`, `go.mod`), whatever the file's type
- `@Project` is the name from that project's manifest, so a CSS, HTML, YAML or JSONC file in a Python, PHP, Rust or Go project gets that project's name too; the folder name is used only when no manifest provides one. Override it with `projectName`. See [Project name and root](#-project-name-and-root)
- Auto-detects author and email from git config/commit history
- Keeps the original `@Author`, and changes `@Last modified by` only when the file's content (everything outside the header) was edited, so a run that only rewrites headers never claims other people's files. See [Author and last modified](#-author-and-last-modified)
- Supports per-run overrides for every detected value
- Supports folder inclusion and exclusion configuration; skips only what the project's ignore files (everything git honours) or your own exclusions say
- Supports monorepos: every file resolves its own project from the nearest manifest in its parent tree
- Writes each header in the file's own comment syntax, and skips files that cannot carry one (strict JSON, plain text); Markdown gets a header only when you force it. See [Supported file types](#-supported-file-types)
- Supports per-detector syntax overrides for line and block comment tokens
- Config files can use `extends` to build on a shared config (an https URL, an npm package path or a file path), so one organisation-wide config serves every repository. See [Shared configs](#-shared-configs)
- Supports both ESM and CJS consumers

---

## 📦 Installation

### Requirements

- **Node.js 22.12.0 or later** (`engines.node` is `>=22.12.0`).
- The package is an ES module and loads with `import` on every supported version. `require("@cldmv/fix-headers")` loads the ES module build synchronously, which needs Node.js ^20.19.0 or >=22.12.0; on older Node.js, use `import()` instead.

### Install

```bash
npm i @cldmv/fix-headers
```

As a development dependency, for the CLI in `package.json` scripts:

```bash
npm i -D @cldmv/fix-headers
```

---

## 🚀 Quick Start

Preview what would change, then write it:

```bash
fix-headers --dry-run --verbose
fix-headers
```

From ESM:

```js
import fixHeaders from "@cldmv/fix-headers";

const result = await fixHeaders({ dryRun: true });
```

From CommonJS:

```js
const fixHeaders = require("@cldmv/fix-headers");

const result = await fixHeaders({ dryRun: true });
```

`result` lists every scanned file and the changes a writing run makes; see [API](#-api) for the options and [Sample output](#-sample-output) for per-file detail.

---

## 💻 CLI

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
- `--check` - validate header dates without writing; exits `1` on date drift (see [Date checks](#-date-checks))
- `--fix-created-date`
- `--strict-created-date`
- `--normalize-date-format`
- `--timezone <name>` - write new header dates in an IANA time zone (see [Time zone](#-time-zone))
- `--convert-timezone` - with `--timezone`, also rewrite existing header dates into that zone
- `--json`
- `--verbose` - list updated files; together with `--sample-output` or `--diff`, also list each file's field differences (`authorName: found "X", expected "Y"`)
- `--sample-output` - print the previous/new header and detected values for each changed file
- `--diff` - print a unified diff of each changed file's header (implies sample output)
- `--force-author-update` - replace an existing `@Author`/`@Email` with the detected identity (see [Author and last modified](#-author-and-last-modified))
- `--force-last-modified-author-update` - write the detected identity as `@Last modified by` on every file, edited or not (rarely needed, see [Author and last modified](#-author-and-last-modified))
- `--use-gpg-signer-author` (the signing key's UID name, with the OpenPGP UID comment dropped)
- `--cwd <path>`
- `--input <path>` (repeatable) - process these files and folders instead of the whole project: the union of every value, each file once (`--input src/a.mjs --input src/b.mjs --input scripts`). A named file whose type cannot carry a header (see [Supported file types](#-supported-file-types)) is reported as `skipped: <file> (<reason>)` and left unchanged
- `--include-folder <path>` (repeatable) - naming a folder inside a dependency folder (`--include-folder node_modules/pkg`) processes it, although discovery otherwise skips dependency folders (see [Which files are processed](#-which-files-are-processed))
- `--include-folder-non-recursive <path>` (repeatable) - include only that folder's own files, not its subfolders
- `--exclude-folder <path>` (repeatable)
- `--include-extension <ext>` (repeatable)
- `--enable-detector <id>` / `--disable-detector <id>` (repeatable)
- `--force-detector <id>` (repeatable) - turn on a force-only detector; `--force-detector markdown` gives `.md` / `.markdown` files an HTML-comment header (see [Supported file types](#-supported-file-types))
- `--project-name <name>`
- `--author-name <name>` / `--author-email <email>`
- `--company-name <name>` - the `@Copyright` holder for every file, instead of the one the manifests provide (see [Copyright holder](#-copyright-holder))
- `--copyright-start-year <year>` - the `@Copyright` start year for every file (default: the year of each file's `@Date`)
- `--spacing <n>` / `--margin <n>` - the header's layout: empty comment lines inside the header's edges (default `1`) and blank lines after it (default `2`), see [Header layout](#-header-layout)
- `--config <json-file>` - load options from a JSON file, which may use `extends` to build on shared configs (see [Shared configs](#-shared-configs)); flags on the command line win over the file

---

## 🔧 API

### `fixHeaders(options?)`

Runs header normalization. Project/language/author/email metadata is auto-detected internally on each run.

Important options:

- `cwd?: string` - start directory for project detection
- `input?: string | string[]` - file or folder paths to process instead of the whole project. Every path is processed: the files named plus the files discovered under the folders named, each file once, in the order given. A path that does not exist throws; an empty list means no input. A file whose type cannot carry a header is listed in the result's `skipped` instead of being changed (see [Supported file types](#-supported-file-types))
- `dryRun?: boolean` - compute changes without writing files
- `check?: boolean` - validate each existing header's dates and write nothing (implies `dryRun`). Each result entry gets `dateIssues`, and the result gets `filesWithDateDrift` and `dateAdvisories`. See [Date checks](#-date-checks)
- `fixCreatedDate?: boolean` - move an existing `@Date` back to the oldest of itself, the file's git first commit, and its filesystem creation time (see [Creation date](#-creation-date)). It only ever moves `@Date` earlier. Off by default: an existing `@Date` is kept as written
- `strictCreatedDate?: boolean` - with `check`, count a `@Date` later than the file's git first commit or filesystem creation time as drift (fails the run). Off by default, where it is an advisory
- `normalizeDateFormat?: boolean` - write every header date in the git `%aI` form (`2026-03-01T17:59:32-08:00`), keeping each date's offset and instant. Off by default; the first run rewrites (and restamps) every managed file whose dates use the space form (`2026-03-01 17:59:32 -08:00`)
- `timezone?: string` - an IANA time zone name (`America/Los_Angeles`, `UTC`, `Asia/Kolkata`, ...). Every date fix-headers writes (a new header's `@Date`, and `@Last modified time`) is expressed in that zone; the instant and its epoch never change. Unset (the default): dates are written as today. An unknown zone name throws. See [Time zone](#-time-zone)
- `convertTimezone?: boolean` - with `timezone`, also rewrite the existing `@Date` and `@Last modified time` values of every header into that zone, keeping each instant. Throws when `timezone` is not set. See [Time zone](#-time-zone)
- `sampleOutput?: boolean` - include a `sample` for each changed file: previous/new header text, a unified `diff`, per-field `issues`, and `detectedValues` (see [Sample output](#-sample-output))
- `configFile?: string` - load JSON options from file (resolved from `cwd`). The file may use `extends` to build on shared configs by URL, npm package path or file path (see [Shared configs](#-shared-configs)); options passed in the call win over everything from files
- `includeExtensions?: string[]` - file extensions to process
- `enabledDetectors?: string[]` - detector ids to enable (defaults to every detector that is not force-only)
- `disabledDetectors?: string[]` - detector ids to disable
- `forcedDetectors?: string[]` - force-only detector ids to turn on (currently only `"markdown"`). A forced detector is used for `input` and for discovery alike, even when `enabledDetectors` does not list it; `disabledDetectors` still turns it off. An id that is unknown or does not need forcing throws. See [Supported file types](#-supported-file-types)
- `detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>` - override detector comment syntax tokens
- `includeFolders?: Array<string | { path: string, recursive?: boolean }>` - project-relative folders to scan. A string entry is scanned recursively; `{ path, recursive: false }` includes only that folder's own files (for example `{ path: ".", recursive: false }` for the project-root files without the whole tree). Overlapping entries are collapsed, so every file is scanned once however the folders nest or are spelled (`"."` next to `"src"`, `"src"` next to `"src/core"`, `"./src"` next to `"src/"`)
- `excludeFolders?: string[]` - folder names or relative paths to exclude, on top of what the ignore files exclude. Dependency folders are always excluded: `node_modules`, `bower_components`, `jspm_packages`, `.pnpm-store` and `.yarn` at any depth, and a `vendor` folder holding Composer's `autoload.php` or Go's `modules.txt` (see [Which files are processed](#-which-files-are-processed)); list a path inside one in `includeFolders` (or pass it as `input`) to process it anyway
- `gitignore?: boolean | string | string[]` - which ignore files decide what discovery skips. Omitted (or `true`): every ignore file git honours (see [Which files are processed](#-which-files-are-processed)). `false`: no ignore files, every file is processed except those in dependency folders. A path or array of paths (relative to the project root): exactly those files, parsed with `.gitignore` syntax, without asking git.
- `projectName?: string` - the `@Project` value for every file, instead of the manifest name
- `language?: string` - the reported `language` for every file (does not change comment syntax or project resolution)
- `projectRoot?: string` - the project root for every file (the base of `@Filename` and of git history lookups) and the scan root
- `marker?: string | null` - the reported `marker` for every file
- `authorName?: string`
- `authorEmail?: string`
- `company?: string` - appends to `@Author` as `Name <Company>`
- `forceAuthorUpdate?: boolean` - replace an existing `@Author`/`@Email` with the detected (or overridden) identity. Off by default: `@Author` is the file's original author, and an existing value is never changed; a missing one is filled in. See [Author and last modified](#-author-and-last-modified)
- `forceLastModifiedAuthorUpdate?: boolean` - write the detected (or overridden) identity as `@Last modified by` on every file, whether its content was edited or not, and update files whose only difference is that identity. Off by default, and not needed for normal use: `@Last modified by` already becomes the run's identity on every file whose content was edited. See [Author and last modified](#-author-and-last-modified)
- `useGpgSignerAuthor?: boolean` - take the detected `@Author` name from the user ID of the OpenPGP key git signs commits with (`user.signingkey`, read through `gpg.openpgp.program` / `gpg.program` / `gpg`; the first user ID that is not revoked or expired). The OpenPGP UID comment is dropped, so `Nate Corcoran (2023 PC) <nate@example.com>` becomes `Nate Corcoran` (with `company: "CLDMV"`: `Nate Corcoran <CLDMV>`). It describes whoever runs the tool, whatever the last commit is — a squash merge made by GitHub or a bot has no locally verifiable signer. With no readable OpenPGP signing key (none configured, `gpg.format` is `ssh`/`x509`, or gpg is unavailable) it falls back to the last commit's signer (`%GS`), then `git config user.name`, then the last commit's author
- `companyName?: string` - the `@Copyright` holder for every file, instead of the one the project's manifests provide. There is no built-in default: unset, the holder comes from the manifests, and with none it is left out of the line (see [Copyright holder](#-copyright-holder))
- `copyrightStartYear?: number` - the `@Copyright` start year for every file. Unset (the default): each file's start year is the year of its own `@Date`, see [Copyright years](#-copyright-years)
- `spacing?: number` - empty comment lines just inside the header's opening and just before its closing. Default `1`, see [Header layout](#-header-layout)
- `margin?: number` - blank lines between the header and the file's next content. Default `2`, see [Header layout](#-header-layout)

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

---

## 🧩 Shared configs

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

---

## 🔎 Project name and root

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
2. **Order.** When several drivers claim that folder, the file's native driver is read first (a `.py` file reads `python` first), then the fixed order `node`, `python`, `php`, `rust`, `go`. Language-neutral files (CSS, HTML, YAML, JSONC, …) use the fixed order.
3. **Per-field fallback.** Each value is taken from the first driver in that order whose manifest provides it. In a folder with a nameless `package.json` and a named `pyproject.toml`, every file gets the `pyproject.toml` name.
4. **Climbing.** A value no driver at the project root provides is looked up the same way in each ancestor folder a driver claims, up to and including the scan root (`projectRoot`, else `cwd`), never above it. A nameless sub-package therefore takes the name of the repository around it. Only values climb: the project root, and with it `@Filename` and the git lookups, stays the nearest claimed folder.
5. **Folder name.** When nothing up to the scan root provides a name, `@Project` is the project root's folder name.

A folder holding `.git` is a repository boundary: neither the root search nor the climb goes past it, so a nested repository without a manifest is a project of its own. With no manifest up to the repository root, that repository root is the project root and its folder name is the name. With neither a manifest nor a repository anywhere above the file, the file's own folder is the project root: `@Project` is that folder's name and `@Filename` is `/<file name>`.

`projectName`, `projectRoot`, `language` and `marker` override the detected values for every file. The copyright holder is resolved from the same manifests by the same rules, see [Copyright holder](#-copyright-holder).

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

---

## 📜 Copyright holder

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

---

## 📅 Creation date

`@Date` is "oldest wins": a file cannot have been created later than its first commit or than the time the filesystem first saw it, and an `@Date` older than both (a file brought in from elsewhere, or dated before it was committed) is kept.

- **New header** (no `@Date`, or one without a `(epoch)`): the older of the git first-commit date and the filesystem creation time. Git wins a tie.
- **Existing `@Date`**: kept exactly as written. Only its epoch is repaired when it disagrees with the datetime text.
- **Existing `@Date` with `fixCreatedDate`**: the oldest of the existing `@Date`, the git first commit, and the filesystem creation time. The existing value wins a tie, so the correction only ever moves `@Date` earlier. An existing value whose datetime is not recognised is replaced.

The filesystem creation time is the earlier of the file's birth time and its modification time. Content last written at the modification time existed by then, so it bounds creation even when the birth time is later (an extracted archive or a `cp -p` copy keeps the source's modification time). Where the platform reports no birth time, the modification time is used. A fresh clone or CI checkout gives every file a current filesystem time, so there the git first commit decides.

---

## 👤 Author and last modified

`@Author` / `@Email` name the file's original author, and `@Last modified by` / `@Last modified time` its last edit.

- **`@Author` / `@Email`** are written once. An existing value is never changed, whoever runs the tool, unless `forceAuthorUpdate` is set. A file without one gets the detected identity.
- **`@Last modified by`** changes only when the file's **content** was edited: everything outside the header. It then becomes the identity detected for the run (`authorName` / `authorEmail`, or git as described under `useGpgSignerAuthor`). Changes fix-headers makes to the header on its own, such as the date format (`normalizeDateFormat`), an epoch repair, `@Date` (`fixCreatedDate`), a time zone conversion, the frame, spacing or margin, or the `@Project`, `@Filename` or `@Copyright` values, keep the recorded editor.
- **`@Last modified time`** is restamped with the time of the run whenever fix-headers rewrites the header, header-only rewrites included. A file whose header is already current is not touched.

Whether the content was edited is decided against git `HEAD`. The header is taken out of the file and out of its `HEAD` version (`git show HEAD:<path>`), along with the blank lines after it, and the rest is compared:

| File                                                         | Content edited?            | `@Author`                  | `@Last modified by` | `@Last modified time` |
| ------------------------------------------------------------ | -------------------------- | -------------------------- | ------------------- | --------------------- |
| Tracked, body the same as at `HEAD`, header rewritten        | no                         | kept                       | kept                | now                   |
| Tracked, body differs from `HEAD`                            | yes                        | kept                       | run identity        | now                   |
| Not in `HEAD` (new, untracked or ignored, or no commits yet) | yes                        | kept (filled when missing) | run identity        | now                   |
| Outside a git work tree, header rewritten                    | cannot tell, treated as no | kept                       | kept                | now                   |
| Header already current, content not edited                   | no                         | unchanged                  | unchanged           | unchanged             |

A missing field is filled with the run identity in every row, and a file without a header gets the run identity in both. Adding a header to a committed file is not a content edit, so a later header-only run by someone else keeps whoever was recorded then.

`@Last modified time` also moves for a content edit by the editor already recorded: when the body differs from `HEAD` and the recorded time is older than the file's last commit, the edit has not been stamped yet, so it is restamped. Once stamped, the time is newer than the last commit, and running fix-headers again changes nothing until the next commit.

The check compares the working tree with `HEAD`, so run fix-headers before committing (a pre-commit hook, or `npm run fix:headers` before `git commit`). Content committed without a run is not detected later: at that point the body matches `HEAD`.

`forceLastModifiedAuthorUpdate` writes the run identity as `@Last modified by` on every file, edited or not. It is the old behaviour for configurations that relied on it; with content-edit detection it is not needed for normal use.

---

## 📆 Copyright years

`@Copyright: Copyright (c) <start>-<end> <companyName> All rights reserved.`

- **`<start>`** is `copyrightStartYear` when it is set. Otherwise it is the year of the file's `@Date` as resolved above: the existing value, the git first commit or filesystem creation time for a new header, or the earlier date `fixCreatedDate` moves it to. The year is read in the zone the date is written in: the `timezone` option when it is set, else the date's own offset. `2019-12-31T23:30:00-08:00` gives `2019`, and `2020` with `timezone: "UTC"`. An `@Date` whose datetime is not recognised gives the year of its epoch in the local time zone.
- **`<end>`** is the year of the run.

A file created in 2019 therefore gets `2019-2026` when fix-headers runs in 2026, not `2026-2026`.

---

## 📐 Header layout

Two options set the shape of the header, and both apply to every file type.

- **`spacing`** (default `1`) is the number of empty comment lines just inside the header's opening and just before its closing. A block header gets an empty ` *` line under `/**` and above ` */`; a line-comment header gets a bare `#` (or the language's own prefix) above and below the fields.
- **`margin`** (default `2`) is the number of blank lines between the header and the file's next content.

With the defaults a JavaScript file and a YAML file look like this:

```text
/**
 *
 *	@Project: @cldmv/example
 *	@Filename: /src/index.mjs
 *	...
 *	@Copyright: Copyright (c) 2026-2026 Example Inc. All rights reserved.
 *
 */


export const value = 1;
```

```text
#
#	@Project: @cldmv/example
#	@Filename: /.github/workflows/ci.yml
#	...
#	@Copyright: Copyright (c) 2026-2026 Example Inc. All rights reserved.
#


name: CI
```

With `spacing: 0, margin: 1` the header is compact, with no empty comment lines and a single blank line after it. Both accept any whole number of `0` or more; anything else is rejected before a file is touched.

An existing header is restyled in place to match, so changing either option rewrites the layout of every header on the next run, and a run with unchanged options finds nothing to update. A line-comment header always keeps at least one blank line after it, even with `margin: 0`, so a comment that follows the file's header is not read as part of it.

---

## ✅ Date checks

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

---

## 🌍 Time zone

A header date is correct in any zone: the offset is only how the instant is shown, and the epoch in parentheses is the instant. So nothing is converted by default. `timezone` / `--timezone <name>` is for projects that want every date shown in one zone:

- **Dates fix-headers writes** are expressed in the zone: a new header's `@Date` (from the git first commit or the filesystem, see [Creation date](#-creation-date)), an `@Date` moved by `fixCreatedDate`, and the `@Last modified time` stamped on every changed file.
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

---

## 📑 Supported file types

Each file type is handled by a detector, which decides the header's comment syntax. A file is given a header only when an enabled detector handles its extension:

| Detector   | Extensions                    | Header comment | Default                                    |
| ---------- | ----------------------------- | -------------- | ------------------------------------------ |
| `node`     | `.js .mjs .cjs .ts .tsx .jsx` | `/** … */`     | on                                         |
| `json`     | `.jsonc .json5 .jsonv`        | `/** … */`     | on                                         |
| `css`      | `.css`                        | `/* … */`      | on                                         |
| `html`     | `.html .htm`                  | `<!-- … -->`   | on                                         |
| `yaml`     | `.yaml .yml`                  | `# …`          | on                                         |
| `python`   | `.py`                         | `# …`          | on                                         |
| `php`      | `.php`                        | `/** … */`     | on                                         |
| `rust`     | `.rs`                         | `/** … */`     | on                                         |
| `go`       | `.go`                         | `/** … */`     | on                                         |
| `markdown` | `.md .markdown`               | `<!-- … -->`   | off; only with `--force-detector markdown` |

Every other file is skipped and left byte-for-byte unchanged, including when you name it with `--input` or add its extension with `includeExtensions`:

- **Strict JSON (`.json`)** has no comment syntax, so it never gets a header. A comment would make `package.json` and every other JSON file invalid.
- **Files with no extension, or an extension no enabled detector handles** (`.txt`, `.toml`, a disabled detector's extensions, …) are skipped instead of being given a guessed comment.
- **Markdown** is skipped unless the `markdown` detector is forced with `--force-detector markdown` (`forcedDetectors: ["markdown"]` in the API or a config file). Naming a `.md` file with `--input` does not force it. A forced header is an HTML comment, which Markdown renderers do not display; it goes below any YAML front matter (`---` … `---`), and later runs update it in place. Forcing applies to discovery too, so a repo-wide run with the option also stamps `README.md` and changelogs; to stamp one file, pass the option together with `--input <file>`. `.mdx` is not covered, because MDX does not accept HTML comments.

A skipped file is listed in the result's `skipped` array as `{ file, reason }` and counted in `filesSkipped`, not in `filesScanned` or `changes`. The CLI adds `skipped=<n>` to its summary and prints one `skipped: <file> (<reason>)` line per file:

```sh
$ fix-headers --input package.json
fix-headers complete: scanned=0, updated=0, skipped=1, dryRun=false
skipped: package.json (no enabled detector handles .json files)
```

---

## 📁 Which files are processed

By default every file with a supported extension (see [Supported file types](#-supported-file-types)) is processed. Build output is not skipped by name: `dist`, `build`, `coverage`, `tmp` and the like are processed unless something excludes them. Files are skipped only when:

- they are inside a dependency folder (below),
- the project's ignore files ignore them, or
- you exclude them with `excludeFolders` / `--exclude-folder`.

`.git`, git's own storage, is never walked. Neither are dependency folders, which hold installed third-party code and never the project's own source. They are skipped at any depth (a sub-package's own `node_modules` included) and whatever the ignore files say, so a project with no `.gitignore`, a tracked dependency folder or `gitignore: false` does not stamp headers into them:

- `node_modules`, `bower_components`, `jspm_packages`, `.pnpm-store` and `.yarn`
- `vendor`, but only when it holds Composer's `vendor/autoload.php` or Go's `vendor/modules.txt`. Any other `vendor` folder is processed, because the name is also used for code the project maintains itself (front-end `vendor/` scripts, Laravel's published `resources/views/vendor`). Exclude such a folder with `excludeFolders` if it holds third-party code.

A path inside a dependency folder that you name explicitly is still processed: an `includeFolders` / `--include-folder` entry such as `node_modules/pkg`, or an `input` / `--input` file or folder.

"Ignore files" means everything git itself honours: the root `.gitignore`, `.gitignore` files in subfolders (each applying to its own folder), `.git/info/exclude`, and the global excludes file (`core.excludesFile`), including negation patterns.

- **Inside a git work tree**, git decides. Discovery runs `git ls-files --cached --others --exclude-standard` once per repository and processes the files it lists. Tracked files are always processed, even when an ignore pattern matches them, because git does not treat tracked files as ignored. Starting discovery in a subfolder of a repository applies that repository's rules.
- **Outside a git work tree** (or when git is not installed), the `.gitignore` files found under the discovery root are parsed instead, each one scoped to its own folder, with deeper files taking precedence. `.git/info/exclude` and `core.excludesFile` belong to a repository, so they do not apply here.
- **A folder holding several repositories** is walked as usual, and every repository found inside it (a folder containing `.git`, including submodules and nested clones) applies its own ignore rules to its own files. The rules of the folder around a nested repository still decide whether that repository is walked at all.
- **A discovery root that the enclosing repository ignores** (for example `--input vendor/lib` when `vendor/` is in the repository's `.gitignore`) was asked for explicitly, so it is treated as a standalone folder: its own `.gitignore` files apply, the enclosing repository's do not.

`gitignore: false` turns all of this off, and `gitignore: "<file>"` / `["<file>", ...]` replaces it with exactly the listed files.

---

## 📝 Notes

- `excludeFolders` supports both folder-name and nested path matching.
- `includeFolders` entries never double-count a file. A folder that lies inside another recursive include is not walked a second time; the exception is a folder the outer walk never enters because it is a dependency folder or `excludeFolders` excludes it (for example `node_modules/pkg` listed explicitly), which keeps being walked on its own because it was named explicitly. An `includeFolders` entry does not override the ignore files: a folder they ignore contributes no files.
- File discovery is described in [Which files are processed](#-which-files-are-processed).
- For monorepos, each file resolves its project from the nearest manifest in its parent tree (see [Project name and root](#-project-name-and-root)).
- With `sampleOutput` enabled, each changed file includes `previousValue`, `newValue`, `diff`, `issues`, and `detectedValues` in results.

---

## 🔍 Sample output

With `sampleOutput: true` (CLI: `--sample-output` or `--diff`), every changed entry in `result.changes` carries a `sample` object. It costs nothing when the option is off.

- `previousValue` - the existing header block, or `null` when the file had none.
- `newValue` - the header block this run writes.
- `diff` - a ready-to-print unified diff of the header block. The `---`/`+++` lines name the file (`a/<file>` / `b/<file>`, or `/dev/null` when there was no previous header, in which case the whole new header shows as added), and hunk line numbers are file line numbers.
- `issues` - one `{ field, previous, detected }` entry per header field whose written value differs from the existing header, in header order. Fields: `projectName`, `filename`, `createdAt`, `authorName`, `authorEmail`, `lastModifiedByName`, `lastModifiedByEmail`, `lastModifiedAt`, `copyrightStartYear`, `copyrightEndYear`, `companyName`. Values are the field text as written in the header (dates keep their `date (timestamp)` form); `previous` is `null` when the field was missing.
- `detectedValues` - the metadata resolved for the file. `projectNameSource` says where `projectName` came from: `{ from: "manifest", driver, manifest, dir }` (the driver, its manifest and the folder it sits in), `{ from: "folder", dir }` (the project root's folder name) or `{ from: "option" }` (`projectName`). `copyrightStartYear` is the start year written for the file, and `copyrightStartYearSource` says where it came from: `"option"` (`copyrightStartYear`) or `"created-date"` (the year of the file's `@Date`, see [Copyright years](#-copyright-years)). The run-level `result.metadata.copyrightStartYear` is the `copyrightStartYear` option, or `null` when it is not set.

`issues` compares the existing header against what is actually written, not against the raw detected metadata. fix-headers preserves an existing `@Author`/`@Email` unless `forceAuthorUpdate` is set, and an existing `@Last modified by` unless the file's content was edited or `forceLastModifiedAuthorUpdate` is set (see [Author and last modified](#-author-and-last-modified)), so those fields only appear when they really change. An updated file always gets a fresh `@Last modified time`, so `lastModifiedAt` is listed for every changed file that already had a header.

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

---

## 📚 Documentation

- **[Changelog](https://github.com/CLDMV/fix-headers/tree/master/docs/changelog/)** — release notes for every version (v1 and v2)
- **[Release notes on GitHub](https://github.com/CLDMV/fix-headers/releases)** — the same notes attached to each release tag

[![CodeFactor]][codefactor_url] [![OpenSSF Scorecard]][ossf_scorecard_url] [![npms.io score]][npms_url] [![npm unpacked size]][npm_size_url] [![Repo size]][repo_size_url]

---

## 🤝 Contributing

Bug reports and pull requests are welcome on [GitHub](https://github.com/CLDMV/fix-headers/issues). Pull requests target the `next` branch; releases ship from `next` to `master`.

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

---

## 🔗 Links

- **npm**: [@cldmv/fix-headers](https://www.npmjs.com/package/@cldmv/fix-headers)
- **GitHub**: [CLDMV/fix-headers](https://github.com/CLDMV/fix-headers)
- **Issues**: [GitHub Issues](https://github.com/CLDMV/fix-headers/issues)
- **Changelog**: [docs/changelog/](https://github.com/CLDMV/fix-headers/tree/master/docs/changelog/)
- **Releases**: [GitHub Releases](https://github.com/CLDMV/fix-headers/releases)

---

## 📄 License

[![GitHub license]][github_license_url] [![npm license]][npm_license_url]

Apache-2.0 © Shinrai / CLDMV

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
[codefactor]: https://img.shields.io/codefactor/grade/github/CLDMV/fix-headers?style=for-the-badge&logo=codefactor&logoColor=white&labelColor=F44A6A
[codefactor_url]: https://www.codefactor.io/repository/github/cldmv/fix-headers
[openssf scorecard]: https://img.shields.io/ossf-scorecard/github.com/CLDMV/fix-headers?style=for-the-badge&label=OpenSSF%20Scorecard
[ossf_scorecard_url]: https://scorecard.dev/viewer/?uri=github.com/CLDMV/fix-headers
[npms.io score]: https://img.shields.io/npms-io/final-score/%40cldmv%2Ffix-headers?style=for-the-badge&logo=npms&logoColor=white&labelColor=0B5D57
[npms_url]: https://npms.io/search?q=%40cldmv%2Ffix-headers
[npm unpacked size]: https://img.shields.io/npm/unpacked-size/%40cldmv%2Ffix-headers.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_size_url]: https://www.npmjs.com/package/@cldmv/fix-headers
[repo size]: https://img.shields.io/github/repo-size/CLDMV/fix-headers?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[repo_size_url]: https://github.com/CLDMV/fix-headers
[github license]: https://img.shields.io/github/license/CLDMV/fix-headers.svg?style=for-the-badge&logo=github&logoColor=white&labelColor=181717
[github_license_url]: https://github.com/CLDMV/fix-headers/blob/HEAD/LICENSE
[npm license]: https://img.shields.io/npm/l/%40cldmv%2Ffix-headers.svg?style=for-the-badge&logo=npm&logoColor=white&labelColor=CB3837
[npm_license_url]: https://www.npmjs.com/package/@cldmv/fix-headers
