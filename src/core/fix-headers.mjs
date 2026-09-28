/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/core/fix-headers.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { readFile, stat, writeFile } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { discoverFiles } from "./file-discovery.mjs";
import { resolveProjectMetadata } from "../detect/project.mjs";
import { checkHeaderDates, normalizeDatePayload, repairDateEpoch } from "../header/dates.mjs";
import { buildHeader } from "../header/template.mjs";
import { compareHeaderFields } from "../header/fields.mjs";
import { findProjectHeader, replaceOrInsertHeader } from "../header/parser.mjs";
import { createUnifiedDiff } from "../utils/diff.mjs";
import { readFileDates } from "../utils/fs.mjs";
import { getGitCreationDate, getGitLastModifiedDate } from "../utils/git.mjs";
import { toDatePayload } from "../utils/time.mjs";

/**
 * @typedef {{
 *  cwd?: string,
 *  input?: string,
 *  dryRun?: boolean,
 *  check?: boolean,
 *  fixCreatedDate?: boolean,
 *  normalizeDateFormat?: boolean,
 *  configFile?: string,
 *  sampleOutput?: boolean,
 *  forceAuthorUpdate?: boolean,
 *  forceLastModifiedAuthorUpdate?: boolean,
 *  useGpgSignerAuthor?: boolean,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
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
 *  copyrightStartYear?: number
 * }} FixHeadersOptions
 */

/**
 * @typedef {import("../header/fields.mjs").HeaderFieldIssue} HeaderFieldIssue
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
 * - `detectedValues` - the metadata resolved for the file.
 * @typedef {{
 *  metadata: {
 *   projectName: string,
 *   language: string,
 *   projectRoot: string,
 *   marker: string | null,
 *   authorName: string,
 *   authorEmail: string,
 *   companyName: string,
 *   copyrightStartYear: number
 *  },
 *  detectedProjects: string[],
 *  filesScanned: number,
 *  filesUpdated: number,
 *  dryRun: boolean,
 *  check: boolean,
 *  filesWithDateDrift?: number,
 *  dateAdvisories?: number,
 *  changes: Array<{file: string, changed: boolean, dateIssues?: import("../header/dates.mjs").DateCheckIssue[], sample?: { previousValue: string | null, newValue: string, diff: string, issues: HeaderFieldIssue[], detectedValues?: {
 *   projectName: string,
 *   language: string,
 *   projectRoot: string,
 *   marker: string | null,
 *   authorName: string,
 *   authorEmail: string,
 *   companyName: string,
 *   copyrightStartYear: number,
 *   createdAtSource: string,
 *   lastModifiedAtSource: string,
 *   createdAt: {date: string, timestamp: number},
 *   lastModifiedAt: {date: string, timestamp: number}
 *  } }}>
 * }} FixHeadersResult
 */

/**
 * Resolves runtime options including optional JSON config file loading.
 * @param {FixHeadersOptions} options - Runtime options.
 * @returns {Promise<FixHeadersOptions>} Effective runtime options.
 */
async function resolveRuntimeOptions(options) {
	const configFile = typeof options.configFile === "string" && options.configFile.trim().length > 0 ? options.configFile.trim() : null;

	if (!configFile) {
		return options;
	}

	const baseCwd = typeof options.cwd === "string" && options.cwd.length > 0 ? options.cwd : process.cwd();
	const absoluteConfigPath = resolve(baseCwd, configFile);
	const raw = await readFile(absoluteConfigPath, "utf8");
	const parsed = JSON.parse(raw);

	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`Config file must contain a JSON object: ${configFile}`);
	}

	const merged = {
		...parsed,
		...options
	};

	delete merged.configFile;
	/** @type {FixHeadersOptions} */
	const output = merged;
	return output;
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
	const scanRoot = resolve(effectiveOptions.projectRoot || effectiveOptions.cwd || process.cwd());
	const metadata = await resolveProjectMetadata({
		...effectiveOptions,
		cwd: scanRoot
	});
	const check = effectiveOptions.check === true;
	const dryRun = check || effectiveOptions.dryRun === true;
	const fixCreatedDate = effectiveOptions.fixCreatedDate === true;
	/** @type {(payload: {date: string, timestamp: number}) => {date: string, timestamp: number}} */
	const formatDate = effectiveOptions.normalizeDateFormat === true ? normalizeDatePayload : (payload) => payload;

	/** @type {string[]} */
	let files;
	if (typeof effectiveOptions.input === "string" && effectiveOptions.input.trim().length > 0) {
		const inputPath = resolve(scanRoot, effectiveOptions.input);
		const targetStats = await stat(inputPath).catch(() => null);
		if (!targetStats) {
			throw new Error(`Input path does not exist: ${effectiveOptions.input}`);
		}

		if (targetStats.isFile()) {
			files = [inputPath];
		} else if (targetStats.isDirectory()) {
			files = await discoverFiles({
				projectRoot: inputPath,
				language: metadata.language,
				enabledDetectors: effectiveOptions.enabledDetectors,
				disabledDetectors: effectiveOptions.disabledDetectors,
				includeFolders: effectiveOptions.includeFolders,
				excludeFolders: effectiveOptions.excludeFolders,
				includeExtensions: effectiveOptions.includeExtensions,
				gitignore: effectiveOptions.gitignore
			});
		} else {
			throw new Error(`Input path must be a file or directory: ${effectiveOptions.input}`);
		}
	} else {
		files = await discoverFiles({
			projectRoot: scanRoot,
			language: metadata.language,
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			includeFolders: effectiveOptions.includeFolders,
			excludeFolders: effectiveOptions.excludeFolders,
			includeExtensions: effectiveOptions.includeExtensions,
			gitignore: effectiveOptions.gitignore
		});
	}

	const currentYear = new Date().getFullYear();
	/** @type {FixHeadersResult["changes"]} */
	const changes = [];
	const detectedProjects = new Set();
	let filesUpdated = 0;
	let filesWithDateDrift = 0;
	let dateAdvisories = 0;

	for (const filePath of files) {
		const fileMetadata = await resolveProjectMetadata({
			...effectiveOptions,
			cwd: scanRoot,
			targetFilePath: filePath
		});

		detectedProjects.add(`${fileMetadata.language}:${fileMetadata.projectRoot}`);
		const relativePath = relative(scanRoot, filePath);
		const original = await readFile(filePath, "utf8");
		const existingHeader = findProjectHeader(original, filePath, {
			language: fileMetadata.language,
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
		});
		const existingHeaderText = existingHeader ? original.slice(existingHeader.start, existingHeader.end) : "";
		const existingIdentity = existingHeaderText.length > 0 ? extractHeaderAuthorIdentity(existingHeaderText) : {};
		const existingLastModifiedIdentity = existingHeaderText.length > 0 ? extractHeaderLastModifiedIdentity(existingHeaderText) : {};
		const existingCreatedAt = existingHeaderText.length > 0 ? extractHeaderCreatedAt(existingHeaderText) : null;
		const existingLastModifiedAt = existingHeaderText.length > 0 ? extractHeaderLastModifiedAt(existingHeaderText) : null;
		const filesystemDates = await readFileDates(filePath);

		const metadataRelativePath = relative(fileMetadata.projectRoot, filePath);
		const gitCreated = await getGitCreationDate(fileMetadata.projectRoot, metadataRelativePath);
		const gitLastUpdated = await getGitLastModifiedDate(fileMetadata.projectRoot, metadataRelativePath);

		// An epoch that disagrees with its own datetime text is recomputed from the text. With
		// fixCreatedDate, an existing @Date that is not the git first-commit instant is dropped so the
		// git date takes over; without git history it is kept.
		const repairedCreatedAt = repairDateEpoch(existingCreatedAt);
		const keptCreatedAt =
			fixCreatedDate && gitCreated && repairedCreatedAt && repairedCreatedAt.timestamp !== gitCreated.timestamp ? null : repairedCreatedAt;
		const repairedLastModifiedAt = repairDateEpoch(existingLastModifiedAt);
		const createdAtSource = keptCreatedAt ? "existing-header" : gitCreated ? "git-created" : "filesystem-created";
		const comparisonLastModifiedAtSource = repairedLastModifiedAt
			? "existing-header"
			: gitLastUpdated
				? "git-last-modified"
				: "filesystem-updated";
		const createdAt = formatDate(keptCreatedAt || gitCreated || toDatePayload(filesystemDates.createdAt));
		const comparisonLastModifiedAt = formatDate(repairedLastModifiedAt || gitLastUpdated || toDatePayload(filesystemDates.updatedAt));
		const shouldForceAuthorUpdate = effectiveOptions.forceAuthorUpdate === true;
		const shouldForceLastModifiedAuthorUpdate = effectiveOptions.forceLastModifiedAuthorUpdate === true;

		const comparisonHeader = buildHeader({
			absoluteFilePath: filePath,
			language: fileMetadata.language,
			syntaxOptions: {
				language: fileMetadata.language,
				enabledDetectors: effectiveOptions.enabledDetectors,
				disabledDetectors: effectiveOptions.disabledDetectors,
				detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
			},
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
			copyrightStartYear: fileMetadata.copyrightStartYear,
			companyName: fileMetadata.companyName,
			currentYear
		});

		const comparisonReplacement = replaceOrInsertHeader(original, comparisonHeader, filePath, {
			language: fileMetadata.language,
			enabledDetectors: effectiveOptions.enabledDetectors,
			disabledDetectors: effectiveOptions.disabledDetectors,
			detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
		});
		const needsUpdate = comparisonReplacement.changed;
		const finalLastModifiedAt = needsUpdate ? formatDate(toDatePayload(new Date())) : comparisonLastModifiedAt;
		const lastModifiedAtSource = needsUpdate ? "current-time-on-change" : comparisonLastModifiedAtSource;

		const header = needsUpdate
			? buildHeader({
					absoluteFilePath: filePath,
					language: fileMetadata.language,
					syntaxOptions: {
						language: fileMetadata.language,
						enabledDetectors: effectiveOptions.enabledDetectors,
						disabledDetectors: effectiveOptions.disabledDetectors,
						detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
					},
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
					copyrightStartYear: fileMetadata.copyrightStartYear,
					companyName: fileMetadata.companyName,
					currentYear
				})
			: comparisonHeader;

		const replacement = needsUpdate
			? replaceOrInsertHeader(original, header, filePath, {
					language: fileMetadata.language,
					enabledDetectors: effectiveOptions.enabledDetectors,
					disabledDetectors: effectiveOptions.disabledDetectors,
					detectorSyntaxOverrides: effectiveOptions.detectorSyntaxOverrides
				})
			: comparisonReplacement;
		/** @type {FixHeadersResult["changes"][number]} */
		const changeEntry = {
			file: relativePath,
			changed: replacement.changed
		};

		if (check) {
			const dateIssues = checkHeaderDates(existingHeaderText, { gitCreated, gitLastModified: gitLastUpdated });
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
					language: fileMetadata.language,
					projectRoot: fileMetadata.projectRoot,
					marker: fileMetadata.marker,
					authorName: fileMetadata.authorName,
					authorEmail: fileMetadata.authorEmail,
					companyName: fileMetadata.companyName,
					copyrightStartYear: fileMetadata.copyrightStartYear,
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
		filesScanned: files.length,
		filesUpdated,
		dryRun,
		check,
		...(check ? { filesWithDateDrift, dateAdvisories } : {}),
		changes
	};
}
