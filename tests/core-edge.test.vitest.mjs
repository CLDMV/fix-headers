import { join } from "node:path";
import { chdir } from "node:process";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixHeaders as coreFixHeaders } from "../src/core/fix-headers.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

describe("core edge coverage", () => {
	it("uses process.cwd fallback and filesystem date fallback without git", async () => {
		const workspace = await createWorkspace("core-edge-no-git");
		const previousCwd = process.cwd();

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
			await writeWorkspaceFile(join(workspace, "src", "two.mjs"), "export const two = true;\n");

			chdir(workspace);
			const result = await coreFixHeaders({ dryRun: true, includeFolders: ["src"] });

			expect(result.filesScanned).toBe(2);
			expect(result.filesUpdated).toBe(2);
			expect(result.detectedProjects.length).toBeGreaterThanOrEqual(1);
		} finally {
			chdir(previousCwd);
			await cleanupWorkspace(workspace);
		}
	});

	it("supports explicit single file and single folder input", async () => {
		const workspace = await createWorkspace("core-edge-input-path");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-input" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
			await writeWorkspaceFile(join(workspace, "src", "two.mjs"), "export const two = true;\n");

			const singleFileResult = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: true
			});
			expect(singleFileResult.filesScanned).toBe(1);
			expect(singleFileResult.changes).toHaveLength(1);

			const singleFolderResult = await coreFixHeaders({
				cwd: workspace,
				input: "src",
				dryRun: true
			});
			expect(singleFolderResult.filesScanned).toBe(2);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("throws for invalid input paths", async () => {
		const workspace = await createWorkspace("core-edge-input-invalid");

		try {
			await expect(
				coreFixHeaders({
					cwd: workspace,
					input: "missing/file.mjs",
					dryRun: true
				})
			).rejects.toThrow(/Input path does not exist/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("throws when configFile contains a non-object payload", async () => {
		const workspace = await createWorkspace("core-edge-config-invalid");

		try {
			await writeWorkspaceFile(join(workspace, "bad.json"), "[]");

			await expect(
				coreFixHeaders({
					cwd: workspace,
					configFile: "bad.json",
					dryRun: true
				})
			).rejects.toThrow(/Config file must contain a JSON object/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("throws when input path is neither file nor directory", async () => {
		const workspace = await createWorkspace("core-edge-input-special");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-special" }, null, 2));

			await expect(
				coreFixHeaders({
					cwd: workspace,
					input: "/dev/null",
					dryRun: true
				})
			).rejects.toThrow(/Input path must be a file or directory/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("uses process.cwd for configFile resolution when cwd is not provided", async () => {
		const workspace = await createWorkspace("core-edge-config-cwd-fallback");
		const previousCwd = process.cwd();

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-config-cwd" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
			await writeWorkspaceFile(
				join(workspace, "fix-headers.config.json"),
				JSON.stringify(
					{
						input: "src/one.mjs",
						dryRun: true
					},
					null,
					2
				)
			);

			chdir(workspace);
			const result = await coreFixHeaders({ configFile: "fix-headers.config.json" });
			expect(result.filesScanned).toBe(1);
		} finally {
			chdir(previousCwd);
			await cleanupWorkspace(workspace);
		}
	});

	it("loads JSON config file and applies detector syntax overrides", async () => {
		const workspace = await createWorkspace("core-edge-config-file");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-config" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
			await writeWorkspaceFile(
				join(workspace, "fix-headers.config.json"),
				JSON.stringify(
					{
						input: "src/one.mjs",
						detectorSyntaxOverrides: {
							node: {
								blockStart: "/*",
								blockLinePrefix: " * ",
								blockEnd: " */"
							}
						}
					},
					null,
					2
				)
			);

			const result = await coreFixHeaders({
				cwd: workspace,
				configFile: "fix-headers.config.json",
				dryRun: false
			});

			expect(result.filesScanned).toBe(1);
			expect(result.filesUpdated).toBe(1);

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated.startsWith("/*\n")).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
