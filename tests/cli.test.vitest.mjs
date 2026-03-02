/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/cli.test.vitest.mjs
 *	@Date: 2026-03-01 15:14:34 -08:00 (1772406874)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { readFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { applyConfigFile, parseCliArgs, runCli, runCliAsMain } from "../src/cli.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

describe("cli", () => {
	it("parses scalar and multi-value flags", () => {
		const parsed = parseCliArgs([
			"--dry-run",
			"--json",
			"--input",
			"src/main.mjs",
			"--include-folder",
			"src",
			"--include-folder",
			"scripts",
			"--exclude-folder",
			"dist",
			"--enable-detector",
			"node",
			"--disable-detector",
			"python",
			"--copyright-start-year",
			"2013"
		]);

		expect(parsed.help).toBe(false);
		expect(parsed.json).toBe(true);
		expect(parsed.options.dryRun).toBe(true);
		expect(parsed.options.input).toBe("src/main.mjs");
		expect(parsed.options.includeFolders).toEqual(["src", "scripts"]);
		expect(parsed.options.excludeFolders).toEqual(["dist"]);
		expect(parsed.options.enabledDetectors).toEqual(["node"]);
		expect(parsed.options.disabledDetectors).toEqual(["python"]);
		expect(parsed.options.copyrightStartYear).toBe(2013);
	});

	it("throws on malformed flags", () => {
		expect(() => parseCliArgs(["--include-folder"])).toThrow(/Missing value/);
		expect(() => parseCliArgs(["--project-name"])).toThrow(/Missing value/);
		expect(() => parseCliArgs(["value-without-flag"])).toThrow(/Unexpected argument/);
		expect(() => parseCliArgs(["--copyright-start-year", "abc"])).toThrow(/Invalid number/);
	});

	it("parses marker non-null and unknown flag camelCase", () => {
		const parsed = parseCliArgs(["--marker", "package.json", "--custom-flag", "value"]);
		expect(parsed.options.marker).toBe("package.json");
		expect(parsed.options.customFlag).toBe("value");
	});

	it("parses marker null sentinel", () => {
		const parsed = parseCliArgs(["--marker", "null"]);
		expect(parsed.options.marker).toBeNull();
	});

	it("parses sample-output flag", () => {
		const parsed = parseCliArgs(["--sample-output"]);
		expect(parsed.options.sampleOutput).toBe(true);
	});

	it("parses force-author-update flag", () => {
		const parsed = parseCliArgs(["--force-author-update"]);
		expect(parsed.options.forceAuthorUpdate).toBe(true);
	});

	it("parses use-gpg-signer-author flag", () => {
		const parsed = parseCliArgs(["--use-gpg-signer-author"]);
		expect(parsed.options.useGpgSignerAuthor).toBe(true);
	});

	it("parses verbose flag", () => {
		const parsed = parseCliArgs(["--verbose"]);
		expect(parsed.options.verbose).toBe(true);
	});

	it("removes duplicates for repeatable list flags", () => {
		const parsed = parseCliArgs([
			"--include-folder",
			"src",
			"--include-folder",
			"src",
			"--enable-detector",
			"node",
			"--enable-detector",
			"node"
		]);

		expect(parsed.options.includeFolders).toEqual(["src"]);
		expect(parsed.options.enabledDetectors).toEqual(["node"]);
	});

	it("throws unknown malformed flag when next token is another flag", () => {
		expect(() => parseCliArgs(["--unknown-flag", "--next-flag"])).toThrow(/Unknown or malformed flag/);
	});

	it("applies config file options and command-line overrides", async () => {
		const workspace = await createWorkspace("cli-config");
		try {
			const configPath = join(workspace, "fix-headers.config.json");
			await writeWorkspaceFile(configPath, JSON.stringify({ includeFolders: ["src"], dryRun: false, projectName: "cfg" }, null, 2));

			const merged = await applyConfigFile({
				cwd: workspace,
				config: "fix-headers.config.json",
				dryRun: true
			});

			expect(merged.includeFolders).toEqual(["src"]);
			expect(merged.dryRun).toBe(true);
			expect(merged.projectName).toBe("cfg");
			expect(Object.hasOwn(merged, "config")).toBe(false);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("rejects non-object config file payloads", async () => {
		const workspace = await createWorkspace("cli-config-invalid");
		try {
			await writeWorkspaceFile(join(workspace, "bad.json"), "[]");
			await expect(applyConfigFile({ cwd: workspace, config: "bad.json" })).rejects.toThrow(/JSON object/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("prints help and exits successfully", async () => {
		const stdout = [];
		const stderr = [];
		const code = await runCli(["--help"], {
			stdout: (message) => stdout.push(message),
			stderr: (message) => stderr.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("fix-headers CLI");
		expect(stderr).toEqual([]);
	});

	it("prints json output with runner result", async () => {
		const stdout = [];
		const code = await runCli(["--json", "--dry-run"], {
			runner: async (options) => ({ ok: true, received: options }),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		const output = JSON.parse(stdout[0]);
		expect(output.ok).toBe(true);
		expect(output.received.dryRun).toBe(true);
	});

	it("prints summary output for object results", async () => {
		const stdout = [];
		const code = await runCli([], {
			runner: async () => ({ filesScanned: 5, filesUpdated: 2, dryRun: false }),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("scanned=5");
	});

	it("prints updated file paths in verbose mode", async () => {
		const stdout = [];
		const code = await runCli(["--verbose"], {
			runner: async () => ({
				filesScanned: 3,
				filesUpdated: 2,
				dryRun: true,
				changes: [
					{ file: "src/a.mjs", changed: true },
					{ file: "src/b.mjs", changed: false },
					{ file: "src/c.mjs", changed: true }
				]
			}),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("updated: src/a.mjs");
		expect(stdout.join("\n")).toContain("updated: src/c.mjs");
		expect(stdout.join("\n")).not.toContain("updated: src/b.mjs");
	});

	it("handles verbose mode when runner returns non-object result", async () => {
		const stdout = [];
		const code = await runCli(["--verbose"], {
			runner: async () => "ok",
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout).toEqual(["fix-headers complete"]);
	});

	it("handles verbose mode when changes is not an array", async () => {
		const stdout = [];
		const code = await runCli(["--verbose"], {
			runner: async () => ({ filesScanned: 1, filesUpdated: 0, dryRun: true, changes: "invalid" }),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("fix-headers complete: scanned=1, updated=0, dryRun=true");
		expect(stdout.join("\n")).not.toContain("updated:");
	});

	it("prints unknown-file fallback in verbose mode", async () => {
		const stdout = [];
		const code = await runCli(["--verbose"], {
			runner: async () => ({
				filesScanned: 1,
				filesUpdated: 1,
				dryRun: true,
				changes: [{ changed: true }]
			}),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("updated: <unknown-file>");
	});

	it("prints sample output blocks for changed files when enabled", async () => {
		const stdout = [];
		const code = await runCli(["--sample-output"], {
			runner: async () => ({
				filesScanned: 1,
				filesUpdated: 1,
				dryRun: true,
				changes: [
					{
						file: "src/demo.mjs",
						changed: true,
						sample: {
							previousValue: null,
							newValue: "/**\\n *\\t@Project: demo\\n */",
							detectedValues: {
								projectName: "demo",
								language: "node"
							}
						}
					}
				]
			}),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("sample: src/demo.mjs");
		expect(stdout.join("\n")).toContain("previous:\n(none)");
		expect(stdout.join("\n")).toContain("new:");
		expect(stdout.join("\n")).toContain("detected-values:");
		expect(stdout.join("\n")).toContain('"projectName": "demo"');
	});

	it("skips malformed sample changes while still printing summary", async () => {
		const stdout = [];
		const code = await runCli(["--sample-output"], {
			runner: async () => ({
				filesScanned: 1,
				filesUpdated: 1,
				dryRun: true,
				changes: [
					null,
					{ changed: false, sample: { newValue: "ignored" } },
					{ changed: true, sample: {} },
					{ changed: true, sample: { newValue: 123 } }
				]
			}),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("fix-headers complete: scanned=1, updated=1, dryRun=true");
		expect(stdout.join("\n")).not.toContain("sample:");
	});

	it("handles sample-output mode when changes is not an array", async () => {
		const stdout = [];
		const code = await runCli(["--sample-output"], {
			runner: async () => ({
				filesScanned: 1,
				filesUpdated: 1,
				dryRun: true,
				changes: "invalid"
			}),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("fix-headers complete: scanned=1, updated=1, dryRun=true");
		expect(stdout.join("\n")).not.toContain("sample:");
	});

	it("prints unknown-file fallback and non-null previous sample value", async () => {
		const stdout = [];
		const code = await runCli(["--sample-output"], {
			runner: async () => ({
				filesScanned: 1,
				filesUpdated: 1,
				dryRun: true,
				changes: [
					{
						changed: true,
						sample: {
							previousValue: "/**\\n * old header\\n */",
							newValue: "/**\\n * new header\\n */"
						}
					}
				]
			}),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("sample: <unknown-file>");
		expect(stdout.join("\n")).toContain("previous:\n/**\\n * old header\\n */");
	});

	it("handles sample-output mode when runner returns non-object result", async () => {
		const stdout = [];
		const code = await runCli(["--sample-output"], {
			runner: async () => "ok",
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout).toEqual(["fix-headers complete"]);
	});

	it("prints summary defaults for null counts and dryRun true", async () => {
		const stdout = [];
		const code = await runCli([], {
			runner: async () => ({ filesScanned: null, filesUpdated: null, dryRun: true }),
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("scanned=0, updated=0, dryRun=true");
	});

	it("prints simple output for non-object results", async () => {
		const stdout = [];
		const code = await runCli([], {
			runner: async () => "ok",
			stdout: (message) => stdout.push(message)
		});

		expect(code).toBe(0);
		expect(stdout.join("\n")).toContain("fix-headers complete");
	});

	it("handles runner failures", async () => {
		const stderr = [];
		const code = await runCli([], {
			runner: async () => {
				throw new Error("runner failed");
			},
			stderr: (message) => stderr.push(message)
		});

		expect(code).toBe(1);
		expect(stderr.join("\n")).toContain("runner failed");
	});

	it("handles non-Error runner failures", async () => {
		const stderr = [];
		const code = await runCli([], {
			runner: async () => {
				throw "runner failed string";
			},
			stderr: (message) => stderr.push(message)
		});

		expect(code).toBe(1);
		expect(stderr.join("\n")).toContain("runner failed string");
	});

	it("loads config with absolute path", async () => {
		const workspace = await createWorkspace("cli-config-absolute");
		try {
			const configPath = join(workspace, "absolute.json");
			await writeWorkspaceFile(configPath, JSON.stringify({ dryRun: true }, null, 2));
			const merged = await applyConfigFile({ config: configPath });
			expect(merged.dryRun).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("returns unchanged options when config is not provided", async () => {
		const input = { dryRun: true };
		const output = await applyConfigFile(input);
		expect(output).toBe(input);
	});

	it("executes CLI main entry path", async () => {
		const { stdout, stderr } = await execFileAsync("node", ["./src/cli.mjs", "--help"], { cwd: process.cwd() });
		expect(stderr).toBe("");
		expect(stdout).toContain("fix-headers CLI");
	});

	it("covers main guard helper true/false branches", async () => {
		const originalExitCode = process.exitCode;
		const fakePath = join(process.cwd(), "src", "cli.mjs");
		const fakeModuleUrl = new URL(`file://${fakePath}`).href;

		const notMain = runCliAsMain(["node", join(process.cwd(), "src", "other.mjs")], fakeModuleUrl, async () => 0);
		expect(notMain).toBe(false);

		try {
			process.exitCode = undefined;
			const didRun = runCliAsMain(["node", fakePath, "--help"], fakeModuleUrl, async () => 0);
			expect(didRun).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 0));

			expect(process.exitCode).toBe(0);
		} finally {
			process.exitCode = originalExitCode;
		}
	});

	it("treats symlinked cli path as main entry", async () => {
		const workspace = await createWorkspace("cli-main-symlink");
		const originalExitCode = process.exitCode;
		const targetPath = join(process.cwd(), "src", "cli.mjs");
		const symlinkPath = join(workspace, "fix-headers-bin");
		const fakeModuleUrl = new URL(`file://${targetPath}`).href;

		try {
			await symlink(targetPath, symlinkPath);
			process.exitCode = undefined;
			const didRun = runCliAsMain(["node", symlinkPath, "--help"], fakeModuleUrl, async () => 0);
			expect(didRun).toBe(true);
			await new Promise((resolve) => setTimeout(resolve, 0));
			expect(process.exitCode).toBe(0);
		} finally {
			process.exitCode = originalExitCode;
			await cleanupWorkspace(workspace);
		}
	});
});
