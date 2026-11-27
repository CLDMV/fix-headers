/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: src/core/declaration-sources.mjs
 *	@Date: 2026-11-27T12:44:03-08:00 (1795812243)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T12:44:52-08:00 (1795812292)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Maps a generated TypeScript declaration back to the source file `tsc` emitted it
 * from, using the tsconfig the declarations were built with.
 *
 * `tsc` copies a source's leading comment into its declaration only when it can keep it; when
 * the header is followed by `import` lines it is dropped. A declaration without a header can then
 * take its source's header dates and author instead of being stamped as new with the build time.
 * @module fix-headers/core/declaration-sources
 */
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

/**
 * Declaration file name: stem and kind (`ts`, `mts` or `cts`).
 * @type {RegExp}
 */
const DECLARATION_FILE = /^(.+)\.d\.(ts|mts|cts)$/i;

/**
 * The source extensions `tsc` emits each declaration kind from, in lookup order.
 * @type {Record<string, string[]>}
 */
const DECLARATION_SOURCES = {
	ts: [".ts", ".tsx", ".js", ".jsx"],
	mts: [".mts", ".mjs"],
	cts: [".cts", ".cjs"]
};

/**
 * Tsconfig files tried, in order, when no `tsconfig` option is given (relative to the scan root).
 * @type {string[]}
 */
const DEFAULT_TSCONFIGS = [".configs/tsconfig.json", "tsconfig.json"];

/**
 * @typedef {{ rootDir: string | null, outDir: string | null, declarationDir: string | null, configDir: string }} DeclarationLayout
 */

/**
 * Parses tsconfig JSON, which allows comments and trailing commas.
 * @param {string} text - File content.
 * @returns {any} Parsed value.
 */
export function parseJsonc(text) {
	let out = "";
	let inString = false;
	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		const next = text[index + 1];
		if (inString) {
			out += char;
			if (char === "\\") {
				out += next ?? "";
				index += 1;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}
		if (char === '"') {
			inString = true;
			out += char;
		} else if (char === "/" && next === "/") {
			while (index < text.length && text[index] !== "\n") {
				index += 1;
			}
			out += "\n";
		} else if (char === "/" && next === "*") {
			const end = text.indexOf("*/", index + 2);
			index = end === -1 ? text.length : end + 1;
		} else if (char === "}" || char === "]") {
			// Drop a trailing comma before the closing bracket.
			const trimmed = out.trimEnd();
			out = (trimmed.endsWith(",") ? trimmed.slice(0, -1) : out) + char;
		} else {
			out += char;
		}
	}
	return JSON.parse(out);
}

/**
 * Resolves an `extends` entry relative to the config that names it: a path, or a package export.
 * @param {string} reference - The `extends` value.
 * @param {string} configPath - The config that names it.
 * @returns {string} Absolute path of the extended config.
 */
function resolveExtends(reference, configPath) {
	if (reference.startsWith(".") || isAbsolute(reference)) {
		const target = resolve(dirname(configPath), reference);
		return target.endsWith(".json") ? target : `${target}.json`;
	}
	return createRequire(configPath).resolve(reference);
}

/**
 * Reads a tsconfig and the configs it extends, resolving each directory option against the
 * folder of the config that sets it (a later config overrides an earlier one, as in `tsc`).
 * @param {string} configPath - Absolute tsconfig path.
 * @param {Set<string>} [seen] - Configs already read (guards against `extends` cycles).
 * @returns {Promise<DeclarationLayout>} The directory options that matter for declarations.
 */
export async function readDeclarationLayout(configPath, seen = new Set()) {
	if (seen.has(configPath)) {
		throw new Error(`tsconfig extends itself: ${configPath}`);
	}
	seen.add(configPath);
	const config = parseJsonc(await readFile(configPath, "utf8"));
	/** @type {DeclarationLayout} */
	let layout = { rootDir: null, outDir: null, declarationDir: null, configDir: dirname(configPath) };
	const parents = config.extends === undefined ? [] : Array.isArray(config.extends) ? config.extends : [config.extends];
	for (const parent of parents) {
		const inherited = await readDeclarationLayout(resolveExtends(parent, configPath), seen);
		layout = {
			rootDir: inherited.rootDir ?? layout.rootDir,
			outDir: inherited.outDir ?? layout.outDir,
			declarationDir: inherited.declarationDir ?? layout.declarationDir,
			configDir: layout.configDir
		};
	}
	const options = config.compilerOptions ?? {};
	for (const key of /** @type {const} */ (["rootDir", "outDir", "declarationDir"])) {
		if (typeof options[key] === "string") {
			layout[key] = resolve(dirname(configPath), options[key]);
		}
	}
	return layout;
}

/**
 * Whether a path exists and is a file.
 * @param {string} filePath - Path.
 * @returns {Promise<boolean>} True for a file.
 */
async function isFile(filePath) {
	const stats = await stat(filePath).catch(() => null);
	return stats !== null && stats.isFile();
}

/**
 * Finds the source a declaration was emitted from under a layout: the declaration's path inside
 * `declarationDir` (else `outDir`), taken under `rootDir` (else the tsconfig's folder), with the
 * first source extension that exists.
 * @param {string} declarationPath - Absolute declaration path.
 * @param {DeclarationLayout} layout - Tsconfig directory options.
 * @returns {Promise<string | null>} Absolute source path, or null when none is found.
 */
export async function findDeclarationSource(declarationPath, layout) {
	const match = DECLARATION_FILE.exec(basename(declarationPath));
	const emitDir = layout.declarationDir ?? layout.outDir;
	if (!match || emitDir === null) {
		return null;
	}
	const inside = relative(emitDir, declarationPath);
	if (inside === ".." || inside.startsWith(`..${sep}`) || isAbsolute(inside)) {
		return null;
	}
	const [, stem, kind] = match;
	const base = join(layout.rootDir ?? layout.configDir, dirname(inside), stem);
	for (const extension of DECLARATION_SOURCES[kind.toLowerCase()]) {
		if (await isFile(`${base}${extension}`)) {
			return `${base}${extension}`;
		}
	}
	return null;
}

/**
 * Creates a lookup from a declaration to its source for one run. The tsconfig is the `tsconfig`
 * option (relative to the scan root), else the first of `.configs/tsconfig.json` and
 * `tsconfig.json` that exists; with none, every lookup returns null.
 * @param {{ scanRoot: string, tsconfig?: string | null }} options - Scan root and optional tsconfig path.
 * @returns {(declarationPath: string) => Promise<string | null>} Source lookup.
 */
export function createDeclarationSourceResolver({ scanRoot, tsconfig = null }) {
	/** @type {Promise<DeclarationLayout | null> | null} */
	let layoutPromise = null;
	const loadLayout = async () => {
		if (typeof tsconfig === "string" && tsconfig.length > 0) {
			const configPath = resolve(scanRoot, tsconfig);
			if (!(await isFile(configPath))) {
				throw new Error(`tsconfig not found: ${tsconfig}`);
			}
			return readDeclarationLayout(configPath);
		}
		// A default tsconfig that can't be read is ignored: the lookup is a best effort there,
		// while a tsconfig named by the option must load.
		for (const candidate of DEFAULT_TSCONFIGS) {
			const configPath = resolve(scanRoot, candidate);
			if (await isFile(configPath)) {
				return readDeclarationLayout(configPath).catch(() => null);
			}
		}
		return null;
	};
	return async (declarationPath) => {
		layoutPromise ??= loadLayout();
		const layout = await layoutPromise;
		return layout === null ? null : findDeclarationSource(declarationPath, layout);
	};
}
