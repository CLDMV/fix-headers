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
export declare const DEFAULT_COMPANY_NAME: string;
/** Header must sit near the top of the file, but a metadata block can legitimately
 *	run long; cap the scan generously so a long block's closing `*​/` is still seen.
 * @type {number} */
export declare const DEFAULT_MAX_HEADER_SCAN_LINES: number;
/**
 * Folders skipped at ANY depth — vendored / VCS directories that are never source and can
 * legitimately nest (hoisted `node_modules`, submodule `.git`).
 * @type {Set<string>}
 */
export declare const ALWAYS_IGNORE_FOLDERS: Set<string>;
/**
 * Folders skipped ONLY at the project root — build / cache output directories. Anchored to
 * the root so a nested SOURCE directory that happens to share the name (e.g. `tools/build`,
 * `packages/x/dist`-style source) is still processed; only the top-level `/build`, `/dist`,
 * `/coverage`, … are ignored.
 * @type {Set<string>}
 */
export declare const ROOT_IGNORE_FOLDERS: Set<string>;
/**
 * Backward-compatible union of {@link ALWAYS_IGNORE_FOLDERS} and {@link ROOT_IGNORE_FOLDERS}.
 * Discovery applies the two sets with different scoping; prefer the specific sets.
 * @type {Set<string>}
 */
export declare const DEFAULT_IGNORE_FOLDERS: Set<string>;
