/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/project-name-sources.test.vitest.mjs
 *	@Date: 2026-09-28T17:56:07-07:00 (1790643367)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T17:56:07-07:00 (1790643367)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/fix-header.mjs";
import { detector as cssDetector } from "../src/detectors/css.mjs";
import { detector as htmlDetector } from "../src/detectors/html.mjs";
import { parsePackageJsonName } from "../src/detectors/shared.mjs";
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

describe("CSS and HTML project-name fallbacks", () => {
	for (const [id, detector] of [
		["css", cssDetector],
		["html", htmlDetector]
	]) {
		it(`${id}: package.json name, else the folder name`, () => {
			expect(detector.parseProjectName("package.json", '{ "name": " @scope/pkg " }', "folder")).toBe("@scope/pkg");
			expect(detector.parseProjectName("package.json", '{ "version": "1.0.0" }', "folder")).toBe("folder");
			expect(detector.parseProjectName("package.json", '{ "name": "   " }', "folder")).toBe("folder");
			expect(detector.parseProjectName("package.json", "{ not json", "folder")).toBe("folder");
			expect(detector.parseProjectName(id === "css" ? "postcss.config.mjs" : "index.html", "", "folder")).toBe("folder");
		});
	}

	it("parsePackageJsonName ignores a non-object or non-string name", () => {
		expect(parsePackageJsonName("null", "folder")).toBe("folder");
		expect(parsePackageJsonName('{ "name": 42 }', "folder")).toBe("folder");
	});
});
