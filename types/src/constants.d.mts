/**
 * Reads a layout count option (`spacing` / `margin`): unset means the default, anything but a whole number of 0 or more throws.
 * @param {unknown} value - Option value.
 * @param {string} name - Option name for the error message.
 * @param {number} fallback - Default when unset.
 * @returns {number} Validated count.
 */
export function resolveLayoutCount(value: unknown, name: string, fallback: number): number;
/** Header must sit near the top of the file, but a metadata block can legitimately
 *	run long; cap the scan generously so a long block's closing comment delimiter is still seen.
 * @type {number} */
export const DEFAULT_MAX_HEADER_SCAN_LINES: number;
/** Empty comment lines just inside a header's opening and closing delimiters (or a bare comment-prefix line above and below a line-comment header).
 * @type {number} */
export const DEFAULT_HEADER_SPACING: number;
/** Blank lines between the end of the header and the file's next content.
 * @type {number} */
export const DEFAULT_HEADER_MARGIN: number;
export { DETECTOR_PROFILES, getAllowedExtensions, getEnabledDetectors } from "./detectors/index.mjs";
