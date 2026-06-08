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

/**
 * Folders skipped at ANY depth — vendored / VCS directories that are never source and can
 * legitimately nest (hoisted `node_modules`, submodule `.git`).
 * @type {Set<string>}
 */
export const ALWAYS_IGNORE_FOLDERS = new Set([".git", "node_modules"]);

/**
 * Folders skipped ONLY at the project root — build / cache output directories. Anchored to
 * the root so a nested SOURCE directory that happens to share the name (e.g. `tools/build`,
 * `packages/x/dist`-style source) is still processed; only the top-level `/build`, `/dist`,
 * `/coverage`, … are ignored.
 * @type {Set<string>}
 */
export const ROOT_IGNORE_FOLDERS = new Set(["dist", "build", "coverage", "tmp", ".next", ".turbo"]);

/**
 * Backward-compatible union of {@link ALWAYS_IGNORE_FOLDERS} and {@link ROOT_IGNORE_FOLDERS}.
 * Discovery applies the two sets with different scoping; prefer the specific sets.
 * @type {Set<string>}
 */
export const DEFAULT_IGNORE_FOLDERS = new Set([...ALWAYS_IGNORE_FOLDERS, ...ROOT_IGNORE_FOLDERS]);
