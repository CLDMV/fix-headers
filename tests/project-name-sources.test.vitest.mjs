/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/project-name-sources.test.vitest.mjs
 *	@Date: 2026-09-28T17:56:07-07:00 (1790643367)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:19-07:00 (1790969299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/fix-header.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * Runs fixHeaders over a workspace and maps each changed file to the @Project it would write.
 * @param {string} workspace - Workspace path.
 * @returns {Promise<Record<string, string | undefined>>} File → @Project value.
 */
async function projectNames(workspace) {
	const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], dryRun: true, sampleOutput: true });
	return Object.fromEntries(result.changes.map((change) => [change.file, change.sample?.newValue.match(/@Project: (.+)/)?.[1]]));
}

describe("@Project comes from the project's config file for every file type", () => {
	it("uses package.json for JS, YAML, CSS and HTML, and pyproject.toml for Python", async () => {
		const workspace = await createWorkspace("project-name-sources");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "@scope/real-name" }));
			await writeWorkspaceFile(join(workspace, "pyproject.toml"), '[project]\nname = "py-real"\n');
			await writeWorkspaceFile(join(workspace, "src", "m.mjs"), "export const x = 1;\n");
			await writeWorkspaceFile(join(workspace, "src", "c.yml"), "k: v\n");
			await writeWorkspaceFile(join(workspace, "src", "s.css"), "a { color: red; }\n");
			await writeWorkspaceFile(join(workspace, "src", "i.html"), "<p>x</p>\n");
			await writeWorkspaceFile(join(workspace, "src", "p.py"), "x = 1\n");

			expect(await projectNames(workspace)).toEqual({
				"src/m.mjs": "@scope/real-name",
				"src/c.yml": "@scope/real-name",
				"src/s.css": "@scope/real-name",
				"src/i.html": "@scope/real-name",
				"src/p.py": "py-real"
			});
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("prefers package.json over a bundler or postcss config in the same folder", async () => {
		const workspace = await createWorkspace("project-name-marker-order");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "@scope/app" }));
			await writeWorkspaceFile(join(workspace, "vite.config.mjs"), "export default {};\n");
			await writeWorkspaceFile(join(workspace, "postcss.config.mjs"), "export default {};\n");
			await writeWorkspaceFile(join(workspace, "src", "s.css"), "a { color: red; }\n");
			await writeWorkspaceFile(join(workspace, "src", "i.html"), "<p>x</p>\n");

			expect(await projectNames(workspace)).toEqual({ "src/s.css": "@scope/app", "src/i.html": "@scope/app" });
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("only manifests mark a project root", () => {
	it("a nested index.html, bundler or postcss config does not start a project of its own", async () => {
		const workspace = await createWorkspace("project-name-nested-markers");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "@scope/site" }));
			await writeWorkspaceFile(join(workspace, "src", "public", "index.html"), "<p>home</p>\n");
			await writeWorkspaceFile(join(workspace, "src", "public", "about.html"), "<p>about</p>\n");
			await writeWorkspaceFile(join(workspace, "src", "styles", "postcss.config.mjs"), "export default {};\n");
			await writeWorkspaceFile(join(workspace, "src", "styles", "main.css"), "a { color: red; }\n");

			expect(await projectNames(workspace)).toEqual({
				"src/public/index.html": "@scope/site",
				"src/public/about.html": "@scope/site",
				"src/styles/postcss.config.mjs": "@scope/site",
				"src/styles/main.css": "@scope/site"
			});
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});
