/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detect/project.mjs
 *	@Date: 2026-03-01 13:32:57 -08:00 (1772400777)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { dirname, extname, join, resolve } from "node:path";
import { DEFAULT_COMPANY_NAME } from "../constants.mjs";
import { getEnabledDetectors } from "../detectors/index.mjs";
import { readTextIfExists } from "../utils/fs.mjs";
import { detectGitAuthor } from "../utils/git.mjs";

/**
 * @fileoverview Auto-detects project metadata from known language markers and git config.
 * @module fix-headers/detect/project
 */

async function findClosestDetectorMatch(startPath, detectors, preferredExtension = "") {
	const extension = typeof preferredExtension === "string" ? preferredExtension.trim().toLowerCase() : "";
	const extensionMatched =
		extension.length > 0
			? detectors.filter((detector) => Array.isArray(detector.extensions) && detector.extensions.includes(extension))
			: [];
	const detectorsToSearch = extensionMatched.length > 0 ? extensionMatched : detectors;

	const matches = await Promise.all(
		detectorsToSearch.map(async (detector) => {
			if (typeof detector.findNearestConfig !== "function") {
				return null;
			}

			const located = await detector.findNearestConfig(startPath);
			if (!located) {
				return null;
			}

			return {
				detector,
				root: located.root,
				marker: located.marker
			};
		})
	);

	const validMatches = matches.filter((item) => item !== null);
	if (validMatches.length === 0) {
		return null;
	}

	let closest = validMatches[0];
	for (const candidate of validMatches.slice(1)) {
		if (candidate.root.length > closest.root.length) {
			closest = candidate;
			continue;
		}

		if (candidate.root.length === closest.root.length) {
			const candidatePriority = Number.isFinite(candidate.detector.priority) ? candidate.detector.priority : 0;
			const closestPriority = Number.isFinite(closest.detector.priority) ? closest.detector.priority : 0;
			if (candidatePriority > closestPriority) {
				closest = candidate;
			}
		}
	}

	return closest;
}

/**
 * Appends company suffix to author display name when requested.
 * @param {string} authorName - Base author name.
 * @param {string | undefined} company - Optional company suffix value.
 * @returns {string} Formatted author name.
 */
function formatAuthorNameWithCompany(authorName, company) {
	if (typeof company !== "string") {
		return authorName;
	}

	const trimmedCompany = company.trim();
	if (trimmedCompany.length === 0) {
		return authorName;
	}

	if (/<[^>]+>/.test(authorName)) {
		return authorName;
	}

	return `${authorName} <${trimmedCompany}>`;
}

/**
 * Detects project root and language by scanning known marker files.
 * @param {string} cwd - Starting working directory.
 * @param {{ detectors?: { id: string, extensions: string[], priority?: number, findNearestConfig: (path: string) => Promise<{ root: string, marker: string } | null>, parseProjectName: (marker: string, content: string, rootDirName: string) => string }[], enabledDetectors?: string[], disabledDetectors?: string[], preferredExtension?: string }} [options={}] - Detection options.
 * @returns {Promise<{
 *  language: string,
 *  rootDir: string,
 *  marker: string | null,
 *  projectName: string
 * }>} Detection result.
 */
export async function detectProjectFromMarkers(cwd, options = {}) {
	const detectors = Array.isArray(options.detectors) ? options.detectors : getEnabledDetectors(options);
	const located = await findClosestDetectorMatch(cwd, detectors, options.preferredExtension);

	if (located) {
		const markerPath = join(located.root, located.marker);
		const markerContent = (await readTextIfExists(markerPath)) || "";
		const rootDirName = located.root.split("/").filter(Boolean).at(-1) || "project";
		const projectName = located.detector.parseProjectName(located.marker, markerContent, rootDirName);

		return {
			language: located.detector.id,
			rootDir: located.root,
			marker: located.marker,
			projectName
		};
	}

	const fallbackRoot = resolve(cwd);
	const fallbackName = fallbackRoot.split("/").filter(Boolean).at(-1) || "project";
	return {
		language: "unknown",
		rootDir: fallbackRoot,
		marker: null,
		projectName: fallbackName
	};
}

/**
 * Resolves project metadata with override support for every auto-detected field.
 * @param {{
 *  cwd?: string,
 *  targetFilePath?: string,
 *  enabledDetectors?: string[],
 *  disabledDetectors?: string[],
 *  projectName?: string,
 *  language?: string,
 *  projectRoot?: string,
 *  marker?: string | null,
 *  useGpgSignerAuthor?: boolean,
 *  authorName?: string,
 *  authorEmail?: string,
 *  company?: string,
 *  companyName?: string,
 *  copyrightStartYear?: number
 * }} [options={}] - Detection options and overrides.
 * @returns {Promise<{
 *  projectName: string,
 *  language: string,
 *  projectRoot: string,
 *  marker: string | null,
 *  authorName: string,
 *  authorEmail: string,
 *  companyName: string,
 *  copyrightStartYear: number
 * }>} Final metadata.
 */
export async function resolveProjectMetadata(options = {}) {
	const basePath = options.targetFilePath || options.cwd || process.cwd();
	const cwd = resolve(basePath);
	const detectors = getEnabledDetectors(options);
	const detectFrom = options.targetFilePath ? dirname(cwd) : cwd;
	const preferredExtension = options.targetFilePath ? extname(cwd).toLowerCase() : "";
	const detected = await detectProjectFromMarkers(detectFrom, { detectors, preferredExtension });
	const gitAuthor = await detectGitAuthor(detected.rootDir, {
		useGpgSignerAuthor: options.useGpgSignerAuthor === true
	});
	const currentYear = new Date().getFullYear();
	const baseAuthorName = options.authorName || gitAuthor.authorName || "Unknown Author";

	return {
		projectName: options.projectName || detected.projectName,
		language: options.language || detected.language,
		projectRoot: options.projectRoot || detected.rootDir,
		marker: options.marker === undefined ? detected.marker : options.marker,
		authorName: formatAuthorNameWithCompany(baseAuthorName, options.company),
		authorEmail: options.authorEmail || gitAuthor.authorEmail || "unknown@example.com",
		companyName: options.companyName || DEFAULT_COMPANY_NAME,
		copyrightStartYear: Number.isInteger(options.copyrightStartYear) ? Number(options.copyrightStartYear) : currentYear
	};
}
