/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/helpers/workspace.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { mkdir, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * @fileoverview Test workspace helpers for creating isolated project fixtures.
 * @module fix-headers/tests/helpers/workspace
 */

/**
 * Root for every test fixture: the repo's OWN gitignored `tmp/` directory.
 * Anchored to this file's location (not `process.cwd()`) so it's cwd-independent.
 *
 * Previously this was `join(resolve(process.cwd(), ".."), "tmp-fix-headers-tests")`,
 * which resolved to the repo's PARENT (the shared repos root). Combined with
 * unique-per-run names and cleanup that only runs on the happy path, every
 * failed/interrupted run leaked its fixtures there, sprawling hundreds of orphaned
 * git repos into the repos root. Keeping fixtures inside the gitignored `tmp/`
 * contains any leak to a spot that's invisible to git and wiped by cleanup below.
 * @type {string}
 */
export const FIXTURE_ROOT = resolve(import.meta.dirname, "..", "..", "tmp", "fix-headers-tests");

/**
 * Creates an isolated test workspace under the project-local tmp directory.
 * @param {string} name - Workspace name suffix.
 * @returns {Promise<string>} Absolute workspace path.
 */
export async function createWorkspace(name) {
	const directoryName = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const workspacePath = join(FIXTURE_ROOT, directoryName);
	await mkdir(workspacePath, { recursive: true });
	return workspacePath;
}

/**
 * Writes a UTF-8 file ensuring parent folders are created.
 * @param {string} filePath - Absolute file path.
 * @param {string} content - File content.
 * @returns {Promise<void>} Completion promise.
 */
export async function writeWorkspaceFile(filePath, content) {
	const pathParts = filePath.split("/");
	pathParts.pop();
	const parentPath = pathParts.join("/");
	await mkdir(parentPath, { recursive: true });
	await writeFile(filePath, content, "utf8");
}

/**
 * Removes a workspace folder recursively.
 * @param {string} workspacePath - Workspace directory to remove.
 * @returns {Promise<void>} Completion promise.
 */
export async function cleanupWorkspace(workspacePath) {
	await rm(workspacePath, { recursive: true, force: true });
}

/**
 * Reaps only STALE fixture directories under {@link FIXTURE_ROOT} — those whose
 * mtime is older than `maxAgeMs`. This self-heals orphans from a crashed/interrupted
 * run WITHOUT deleting fixtures a concurrent, still-running suite is actively using
 * (an in-flight run's fixtures have a fresh mtime, so they're never reaped). A
 * whole-root wipe would corrupt overlapping runs — CI + local, or two shards — so
 * age is the guard. Per-test {@link cleanupWorkspace} still removes each fixture on
 * the happy path; this is only the backstop for the crash/timeout path.
 *
 * The default 1h threshold is far longer than any real run of this suite (seconds)
 * yet short enough to keep orphans from piling up; override for slower environments.
 * Missing root and races (a dir removed mid-sweep by another run) are ignored.
 * @param {number} [maxAgeMs=3600000] - Age past which a fixture counts as orphaned (default 1h).
 * @returns {Promise<void>} Completion promise.
 */
export async function reapStaleWorkspaces(maxAgeMs = 60 * 60 * 1000) {
	let entries;
	try {
		entries = await readdir(FIXTURE_ROOT, { withFileTypes: true });
	} catch {
		return; // fixture root doesn't exist yet — nothing to reap
	}
	const cutoff = Date.now() - maxAgeMs;
	await Promise.all(
		entries.map(async (entry) => {
			const full = join(FIXTURE_ROOT, entry.name);
			try {
				const info = await stat(full);
				if (info.mtimeMs < cutoff) await rm(full, { recursive: true, force: true });
			} catch {
				/* vanished mid-sweep (a concurrent run cleaned it) — fine */
			}
		})
	);
}
