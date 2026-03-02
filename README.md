# fix-headers

Multi-language source header normalizer for Node.js projects.

`fix-headers` scans project files, auto-detects project metadata (language, root, project name, git author/email), and inserts or updates standard file headers.

[![npm version]][npm_version_url] [![npm downloads]][npm_downloads_url] <!-- [![GitHub release]][github_release_url] -->[![GitHub downloads]][github_downloads_url] [![Last commit]][last_commit_url] <!-- [![Release date]][release_date_url] -->[![npm last update]][npm_last_update_url] [![Coverage]][coverage_url]

[![Contributors]][contributors_url] [![Sponsor shinrai]][sponsor_url]

## Features

- Auto-detects project type by marker files (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`) and YAML files (`.yaml`, `.yml`)
- Auto-detects author and email from git config/commit history
- Supports per-run overrides for every detected value
- Supports folder inclusion and exclusion configuration
- Supports detector-based monorepo scanning with nearest config resolution per file
- Supports per-detector syntax overrides for line and block comment tokens
- Supports both ESM and CJS consumers

## Install

```bash
npm i fix-headers
```

## Usage

### ESM

```js
import fixHeaders from "fix-headers";

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
- `--json`
- `--sample-output`
- `--force-author-update`
- `--use-gpg-signer-author`
- `--cwd <path>`
- `--input <path>`
- `--include-folder <path>` (repeatable)
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
const fixHeaders = require("fix-headers");

const result = await fixHeaders({ dryRun: true });
```

## API

### `fixHeaders(options?)`

Runs header normalization. Project/language/author/email metadata is auto-detected internally on each run.

Important options:

- `cwd?: string` - start directory for project detection
- `input?: string` - explicit single file or folder path to process
- `dryRun?: boolean` - compute changes without writing files
- `sampleOutput?: boolean` - include previous/new header sample text for changed files
- `configFile?: string` - load JSON options from file (resolved from `cwd`)
- `includeExtensions?: string[]` - file extensions to process
- `enabledDetectors?: string[]` - detector ids to enable (defaults to all)
- `disabledDetectors?: string[]` - detector ids to disable
- `detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>` - override detector comment syntax tokens
- `includeFolders?: string[]` - project-relative folders to scan
- `excludeFolders?: string[]` - folder names or relative paths to exclude
- `projectName?: string`
- `language?: string`
- `projectRoot?: string`
- `marker?: string | null`
- `authorName?: string`
- `authorEmail?: string`
- `forceAuthorUpdate?: boolean` - force update `@Author`/`@Email` to detected or overridden current values
- `useGpgSignerAuthor?: boolean` - use signed-commit UID (`%GS`) for detected `@Author` (includes signer comment when present)
- `companyName?: string` (default: `Catalyzed Motivation Inc.`)
- `copyrightStartYear?: number` (default: current year)

Example:

```js
const result = await fixHeaders({
	cwd: process.cwd(),
	dryRun: false,
	configFile: "fix-headers.config.json",
	includeFolders: ["src", "scripts"],
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

## Notes

- `excludeFolders` supports both folder-name and nested path matching.
- For monorepos, each file resolves metadata from the closest detector config in its parent tree.
- With `sampleOutput` enabled, each changed file includes `previousValue`, `newValue`, and `detectedValues` in results.

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
