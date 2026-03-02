/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/index.mjs
 *	@Date: 2026-03-01 16:34:41 -08:00 (1772411681)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { readdir } from "node:fs/promises";
import { extname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

/**
 * @fileoverview Detector registry and shared selector helpers.
 * @module fix-headers/detectors
 */

/**
 * @typedef {{
 *  id: string,
 *  markers: string[],
 *  extensions: string[],
 *  enabledByDefault: boolean,
 *  findNearestConfig: (startPath: string) => Promise<{root: string, marker: string} | null>,
 *  parseProjectName: (marker: string, markerContent: string, rootDirName: string) => string,
 *  resolveCommentSyntax: (filePath: string) => ({kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string} | null),
 *  resolvePreservedPrefix?: (filePath: string, content: string) => string,
 *  priority?: number
 * }} DetectorProfile
 */

/**
 * Loads detector modules from the current directory.
 * @returns {Promise<DetectorProfile[]>} Loaded detectors.
 */
async function loadDetectorsFromDirectory() {
	const directoryPath = dirname(fileURLToPath(import.meta.url));
	const files = await readdir(directoryPath);
	const detectorFiles = files
		.filter((fileName) => fileName.endsWith(".mjs"))
		.filter((fileName) => fileName !== "index.mjs" && fileName !== "shared.mjs")
		.sort((left, right) => left.localeCompare(right));

	const modules = await Promise.all(
		detectorFiles.map((fileName) => {
			const fileUrl = pathToFileURL(join(directoryPath, fileName)).href;
			return import(fileUrl);
		})
	);

	return modules.map((moduleExports) => moduleExports.detector).filter((entry) => entry && typeof entry.id === "string");
}

export const DETECTOR_PROFILES = await loadDetectorsFromDirectory();

/** @type {Map<string, typeof DETECTOR_PROFILES[number]>} */
const detectorMap = new Map(DETECTOR_PROFILES.map((detector) => [detector.id, detector]));

/**
 * Applies runtime syntax overrides to a detector-provided syntax descriptor.
 * @param {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} syntax - Base syntax descriptor.
 * @param {{ linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string } | undefined} override - Override descriptor.
 * @returns {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} Effective descriptor.
 */
function applySyntaxOverride(syntax, override) {
	if (!override || typeof override !== "object") {
		return syntax;
	}

	if (syntax.kind === "line") {
		return {
			...syntax,
			linePrefix: typeof override.linePrefix === "string" && override.linePrefix.length > 0 ? override.linePrefix : syntax.linePrefix,
			lineSeparator: typeof override.lineSeparator === "string" ? override.lineSeparator : syntax.lineSeparator
		};
	}

	return {
		...syntax,
		blockStart: typeof override.blockStart === "string" && override.blockStart.length > 0 ? override.blockStart : syntax.blockStart,
		blockLinePrefix:
			typeof override.blockLinePrefix === "string" && override.blockLinePrefix.length > 0
				? override.blockLinePrefix
				: syntax.blockLinePrefix,
		blockEnd: typeof override.blockEnd === "string" && override.blockEnd.length > 0 ? override.blockEnd : syntax.blockEnd
	};
}

/**
 * Gets enabled detector profiles based on include/exclude options.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {typeof DETECTOR_PROFILES} Enabled detector list.
 */
export function getEnabledDetectors(options = {}) {
	const explicitEnabled = new Set(Array.isArray(options.enabledDetectors) ? options.enabledDetectors : []);
	const explicitDisabled = new Set(Array.isArray(options.disabledDetectors) ? options.disabledDetectors : []);

	return DETECTOR_PROFILES.filter((detector) => {
		if (explicitEnabled.size > 0) {
			return explicitEnabled.has(detector.id);
		}

		if (explicitDisabled.has(detector.id)) {
			return false;
		}

		return detector.enabledByDefault;
	});
}

/**
 * Gets allowed file extensions for enabled detectors.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], includeExtensions?: string[] }} [options={}] - Runtime options.
 * @returns {Set<string>} Allowed extensions.
 */
export function getAllowedExtensions(options = {}) {
	if (Array.isArray(options.includeExtensions) && options.includeExtensions.length > 0) {
		return new Set(options.includeExtensions.map((extension) => extension.toLowerCase()));
	}

	const detectors = getEnabledDetectors(options);
	return new Set(detectors.flatMap((detector) => detector.extensions));
}

/**
 * Gets a detector by id.
 * @param {string} id - Detector id.
 * @returns {typeof DETECTOR_PROFILES[number] | undefined} Detector.
 */
export function getDetectorById(id) {
	return detectorMap.get(id);
}

/**
 * Resolves comment syntax for a file path using detector-specific templates.
 * @param {string} filePath - File path.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }> }} [options={}] - Runtime options.
 * @returns {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} Syntax descriptor.
 */
export function getCommentSyntaxForFile(filePath, options = {}) {
	const extension = extname(filePath).toLowerCase();
	const detectors = getEnabledDetectors(options);
	for (const detector of detectors) {
		if (!detector.extensions.includes(extension)) {
			continue;
		}
		const resolved = detector.resolveCommentSyntax(filePath);
		if (resolved) {
			const overrides =
				options.detectorSyntaxOverrides && typeof options.detectorSyntaxOverrides === "object" ? options.detectorSyntaxOverrides : {};
			return applySyntaxOverride(resolved, overrides[detector.id]);
		}
	}

	return { kind: "block", blockStart: "/**", blockLinePrefix: " *\t", blockEnd: " */" };
}

/**
 * Resolves detector-specific leading content that must be preserved above inserted headers.
 * @param {string} filePath - File path.
 * @param {string} content - Full file content.
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {string} Preserved prefix (possibly empty).
 */
export function getPreservedPrefixForFile(filePath, content, options = {}) {
	const extension = extname(filePath).toLowerCase();
	const detectors = getEnabledDetectors(options);
	for (const detector of detectors) {
		if (!detector.extensions.includes(extension)) {
			continue;
		}

		if (typeof detector.resolvePreservedPrefix === "function") {
			return detector.resolvePreservedPrefix(filePath, content);
		}

		return "";
	}

	return "";
}
