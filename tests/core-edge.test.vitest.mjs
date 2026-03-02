/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/core-edge.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01 19:50:13 -08:00 (1772423413)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { join } from "node:path";
import { chdir } from "node:process";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { fixHeaders as coreFixHeaders } from "../src/core/fix-headers.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

/**
 * Initializes a git repository with one initial commit.
 * @param {string} workspace - Workspace path.
 * @returns {Promise<void>} Completion promise.
 */
async function initializeGitWorkspace(workspace) {
	await execFileAsync("git", ["init"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.name", "Core Edge Tester"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.email", "core-edge@example.com"], { cwd: workspace });
	await execFileAsync("git", ["add", "."], { cwd: workspace });
	await execFileAsync("git", ["commit", "-m", "initial"], { cwd: workspace });
}

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

	it("preserves original header author and updates only last modified by", async () => {
		const workspace = await createWorkspace("core-edge-preserve-author");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-preserve-author" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-preserve-author\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Original Author\n *\t@Email: <original@example.com>\n *\t-----\n *\t@Last modified by: Old Updater (old@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.\n */\n\nexport const one = true;\n`
			);

			await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				authorName: "New Updater",
				authorEmail: "new@example.com",
				dryRun: false
			});

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).toContain("@Author: Original Author");
			expect(updated).toContain("@Email: <original@example.com>");
			expect(updated).toContain("@Last modified by: New Updater (new@example.com)");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("forces author and email update when enabled", async () => {
		const workspace = await createWorkspace("core-edge-force-author-update");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-force-author-update" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-force-author-update\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Original Author\n *\t@Email: <original@example.com>\n *\t-----\n *\t@Last modified by: Old Updater (old@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);

			await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				authorName: "Forced Author",
				authorEmail: "forced@example.com",
				forceAuthorUpdate: true,
				dryRun: false
			});

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).toContain("@Author: Forced Author");
			expect(updated).toContain("@Email: <forced@example.com>");
			expect(updated).not.toContain("@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("applies company suffix to generated author line", async () => {
		const workspace = await createWorkspace("core-edge-author-company");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-author-company" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");

			const result = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				authorName: "Nate Corcoran",
				authorEmail: "nate@example.com",
				company: "CLDMV",
				sampleOutput: true,
				dryRun: true
			});

			expect(result.filesScanned).toBe(1);
			expect(result.changes[0]?.sample?.newValue).toContain("@Author: Nate Corcoran <CLDMV>");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("does not churn on subsequent run when no other changes are needed", async () => {
		const workspace = await createWorkspace("core-edge-no-last-modified-churn");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-no-last-modified-churn" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");

			const firstRun = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});
			expect(firstRun.filesUpdated).toBe(1);

			const secondRun = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});
			expect(secondRun.filesUpdated).toBe(0);
			expect(secondRun.changes[0]?.changed).toBe(false);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("repairs header when @Last modified time is missing", async () => {
		const workspace = await createWorkspace("core-edge-missing-last-modified-time");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-missing-last-modified-time" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-missing-last-modified-time\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Existing Author\n *\t@Email: <existing@example.com>\n *\t-----\n *\t@Last modified by: Existing Author (existing@example.com)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);

			const result = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});

			expect(result.filesUpdated).toBe(1);
			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).toContain("@Last modified time:");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("preserves existing created date when git creation date is unavailable", async () => {
		const workspace = await createWorkspace("core-edge-preserve-created-date");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-preserve-created-date" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-preserve-created-date\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Original Author\n *\t@Email: <original@example.com>\n *\t-----\n *\t@Last modified by: Old Updater (old@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);

			await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).toContain("@Date: 2026-01-01 00:00:00 +00:00 (1735689600)");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("preserves existing created date even when git creation date exists", async () => {
		const workspace = await createWorkspace("core-edge-preserve-created-date-with-git");

		try {
			await writeWorkspaceFile(
				join(workspace, "package.json"),
				JSON.stringify({ name: "core-edge-preserve-created-date-with-git" }, null, 2)
			);
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-preserve-created-date-with-git\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Original Author\n *\t@Email: <original@example.com>\n *\t-----\n *\t@Last modified by: Old Updater (old@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);
			await initializeGitWorkspace(workspace);

			await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).toContain("@Date: 2026-01-01 00:00:00 +00:00 (1735689600)");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("falls back when existing @Date format is malformed", async () => {
		const workspace = await createWorkspace("core-edge-malformed-created-date");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-malformed-created-date" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-malformed-created-date\n *\t@Filename: /src/one.mjs\n *\t@Date: malformed-date-without-timestamp\n *\t@Author: Original Author\n *\t@Email: <original@example.com>\n *\t-----\n *\t@Last modified by: Old Updater (old@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);

			await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).not.toContain("@Date: malformed-date-without-timestamp");
			expect(updated).toContain("@Date:");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("falls back when created-date timestamp parse returns NaN", async () => {
		const workspace = await createWorkspace("core-edge-created-date-parse-nan");
		const parseIntSpy = vi.spyOn(Number, "parseInt").mockReturnValue(Number.NaN);

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-created-date-parse-nan" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-created-date-parse-nan\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Original Author\n *\t@Email: <original@example.com>\n *\t-----\n *\t@Last modified by: Old Updater (old@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);

			await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: false
			});

			const updated = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(updated).toContain("@Date:");
		} finally {
			parseIntSpy.mockRestore();
			await cleanupWorkspace(workspace);
		}
	});

	it("emits sample output values in dry-run mode when enabled", async () => {
		const workspace = await createWorkspace("core-edge-sample-output");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-sample-output" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");

			const result = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: true,
				sampleOutput: true
			});

			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].changed).toBe(true);
			expect(result.changes[0].sample).toBeDefined();
			expect(result.changes[0].sample?.previousValue).toBeNull();
			expect(result.changes[0].sample?.newValue).toContain("@Project:");
			expect(result.changes[0].sample?.detectedValues).toBeDefined();
			expect(result.changes[0].sample?.detectedValues?.projectName).toBe("core-edge-sample-output");
			expect(result.changes[0].sample?.detectedValues?.createdAtSource).toBeTypeOf("string");
			expect(result.changes[0].sample?.detectedValues?.lastModifiedAtSource).toBeTypeOf("string");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("emits previous sample value when an existing header is present", async () => {
		const workspace = await createWorkspace("core-edge-sample-existing-header");

		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "core-edge-sample-existing-header" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				`/**\n *\t@Project: core-edge-sample-existing-header\n *\t@Filename: /src/one.mjs\n *\t@Date: 2026-01-01 00:00:00 +00:00 (1735689600)\n *\t@Author: Existing Author\n *\t@Email: <existing@example.com>\n *\t-----\n *\t@Last modified by: Existing Author (existing@example.com)\n *\t@Last modified time: 2026-01-02 00:00:00 +00:00 (1735776000)\n *\t-----\n *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc All rights reserved.\n */\n\nexport const one = true;\n`
			);

			const result = await coreFixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				dryRun: true,
				sampleOutput: true,
				authorName: "Updated Author",
				authorEmail: "updated@example.com",
				forceAuthorUpdate: true
			});

			expect(result.changes).toHaveLength(1);
			expect(result.changes[0].changed).toBe(true);
			expect(result.changes[0].sample?.previousValue).toContain("@Project: core-edge-sample-existing-header");
			expect(result.changes[0].sample?.newValue).toContain("@Author: Updated Author");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
