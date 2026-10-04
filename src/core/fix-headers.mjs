/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/core/fix-headers.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:13-07:00 (1790969293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { applyConfigOption } from "../config/load.mjs";
import { DEFAULT_HEADER_MARGIN, DEFAULT_HEADER_SPACING, resolveLayoutCount } from "../constants.mjs";
import { discoverFiles } from "./file-discovery.mjs";
import { getHeaderSkipReason, resolveForcedDetectors } from "../detectors/index.mjs";
import { resolveProjectMetadata } from "../detect/project.mjs";
import {
	checkHeaderDates,
	convertDatePayload,
	dateYear,
	normalizeDatePayload,
	repairDateEpoch,
	resolveCreatedDate
} from "../header/dates.mjs";
import { buildHeader } from "../header/template.mjs";
import { compareHeaderFields } from "../header/fields.mjs";
import { findProjectHeader, replaceOrInsertHeader } from "../header/parser.mjs";
import { createUnifiedDiff } from "../utils/diff.mjs";
import { readFileDates } from "../utils/fs.mjs";
import { getGitCreationDate, getGitLastModifiedDate } from "../utils/git.mjs";
import { assertTimeZone, toDatePayload } from "../utils/time.mjs";

/**
 * @typedef {{
 *  cwd?: string,
 *  input?: string | string[],
 *  dryRun?: boolean,
 *  check?: boolean,
 *  fixCreatedDate?: boolean,
 *  strictCreatedDate?: boolean,
 *  normalizeDateFormat?: boolean,
 *  timezone?: string,
 *  convertTimezone?: boolean,
 *  configFile?: string,
 *  sampleOutput?: boolean,
 *  forceAuthorUpdate?: boolean,
 *  forceLastModifiedAuthorUpdate?: boolean,
 *  useGpgSignerAuthor?: boolean,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  forcedDetectors?: string[],
 *  detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>,
 *  includeFolders?: Array<string | { path: string, recursive?: boolean }>,
 *  excludeFolders?: string[],
 *  includeExtensions?: string[],
 *  gitignore?: boolean | string | string[],
 *  projectName?: string,
 *  language?: string,
 *  projectRoot?: string,
 *  marker?: string | null,
 *  authorName?: string,
 *  authorEmail?: string,
 *  company?: string,
 *  companyName?: string,
 *  copyrightStartYear?: number,
 *  spacing?: number,
 *  margin?: number
 * }} FixHeadersOptions
 */

/**
 * @typedef {import("../header/fields.mjs").HeaderFieldIssue} HeaderFieldIssue
 */

/**
 * Rewrites a header date payload (format or zone), keeping its instant.
 * @typedef {(payload: {date: string, timestamp: number}) => {date: string, timestamp: number}} DateRewrite
 */

/**
 * Result of a run. With `sampleOutput: true`, each changed entry carries a `sample`:
 * - `previousValue` / `newValue` - the header block before (null when the file had none) and after.
 * - `diff` - a unified diff of the header block (`--- a/<file>` / `+++ b/<file>`, `/dev/null`
 *   when there was no previous header), with hunk line numbers relative to the file.
 * - `issues` - one `{ field, previous, detected }` entry per header field whose written value
 *   differs from the existing header. Values are the field text as written in the header
 *   (dates keep their `date (timestamp)` form; `previous` is null when the field was missing).
 *   Fields fix-headers preserves - the original `@Author`/`@Email` and `@Last modified by`
 *   identity, unless `forceAuthorUpdate` / `forceLastModifiedAuthorUpdate` is set - are compared
 *   against what is actually written, so they only appear when they really change. Because an
 *   updated file gets a fresh `@Last modified time`, `lastModifiedAt` is listed for every
 *   changed file that already had a header.
 * - `detectedValues` - the metadata resolved for the file. `projectNameSource` says where
 *   `projectName` came from: `{ from: "manifest", driver, manifest, dir }`,
 *   `{ from: "folder", dir }` or `{ from: "option" }`. `companyName` is the `@Copyright` holder
 *   (null when nothing provides one, and the line then carries none), and `companyNameSource`
 *   says where it came from: `{ from: "manifest", driver, manifest, dir }`, `{ from: "option" }`
 *   or `{ from: "none" }`. `copyrightStartYear` is the start year written for the file, and
 *   `copyrightStartYearSource` says where it came from: `"option"` (`copyrightStartYear`) or
 *   `"created-date"` (the year of the file's `@Date`).
 *
 * `metadata.copyrightStartYear` is the `copyrightStartYear` option, or null when it is not set.
 *
 * Files whose format cannot carry the header comment are not processed: each is listed in
 * `skipped` as `{ file, reason }` and counted in `filesSkipped`, not in `filesScanned` or
 * `changes`. That covers strict `.json`, files with no extension or an extension no enabled
 * detector handles (for example one added through `includeExtensions`), and Markdown unless
 * `forcedDetectors` includes `"markdown"`.
 * @typedef {{
 *  metadata: {
 *   projectName: string,
 *   projectNameSource: import("../detect/project.mjs").ProjectNameSource,
 *   language: string,
 *   projectRoot: string,
 *   marker: string | null,
 *   authorName: string,
 *   authorEmail: string,
 *   companyName: string | null,
 *   companyNameSource: import("../detect/project.mjs").CompanyNameSource,
 *   copyrightStartYear: number | null
 *  },
 *  detectedProjects: string[],
 *  filesScanned: number,
 *  filesUpdated: number,
 *  filesSkipped: number,
 *  skipped: Array<{file: string, reason: string}>,
 *  dryRun: boolean,
 *  check: boolean,
 *  filesWithDateDrift?: number,
 *  dateAdvisories?: number,
 *  changes: Array<{file: string, changed: boolean, dateIssues?: import("../header/dates.mjs").DateCheckIssue[], sample?: { previousValue: string | null, newValue: string, diff: string, issues: HeaderFieldIssue[], detectedValues?: {
 *   projectName: string,
 *   projectNameSource: import("../detect/project.mjs").ProjectNameSource,
 *   language: string,
 *   projectRoot: string,
 *   marker: string | null,
 *   authorName: string,
 *   authorEmail: string,
 *   companyName: string | null,
 *   companyNameSource: import("../detect/project.mjs").CompanyNameSource,
 *   copyrightStartYear: number,
 *   copyrightStartYearSource: "option" | "created-date",
 *   createdAtSource: string,
 *   lastModifiedAtSource: string,
 *   createdAt: {date: string, timestamp: number},
 *   lastModifiedAt: {date: string, timestamp: number}
 *  } }}>
 * }} FixHeadersResult
 */

/**
 * Resolves runtime options including optional JSON config file loading (with `extends`).
 * Options passed directly win over everything from the config file.
 * @param {FixHeadersOptions} options - Runtime options.
 * @returns {Promise<FixHeadersOptions>} Effective runtime options.
 */
function resolveRuntimeOptions(options) {
	return applyConfigOption(options, "configFile");
}

/**
 * Normalizes the `input` option to a list of paths. A string is one path, an array is several
 * (CLI `--input` is repeatable); blank entries are dropped, so an empty list means no input.
 * @param {unknown} input - Option value.
 * @returns {string[]} Non-blank input paths, possibly empty.
 */
function resolveInputs(input) {
	if (input === undefined || input === null) {
		return [];
	}
	const list = Array.isArray(input) ? input : [input];
	if (list.some((entry) => typeof entry !== "string")) {
		throw new Error(`input must be a path or an array of paths, got ${JSON.stringify(input)}`);
	}
	return list.filter((entry) => entry.trim().length > 0);
}

/**
 * Extracts original author identity from an existing header block.
 * @param {string} headerText - Existing header content.
 * @returns {{ authorName?: string, authorEmail?: string }} Parsed identity values.
 */
function extractHeaderAuthorIdentity(headerText) {
	const authorMatch = headerText.match(/@Author:\s*(.+)$/m);
	const emailMatch = headerText.match(/@Email:\s*<([^>\n]+)>/m);

	return {
		authorName: authorMatch?.[1]?.trim(),
		authorEmail: emailMatch?.[1]?.trim()
	};
}

/**
 * Extracts original last-modified-by identity from an existing header block.
 * @param {string} headerText - Existing header content.
 * @returns {{ authorName?: string, authorEmail?: string }} Parsed identity values.
 */
function extractHeaderLastModifiedIdentity(headerText) {
	const match = headerText.match(/@Last modified by:\s*(.+?)\s*\(([^)\n]+)\)\s*$/m);

	return {
		authorName: match?.[1]?.trim(),
		authorEmail: match?.[2]?.trim()
	};
}

/**
 * Extracts original created-at payload from an existing header block.
 * @param {string} headerText - Existing header content.
 * @returns {{date: string, timestamp: number} | null} Parsed created-at value.
 */
function extractHeaderCreatedAt(headerText) {
	const dateMatch = headerText.match(/@Date:\s*(.+?)\s*\((\d+)\)$/m);
	if (!dateMatch || !dateMatch[1] || !dateMatch[2]) {
		return null;
	}

	const timestamp = Number.parseInt(dateMatch[2], 10);
	if (Number.isNaN(timestamp)) {
		return null;
	}

	return {
		date: dateMatch[1].trim(),
		timestamp
	};
}

/**
 * Extracts original last-modified payload from an existing header block.
 * @param {string} headerText - Existing header content.
 * @returns {{date: string, timestamp: number} | null} Parsed last-modified value.
 */
function extractHeaderLastModifiedAt(headerText) {
	const modifiedMatch = headerText.match(/@Last modified time:\s*(.+?)\s*\((\d+)\)$/m);
	if (!modifiedMatch || !modifiedMatch[1] || !modifiedMatch[2]) {
		return null;
	}

	const timestamp = Number.parseInt(modifiedMatch[2], 10);
	if (Number.isNaN(timestamp)) {
		return null;
	}

	return {
		date: modifiedMatch[1].trim(),
		timestamp
	};
}

/**
 * @fileoverview Main header-fixing engine with auto-detection and override support.
 * @module fix-headers/core/fix-headers
 */

/**
 * Fixes headers in a project using auto-detected metadata unless overridden.
 * @param {FixHeadersOptions} [options={}] - Runtime options.
 * @returns {Promise<FixHeadersResult>} Process report.
 */
export async function fixHeaders(options = {}) {
	const effectiveOptions = await resolveRuntimeOptions(options);
	const timeZone =
		effectiveOptions.timezone === undefined || effectiveOptions.timezone === null ? null : assertTimeZone(effectiveOptions.timezone);
	const convertTimezone = effectiveOptions.convertTimezone === true;
	if (convertTimezone && !timeZone) {
		throw new Error(
			"convertTimezone requires timezone: set timezone (CLI --timezone <name>) to the IANA zone to convert header dates into"
		);
	}
	const forcedDetectors = resolveForcedDetectors(effectiveOptions.forcedDetectors);
	const scanRoot = resolve(effectiveOptions.projectRoot || effectiveOptions.cwd || process.cwd());
	const metadata = await resolveProjectMetadata({
		...effectiveOptions,
		cwd: scanRoot
	});
	resolveLayoutCount(effectiveOptions.spacing, "spacing", DEFAULT_HEADER_SPACING);
	resolveLayoutCount(effectiveOptions.margin, "margin", DEFAULT_HEADER_MARGIN);
	const check = effectiveOptions.check === true;
	const dryRun = check || effectiveOptions.dryRun === true;
	const fixCreatedDate = effectiveOptions.fixCreatedDate === true;
	/** @type {DateRewrite} */
	const keepDate = (payload) => payload;
	/** @type {DateRewrite} */
	const formatDate = effectiveOptions.normalizeDateFormat === true ? normalizeDatePayload : keepDate;
	// Dates taken from git, the filesystem, or the clock are written in `timezone`; dates already
	// in a header are only moved into it by the `convertTimezone` sweep. Either way the instant is kept.
	/** @type {DateRewrite} */
	const toZone = timeZone ? (payload) => convertDatePayload(payload, timeZone) : keepDate;
	const toZoneIfSweeping = convertTimezone ? toZone : keepDate;

	const discoveryOptions = {
		language: metadata.language,
		enabledDetectors: effectiveOptions.enabledDetectors,
		disabledDetectors: effectiveOptions.disabledDetectors,
		forcedDetectors,
		includeFolders: effectiveOptions.includeFolders,
		excludeFolders: effectiveOptions.excludeFolders,
		includeExtensions: effectiveOptions.includeExtensions,
		gitignore: effectiveOptions.gitignore
	};
	const inputs = resolveInputs(effectiveOptions.input);

	/** @type {string[]} */
	let files;
	if (inputs.length > 0) {
		// Every input is processed: the union of the files named and the files discovered
		// under the folders named, each file once, in the order the inputs were given.
		const collected = new Set();
		for (const input of inputs) {
			const inputPath = resolve(scanRoot, input);
			const targetStats = await stat(inputPath).catch(() => null);
			if (!targetStats) {
				throw new Error(`Input path does not exist: ${input}`);
			}

			if (targetStats.isFile()) {
				collected.add(inputPath);
			} else if (targetStats.isDirectory()) {
				for (const file of await discoverFiles({ ...discoveryOptions, projectRoot: inputPath })) {
					collected.add(file);
				}
			} else {
				throw new Error(`Input path must be a file or directory: ${input}`);
			}
		}
		files = Array.from(collected);
	} else {
		files = await discoverFiles({ ...discoveryOptions, projectRoot: scanRoot });
	}

	const currentYear = new Date().getFullYear();
	/** @type {FixHeadersResult["changes"]} */
	const changes = [];
	/** @type {FixHeadersResult["skipped"]} */
	const skipped = [];
	const detectedProjects = new Set();
	let filesUpdated = 0;
	let filesWithDateDrift = 0;
	let dateAdvisories = 0;

	for (const filePath of files) {
		// A file whose format cannot carry the header comment (strict JSON, Markdown that is not
		// forced, an extension no enabled detector handles) is skipped, never given a JS comment.
		const skipReason = getHeaderSkipReason(filePath, {
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			forcedDetectors
		});
		if (skipReason !== null) {
			skipped.push({ file: relative(scanRoot, filePath), reason: skipReason });
			continue;
		}

		const fileMetadata = await resolveProjectMetadata({
			...effectiveOptions,
			cwd: scanRoot,
			targetFilePath: filePath
		});

		detectedProjects.add(`${fileMetadata.language}:${fileMetadata.projectRoot}`);
		const relativePath = relative(scanRoot, filePath);
		const original = await readFile(filePath, "utf8");
		const syntaxOptions = {
			language: fileMetadata.language,
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			forcedDetectors,
			detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides,
			spacing: effectiveOptions.spacing,
			margin: effectiveOptions.margin
		};
		const existingHeader = findProjectHeader(original, filePath, syntaxOptions);
		const existingHeaderText = existingHeader ? original.slice(existingHeader.start, existingHeader.end) : "";
		const existingIdentity = existingHeaderText.length > 0 ? extractHeaderAuthorIdentity(existingHeaderText) : {};
		const existingLastModifiedIdentity = existingHeaderText.length > 0 ? extractHeaderLastModifiedIdentity(existingHeaderText) : {};
		const existingCreatedAt = existingHeaderText.length > 0 ? extractHeaderCreatedAt(existingHeaderText) : null;
		const existingLastModifiedAt = existingHeaderText.length > 0 ? extractHeaderLastModifiedAt(existingHeaderText) : null;
		const filesystemDates = await readFileDates(filePath);

		const metadataRelativePath = relative(fileMetadata.projectRoot, filePath);
		const gitCreated = await getGitCreationDate(fileMetadata.projectRoot, metadataRelativePath);
		const gitLastUpdated = await getGitLastModifiedDate(fileMetadata.projectRoot, metadataRelativePath);

		// An epoch that disagrees with its own datetime text is recomputed from the text. @Date is
		// "oldest wins": see resolveCreatedDate.
		const filesystemCreatedAt = toDatePayload(filesystemDates.createdAt);
		const resolvedCreatedAt = resolveCreatedDate({
			existing: repairDateEpoch(existingCreatedAt),
			gitCreated,
			filesystemCreated: filesystemCreatedAt,
			fixCreatedDate
		});
		const repairedLastModifiedAt = repairDateEpoch(existingLastModifiedAt);
		const createdAtSource = resolvedCreatedAt.source;
		const comparisonLastModifiedAtSource = repairedLastModifiedAt
			? "existing-header"
			: gitLastUpdated
				? "git-last-modified"
				: "filesystem-updated";
		const createdAt = formatDate(
			createdAtSource === "existing-header" ? toZoneIfSweeping(resolvedCreatedAt.payload) : toZone(resolvedCreatedAt.payload)
		);
		// Without the copyrightStartYear option, the start year is the year of the @Date written,
		// read in the zone it is written in: `timezone` when set, else the date's own offset.
		const copyrightStartYearSource = fileMetadata.copyrightStartYear === null ? "created-date" : "option";
		const copyrightStartYear = fileMetadata.copyrightStartYear ?? dateYear(createdAt, timeZone);
		const comparisonLastModifiedAt = formatDate(
			repairedLastModifiedAt ? toZoneIfSweeping(repairedLastModifiedAt) : toZone(gitLastUpdated || toDatePayload(filesystemDates.updatedAt))
		);
		const shouldForceAuthorUpdate = effectiveOptions.forceAuthorUpdate === true;
		const shouldForceLastModifiedAuthorUpdate = effectiveOptions.forceLastModifiedAuthorUpdate === true;

		const comparisonHeader = buildHeader({
			absoluteFilePath: filePath,
			language: fileMetadata.language,
			syntaxOptions,
			projectRoot: fileMetadata.projectRoot,
			projectName: fileMetadata.projectName,
			createdByName: shouldForceAuthorUpdate ? fileMetadata.authorName : existingIdentity.authorName || fileMetadata.authorName,
			createdByEmail: shouldForceAuthorUpdate ? fileMetadata.authorEmail : existingIdentity.authorEmail || fileMetadata.authorEmail,
			lastModifiedByName: shouldForceLastModifiedAuthorUpdate
				? fileMetadata.authorName
				: existingLastModifiedIdentity.authorName || fileMetadata.authorName,
			lastModifiedByEmail: shouldForceLastModifiedAuthorUpdate
				? fileMetadata.authorEmail
				: existingLastModifiedIdentity.authorEmail || fileMetadata.authorEmail,
			authorName: fileMetadata.authorName,
			authorEmail: fileMetadata.authorEmail,
			createdAt,
			lastModifiedAt: comparisonLastModifiedAt,
			copyrightStartYear,
			companyName: fileMetadata.companyName,
			currentYear
		});

		const comparisonReplacement = replaceOrInsertHeader(original, comparisonHeader, filePath, syntaxOptions);
		const needsUpdate = comparisonReplacement.changed;
		const finalLastModifiedAt = needsUpdate ? formatDate(toZone(toDatePayload(new Date()))) : comparisonLastModifiedAt;
		const lastModifiedAtSource = needsUpdate ? "current-time-on-change" : comparisonLastModifiedAtSource;

		const header = needsUpdate
			? buildHeader({
					absoluteFilePath: filePath,
					language: fileMetadata.language,
					syntaxOptions,
					projectRoot: fileMetadata.projectRoot,
					projectName: fileMetadata.projectName,
					createdByName: shouldForceAuthorUpdate ? fileMetadata.authorName : existingIdentity.authorName || fileMetadata.authorName,
					createdByEmail: shouldForceAuthorUpdate ? fileMetadata.authorEmail : existingIdentity.authorEmail || fileMetadata.authorEmail,
					lastModifiedByName: shouldForceLastModifiedAuthorUpdate
						? fileMetadata.authorName
						: existingLastModifiedIdentity.authorName || fileMetadata.authorName,
					lastModifiedByEmail: shouldForceLastModifiedAuthorUpdate
						? fileMetadata.authorEmail
						: existingLastModifiedIdentity.authorEmail || fileMetadata.authorEmail,
					authorName: fileMetadata.authorName,
					authorEmail: fileMetadata.authorEmail,
					createdAt,
					lastModifiedAt: finalLastModifiedAt,
					copyrightStartYear,
					companyName: fileMetadata.companyName,
					currentYear
				})
			: comparisonHeader;

		const replacement = needsUpdate ? replaceOrInsertHeader(original, header, filePath, syntaxOptions) : comparisonReplacement;
		/** @type {FixHeadersResult["changes"][number]} */
		const changeEntry = {
			file: relativePath,
			changed: replacement.changed
		};

		if (check) {
			const dateIssues = checkHeaderDates(
				existingHeaderText,
				{ gitCreated, gitLastModified: gitLastUpdated, filesystemCreated: filesystemCreatedAt },
				{ strictCreatedDate: effectiveOptions.strictCreatedDate === true }
			);
			const advisoryCount = dateIssues.filter((issue) => issue.advisory).length;
			changeEntry.dateIssues = dateIssues;
			dateAdvisories += advisoryCount;
			filesWithDateDrift += dateIssues.length > advisoryCount ? 1 : 0;
		}

		if (effectiveOptions.sampleOutput === true && replacement.changed) {
			const previousValue = existingHeaderText.length > 0 ? existingHeaderText.trimEnd() : null;
			const diffPath = relativePath.replace(/\\/g, "/");
			const headerLineOffset = replacement.nextContent.slice(0, replacement.nextContent.indexOf(header)).split("\n").length - 1;
			changeEntry.sample = {
				previousValue,
				newValue: header,
				diff: createUnifiedDiff(previousValue, header, {
					fromFile: `a/${diffPath}`,
					toFile: `b/${diffPath}`,
					lineOffset: headerLineOffset
				}),
				issues: compareHeaderFields(previousValue, header),
				detectedValues: {
					projectName: fileMetadata.projectName,
					projectNameSource: fileMetadata.projectNameSource,
					language: fileMetadata.language,
					projectRoot: fileMetadata.projectRoot,
					marker: fileMetadata.marker,
					authorName: fileMetadata.authorName,
					authorEmail: fileMetadata.authorEmail,
					companyName: fileMetadata.companyName,
					companyNameSource: fileMetadata.companyNameSource,
					copyrightStartYear,
					copyrightStartYearSource,
					createdAtSource,
					lastModifiedAtSource,
					createdAt,
					lastModifiedAt: finalLastModifiedAt
				}
			};
		}

		changes.push(changeEntry);

		if (!replacement.changed) {
			continue;
		}

		filesUpdated += 1;
		if (!dryRun) {
			await writeFile(filePath, replacement.nextContent, "utf8");
		}
	}

	return {
		metadata,
		detectedProjects: Array.from(detectedProjects),
		filesScanned: files.length - skipped.length,
		filesUpdated,
		filesSkipped: skipped.length,
		dryRun,
		check,
		...(check ? { filesWithDateDrift, dateAdvisories } : {}),
		changes,
		skipped
	};
}
