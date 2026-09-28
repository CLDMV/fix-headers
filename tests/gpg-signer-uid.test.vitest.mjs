/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/gpg-signer-uid.test.vitest.mjs
 *	@Date: 2026-09-27T23:43:47-07:00 (1790577827)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-27T23:43:47-07:00 (1790577827)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { execFile } from "node:child_process";
import { chmod, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/fix-header.mjs";
import { detectGitAuthor, parseSignerUid } from "../src/utils/git.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const execFileAsync = promisify(execFile);

/**
 * Builds a bash git shim that answers the listed argument patterns and delegates everything else to the real git.
 * @param {Array<{match: string, output: string | null}>} rules - `$*` substring to match and the line to print (null prints nothing).
 * @returns {string} Shim script source.
 */
function buildGitShim(rules) {
	const branches = rules
		.map(({ match, output }) => {
			const body = output === null ? "" : `  printf '%s\\n' ${JSON.stringify(output)}\n`;
			return `if [[ "$*" == *${JSON.stringify(match)}* ]]; then\n${body}  exit 0\nfi\n`;
		})
		.join("");
	return `#!/usr/bin/env bash\nset -e\n${branches}exec /usr/bin/git "$@"\n`;
}

/**
 * Creates a committed git workspace and puts a git shim first on PATH.
 * @param {string} name - Workspace name suffix.
 * @param {Array<{match: string, output: string | null}>} rules - Shim rules passed to {@link buildGitShim}.
 * @returns {Promise<{workspace: string, restore: () => Promise<void>}>} Workspace path and a restore callback.
 */
async function createShimmedWorkspace(name, rules) {
	const workspace = await createWorkspace(name);
	const previousPath = process.env.PATH;
	await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name }, null, 2));
	await writeWorkspaceFile(join(workspace, "src", "main.mjs"), "export const x = true;\n");
	await execFileAsync("git", ["init"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.name", "Configured Name"], { cwd: workspace });
	await execFileAsync("git", ["config", "user.email", "configured@example.com"], { cwd: workspace });
	await execFileAsync("git", ["add", "."], { cwd: workspace });
	await execFileAsync("git", ["-c", "commit.gpgsign=false", "commit", "-m", "init"], { cwd: workspace });

	const shimPath = join(workspace, "git");
	await writeFile(shimPath, buildGitShim(rules));
	await chmod(shimPath, 0o755);
	process.env.PATH = `${workspace}:${previousPath}`;

	return {
		workspace,
		restore: async () => {
			process.env.PATH = previousPath;
			await cleanupWorkspace(workspace);
		}
	};
}

describe("parseSignerUid", () => {
	it("drops the OpenPGP UID comment before the email", () => {
		expect(parseSignerUid("Nate Corcoran (2023 PC) <Shinrai@users.noreply.github.com>")).toEqual({
			authorName: "Nate Corcoran",
			authorEmail: "Shinrai@users.noreply.github.com"
		});
	});

	it("parses a UID without a comment unchanged", () => {
		expect(parseSignerUid("Nate Corcoran <Shinrai@users.noreply.github.com>")).toEqual({
			authorName: "Nate Corcoran",
			authorEmail: "Shinrai@users.noreply.github.com"
		});
	});

	it("parses an email-only UID with no name", () => {
		expect(parseSignerUid("<signer@example.com>")).toEqual({ authorName: null, authorEmail: "signer@example.com" });
	});

	it("parses a name-only UID", () => {
		expect(parseSignerUid("Signer Name")).toEqual({ authorName: "Signer Name", authorEmail: null });
	});

	it("drops a trailing comment from a name-only UID", () => {
		expect(parseSignerUid("Signer Name (Desktop)")).toEqual({ authorName: "Signer Name", authorEmail: null });
	});

	it("keeps parentheses that sit inside the name rather than at its end", () => {
		expect(parseSignerUid("Jane (JJ) Doe <jane@example.com>")).toEqual({ authorName: "Jane (JJ) Doe", authorEmail: "jane@example.com" });
		expect(parseSignerUid("Jane (JJ) Doe (Work) <jane@example.com>").authorName).toBe("Jane (JJ) Doe");
	});

	it("drops a comment that contains nested parentheses", () => {
		expect(parseSignerUid("Signer Name (Home (old box)) <signer@example.com>").authorName).toBe("Signer Name");
	});

	it("only drops the last of several trailing comments", () => {
		expect(parseSignerUid("Signer Name (A) (B) <signer@example.com>").authorName).toBe("Signer Name (A)");
	});

	it("treats backslash-escaped parentheses as literal comment text", () => {
		expect(parseSignerUid(String.raw`Signer Name (a \) b \( c) <signer@example.com>`).authorName).toBe("Signer Name");
		expect(parseSignerUid(String.raw`Signer Name (a \\) <signer@example.com>`).authorName).toBe("Signer Name");
	});

	it("keeps a name ending in an escaped parenthesis", () => {
		expect(parseSignerUid(String.raw`Signer Name \)`).authorName).toBe(String.raw`Signer Name \)`);
	});

	it("keeps a name whose trailing parenthesis is unbalanced", () => {
		expect(parseSignerUid("Signer Name) <signer@example.com>").authorName).toBe("Signer Name)");
	});

	it("falls back to the raw name when the UID is only a comment", () => {
		expect(parseSignerUid("(Laptop) <signer@example.com>")).toEqual({ authorName: "(Laptop)", authorEmail: "signer@example.com" });
		expect(parseSignerUid("(Laptop)")).toEqual({ authorName: "(Laptop)", authorEmail: null });
	});

	it("returns nulls for an empty or whitespace-only UID", () => {
		expect(parseSignerUid("")).toEqual({ authorName: null, authorEmail: null });
		expect(parseSignerUid("   ")).toEqual({ authorName: null, authorEmail: null });
	});
});

describe("detectGitAuthor with useGpgSignerAuthor", () => {
	it("uses the signer name without its UID comment", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-uid-comment", [
			{ match: "log -1 --format=%GS", output: "Nate Corcoran (2023 PC) <Shinrai@users.noreply.github.com>" }
		]);
		try {
			const author = await detectGitAuthor(workspace, { useGpgSignerAuthor: true });
			expect(author.authorName).toBe("Nate Corcoran");
			expect(author.authorEmail).toBe("configured@example.com");
		} finally {
			await restore();
		}
	});

	it("falls back to user.name when the last commit is unsigned", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-uid-unsigned", [{ match: "log -1 --format=%GS", output: null }]);
		try {
			const author = await detectGitAuthor(workspace, { useGpgSignerAuthor: true });
			expect(author.authorName).toBe("Configured Name");
			expect(author.authorEmail).toBe("configured@example.com");
		} finally {
			await restore();
		}
	});

	it("falls back to the log author when the commit is unsigned and user.name is unset", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-uid-unsigned-no-config", [
			{ match: "config --get user.name", output: null },
			{ match: "config --get user.email", output: null },
			{ match: "log -1 --format=%GS", output: null },
			{ match: "log -1 --format=%an|%ae", output: "Log Author|log@example.com" }
		]);
		try {
			const author = await detectGitAuthor(workspace, { useGpgSignerAuthor: true });
			expect(author.authorName).toBe("Log Author");
			expect(author.authorEmail).toBe("log@example.com");
		} finally {
			await restore();
		}
	});
});

describe("fixHeaders with useGpgSignerAuthor and company", () => {
	it("writes the signer name without its UID comment and with the company suffix", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-uid-fix-headers", [
			{ match: "log -1 --format=%GS", output: "Nate Corcoran (2023 PC) <Shinrai@users.noreply.github.com>" }
		]);
		try {
			const result = await fixHeaders({
				cwd: workspace,
				input: "src/main.mjs",
				useGpgSignerAuthor: true,
				company: "CLDMV",
				sampleOutput: true,
				dryRun: true
			});

			expect(result.filesScanned).toBe(1);
			const header = result.changes[0]?.sample?.newValue;
			expect(header).toContain("@Author: Nate Corcoran <CLDMV>");
			expect(header).not.toContain("2023 PC");
		} finally {
			await restore();
		}
	});
});
