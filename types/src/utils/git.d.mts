/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/git.mjs
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
 * @fileoverview Git helpers for author identity and file history metadata.
 * @module fix-headers/utils/git
 */
/**
 * Runs a git command and returns trimmed stdout.
 * @param {string} cwd - Working directory.
 * @param {string[]} args - Git command arguments.
 * @returns {Promise<string | null>} Trimmed stdout or null on failure.
 */
export declare function runGit(cwd: string, args: string[]): Promise<string | null>;
/**
 * Parses a signer UID string into author name and optional email.
 * The OpenPGP UID comment (`Name (Comment) <email>`) is dropped from the name;
 * when the UID is only a comment, the raw name is kept.
 * @param {string} signerUid - Raw signer UID (for example: "Name (Comment) <email@example.com>").
 * @returns {{authorName: string | null, authorEmail: string | null}} Parsed signer identity.
 */
export declare function parseSignerUid(signerUid: string): {
    authorName: string | null;
    authorEmail: string | null;
};
/**
 * Reads the user ID of the OpenPGP key git signs commits with (`user.signingkey`).
 * Returns the first user ID that is not revoked or expired (GnuPG lists the primary
 * one first), or null when git signs with SSH/X.509, no signing key is configured,
 * or GnuPG is unavailable or doesn't know the key.
 * @param {string} cwd - Project directory (git config is read as git sees it there).
 * @returns {Promise<string | null>} The signing key's user ID.
 */
export declare function readSigningKeyUid(cwd: string): Promise<string | null>;
/**
 * Detects git author name and email from config or commit history.
 *
 * With `useGpgSignerAuthor`, the name comes from the user ID of the OpenPGP key git is
 * configured to sign with (`user.signingkey`), so it describes whoever is running the
 * tool. When no such key can be read, it falls back to the signer of the last commit
 * (`%GS`), and then to `user.name`. The last commit alone is unreliable: on a branch
 * whose tip is a squash merge made by GitHub or a bot, it has no locally verifiable
 * signer.
 * @param {string} cwd - Project directory.
 * @param {{useGpgSignerAuthor?: boolean}} [options={}] - Detection options.
 * @returns {Promise<{authorName: string | null, authorEmail: string | null}>} Author information.
 */
export declare function detectGitAuthor(cwd: string, options?: {
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
export declare function getGitCreationDate(cwd: string, filePath: string): Promise<{
    date: string;
    timestamp: number;
} | null>;
/**
 * Gets a file's latest commit date from git history.
 * @param {string} cwd - Project directory.
 * @param {string} filePath - Relative file path.
 * @returns {Promise<{date: string, timestamp: number} | null>} Git last-modified payload.
 */
export declare function getGitLastModifiedDate(cwd: string, filePath: string): Promise<{
    date: string;
    timestamp: number;
} | null>;
