/**
 * @fileoverview Filesystem helpers for project discovery and recursive scanning.
 * @module fix-headers/utils/fs
 */
/**
 * Checks whether a file exists and is readable.
 * @param {string} filePath - Absolute or relative path.
 * @returns {Promise<boolean>} True when the path exists.
 */
export function pathExists(filePath: string): Promise<boolean>;
/**
 * Finds a marker file by traversing upward from a directory.
 * @param {string} startDir - Starting directory.
 * @param {string[]} markerFiles - Candidate marker file names.
 * @returns {Promise<{root: string, marker: string} | null>} First match with root path.
 */
export function findProjectRoot(startDir: string, markerFiles: string[]): Promise<{
    root: string;
    marker: string;
} | null>;
/**
 * Reads UTF-8 file content if it exists.
 * @param {string} filePath - File path.
 * @returns {Promise<string | null>} File content or null when missing.
 */
export function readTextIfExists(filePath: string): Promise<string | null>;
/**
 * Recursively discovers files matching allowed extensions.
 * @param {string} dirPath - Root directory to scan.
 * @param {{
 *  allowedExtensions: Set<string>,
 *  ignoreFolders: Set<string>,
 *  shouldSkipDirectory?: (directoryPath: string, directoryName: string) => boolean | Promise<boolean>,
 *  recursive?: boolean
 * }} options - Scan options. `recursive: false` lists only the directory's own files.
 *  `shouldSkipDirectory` may be async. Symlinked directories are never followed.
 * @returns {Promise<string[]>} Matching file paths.
 */
export function walkFiles(dirPath: string, options: {
    allowedExtensions: Set<string>;
    ignoreFolders: Set<string>;
    shouldSkipDirectory?: (directoryPath: string, directoryName: string) => boolean | Promise<boolean>;
    recursive?: boolean;
}): Promise<string[]>;
/**
 * Gets creation-like and modified timestamps from filesystem stats.
 * The creation time is the earlier of the birth time and the modification time: content last
 * written at `mtime` existed by then, so `mtime` bounds creation even when the birth time is
 * later (an archive extraction or `cp -p` keeps the source's `mtime` but gets a new birth time).
 * Where the platform reports no birth time (`birthtimeMs` 0), `mtime` is used.
 * @param {string} filePath - Absolute file path.
 * @returns {Promise<{createdAt: Date, updatedAt: Date}>} Date pair.
 */
export function readFileDates(filePath: string): Promise<{
    createdAt: Date;
    updatedAt: Date;
}>;
