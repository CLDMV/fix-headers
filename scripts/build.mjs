/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: scripts/build.mjs
 *	@Date: 2026-11-25T19:43:50-08:00 (1795664630)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T19:43:58-08:00 (1795664638)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Builds dist/ from src/, one output file per source file.
 *
 * Every `src/**\/*.mjs` is minified in place into the same relative path under dist/, with
 * its imports left as they are, so dist/ mirrors src/ file for file: nothing is bundled,
 * merged or duplicated. dist/cli.mjs is the package's "bin" and imports the library from
 * its sibling files, the same way src/cli.mjs does. src/index.cjs, the thin CommonJS
 * wrapper, is copied verbatim, so it stays as small as it is in src/.
 *
 * Sourcemaps are written for local debugging and left out of the tarball by package.json
 * "files". esbuild keeps the CLI's `#!` line.
 *
 * `npm run build` runs this file. Tests import `build()` to build into their own folder.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { build as esbuild } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Lists every `.mjs` file under a folder, recursively.
 * @param {string} folder - Folder to walk.
 * @returns {string[]} Absolute file paths, sorted.
 */
function listModules(folder) {
	return readdirSync(folder, { recursive: true, withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
		.map((entry) => join(entry.parentPath, entry.name))
		.sort();
}

/**
 * Builds the package output.
 * @param {{ srcDir?: string, outDir?: string }} [options={}] - `srcDir` defaults to the repo's
 *   src/ and `outDir` to its dist/. The output folder is removed first.
 * @returns {Promise<string[]>} Output paths written, relative to `outDir`.
 */
export async function build({ srcDir = join(repoRoot, "src"), outDir = join(repoRoot, "dist") } = {}) {
	rmSync(outDir, { recursive: true, force: true });
	const entryPoints = listModules(srcDir);
	await esbuild({
		entryPoints,
		outbase: srcDir,
		outdir: outDir,
		outExtension: { ".js": ".mjs" },
		bundle: false,
		format: "esm",
		platform: "node",
		target: "node18",
		minify: true,
		// Keep function and class names through minification (`fixHeaders.name`, stack traces).
		keepNames: true,
		sourcemap: true,
		logLevel: "warning"
	});
	mkdirSync(outDir, { recursive: true });
	copyFileSync(join(srcDir, "index.cjs"), join(outDir, "index.cjs"));
	return [...entryPoints.map((file) => relative(srcDir, file)), "index.cjs"];
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
	const written = await build();
	console.log(`built ${written.length} files into dist/`);
}
