/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/constants.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

/**
 * @fileoverview Shared constants for project/language detection and header defaults.
 * @module fix-headers/constants
 */

export { DETECTOR_PROFILES, getAllowedExtensions, getEnabledDetectors } from "./detectors/index.mjs";

/** Header must sit near the top of the file, but a metadata block can legitimately
 *	run long; cap the scan generously so a long block's closing comment delimiter is still seen.
 * @type {number} */
export const DEFAULT_MAX_HEADER_SCAN_LINES = 200;

/** Empty comment lines just inside a header's opening and closing delimiters (or a bare comment-prefix line above and below a line-comment header).
 * @type {number} */
export const DEFAULT_HEADER_SPACING = 1;

/** Blank lines between the end of the header and the file's next content.
 * @type {number} */
export const DEFAULT_HEADER_MARGIN = 2;

/**
 * Reads a layout count option (`spacing` / `margin`): unset means the default, anything but a whole number of 0 or more throws.
 * @param {unknown} value - Option value.
 * @param {string} name - Option name for the error message.
 * @param {number} fallback - Default when unset.
 * @returns {number} Validated count.
 */
export function resolveLayoutCount(value, name, fallback) {
	if (value === undefined || value === null) {
		return fallback;
	}
	if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
		throw new Error(`${name} must be a whole number of 0 or more, got ${JSON.stringify(value)}`);
	}
	return value;
}
