/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/utils/git.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-03T22:50:30-07:00 (1791093030)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execFile } from "node:child_process";
import { basename, dirname } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

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
export async function runGit(cwd, args) {
	try {
		const { stdout } = await execFileAsync("git", args, { cwd });
		const value = stdout.trim();
		return value.length > 0 ? value : null;
	} catch {
		return null;
	}
}

/**
 * Checks whether the character at an index is escaped by an odd run of preceding backslashes.
 * @param {string} text - Source text.
 * @param {number} index - Index of the character to check.
 * @returns {boolean} True when the character is backslash-escaped.
 */
function isEscaped(text, index) {
	let backslashes = 0;
	for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor--) {
		backslashes++;
	}
	return backslashes % 2 === 1;
}

/**
 * Removes a trailing OpenPGP user-ID comment from the name part of a UID.
 * A UID has the form `Name (Comment) <email>`; the comment is the parenthesised
 * group that ends the name part. Nested parentheses are balanced and
 * backslash-escaped parentheses (RFC 2822 quoted-pair) are treated as literal
 * text. Parentheses anywhere else in the name are kept.
 * @param {string} namePart - UID text before the `<email>` (or the whole UID when there is no email).
 * @returns {string} Name with the trailing comment removed, or the input unchanged when there is none.
 */
function stripUidComment(namePart) {
	const text = namePart.trim();
	if (!text.endsWith(")") || isEscaped(text, text.length - 1)) {
		return text;
	}

	let depth = 0;
	for (let index = text.length - 1; index >= 0; index--) {
		const character = text[index];
		if ((character !== "(" && character !== ")") || isEscaped(text, index)) {
			continue;
		}
		depth += character === ")" ? 1 : -1;
		if (depth === 0) {
			return text.slice(0, index).trim();
		}
	}

	return text;
}

/**
 * Parses a signer UID string into author name and optional email.
 * The OpenPGP UID comment (`Name (Comment) <email>`) is dropped from the name;
 * when the UID is only a comment, the raw name is kept.
 * @param {string} signerUid - Raw signer UID (for example: "Name (Comment) <email@example.com>").
 * @returns {{authorName: string | null, authorEmail: string | null}} Parsed signer identity.
 */
export function parseSignerUid(signerUid) {
	const trimmed = signerUid.trim();
	if (trimmed.length === 0) {
		return { authorName: null, authorEmail: null };
	}

	const emailMatch = trimmed.match(/<([^>\n]+)>\s*$/);
	const authorEmail = emailMatch?.[1]?.trim() || null;
	const rawName = (emailMatch ? trimmed.slice(0, emailMatch.index) : trimmed).trim();
	const authorName = stripUidComment(rawName) || rawName || null;

	return { authorName, authorEmail };
}

/**
 * Runs a program and returns trimmed stdout.
 * @param {string} program - Executable name or path.
 * @param {string[]} args - Arguments.
 * @returns {Promise<string | null>} Trimmed stdout, or null when the program is missing, fails, or prints nothing.
 */
async function runProgram(program, args) {
	try {
		const { stdout } = await execFileAsync(program, args);
		const value = stdout.trim();
		return value.length > 0 ? value : null;
	} catch {
		return null;
	}
}

/**
 * Decodes the `\xNN` escapes GnuPG uses in `--with-colons` output.
 * @param {string} value - Escaped field value.
 * @returns {string} Decoded value.
 */
function decodeColonField(value) {
	return value.replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16)));
}

/**
 * Reads the user ID of the OpenPGP key git signs commits with (`user.signingkey`).
 * Returns the first user ID that is not revoked or expired (GnuPG lists the primary
 * one first), or null when git signs with SSH/X.509, no signing key is configured,
 * or GnuPG is unavailable or doesn't know the key.
 * @param {string} cwd - Project directory (git config is read as git sees it there).
 * @returns {Promise<string | null>} The signing key's user ID.
 */
export async function readSigningKeyUid(cwd) {
	const format = await runGit(cwd, ["config", "--get", "gpg.format"]);
	if (format !== null && format !== "openpgp") {
		return null;
	}

	const signingKey = await runGit(cwd, ["config", "--get", "user.signingkey"]);
	if (!signingKey) {
		return null;
	}

	const program =
		(await runGit(cwd, ["config", "--get", "gpg.openpgp.program"])) || (await runGit(cwd, ["config", "--get", "gpg.program"])) || "gpg";
	const listing = await runProgram(program, ["--batch", "--with-colons", "--list-keys", signingKey]);
	if (!listing) {
		return null;
	}

	for (const line of listing.split("\n")) {
		const fields = line.split(":");
		if (fields[0] === "uid" && fields[1] !== "r" && fields[1] !== "e" && fields[9]) {
			return decodeColonField(fields[9]);
		}
	}
	return null;
}

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
export async function detectGitAuthor(cwd, options = {}) {
	let authorName = await runGit(cwd, ["config", "--get", "user.name"]);
	let authorEmail = await runGit(cwd, ["config", "--get", "user.email"]);
	if (options.useGpgSignerAuthor === true) {
		const signerUid = (await readSigningKeyUid(cwd)) || (await runGit(cwd, ["log", "-1", "--format=%GS"]));
		const signerIdentity = parseSignerUid(signerUid || "");
		authorName = signerIdentity.authorName || authorName;
		authorEmail = authorEmail || signerIdentity.authorEmail;
	}

	if (!authorName || !authorEmail) {
		const fallback = await runGit(cwd, ["log", "-1", "--format=%an|%ae"]);
		if (fallback) {
			const [fallbackName, fallbackEmail] = fallback.split("|");
			authorName = authorName || fallbackName || null;
			authorEmail = authorEmail || fallbackEmail || null;
		}
	}

	return { authorName, authorEmail };
}

/**
 * Canonicalises a git `%aI` date to the `±HH:MM` offset form. Git 2.45+ prints a UTC
 * instant as `…Z`; older versions print `…+00:00`. Headers must not depend on the git
 * version, so `Z` is written as `+00:00`.
 * @param {string} date - `%aI` output.
 * @returns {string} The same instant with a numeric offset.
 */
function canonicalGitDate(date) {
	return date.replace(/z$/i, "+00:00");
}

/**
 * Gets a file's first commit date from git history.
 * @param {string} cwd - Project directory.
 * @param {string} filePath - Relative file path.
 * @returns {Promise<{date: string, timestamp: number} | null>} Git creation date payload.
 */
export async function getGitCreationDate(cwd, filePath) {
	const output = await runGit(cwd, ["log", "--follow", "--format=%aI|%at", "--reverse", "--", filePath]);
	if (!output) {
		return null;
	}

	const firstLine = output.split("\n")[0];
	const [date, timestampText] = firstLine.split("|");
	if (!date || !timestampText) {
		return null;
	}

	const timestamp = Number.parseInt(timestampText, 10);
	if (Number.isNaN(timestamp)) {
		return null;
	}

	return { date: canonicalGitDate(date), timestamp };
}

/**
 * Gets a file's latest commit date from git history.
 * @param {string} cwd - Project directory.
 * @param {string} filePath - Relative file path.
 * @returns {Promise<{date: string, timestamp: number} | null>} Git last-modified payload.
 */
export async function getGitLastModifiedDate(cwd, filePath) {
	const output = await runGit(cwd, ["log", "-1", "--format=%aI|%at", "--", filePath]);
	if (!output) {
		return null;
	}

	const [date, timestampText] = output.split("|");
	if (!date || !timestampText) {
		return null;
	}

	const timestamp = Number.parseInt(timestampText, 10);
	if (Number.isNaN(timestamp)) {
		return null;
	}

	return { date: canonicalGitDate(date), timestamp };
}

/**
 * Largest committed file `readGitHeadFile` reads (git show's stdout buffer).
 * @type {number}
 */
const HEAD_FILE_MAX_BUFFER = 256 * 1024 * 1024;

/**
 * Reads a file as it is at git `HEAD`, from the repository that contains it.
 * @param {string} filePath - Absolute file path.
 * @returns {Promise<{state: "no-git", content: null} | {state: "untracked", content: null} | {state: "tracked", content: string}>}
 *   `no-git` when the file is not inside a git work tree, `untracked` when `HEAD` has no such
 *   file (a new or ignored file, or a repository with no commits yet), otherwise the content at `HEAD`.
 */
export async function readGitHeadFile(filePath) {
	const cwd = dirname(filePath);
	if ((await runGit(cwd, ["rev-parse", "--is-inside-work-tree"])) !== "true") {
		return { state: "no-git", content: null };
	}
	try {
		const { stdout } = await execFileAsync("git", ["show", `HEAD:./${basename(filePath)}`], {
			cwd,
			encoding: "utf8",
			maxBuffer: HEAD_FILE_MAX_BUFFER
		});
		return { state: "tracked", content: stdout };
	} catch {
		return { state: "untracked", content: null };
	}
}
