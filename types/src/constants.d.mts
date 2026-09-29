/** Header must sit near the top of the file, but a metadata block can legitimately
 *	run long; cap the scan generously so a long block's closing comment delimiter is still seen.
 * @type {number} */
export const DEFAULT_MAX_HEADER_SCAN_LINES: number;
export { DETECTOR_PROFILES, getAllowedExtensions, getEnabledDetectors } from "./detectors/index.mjs";
