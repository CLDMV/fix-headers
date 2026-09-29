/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/config/load.mjs
 *	@Date: 2026-09-28T21:19:05-07:00 (1790655545)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T21:19:05-07:00 (1790655545)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, isAbsolute, resolve } from "node:path";

/**
 * @fileoverview Shared JSON config loader for the CLI `--config` flag and the API
 * `configFile` option, including `extends` chains.
 *
 * A config's `extends` is a string or an array of strings, each one of:
 * - an https URL, fetched on every run (no cache — a cached copy can go stale);
 * - a relative (`./`, `../`) or absolute file path, resolved from the config file's folder;
 * - an npm package path (e.g. `@cldmv/configs/fix-headers.json`), resolved from the config
 *   file's location with `createRequire`, which honours the package's `exports` map.
 *
 * Extended configs apply in order, then the config's own settings on top. Plain objects merge
 * key by key; arrays and scalars replace. Inside a fetched config, relative references resolve
 * against its URL. A cycle is an error.
 * @module fix-headers/config/load
 */

/** Longest a single config fetch may take before the run fails. */
const FETCH_TIMEOUT_MS = 30_000;

/** Hosts plain `http://` is allowed for: the local machine only. Everything else needs https. */
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Where a config was read from: a local file or a fetched URL.
 * @typedef {{ kind: "file", path: string } | { kind: "url", href: string }} ConfigSource
 */

/**
 * Returns whether a value is a plain (JSON) object.
 * @param {unknown} value - Value to test.
 * @returns {value is Record<string, unknown>} Whether the value is a non-array object.
 */
function isPlainObject(value) {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merges `override` onto `base`: plain objects merge key by key, arrays and scalars replace.
 * Neither input is modified. `__proto__` keys are skipped so a config can't change prototypes.
 * @param {Record<string, unknown>} base - Lower-precedence settings.
 * @param {Record<string, unknown>} override - Higher-precedence settings.
 * @returns {Record<string, unknown>} Merged settings.
 */
export function mergeConfig(base, override) {
	/** @type {Record<string, unknown>} */
	const output = { ...base };
	for (const [key, value] of Object.entries(override)) {
		if (key === "__proto__") {
			continue;
		}
		output[key] = isPlainObject(output[key]) && isPlainObject(value) ? mergeConfig(output[key], value) : value;
	}
	return output;
}

/**
 * Returns a readable label for a config source.
 * @param {ConfigSource} source - Config source.
 * @returns {string} File path or URL.
 */
function describeSource(source) {
	return source.kind === "file" ? source.path : source.href;
}

/**
 * Reads the raw text of a config source. URLs are fetched fresh on every call.
 * @param {ConfigSource} source - Config source.
 * @returns {Promise<{ text: string, source: ConfigSource }>} Raw text, and the source relative references resolve against (the final URL after redirects).
 */
async function readSource(source) {
	if (source.kind === "file") {
		return { text: await readFile(source.path, "utf8"), source };
	}

	let response;
	try {
		response = await fetch(source.href, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
	} catch (error) {
		const reason = error.cause instanceof Error ? error.cause.message : error.message;
		throw new Error(`Failed to fetch config ${source.href}: ${reason}`, { cause: error });
	}
	if (!response.ok) {
		throw new Error(`Failed to fetch config ${source.href}: HTTP ${response.status} ${response.statusText}`);
	}
	return { text: await response.text(), source: { kind: "url", href: response.url } };
}

/**
 * Turns an http(s) reference into a URL source, refusing plain http except to loopback hosts.
 * @param {URL} url - Parsed URL.
 * @returns {ConfigSource} URL source.
 */
function toUrlSource(url) {
	if (url.protocol === "http:" && !LOOPBACK_HOSTS.has(url.hostname)) {
		throw new Error(`Refusing to fetch config over plain http: ${url.href} (use https)`);
	}
	return { kind: "url", href: url.href };
}

/**
 * Resolves one `extends` reference relative to the config that contains it.
 * @param {string} reference - The `extends` entry.
 * @param {ConfigSource} from - The config that contains the reference.
 * @returns {ConfigSource} The referenced config.
 */
function resolveReference(reference, from) {
	if (/^https?:\/\//i.test(reference)) {
		return toUrlSource(new URL(reference));
	}
	if (/^[a-z][a-z\d+.-]+:\/\//i.test(reference)) {
		throw new Error(`Unsupported extends URL "${reference}" in ${describeSource(from)}; use https, a file path or a package path`);
	}

	const isPath = /^\.{1,2}[\\/]/.test(reference);
	if (from.kind === "url") {
		if (isPath || reference.startsWith("/")) {
			return toUrlSource(new URL(reference, from.href));
		}
		throw new Error(`Cannot extend package "${reference}" from the remote config ${from.href}; use a URL or a relative path`);
	}

	if (isPath || isAbsolute(reference)) {
		return { kind: "file", path: resolve(dirname(from.path), reference) };
	}
	try {
		return { kind: "file", path: createRequire(from.path).resolve(reference) };
	} catch (error) {
		throw new Error(`Cannot resolve extends "${reference}" from ${from.path}: ${error.message}`, { cause: error });
	}
}

/**
 * Normalizes a config's `extends` value to a list of references.
 * @param {unknown} value - The raw `extends` value.
 * @param {string} label - Config location for error messages.
 * @returns {string[]} References in application order.
 */
function readExtends(value, label) {
	if (value === undefined) {
		return [];
	}
	const list = Array.isArray(value) ? value : [value];
	if (!list.every((entry) => typeof entry === "string" && entry.trim().length > 0)) {
		throw new Error(`Config "extends" must be a string or an array of strings: ${label}`);
	}
	return list.map((entry) => entry.trim());
}

/**
 * Loads one config and everything it extends.
 * @param {ConfigSource} source - Config to load.
 * @param {string[]} chain - Labels of the configs currently being loaded, outermost first.
 * @returns {Promise<Record<string, unknown>>} Fully merged settings, without `extends`.
 */
async function loadSource(source, chain) {
	const label = describeSource(source);
	if (chain.includes(label)) {
		throw new Error(`Config extends cycle: ${[...chain, label].join(" -> ")}`);
	}

	const { text, source: base } = await readSource(source);
	let parsed;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		throw new Error(`Config ${label} is not valid JSON: ${error.message}`, { cause: error });
	}
	if (!isPlainObject(parsed)) {
		throw new Error(`Config file must contain a JSON object: ${label}`);
	}

	const { extends: references, ...own } = parsed;
	let merged = {};
	for (const reference of readExtends(references, label)) {
		merged = mergeConfig(merged, await loadSource(resolveReference(reference, base), [...chain, label]));
	}
	return mergeConfig(merged, own);
}

/**
 * Loads a JSON config file and resolves its `extends` chain.
 * @param {string} configPath - Config file path, absolute or relative to `cwd`.
 * @param {string} [cwd=process.cwd()] - Folder a relative `configPath` resolves from.
 * @returns {Promise<Record<string, unknown>>} Fully merged settings from the file and everything it extends.
 */
export function loadConfigFile(configPath, cwd = process.cwd()) {
	return loadSource({ kind: "file", path: resolve(cwd, configPath) }, []);
}

/**
 * Applies the config file named by `options[key]` underneath `options`: settings from the file
 * (and everything it extends) fill in, and every option passed directly wins over them. The
 * config-file key itself is removed from the result. Returns `options` unchanged when no config
 * file is named.
 * @template {Record<string, unknown>} T
 * @param {T} options - Direct options (CLI flags or API call options).
 * @param {string} key - Option naming the config file (`config` for the CLI, `configFile` for the API).
 * @returns {Promise<T>} Effective options.
 */
export async function applyConfigOption(options, key) {
	const configPath = typeof options[key] === "string" ? options[key].trim() : "";
	if (configPath.length === 0) {
		return options;
	}

	const cwd = typeof options.cwd === "string" && options.cwd.length > 0 ? options.cwd : process.cwd();
	const merged = { ...(await loadConfigFile(configPath, cwd)), ...options };
	delete merged[key];
	return /** @type {T} */ (merged);
}
