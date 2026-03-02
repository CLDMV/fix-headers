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

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

/**
 * @fileoverview Test workspace helpers for creating isolated project fixtures.
 * @module fix-headers/tests/helpers/workspace
 */

/**
 * Creates an isolated test workspace under the project-local tmp directory.
 * @param {string} name - Workspace name suffix.
 * @returns {Promise<string>} Absolute workspace path.
 */
export async function createWorkspace(name) {
	const directoryName = `${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
	const workspacePath = join(resolve(process.cwd(), ".."), "tmp-fix-headers-tests", directoryName);
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
