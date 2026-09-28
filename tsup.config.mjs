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
 * Two builds plus one copied file:
 *  - ESM API  → dist/index.mjs — `fixHeaders` named export plus the default export.
 *  - CJS API  → dist/index.cjs — not built: src/cjs/index.cjs is a thin wrapper that
 *    `require()`s dist/index.mjs and returns its default export (`module.exports =
 *    fixHeaders`, the historical shape). tsup copies it into the ESM build's outDir via
 *    `publicDir`, so it follows any outDir override and never duplicates the library.
 *  - CLI      → bin/fix-headers.mjs — ESM only, bundled from src/cli.mjs. bin/ is the
 *    stable published path (package.json "bin") but is a build artifact like dist/ — not
 *    tracked in git. esbuild keeps the entry's shebang, so the output stays executable.
 *
 * Runtime dependencies (package.json "dependencies") stay external. Output is minified;
 * sourcemaps are generated for local debugging and excluded from the tarball via
 * package.json "files". Each output is one self-contained file (no shared chunks).
 * Nothing here cleans the output folders; the `build` script clears dist/ and bin/
 * before invoking tsup instead.
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
	minify: true,
	// Keep function and class names through minification (`fixHeaders.name`, stack traces).
	keepNames: true
};

export default defineConfig([
	{
		...shared,
		entry: { index: "src/fix-header.mjs" },
		format: ["esm"],
		publicDir: "src/cjs",
		outDir: "dist",
		clean: false,
		outExtension() {
			return { js: ".mjs" };
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
