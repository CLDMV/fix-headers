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
