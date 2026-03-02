#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { pathToFileURL } from "node:url";
import fixHeaders from "./fix-header.mjs";

/**
 * @fileoverview CLI entry point for running fix-headers from terminal commands.
 * @module fix-headers/cli
 */

const HELP_TEXT = `fix-headers CLI\n\nUsage:\n  fix-headers [options]\n\nOptions:\n  -h, --help                         Show help\n      --dry-run                      Compute changes without writing files\n      --json                         Print JSON output\n      --cwd <path>                   Working directory for project detection\n      --input <path>                 Single file or folder input\n      --include-folder <path>        Include folder (repeatable)\n      --exclude-folder <path>        Exclude folder name/path (repeatable)\n      --include-extension <ext>      Include extension (repeatable)\n      --enable-detector <id>         Enable only specific detector (repeatable)\n      --disable-detector <id>        Disable detector by id (repeatable)\n      --project-name <name>          Override project name\n      --language <id>                Override language id\n      --project-root <path>          Override project root\n      --marker <name|null>           Override marker filename\n      --author-name <name>           Override author name\n      --author-email <email>         Override author email\n      --company-name <name>          Override company name\n      --copyright-start-year <year>  Override copyright start year\n      --config <path>                Load JSON options file\n\nExamples:\n  fix-headers --dry-run --include-folder src\n  fix-headers --project-name @scope/pkg --company-name "Catalyzed Motivation Inc."\n`;

/**
 * Converts CLI flag token to camelCase key.
 * @param {string} token - CLI token without leading dashes.
 * @returns {string} CamelCase key.
 */
function toCamelCase(token) {
	return token.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Parses CLI arguments into fixHeaders options and control flags.
 * @param {string[]} argv - Process argument vector without node/script items.
 * @returns {{
 *  options: Record<string, unknown>,
 *  help: boolean,
 *  json: boolean
 * }} Parsed CLI payload.
 */
export function parseCliArgs(argv) {
	/** @type {Record<string, unknown>} */
	const options = {};
	const control = { help: false, json: false };
	const multiMap = {
		"include-folder": "includeFolders",
		"exclude-folder": "excludeFolders",
		"include-extension": "includeExtensions",
		"enable-detector": "enabledDetectors",
		"disable-detector": "disabledDetectors"
	};
	const scalarMap = {
		cwd: "cwd",
		input: "input",
		"project-name": "projectName",
		language: "language",
		"project-root": "projectRoot",
		marker: "marker",
		"author-name": "authorName",
		"author-email": "authorEmail",
		"company-name": "companyName",
		"copyright-start-year": "copyrightStartYear",
		config: "config"
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === "-h" || arg === "--help") {
			control.help = true;
			continue;
		}
		if (arg === "--json") {
			control.json = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (!arg.startsWith("--")) {
			throw new Error(`Unexpected argument: ${arg}`);
		}

		const flag = arg.slice(2);
		if (multiMap[flag]) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for --${flag}`);
			}
			index += 1;
			const key = multiMap[flag];
			const list = Array.isArray(options[key]) ? options[key] : [];
			options[key] = [...list, value];
			continue;
		}

		if (scalarMap[flag]) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for --${flag}`);
			}
			index += 1;
			const key = scalarMap[flag];
			if (key === "copyrightStartYear") {
				options[key] = Number.parseInt(value, 10);
				if (Number.isNaN(options[key])) {
					throw new Error(`Invalid number for --${flag}: ${value}`);
				}
			} else if (key === "marker" && value === "null") {
				options[key] = null;
			} else {
				options[key] = value;
			}
			continue;
		}

		const camelKey = toCamelCase(flag);
		const value = argv[index + 1];
		if (!value || value.startsWith("--")) {
			throw new Error(`Unknown or malformed flag: --${flag}`);
		}
		index += 1;
		options[camelKey] = value;
	}

	return {
		options,
		help: control.help,
		json: control.json
	};
}

/**
 * Loads extra options from a JSON config file.
 * @param {Record<string, unknown>} options - Current options object.
 * @returns {Promise<Record<string, unknown>>} Merged options object.
 */
export async function applyConfigFile(options) {
	if (typeof options.config !== "string" || options.config.trim().length === 0) {
		return options;
	}

	const baseDir = typeof options.cwd === "string" && options.cwd.length > 0 ? options.cwd : process.cwd();
	const configPath = isAbsolute(options.config) ? options.config : join(baseDir, options.config);
	const raw = await readFile(configPath, "utf8");
	const parsed = JSON.parse(raw);
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error("Config file must contain a JSON object");
	}

	const merged = { ...parsed, ...options };
	delete merged.config;
	/** @type {Record<string, unknown>} */
	const output = merged;
	return output;
}

/**
 * Executes CLI flow and returns process-like exit code.
 * @param {string[]} argv - CLI arguments.
 * @param {{
 *  runner?: (options: Record<string, unknown>) => Promise<unknown>,
 *  stdout?: (message: string) => void,
 *  stderr?: (message: string) => void
 * }} [deps={}] - Dependency overrides for tests.
 * @returns {Promise<number>} Exit code.
 */
export async function runCli(argv, deps = {}) {
	const runner = deps.runner || fixHeaders;
	const stdout = deps.stdout || console.log;
	const stderr = deps.stderr || console.error;

	try {
		const parsed = parseCliArgs(argv);
		if (parsed.help) {
			stdout(HELP_TEXT);
			return 0;
		}

		const finalOptions = await applyConfigFile(parsed.options);
		const result = await runner(finalOptions);

		if (parsed.json) {
			stdout(JSON.stringify(result, null, 2));
			return 0;
		}

		if (result && typeof result === "object") {
			const report = /** @type {{filesScanned?: number, filesUpdated?: number, dryRun?: boolean}} */ (result);
			stdout(
				`fix-headers complete: scanned=${report.filesScanned ?? 0}, updated=${report.filesUpdated ?? 0}, dryRun=${report.dryRun === true}`
			);
		} else {
			stdout("fix-headers complete");
		}
		return 0;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		stderr(`fix-headers failed: ${message}`);
		return 1;
	}
}

/**
 * Executes CLI flow when the module is the process entrypoint.
 * @param {string[]} [argv=process.argv] - Process argument vector.
 * @param {string} [moduleUrl=import.meta.url] - Current module URL.
 * @param {(args: string[]) => Promise<number>} [executor=runCli] - CLI executor.
 * @returns {boolean} Whether the entrypoint branch was executed.
 */
export function runCliAsMain(argv = process.argv, moduleUrl = import.meta.url, executor = runCli) {
	const isMain = argv[1] && moduleUrl === pathToFileURL(argv[1]).href;
	if (!isMain) {
		return false;
	}

	executor(argv.slice(2)).then((code) => {
		process.exitCode = code;
	});

	return true;
}

runCliAsMain();
