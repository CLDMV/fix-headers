/**
 * @fileoverview Git helpers for author identity and file history metadata.
 * @module fix-headers/utils/git
 */
/**
 * Runs a git command and returns trimmed stdout.
 * @param {string} cwd - Working directory.
 * @param {string[]} args - Git command arguments.
 * @returns {Promise<string | null>} Trimmed stdout or null on failure.
 */
export function runGit(cwd: string, args: string[]): Promise<string | null>;
/**
 * Detects git author name and email from config or commit history.
 * @param {string} cwd - Project directory.
 * @param {{useGpgSignerAuthor?: boolean}} [options={}] - Detection options.
 * @returns {Promise<{authorName: string | null, authorEmail: string | null}>} Author information.
 */
export function detectGitAuthor(cwd: string, options?: {
    useGpgSignerAuthor?: boolean;
}): Promise<{
    authorName: string | null;
    authorEmail: string | null;
}>;
/**
 * Gets a file's first commit date from git history.
 * @param {string} cwd - Project directory.
 * @param {string} filePath - Relative file path.
 * @returns {Promise<{date: string, timestamp: number} | null>} Git creation date payload.
 */
export function getGitCreationDate(cwd: string, filePath: string): Promise<{
    date: string;
    timestamp: number;
} | null>;
/**
 * Gets a file's latest commit date from git history.
 * @param {string} cwd - Project directory.
 * @param {string} filePath - Relative file path.
 * @returns {Promise<{date: string, timestamp: number} | null>} Git last-modified payload.
 */
export function getGitLastModifiedDate(cwd: string, filePath: string): Promise<{
    date: string;
    timestamp: number;
} | null>;
