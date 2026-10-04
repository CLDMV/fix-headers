#!/usr/bin/env node
/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/cli.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:50:30-07:00 (1791093030)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { realpathSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyConfigOption } from "./config/load.mjs";
import fixHeaders from "./fix-header.mjs";

/**
 * @fileoverview CLI entry point for running fix-headers from terminal commands.
 * @module fix-headers/cli
 */

const HELP_TEXT = `fix-headers CLI\n\nUsage:\n  fix-headers [options]\n\nOptions:\n  -h, --help                         Show help\n      --dry-run                      Compute changes without writing files\n      --check                        Validate header dates without writing; exit 1 on date drift\n      --fix-created-date             Move an existing @Date back to the oldest of git first commit / file creation\n      --strict-created-date          With --check, fail when @Date is later than git first commit / file creation\n      --normalize-date-format        Write every header date in the ISO 8601 T-form (git %aI)\n      --timezone <name>              Write new dates in an IANA time zone (e.g. America/Los_Angeles, UTC); the instant never changes\n      --convert-timezone             With --timezone, also rewrite existing @Date/@Last modified time values into that zone\n      --json                         Print JSON output\n      --verbose                      Print updated file paths in summary mode; with --sample-output or --diff, also print each file's field differences\n      --sample-output                Show previous/new header sample for changed files\n      --diff                         Print a unified diff of each changed file's header (implies sample output)\n      --force-author-update          Replace an existing @Author/@Email with the detected/current values\n      --force-last-modified-author-update  Write the detected identity as @Last modified by on every file, edited or not\n      --use-gpg-signer-author        Use signed-commit UID (%GS) for detected @Author\n      --cwd <path>                   Working directory for project detection\n      --input <path>                 File or folder to process instead of the whole project (repeatable)\n      --include-folder <path>        Include folder (repeatable)\n      --include-folder-non-recursive <path>  Include only a folder's own files, not its subfolders (repeatable)\n      --exclude-folder <path>        Exclude folder name/path (repeatable)\n      --include-extension <ext>      Include extension (repeatable)\n      --enable-detector <id>         Enable only specific detector (repeatable)\n      --disable-detector <id>        Disable detector by id (repeatable)\n      --force-detector <id>          Use a force-only detector, e.g. markdown (HTML-comment headers in .md files) (repeatable)\n      --project-name <name>          Override project name\n      --language <id>                Override language id\n      --project-root <path>          Override project root\n      --marker <name|null>           Override marker filename\n      --author-name <name>           Override author name\n      --author-email <email>         Override author email\n      --company <name>               Append company suffix to @Author (Name <Company>)\n      --company-name <name>          @Copyright holder (default: the project manifest's author; omitted when none)\n      --copyright-start-year <year>  Set the copyright start year (default: each file's @Date year)\n      --spacing <n>                  Empty comment lines just inside the header's opening and closing (default: 1)\n      --margin <n>                   Blank lines between the header and the file's next content (default: 2)\n      --config <path>                Load JSON options file; its 'extends' can pull in shared configs (URL, package or path)\n\nExamples:\n  fix-headers --dry-run --include-folder src\n  fix-headers --dry-run --diff --verbose\n  fix-headers --check --verbose\n  fix-headers --timezone America/Los_Angeles --convert-timezone\n  fix-headers --project-name @scope/pkg --company-name "Catalyzed Motivation Inc."\n`;

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
 *  json: boolean,
 *  diff: boolean
 * }} Parsed CLI payload.
 */
export function parseCliArgs(argv) {
	/** @type {Record<string, unknown>} */
	const options = {};
	const control = { help: false, json: false, diff: false };
	const multiMap = {
		"include-folder": "includeFolders",
		"exclude-folder": "excludeFolders",
		"include-extension": "includeExtensions",
		"enable-detector": "enabledDetectors",
		"disable-detector": "disabledDetectors",
		"force-detector": "forcedDetectors",
		input: "input"
	};
	const scalarMap = {
		cwd: "cwd",
		"project-name": "projectName",
		language: "language",
		"project-root": "projectRoot",
		marker: "marker",
		"author-name": "authorName",
		"author-email": "authorEmail",
		company: "company",
		"company-name": "companyName",
		"copyright-start-year": "copyrightStartYear",
		spacing: "spacing",
		margin: "margin",
		timezone: "timezone",
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
		if (arg === "--diff") {
			control.diff = true;
			continue;
		}
		if (arg === "--verbose") {
			options.verbose = true;
			continue;
		}
		if (arg === "--dry-run") {
			options.dryRun = true;
			continue;
		}
		if (arg === "--check") {
			options.check = true;
			continue;
		}
		if (arg === "--fix-created-date") {
			options.fixCreatedDate = true;
			continue;
		}
		if (arg === "--strict-created-date") {
			options.strictCreatedDate = true;
			continue;
		}
		if (arg === "--normalize-date-format") {
			options.normalizeDateFormat = true;
			continue;
		}
		if (arg === "--convert-timezone") {
			options.convertTimezone = true;
			continue;
		}
		if (arg === "--sample-output") {
			options.sampleOutput = true;
			continue;
		}
		if (arg === "--force-author-update") {
			options.forceAuthorUpdate = true;
			continue;
		}
		if (arg === "--force-last-modified-author-update") {
			options.forceLastModifiedAuthorUpdate = true;
			continue;
		}
		if (arg === "--use-gpg-signer-author") {
			options.useGpgSignerAuthor = true;
			continue;
		}
		if (!arg.startsWith("--")) {
			throw new Error(`Unexpected argument: ${arg}`);
		}

		const flag = arg.slice(2);
		if (flag === "include-folder-non-recursive") {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for --${flag}`);
			}
			index += 1;
			const list = Array.isArray(options.includeFolders) ? options.includeFolders : [];
			options.includeFolders = [...list, { path: value, recursive: false }];
			continue;
		}

		if (multiMap[flag]) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for --${flag}`);
			}
			index += 1;
			const key = multiMap[flag];
			const list = Array.isArray(options[key]) ? options[key] : [];
			options[key] = Array.from(new Set([...list, value]));
			continue;
		}

		if (scalarMap[flag]) {
			const value = argv[index + 1];
			if (!value || value.startsWith("--")) {
				throw new Error(`Missing value for --${flag}`);
			}
			index += 1;
			const key = scalarMap[flag];
			if (key === "copyrightStartYear" || key === "spacing" || key === "margin") {
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
		json: control.json,
		diff: control.diff
	};
}

/**
 * Loads extra options from the JSON config file named by `--config` (and everything it
 * `extends`); options given on the command line win over the file.
 * @param {Record<string, unknown>} options - Current options object.
 * @returns {Promise<Record<string, unknown>>} Merged options object.
 */
export function applyConfigFile(options) {
	return applyConfigOption(options, "config");
}

/**
 * @typedef {{
 *  file?: string,
 *  changed?: boolean,
 *  sample?: {
 *   previousValue?: string | null,
 *   newValue?: string,
 *   diff?: string,
 *   issues?: Array<{ field?: string, previous?: string | null, detected?: string | null }>,
 *   detectedValues?: Record<string, unknown>
 *  }
 * }} CliChangeEntry
 */

/**
 * Returns the changed entries that carry a usable sample payload.
 * @param {unknown} result - Runner result object.
 * @returns {CliChangeEntry[]} Changed entries with a sample.
 */
function getSampledChanges(result) {
	if (!result || typeof result !== "object") {
		return [];
	}

	const report = /** @type {{changes?: CliChangeEntry[]}} */ (result);
	const changes = Array.isArray(report.changes) ? report.changes : [];
	return changes.filter((change) => change && change.changed === true && change.sample && typeof change.sample.newValue === "string");
}

/**
 * Formats a header field value for issue output.
 * @param {unknown} value - Field value.
 * @returns {string} Printable value.
 */
function formatIssueValue(value) {
	return typeof value === "string" ? `"${value}"` : "(missing)";
}

/**
 * Prints each changed file's per-field differences.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {unknown} result - Runner result object.
 * @returns {void}
 */
function printIssues(stdout, result) {
	for (const change of getSampledChanges(result)) {
		const issues = Array.isArray(change.sample.issues) ? change.sample.issues : [];
		stdout(`issues: ${change.file || "<unknown-file>"}`);
		if (issues.length === 0) {
			stdout("  (no field differences; header formatting only)");
			continue;
		}
		for (const issue of issues) {
			stdout(
				`  ${issue?.field || "<unknown-field>"}: found ${formatIssueValue(issue?.previous)}, expected ${formatIssueValue(issue?.detected)}`
			);
		}
	}
}

/**
 * Prints each changed file's unified header diff.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {unknown} result - Runner result object.
 * @returns {void}
 */
function printDiffs(stdout, result) {
	for (const change of getSampledChanges(result)) {
		if (typeof change.sample.diff === "string" && change.sample.diff.length > 0) {
			stdout(change.sample.diff);
		}
	}
}

/**
 * Prints per-file previous/new header samples when available.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {unknown} result - Runner result object.
 * @returns {void}
 */
function printSampleOutput(stdout, result) {
	for (const change of getSampledChanges(result)) {
		stdout(`sample: ${change.file || "<unknown-file>"}`);
		stdout("previous:");
		stdout(change.sample.previousValue === null ? "(none)" : String(change.sample.previousValue));
		stdout("new:");
		stdout(change.sample.newValue);
		if (change.sample.detectedValues && typeof change.sample.detectedValues === "object") {
			stdout("detected-values:");
			stdout(JSON.stringify(change.sample.detectedValues, null, 2));
		}
	}
}

/**
 * Prints changed file paths from result payload.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {unknown} result - Runner result object.
 * @returns {void}
 */
function printChangedFiles(stdout, result) {
	if (!result || typeof result !== "object") {
		return;
	}

	const report = /** @type {{changes?: Array<{file?: string, changed?: boolean}>}} */ (result);
	const changes = Array.isArray(report.changes) ? report.changes : [];
	const updatedFiles = changes.filter((change) => change && change.changed === true).map((change) => change.file || "<unknown-file>");
	for (const file of updatedFiles) {
		stdout(`updated: ${file}`);
	}
}

/**
 * Prints each file that was skipped because its format cannot carry the header comment.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {{skipped?: Array<{file?: string, reason?: string}>}} report - Runner result object.
 * @returns {void}
 */
function printSkipped(stdout, report) {
	const skipped = Array.isArray(report.skipped) ? report.skipped : [];
	for (const entry of skipped) {
		stdout(`skipped: ${entry?.file || "<unknown-file>"} (${entry?.reason || "no reason given"})`);
	}
}

/**
 * Prints the optional per-file detail sections selected by the CLI flags.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {unknown} result - Runner result object.
 * @param {Record<string, unknown>} options - Effective runner options.
 * @param {boolean} diff - Whether `--diff` was passed.
 * @returns {void}
 */
function printDetails(stdout, result, options, diff) {
	const sampled = options.sampleOutput === true || diff;
	if (options.verbose === true) {
		printChangedFiles(stdout, result);
		if (sampled) {
			printIssues(stdout, result);
		}
	}
	if (options.sampleOutput === true) {
		printSampleOutput(stdout, result);
	}
	if (diff) {
		printDiffs(stdout, result);
	}
}

/**
 * Prints `--check` date findings: failing issues always, advisory issues only in verbose mode.
 * @param {(message: string) => void} stdout - Standard output writer.
 * @param {{changes?: Array<{file?: string, dateIssues?: Array<{advisory?: boolean, message?: string}>}>}} report - Check-mode result.
 * @param {boolean} verbose - Whether to print advisory issues.
 * @returns {void}
 */
function printDateIssues(stdout, report, verbose) {
	const changes = Array.isArray(report.changes) ? report.changes : [];
	for (const change of changes) {
		const issues = Array.isArray(change?.dateIssues) ? change.dateIssues : [];
		for (const issue of issues) {
			if (issue.advisory === true && !verbose) {
				continue;
			}
			stdout(`${issue.advisory === true ? "advisory" : "drift"}: ${change.file || "<unknown-file>"}: ${issue.message}`);
		}
	}
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
		const result = await runner(parsed.diff ? { ...finalOptions, sampleOutput: true } : finalOptions);
		const checkReport =
			result && typeof result === "object" && /** @type {{check?: boolean}} */ (result).check === true
				? /** @type {{filesScanned?: number, filesWithDateDrift?: number, dateAdvisories?: number, changes?: Array<{file?: string, dateIssues?: Array<{advisory?: boolean, message?: string}>}>}} */ (
						result
					)
				: null;
		const exitCode = checkReport && Number(checkReport.filesWithDateDrift) > 0 ? 1 : 0;

		if (parsed.json) {
			stdout(JSON.stringify(result, null, 2));
			return exitCode;
		}

		if (checkReport) {
			stdout(
				`fix-headers check: scanned=${checkReport.filesScanned ?? 0}, drift=${checkReport.filesWithDateDrift ?? 0}, advisories=${checkReport.dateAdvisories ?? 0}`
			);
			printDateIssues(stdout, checkReport, finalOptions.verbose === true);
			return exitCode;
		}

		if (result && typeof result === "object") {
			const report =
				/** @type {{filesScanned?: number, filesUpdated?: number, filesSkipped?: number, skipped?: Array<{file?: string, reason?: string}>, dryRun?: boolean}} */ (
					result
				);
			const skippedCount = Number(report.filesSkipped) > 0 ? `, skipped=${report.filesSkipped}` : "";
			stdout(
				`fix-headers complete: scanned=${report.filesScanned ?? 0}, updated=${report.filesUpdated ?? 0}${skippedCount}, dryRun=${report.dryRun === true}`
			);
			printSkipped(stdout, report);
			printDetails(stdout, result, finalOptions, parsed.diff);
		} else {
			printDetails(stdout, result, finalOptions, parsed.diff);
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
	let isMain = false;
	if (argv[1]) {
		try {
			const argvRealPath = realpathSync(argv[1]);
			const moduleRealPath = realpathSync(fileURLToPath(moduleUrl));
			isMain = argvRealPath === moduleRealPath;
		} catch {
			isMain = moduleUrl === pathToFileURL(argv[1]).href;
		}
	}
	if (!isMain) {
		return false;
	}

	executor(argv.slice(2)).then((code) => {
		process.exitCode = code;
	});

	return true;
}

runCliAsMain();
