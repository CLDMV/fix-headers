/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/branches.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { mkdir, symlink } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DETECTOR_PROFILES, getAllowedExtensions, getEnabledDetectors } from "../src/constants.mjs";
import { discoverFiles } from "../src/core/file-discovery.mjs";
import { detectProjectFromMarkers } from "../src/detect/project.mjs";
import { findProjectHeader } from "../src/header/parser.mjs";
import { getHeaderSyntaxForFile, renderHeaderLines } from "../src/header/syntax.mjs";
import { findProjectRoot, walkFiles } from "../src/utils/fs.mjs";
import { formatDateWithTimezone } from "../src/utils/time.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

describe("branch coverage helpers", () => {
	it("supports detector enable/disable option paths", () => {
		const enabledDefault = getEnabledDetectors();
		expect(enabledDefault.length).toBe(DETECTOR_PROFILES.length);

		const enabledOnly = getEnabledDetectors({ enabledDetectors: ["node"] });
		expect(enabledOnly.map((item) => item.id)).toEqual(["node"]);

		const disabled = getEnabledDetectors({ disabledDetectors: ["python"] });
		expect(disabled.some((item) => item.id === "python")).toBe(false);

		const extensionDefault = getAllowedExtensions();
		expect(extensionDefault.has(".js")).toBe(true);

		const extensionOverride = getAllowedExtensions({ includeExtensions: [".abc"] });
		expect(extensionOverride.has(".abc")).toBe(true);
	});

	it("handles discovery exclusion edge cases", async () => {
		const workspace = await createWorkspace("branches-discovery");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "branches" }));
			await writeWorkspaceFile(join(workspace, "src", "file.mjs"), "export const x = true;\n");
			await writeWorkspaceFile(join(workspace, "src", "file"), "no extension\n");
			await writeWorkspaceFile(join(workspace, "src", "dist", "skip.mjs"), "export const skip = true;\n");
			await symlink(join(workspace, "src", "file.mjs"), join(workspace, "src", "file-link.mjs"));

			const files = await discoverFiles({
				projectRoot: workspace,
				includeFolders: ["src"],
				excludeFolders: ["src/dist", "", 123]
			});

			expect(files.some((filePath) => filePath.includes("src/dist/"))).toBe(false);
			expect(files.some((filePath) => filePath.endsWith("file.mjs"))).toBe(true);

			const byNameExclusion = await discoverFiles({
				projectRoot: workspace,
				includeFolders: ["src"],
				excludeFolders: ["dist"]
			});
			expect(byNameExclusion.some((filePath) => filePath.includes("src/dist/"))).toBe(false);

			await writeWorkspaceFile(join(workspace, "src", "drop-me.mjs"), "export const dropMe = true;\n");
			const fileNameExclusion = await discoverFiles({
				projectRoot: workspace,
				includeFolders: ["src"],
				excludeFolders: ["drop-me.mjs"]
			});
			expect(fileNameExclusion.some((filePath) => filePath.endsWith("drop-me.mjs"))).toBe(false);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("covers unknown fallback name on filesystem root", async () => {
		const detected = await detectProjectFromMarkers("/", { detectors: [] });
		expect(detected.language).toBe("unknown");
		expect(detected.projectName).toBe("project");
	});

	it("covers project parser fallback branches", async () => {
		const workspace = await createWorkspace("branches-parser");
		try {
			const nodeRoot = join(workspace, "node");
			await writeWorkspaceFile(join(nodeRoot, "package.json"), "{ invalid json");
			const nodeDetected = await detectProjectFromMarkers(nodeRoot);
			expect(nodeDetected.language).toBe("node");
			expect(nodeDetected.projectName).toBe("node");

			const phpRoot = join(workspace, "php");
			await writeWorkspaceFile(join(phpRoot, "composer.json"), "{ invalid json");
			const phpDetected = await detectProjectFromMarkers(phpRoot);
			expect(phpDetected.language).toBe("php");
			expect(phpDetected.projectName).toBe("php");

			const goRoot = join(workspace, "go");
			await writeWorkspaceFile(join(goRoot, "go.mod"), "module\n");
			const goDetected = await detectProjectFromMarkers(goRoot);
			expect(goDetected.language).toBe("go");
			expect(goDetected.projectName).toBe("go");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("covers syntax helpers and parser style variants", () => {
		expect(getHeaderSyntaxForFile("index.html").kind).toBe("html");
		expect(getHeaderSyntaxForFile("script.py").kind).toBe("line");
		expect(getHeaderSyntaxForFile("unknown.ext").kind).toBe("block");

		const html = renderHeaderLines({ kind: "html" }, ["@Project: demo"]);
		expect(html.startsWith("<!--")).toBe(true);

		const hash = renderHeaderLines({ kind: "line", linePrefix: "#" }, ["@Project: demo"]);
		expect(hash.startsWith("#\t@Project")).toBe(true);

		const hashDefault = renderHeaderLines({ kind: "line" }, ["@Project: demo"]);
		expect(hashDefault.startsWith("#\t@Project")).toBe(true);

		const hashSpace = renderHeaderLines({ kind: "line", linePrefix: "#", lineSeparator: " " }, ["@Project: demo"]);
		expect(hashSpace.startsWith("# @Project")).toBe(true);

		const hashNone = renderHeaderLines({ kind: "line", linePrefix: "#", lineSeparator: "" }, ["@Project: demo"]);
		expect(hashNone.startsWith("#@Project")).toBe(true);

		const block = renderHeaderLines({ kind: "block" }, ["@Project: demo"]);
		expect(block.startsWith("/**")).toBe(true);

		const parsedHtml = findProjectHeader(`${html}\n\n<body></body>\n`, "index.html");
		expect(parsedHtml).not.toBeNull();
	});

	it("covers fs upward search end condition and non-file walk entries", async () => {
		const workspace = await createWorkspace("branches-fs");
		try {
			await writeWorkspaceFile(join(workspace, "src", "a.mjs"), "export const a = 1;\n");
			await writeWorkspaceFile(join(workspace, "src", "noext"), "x\n");
			await mkdir(join(workspace, "src", "nested"), { recursive: true });
			await symlink(join(workspace, "src", "a.mjs"), join(workspace, "src", "nested", "sym"));

			const missingRoot = await findProjectRoot(workspace, ["missing-marker-file"]);
			expect(missingRoot).toBeNull();

			const walked = await walkFiles(join(workspace, "src"), {
				allowedExtensions: new Set([".mjs"]),
				ignoreFolders: new Set(["ignore-me"])
			});

			expect(walked.some((item) => item.endsWith("a.mjs"))).toBe(true);
			expect(walked.some((item) => item.endsWith("noext"))).toBe(false);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("covers timezone sign branch with positive offset", () => {
		const fakeDate = {
			getTimezoneOffset() {
				return -120;
			},
			getFullYear() {
				return 2026;
			},
			getMonth() {
				return 0;
			},
			getDate() {
				return 1;
			},
			getHours() {
				return 2;
			},
			getMinutes() {
				return 3;
			},
			getSeconds() {
				return 4;
			}
		};
		const output = formatDateWithTimezone(/** @type {Date} */ (fakeDate));
		expect(output).toContain("+02:00");
	});
});
