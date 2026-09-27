/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tsup.config.mjs
 *	@Date: 2026-09-27 11:47:59 -07:00 (1790534879)
 *	@Author: Shinrai
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Shinrai (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27 11:50:38 -07:00 (1790535038)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Bundler config — produces the published dist/ and bin/ output from source.
 *
 * Three entries:
 *  - ESM API  → dist/index.mjs — `fixHeaders` named export plus the default export.
 *  - CJS API  → dist/index.cjs — built from src/index.cjs.mjs, which exposes only the
 *    default export; with `cjsInterop` that becomes `module.exports = fixHeaders`, the
 *    same shape the old hand-written index.cjs shim had, so `require()` callers keep
 *    getting the function itself.
 *  - CLI      → bin/fix-headers.mjs — ESM only, bundled from src/cli.mjs. bin/ is the
 *    stable published path (package.json "bin") but is a build artifact like dist/ — not
 *    tracked in git. esbuild keeps the entry's shebang, so the output stays executable.
 *
 * Runtime dependencies (package.json "dependencies") stay external. Sourcemaps are
 * generated for local debugging and excluded from the tarball via package.json "files".
 * Each output is one self-contained file (no shared chunks). Nothing here cleans the
 * output folders because the three builds run in parallel and two share dist/; the
 * `build` script clears dist/ and bin/ before invoking tsup instead.
 */
import { defineConfig } from "tsup";

const shared = {
	target: "node22",
	platform: "node",
	splitting: false,
	// Keep `node:` specifiers on built-in imports (tsup strips them by default).
	removeNodeProtocol: false,
	sourcemap: true,
	dts: false,
	minify: false
};

export default defineConfig([
	{
		...shared,
		entry: { index: "src/fix-header.mjs" },
		format: ["esm"],
		outDir: "dist",
		clean: false,
		outExtension() {
			return { js: ".mjs" };
		}
	},
	{
		...shared,
		entry: { index: "src/index.cjs.mjs" },
		format: ["cjs"],
		cjsInterop: true,
		// tsup only records a CJS chunk's exports (which cjsInterop needs) when the
		// CJS output is produced via its splitting path; with one entry there are no
		// extra chunks, so this changes nothing else about the output.
		splitting: true,
		outDir: "dist",
		clean: false,
		outExtension() {
			return { js: ".cjs" };
		}
	},
	{
		...shared,
		entry: { "fix-headers": "src/cli.mjs" },
		format: ["esm"],
		outDir: "bin",
		clean: false,
		outExtension() {
			return { js: ".mjs" };
		}
	}
]);
