/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/integration.module.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { beforeEach, describe, expect, it } from "vitest";
import { pathToFileURL } from "node:url";
import fixHeadersDefault, { fixHeaders } from "../index.mjs";
import { discoverFiles } from "../src/core/file-discovery.mjs";
import { fixHeaders as coreFixHeaders } from "../src/core/fix-headers.mjs";
import { detectProjectFromMarkers, resolveProjectMetadata } from "../src/detect/project.mjs";
import { readFileDates, findProjectRoot, pathExists, readTextIfExists, walkFiles } from "../src/utils/fs.mjs";
import { detectGitAuthor, getGitCreationDate, getGitLastModifiedDate, runGit } from "../src/utils/git.mjs";

import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

/**
 * Initializes a git repository and creates an initial commit.
 * @param {string} workspace - Workspace path.
 * @returns {Promise<void>} Completion promise.
 */
async function initializeGitWorkspace(workspace) {
	await execFileAsync("git", ["init"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.name", "Integration Tester"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.email", "integration@example.com"], { cwd: workspace });
	await execFileAsync("git", ["add", "."], { cwd: workspace });
	await execFileAsync("git", ["commit", "-m", "initial"], { cwd: workspace });
}

/**
 * Creates a multi-language fixture workspace with source files.
 * @param {string} workspace - Workspace path.
 * @returns {Promise<void>} Completion promise.
 */
async function createNodeFixture(workspace) {
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "fixture-node-project", version: "1.0.0" }, null, 2));

	await writeWorkspaceFile(join(workspace, "src", "main.mjs"), "export const main = true;\n");
	await writeWorkspaceFile(join(workspace, "src", "nested", "keep.mjs"), "export const keep = true;\n");
	await writeWorkspaceFile(join(workspace, "src", "nested", "ignore.cjs"), "module.exports = { value: true };\n");
	await writeWorkspaceFile(join(workspace, "src", "generated", "skip.mjs"), "export const skip = true;\n");
	await writeWorkspaceFile(join(workspace, "dist", "artifact.mjs"), "export const artifact = true;\n");
	await writeWorkspaceFile(join(workspace, "scripts", "task.js"), "export const task = true;\n");
}

describe("module integration and coverage", () => {
	/** @type {string[]} */
	let workspaces;

	beforeEach(() => {
		workspaces = [];
	});

	it("supports direct source API and default export alias", async () => {
		const workspace = await createWorkspace("source-api");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		expect(fixHeadersDefault).toBe(fixHeaders);

		const result = await fixHeaders({
			cwd: workspace,
			dryRun: true,
			includeFolders: ["src"],
			excludeFolders: ["src/generated"]
		});

		expect(result.filesScanned).toBeGreaterThan(0);
		expect(result.filesUpdated).toBeGreaterThan(0);
		expect(result.metadata.projectName).toBe("fixture-node-project");
		expect(result.changes.some((change) => change.file.startsWith("src/generated/"))).toBe(false);
	});

	it("runs through top-level ESM and CJS shims", async () => {
		const workspace = await createWorkspace("shim-api");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		const projectRoot = process.cwd();
		const esmModule = await import(pathToFileURL(join(projectRoot, "index.mjs")).href);
		expect(typeof esmModule.default).toBe("function");
		expect(typeof esmModule.fixHeaders).toBe("function");

		const cjsModule = await import(pathToFileURL(join(projectRoot, "index.cjs")).href);
		expect(typeof cjsModule.default).toBe("function");

		const esmResult = await esmModule.default({ cwd: workspace, dryRun: true, includeFolders: ["src"] });
		const cjsResult = await cjsModule.default({ cwd: workspace, dryRun: true, includeFolders: ["src"] });
		expect(esmResult.filesScanned).toBeGreaterThan(0);
		expect(cjsResult.filesScanned).toBeGreaterThan(0);
	});

	it("covers file discovery branches with include folders and exclusions", async () => {
		const workspace = await createWorkspace("discovery");
		workspaces.push(workspace);
		await createNodeFixture(workspace);

		const byIncludeFolders = await discoverFiles({
			projectRoot: workspace,
			language: "node",
			includeFolders: ["src"],
			excludeFolders: ["src/generated", "dist"]
		});

		expect(byIncludeFolders.some((path) => path.includes("src/generated/"))).toBe(false);
		expect(byIncludeFolders.some((path) => path.includes("dist/"))).toBe(false);
		expect(byIncludeFolders.some((path) => path.endsWith("main.mjs"))).toBe(true);

		const byScriptsFolder = await discoverFiles({
			projectRoot: workspace,
			language: "node",
			includeFolders: ["scripts"]
		});
		expect(byScriptsFolder.some((path) => path.endsWith("task.js"))).toBe(true);

		const unknownLanguageFallback = await discoverFiles({
			projectRoot: workspace,
			language: "unknown-language"
		});
		expect(unknownLanguageFallback.length).toBeGreaterThan(0);

		const extensionOverride = await discoverFiles({
			projectRoot: workspace,
			language: "node",
			includeExtensions: [".cjs"],
			includeFolders: ["src"]
		});
		expect(extensionOverride.every((path) => path.endsWith(".cjs"))).toBe(true);
	});

	it("covers project detection for node and fallback unknown mode", async () => {
		const workspace = await createWorkspace("detection");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		const markerDetection = await detectProjectFromMarkers(join(workspace, "src"));
		expect(markerDetection.language).toBe("node");
		expect(markerDetection.marker).toBe("package.json");
		expect(markerDetection.projectName).toBe("fixture-node-project");

		const unknownWorkspace = await createWorkspace("detection-unknown");
		workspaces.push(unknownWorkspace);
		await writeWorkspaceFile(join(unknownWorkspace, "file.txt"), "hello\n");
		const unknownDetection = await detectProjectFromMarkers(unknownWorkspace);
		expect(unknownDetection.language).toBe("unknown");
		expect(unknownDetection.marker).toBeNull();
	});

	it("covers metadata override paths and git fallback defaults", async () => {
		const workspace = await createWorkspace("metadata");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		const resolved = await resolveProjectMetadata({
			cwd: workspace,
			projectName: "override-project",
			language: "python",
			projectRoot: workspace,
			marker: null,
			authorName: "Override Author",
			authorEmail: "override@example.com",
			companyName: "Override Company",
			copyrightStartYear: 2001
		});

		expect(resolved.projectName).toBe("override-project");
		expect(resolved.language).toBe("python");
		expect(resolved.marker).toBeNull();
		expect(resolved.authorName).toBe("Override Author");
		expect(resolved.authorEmail).toBe("override@example.com");
		expect(resolved.companyName).toBe("Override Company");
		expect(resolved.copyrightStartYear).toBe(2001);
	});

	it("covers fs utilities and git utility fallbacks", async () => {
		const workspace = await createWorkspace("utils");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		const filePath = join(workspace, "src", "main.mjs");
		expect(await pathExists(filePath)).toBe(true);
		expect(await pathExists(join(workspace, "missing.mjs"))).toBe(false);

		const rootFound = await findProjectRoot(join(workspace, "src", "nested"), ["package.json"]);
		expect(rootFound?.root).toBe(workspace);
		expect(rootFound?.marker).toBe("package.json");

		const text = await readTextIfExists(join(workspace, "package.json"));
		expect(text).toContain("fixture-node-project");
		expect(await readTextIfExists(join(workspace, "does-not-exist.json"))).toBeNull();

		const walked = await walkFiles(join(workspace, "src"), {
			allowedExtensions: new Set([".mjs", ".js", ".cjs"]),
			ignoreFolders: new Set(["none"]),
			shouldSkipDirectory: (directoryPath) => directoryPath.includes("generated")
		});
		expect(walked.some((path) => path.includes("generated/"))).toBe(false);

		const dates = await readFileDates(filePath);
		expect(dates.createdAt instanceof Date).toBe(true);
		expect(dates.updatedAt instanceof Date).toBe(true);

		const gitName = await runGit(workspace, ["config", "--get", "user.name"]);
		expect(gitName).toBe("Integration Tester");

		const gitMissing = await runGit(workspace, ["config", "--get", "user.this.does.not.exist"]);
		expect(gitMissing).toBeNull();

		const author = await detectGitAuthor(workspace);
		expect(author.authorName).toBe("Integration Tester");
		expect(author.authorEmail).toBe("integration@example.com");

		const created = await getGitCreationDate(workspace, "src/main.mjs");
		const modified = await getGitLastModifiedDate(workspace, "src/main.mjs");
		expect(created?.timestamp).toBeTypeOf("number");
		expect(modified?.timestamp).toBeTypeOf("number");

		expect(await getGitCreationDate(workspace, "src/not-real.mjs")).toBeNull();
		expect(await getGitLastModifiedDate(workspace, "src/not-real.mjs")).toBeNull();
	});

	it("covers fix-headers core write path and unchanged path", async () => {
		const workspace = await createWorkspace("core");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		const firstPass = await coreFixHeaders({
			cwd: workspace,
			dryRun: false,
			includeFolders: ["src"],
			excludeFolders: ["src/generated"],
			companyName: "Catalyzed Motivation Inc.",
			copyrightStartYear: 2013
		});
		expect(firstPass.filesUpdated).toBeGreaterThan(0);

		const fileAfterFirstPass = await readFile(join(workspace, "src", "main.mjs"), "utf8");
		expect(fileAfterFirstPass).toContain("@Project: fixture-node-project");

		const secondPass = await coreFixHeaders({
			cwd: workspace,
			dryRun: false,
			includeFolders: ["src"],
			excludeFolders: ["src/generated"],
			companyName: "Catalyzed Motivation Inc.",
			copyrightStartYear: 2013
		});

		expect(secondPass.filesScanned).toBe(firstPass.filesScanned);
		expect(secondPass.changes.every((change) => typeof change.changed === "boolean")).toBe(true);
		expect(secondPass.metadata.projectRoot).toBe(workspace);
	});

	it("covers marker parsing for python/rust/go/php profiles", async () => {
		const base = await createWorkspace("markers");
		workspaces.push(base);

		const pythonRoot = join(base, "python");
		await writeWorkspaceFile(join(pythonRoot, "pyproject.toml"), '[project]\nname = "python-project"\n');
		await writeWorkspaceFile(join(pythonRoot, "nested", "placeholder.txt"), "ok\n");
		const pythonDetection = await detectProjectFromMarkers(join(pythonRoot, "nested"));
		expect(pythonDetection.projectName).toBe("python-project");
		expect(pythonDetection.language).toBe("python");

		const rustRoot = join(base, "rust");
		await writeWorkspaceFile(join(rustRoot, "Cargo.toml"), '[package]\nname = "rust-project"\n');
		const rustDetection = await detectProjectFromMarkers(rustRoot);
		expect(rustDetection.projectName).toBe("rust-project");
		expect(rustDetection.language).toBe("rust");

		const goRoot = join(base, "go");
		await writeWorkspaceFile(join(goRoot, "go.mod"), "module github.com/example/go-project\n");
		const goDetection = await detectProjectFromMarkers(goRoot);
		expect(goDetection.projectName).toBe("github.com/example/go-project");
		expect(goDetection.language).toBe("go");

		const phpRoot = join(base, "php");
		await writeWorkspaceFile(join(phpRoot, "composer.json"), JSON.stringify({ name: "vendor/php-project" }));
		const phpDetection = await detectProjectFromMarkers(phpRoot);
		expect(phpDetection.projectName).toBe("vendor/php-project");
		expect(phpDetection.language).toBe("php");
	});

	it("covers git author fallback from commit history when config is unavailable", async () => {
		const workspace = await createWorkspace("git-fallback");
		workspaces.push(workspace);
		await createNodeFixture(workspace);
		await initializeGitWorkspace(workspace);

		await execFileAsync("git", ["config", "--unset", "user.name"], { cwd: workspace });
		await execFileAsync("git", ["config", "--unset", "user.email"], { cwd: workspace });

		const previousGlobalConfig = process.env.GIT_CONFIG_GLOBAL;
		const previousHome = process.env.HOME;
		process.env.GIT_CONFIG_GLOBAL = join(workspace, "non-existent-global-config");
		process.env.HOME = workspace;

		const author = await detectGitAuthor(workspace);

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

		expect(author.authorName).toBe("Integration Tester");
		expect(author.authorEmail).toBe("integration@example.com");
	});

	it("cleans up fixture workspaces", async () => {
		const workspace = await createWorkspace("cleanup");
		workspaces.push(workspace);
		await writeWorkspaceFile(join(workspace, "placeholder.txt"), "ok\n");
		expect(await pathExists(join(workspace, "placeholder.txt"))).toBe(true);

		for (const item of workspaces.splice(0)) {
			await cleanupWorkspace(item);
		}

		expect(await pathExists(join(workspace, "placeholder.txt"))).toBe(false);
	});
});
