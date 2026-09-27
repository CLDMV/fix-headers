/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/fs.mjs
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
 * @fileoverview Filesystem helpers for project discovery and recursive scanning.
 * @module fix-headers/utils/fs
 */
/**
 * Checks whether a file exists and is readable.
 * @param {string} filePath - Absolute or relative path.
 * @returns {Promise<boolean>} True when the path exists.
 */
export declare function pathExists(filePath: string): Promise<boolean>;
/**
 * Finds a marker file by traversing upward from a directory.
 * @param {string} startDir - Starting directory.
 * @param {string[]} markerFiles - Candidate marker file names.
 * @returns {Promise<{root: string, marker: string} | null>} First match with root path.
 */
export declare function findProjectRoot(startDir: string, markerFiles: string[]): Promise<{
    root: string;
    marker: string;
} | null>;
/**
 * Reads UTF-8 file content if it exists.
 * @param {string} filePath - File path.
 * @returns {Promise<string | null>} File content or null when missing.
 */
export declare function readTextIfExists(filePath: string): Promise<string | null>;
/**
 * Recursively discovers files matching allowed extensions.
 * @param {string} dirPath - Root directory to scan.
 * @param {{
 *  allowedExtensions: Set<string>,
 *  ignoreFolders: Set<string>,
 *  shouldSkipDirectory?: (directoryPath: string, directoryName: string) => boolean
 * }} options - Scan options.
 * @returns {Promise<string[]>} Matching file paths.
 */
export declare function walkFiles(dirPath: string, options: {
    allowedExtensions: Set<string>;
    ignoreFolders: Set<string>;
    shouldSkipDirectory?: (directoryPath: string, directoryName: string) => boolean;
}): Promise<string[]>;
/**
 * Gets creation-like and modified timestamps from filesystem stats.
 * @param {string} filePath - Absolute file path.
 * @returns {Promise<{createdAt: Date, updatedAt: Date}>} Date pair.
 */
export declare function readFileDates(filePath: string): Promise<{
    createdAt: Date;
    updatedAt: Date;
}>;
