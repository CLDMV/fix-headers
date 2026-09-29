/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/shared.mjs
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
 * @fileoverview Shared detector helpers for nearest marker search.
 * @module fix-headers/detectors/shared
 */
/**
 * Finds the closest marker file by walking up parent directories.
 * @param {string} startPath - Starting directory or file path.
 * @param {string[]} markers - Marker filenames to search.
 * @returns {Promise<{root: string, marker: string} | null>} Closest located marker.
 */
export declare function findNearestMarker(startPath: string, markers: string[]): Promise<{
    root: string;
    marker: string;
} | null>;
/**
 * Reads the project name from a `package.json` marker: its trimmed `name`, or the fallback
 * when the content isn't valid JSON or has no non-empty string `name`.
 * @param {string} markerContent - `package.json` content.
 * @param {string} fallbackName - Name to use without a usable `name` (the project folder name).
 * @returns {string} Project name.
 */
export declare function parsePackageJsonName(markerContent: string, fallbackName: string): string;
