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

/** @type {string} */
export const DEFAULT_COMPANY_NAME = "Catalyzed Motivation Inc.";

/** @type {number} */
export const DEFAULT_MAX_HEADER_SCAN_LINES = 40;

/** @type {Set<string>} */
export const DEFAULT_IGNORE_FOLDERS = new Set([".git", "node_modules", "dist", "build", "coverage", "tmp", ".next", ".turbo"]);
