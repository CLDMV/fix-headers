/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/index.mjs
 *	@Date: 2026-03-01T16:34:41-08:00 (1772411681)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:13-07:00 (1790969293)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { extname } from "node:path";
import { detector as cssDetector } from "./css.mjs";
import { detector as goDetector } from "./go.mjs";
import { detector as htmlDetector } from "./html.mjs";
import { detector as jsonDetector } from "./json.mjs";
import { detector as markdownDetector } from "./markdown.mjs";
import { detector as nodeDetector } from "./node.mjs";
import { detector as phpDetector } from "./php.mjs";
import { detector as pythonDetector } from "./python.mjs";
import { detector as rustDetector } from "./rust.mjs";
import { detector as yamlDetector } from "./yaml.mjs";

/**
 * @fileoverview Detector registry and shared selector helpers.
 * @module fix-headers/detectors
 */

/**
 * @typedef {{
 *  id: string,
 *  extensions: string[],
 *  enabledByDefault: boolean,
 *  requiresForce?: boolean,
 *  resolveCommentSyntax: (filePath: string) => ({kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string} | null),
 *  resolvePreservedPrefix?: (filePath: string, content: string) => string
 * }} DetectorProfile
 * A file-type detector: which extensions it handles and the comment syntax (and preserved
 * leading prefix) of those files. Which project a file belongs to is resolved separately,
 * from the manifest drivers in `src/drivers/`. A detector with `requiresForce: true` is used only
 * when its id is listed in the `forcedDetectors` option (see {@link getEnabledDetectors}).
 */

/**
 * Registered detector profiles, in alphabetical order by module name. Imported
 * statically (not discovered from the directory at runtime) so the registry
 * survives bundling into dist/. Add a new detector module here. The cast keeps the
 * public type `DetectorProfile[]`: the detector modules' object literals widen their
 * `kind` strings, which the typedef narrows to its literal union.
 */
export const DETECTOR_PROFILES = /** @type {DetectorProfile[]} */ ([
	cssDetector,
	goDetector,
	htmlDetector,
	jsonDetector,
	markdownDetector,
	nodeDetector,
	phpDetector,
	pythonDetector,
	rustDetector,
	yamlDetector
]);

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
 * Validates the `forcedDetectors` option: each id must name a force-only detector
 * (`requiresForce: true`). Forcing a detector that is used without forcing, or one that does
 * not exist, is reported instead of silently doing nothing.
 * @param {unknown} value - Option value.
 * @returns {string[]} De-duplicated detector ids (empty when unset).
 */
export function resolveForcedDetectors(value) {
	if (value === undefined || value === null) {
		return [];
	}
	if (!Array.isArray(value) || value.some((id) => typeof id !== "string")) {
		throw new Error(`forcedDetectors must be an array of detector ids, got ${JSON.stringify(value)}`);
	}
	const forceOnly = DETECTOR_PROFILES.filter((detector) => detector.requiresForce === true).map((detector) => detector.id);
	for (const id of value) {
		if (!detectorMap.has(id)) {
			throw new Error(`forcedDetectors: unknown detector "${id}" (force-only detectors: ${forceOnly.join(", ")})`);
		}
		if (!forceOnly.includes(id)) {
			throw new Error(`forcedDetectors: "${id}" does not need forcing (force-only detectors: ${forceOnly.join(", ")})`);
		}
	}
	return Array.from(new Set(value));
}

/**
 * Gets enabled detector profiles based on include/exclude options. A force-only detector
 * (`requiresForce: true`) is enabled only when `forcedDetectors` names it, and then even when
 * `enabledDetectors` does not; `disabledDetectors` still turns it off. Listing it in
 * `enabledDetectors` alone does not force it.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {typeof DETECTOR_PROFILES} Enabled detector list.
 */
export function getEnabledDetectors(options = {}) {
	const explicitEnabled = new Set(Array.isArray(options.enabledDetectors) ? options.enabledDetectors : []);
	const explicitDisabled = new Set(Array.isArray(options.disabledDetectors) ? options.disabledDetectors : []);
	const forced = new Set(Array.isArray(options.forcedDetectors) ? options.forcedDetectors : []);

	return DETECTOR_PROFILES.filter((detector) => {
		if (detector.requiresForce === true) {
			return forced.has(detector.id) && !explicitDisabled.has(detector.id);
		}

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
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], includeExtensions?: string[] }} [options={}] - Runtime options.
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
 * Says why a file cannot be given a header, or returns null when it can. A file gets a header
 * only when an enabled detector handles its extension and supplies a comment syntax; anything
 * else (strict `.json`, `.txt`, extensionless files, a disabled detector's extensions, Markdown
 * that is not forced) is skipped rather than given a comment its format cannot carry.
 * @param {string} filePath - File path.
 * @param {{ enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
 * @returns {string | null} Skip reason, or null when the file can carry a header.
 */
export function getHeaderSkipReason(filePath, options = {}) {
	const extension = extname(filePath).toLowerCase();
	const handled = getEnabledDetectors(options).some(
		(detector) => detector.extensions.includes(extension) && detector.resolveCommentSyntax(filePath) !== null
	);
	if (handled) {
		return null;
	}
	if (extension.length === 0) {
		return "the file has no extension, so its comment syntax is unknown";
	}
	const forced = new Set(Array.isArray(options.forcedDetectors) ? options.forcedDetectors : []);
	const forceOnly = DETECTOR_PROFILES.find(
		(detector) => detector.requiresForce === true && detector.extensions.includes(extension) && !forced.has(detector.id)
	);
	if (forceOnly) {
		return `${extension} files get a header only when forced (--force-detector ${forceOnly.id} / forcedDetectors: ["${forceOnly.id}"])`;
	}
	return `no enabled detector handles ${extension} files`;
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
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[], detectors?: DetectorProfile[], detectorSyntaxOverrides?: Record<string, { linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string }>, spacing?: number, margin?: number }} [options={}] - Runtime options. `detectors` overrides the enabled-detector set (matching {@link detectProjectFromMarkers}).
 * @returns {{kind: "block" | "line" | "html", linePrefix?: string, lineSeparator?: string, blockStart?: string, blockLinePrefix?: string, blockEnd?: string}} Syntax descriptor.
 */
export function getCommentSyntaxForFile(filePath, options = {}) {
	const extension = extname(filePath).toLowerCase();
	const detectors = Array.isArray(options.detectors) ? options.detectors : getEnabledDetectors(options);
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
 * @param {{ language?: string, enabledDetectors?: string[], disabledDetectors?: string[], forcedDetectors?: string[] }} [options={}] - Runtime options.
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
