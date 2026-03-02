import { execFile } from "node:child_process";
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
 * Detects git author name and email from config or commit history.
 * @param {string} cwd - Project directory.
 * @returns {Promise<{authorName: string | null, authorEmail: string | null}>} Author information.
 */
export async function detectGitAuthor(cwd) {
	let authorName = await runGit(cwd, ["config", "--get", "user.name"]);
	let authorEmail = await runGit(cwd, ["config", "--get", "user.email"]);

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

	return { date, timestamp };
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

	return { date, timestamp };
}
