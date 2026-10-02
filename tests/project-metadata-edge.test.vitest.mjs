/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/project-metadata-edge.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:19-07:00 (1790969299)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { detectProjectFromMarkers, resolveProjectMetadata } from "../src/detect/project.mjs";
import { cleanupWorkspace, createIsolatedWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

describe("project metadata edge branches", () => {
	/**
	 * Builds a fake manifest driver that claims the given folders.
	 * @param {string} id - Driver id.
	 * @param {Record<string, string | undefined>} claimed - Folder → name its manifest provides.
	 * @param {string[]} [languages=[]] - Native file-type detector ids.
	 * @returns {import("../src/drivers/index.mjs").ManifestDriver} Driver.
	 */
	function fakeDriver(id, claimed, languages = []) {
		return {
			id,
			languages,
			manifests: [`${id}.manifest`],
			async detect(dirPath) {
				return dirPath in claimed ? { dir: dirPath, manifest: `${id}.manifest`, files: [{ file: `${id}.manifest`, content: "" }] } : null;
			},
			read(detection) {
				return { name: claimed[detection.dir] };
			}
		};
	}

	it("takes the root from the nearest folder any driver claims", async () => {
		const shallow = fakeDriver("shallow", { "/fix-headers-no-such-dir": "shallow-name" });
		const deep = fakeDriver("deep", { "/fix-headers-no-such-dir/src": "deep-name" });

		const detected = await detectProjectFromMarkers("/fix-headers-no-such-dir/src/core", { drivers: [shallow, deep] });

		expect(detected.language).toBe("deep");
		expect(detected.rootDir).toBe("/fix-headers-no-such-dir/src");
		expect(detected.projectName).toBe("deep-name");
		expect(detected.marker).toBe("deep.manifest");
		expect(detected.drivers).toEqual(["deep"]);
	});

	it("reads the native driver first and ignores a non-string preferredExtension", async () => {
		const first = fakeDriver("first", { "/fix-headers-no-such-dir": "first-name" });
		const native = fakeDriver("native", { "/fix-headers-no-such-dir": "native-name" }, ["node"]);

		const nativeFirst = await detectProjectFromMarkers("/fix-headers-no-such-dir", {
			drivers: [first, native],
			preferredExtension: ".mjs"
		});
		expect(nativeFirst.language).toBe("node");
		expect(nativeFirst.projectName).toBe("native-name");
		expect(nativeFirst.drivers).toEqual(["native", "first"]);

		const registryOrder = await detectProjectFromMarkers("/fix-headers-no-such-dir", { drivers: [first, native], preferredExtension: 123 });
		expect(registryOrder.language).toBe("first");
		expect(registryOrder.projectName).toBe("first-name");

		const noDetector = await detectProjectFromMarkers("/fix-headers-no-such-dir", {
			drivers: [first, native],
			preferredExtension: ".unknown-ext"
		});
		expect(noDetector.language).toBe("first");
	});

	it("falls back to project name when the claimed root is the filesystem root", async () => {
		const rootDriver = fakeDriver("root", { "/": undefined });

		const detected = await detectProjectFromMarkers("/fix-headers-no-such-dir", { drivers: [rootDriver] });

		expect(detected.projectName).toBe("project");
		expect(detected.projectNameSource).toEqual({ from: "folder", dir: "/" });
		expect(detected.rootDir).toBe("/");
	});

	it("uses explicit detector list option", async () => {
		const workspace = await createWorkspace("project-detectors");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "detector-node" }, null, 2));
			const detected = await detectProjectFromMarkers(workspace, {
				detectors: [nodeDetector]
			});
			expect(detected.language).toBe("node");
			expect(detected.projectName).toBe("detector-node");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("uses unknown author/email fallback when git identity is unavailable", async () => {
		const workspace = await createIsolatedWorkspace("project-unknown-author");
		const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const previousHome = process.env.HOME;
		try {
			await writeWorkspaceFile(join(workspace, "placeholder.txt"), "x\n");
			process.env.GIT_CONFIG_GLOBAL = join(workspace, "missing-global");
			process.env.HOME = workspace;

			const metadata = await resolveProjectMetadata({
				cwd: workspace,
				enabledDetectors: []
			});
			expect(metadata.authorName).toBe("Unknown Author");
			expect(metadata.authorEmail).toBe("unknown@example.com");
		} finally {
			if (previousGlobalConfig === undefined) {
				delete process.env.GIT_CONFIG_GLOBAL;
			} else {
				process.env.GIT_CONFIG_GLOBAL = previousGlobalConfig;
			}
			if (previousHome === undefined) {
				delete process.env.HOME;
			} else {
				process.env.HOME = previousHome;
			}
			await cleanupWorkspace(workspace);
		}
	});

	it("uses process.cwd fallback when no cwd or targetFilePath is provided", async () => {
		const metadata = await resolveProjectMetadata({
			enabledDetectors: []
		});

		expect(typeof metadata.projectRoot).toBe("string");
		expect(metadata.projectRoot.length).toBeGreaterThan(0);
	});

	it("formats resolved author name with company suffix when provided", async () => {
		const workspace = await createWorkspace("project-author-company");
		try {
			await writeWorkspaceFile(join(workspace, "placeholder.txt"), "x\n");
			const metadata = await resolveProjectMetadata({
				cwd: workspace,
				enabledDetectors: [],
				authorName: "Nate Corcoran",
				company: "CLDMV"
			});
			expect(metadata.authorName).toBe("Nate Corcoran <CLDMV>");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("does not append company suffix when author name already includes angle brackets", async () => {
		const workspace = await createWorkspace("project-author-company-existing");
		try {
			await writeWorkspaceFile(join(workspace, "placeholder.txt"), "x\n");
			const metadata = await resolveProjectMetadata({
				cwd: workspace,
				enabledDetectors: [],
				authorName: "Nate Corcoran <CLDMV>",
				company: "CLDMV"
			});
			expect(metadata.authorName).toBe("Nate Corcoran <CLDMV>");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("does not append company suffix when company value is blank", async () => {
		const workspace = await createWorkspace("project-author-company-blank");
		try {
			await writeWorkspaceFile(join(workspace, "placeholder.txt"), "x\n");
			const metadata = await resolveProjectMetadata({
				cwd: workspace,
				enabledDetectors: [],
				authorName: "Nate Corcoran",
				company: "   "
			});
			expect(metadata.authorName).toBe("Nate Corcoran");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("uses gpg signer UID for resolved author when enabled", async () => {
		const workspace = await createWorkspace("project-gpg-signer-author");
		const previousPath = process.env.PATH;

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "project-gpg-signer-author" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "main.mjs"), "export const x = true;\n");
			await execFileAsync("git", ["init"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.name", "Configured Name"], { cwd: workspace });
			await execFileAsync("git", ["config", "user.email", "configured@example.com"], { cwd: workspace });
			await execFileAsync("git", ["add", "."], { cwd: workspace });
			await execFileAsync("git", ["commit", "-m", "init"], { cwd: workspace });

			const shimPath = join(workspace, "git");
			await writeWorkspaceFile(
				shimPath,
				'#!/usr/bin/env bash\nset -e\nif [[ "$*" == *"log -1 --format=%GS"* ]]; then\n  echo "Signer Name (2026 Laptop) <signer@example.com>"\n  exit 0\nfi\nexec /usr/bin/git "$@"\n'
			);
			await execFileAsync("chmod", ["755", shimPath], { cwd: workspace });
			process.env.PATH = `${workspace}:${previousPath}`;

			const metadata = await resolveProjectMetadata({
				cwd: workspace,
				useGpgSignerAuthor: true
			});

			expect(metadata.authorName).toBe("Signer Name");
			expect(metadata.authorEmail).toBe("configured@example.com");
		} finally {
			process.env.PATH = previousPath;
			await cleanupWorkspace(workspace);
		}
	});
});
