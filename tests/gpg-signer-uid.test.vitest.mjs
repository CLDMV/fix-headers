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
import { detectGitAuthor, parseSignerUid, readSigningKeyUid } from "../src/utils/git.mjs";
import { SIGNING_KEY_UID_ENV } from "./helpers/signing-key.mjs";
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

/**
 * Writes an executable stand-in for gpg into the workspace (which is first on PATH) that
 * prints a fixed `--with-colons` listing, or exits 2 with no output when listing is null.
 * @param {string} workspace - Workspace path.
 * @param {string} name - Executable name (e.g. "gpg").
 * @param {string[] | null} lines - Listing lines.
 * @returns {Promise<void>} Completion promise.
 */
async function writeGpgShim(workspace, name, lines) {
	const body = lines === null ? "exit 2\n" : `cat <<'LISTING'\n${lines.join("\n")}\nLISTING\n`;
	const shimPath = join(workspace, name);
	await writeFile(shimPath, `#!/usr/bin/env bash\n${body}`);
	await chmod(shimPath, 0o755);
}

const KEY_LISTING = [
	"tru::1:1790000000:0:3:1:5",
	"pub:u:255:22:B9C512AC985D8BFE:1770767349:::u:::scESC:::::ed25519:::0:",
	"fpr:::::::::0123456789ABCDEF0123456789ABCDEFB9C512AC985D8BFE:",
	"uid:u::::1770767349::HASH1::Nate Corcoran (2023 PC) <Shinrai@users.noreply.github.com>::::::::::0:"
];

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

describe("readSigningKeyUid and the signing key as the author source", () => {
	/** git config answers shared by these tests: an OpenPGP signing key and no custom gpg program. */
	const signingKeyRules = [
		{ match: "config --get gpg.format", output: null },
		{ match: "config --get user.signingkey", output: "B9C512AC985D8BFE" },
		{ match: "config --get gpg.openpgp.program", output: null },
		{ match: "config --get gpg.program", output: null }
	];

	it("takes the author from the configured signing key, not the last commit's signer", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-signing-key", [
			...signingKeyRules,
			{ match: "log -1 --format=%GS", output: "GitHub <noreply@github.com>" }
		]);
		try {
			await writeGpgShim(workspace, "gpg", KEY_LISTING);
			expect(await readSigningKeyUid(workspace)).toBe("Nate Corcoran (2023 PC) <Shinrai@users.noreply.github.com>");
			const author = await detectGitAuthor(workspace, { useGpgSignerAuthor: true });
			expect(author).toEqual({ authorName: "Nate Corcoran", authorEmail: "configured@example.com" });
		} finally {
			await restore();
		}
	});

	it("skips revoked and expired user IDs and decodes GnuPG's \\xNN escapes", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-signing-key-uids", signingKeyRules);
		try {
			await writeGpgShim(workspace, "gpg", [
				KEY_LISTING[1],
				"uid:r::::1::HASH0::Revoked Name <old@example.com>::::::::::0:",
				"uid:e::::1::HASH2::Expired Name <exp@example.com>::::::::::0:",
				"uid:u::::1::HASH3::Team\\x3a Ops <ops@example.com>::::::::::0:"
			]);
			expect(await readSigningKeyUid(workspace)).toBe("Team: Ops <ops@example.com>");
		} finally {
			await restore();
		}
	});

	it("falls back to the last commit's signer when git signs with SSH", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-signing-key-ssh", [
			{ match: "config --get gpg.format", output: "ssh" },
			{ match: "config --get user.signingkey", output: "~/.ssh/id_ed25519.pub" },
			{ match: "log -1 --format=%GS", output: "Signer Name <signer@example.com>" }
		]);
		try {
			await writeGpgShim(workspace, "gpg", KEY_LISTING);
			expect(await readSigningKeyUid(workspace)).toBeNull();
			expect((await detectGitAuthor(workspace, { useGpgSignerAuthor: true })).authorName).toBe("Signer Name");
		} finally {
			await restore();
		}
	});

	it("falls back to the last commit's signer when no signing key is configured", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-signing-key-none", [
			{ match: "config --get gpg.format", output: null },
			{ match: "config --get user.signingkey", output: null },
			{ match: "log -1 --format=%GS", output: "Signer Name <signer@example.com>" }
		]);
		try {
			expect(await readSigningKeyUid(workspace)).toBeNull();
			expect((await detectGitAuthor(workspace, { useGpgSignerAuthor: true })).authorName).toBe("Signer Name");
		} finally {
			await restore();
		}
	});

	it("falls back when the gpg program is missing or lists no usable user ID", async () => {
		const missing = await createShimmedWorkspace("gpg-signing-key-missing", [
			{ match: "config --get gpg.format", output: null },
			{ match: "config --get user.signingkey", output: "B9C512AC985D8BFE" },
			{ match: "config --get gpg.openpgp.program", output: "gpg-does-not-exist" },
			{ match: "log -1 --format=%GS", output: "Signer Name <signer@example.com>" }
		]);
		try {
			expect(await readSigningKeyUid(missing.workspace)).toBeNull();
			expect((await detectGitAuthor(missing.workspace, { useGpgSignerAuthor: true })).authorName).toBe("Signer Name");
		} finally {
			await missing.restore();
		}

		const unknown = await createShimmedWorkspace("gpg-signing-key-unknown", signingKeyRules);
		try {
			await writeGpgShim(unknown.workspace, "gpg", null);
			expect(await readSigningKeyUid(unknown.workspace)).toBeNull();
			// gpg succeeds but prints nothing
			await writeGpgShim(unknown.workspace, "gpg", []);
			expect(await readSigningKeyUid(unknown.workspace)).toBeNull();
			await writeGpgShim(unknown.workspace, "gpg", [KEY_LISTING[1], "uid:r::::1::HASH0::Revoked Name <old@example.com>::::::::::0:"]);
			expect(await readSigningKeyUid(unknown.workspace)).toBeNull();
		} finally {
			await unknown.restore();
		}
	});

	it("prefers gpg.openpgp.program over gpg.program", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-signing-key-program", [
			{ match: "config --get gpg.format", output: "openpgp" },
			{ match: "config --get user.signingkey", output: "B9C512AC985D8BFE" },
			{ match: "config --get gpg.openpgp.program", output: "gpg-openpgp" },
			{ match: "config --get gpg.program", output: "gpg-generic" }
		]);
		try {
			await writeGpgShim(workspace, "gpg-openpgp", [KEY_LISTING[1], "uid:u::::1::H::OpenPGP Program <a@example.com>::::::::::0:"]);
			await writeGpgShim(workspace, "gpg-generic", [KEY_LISTING[1], "uid:u::::1::H::Generic Program <b@example.com>::::::::::0:"]);
			expect(await readSigningKeyUid(workspace)).toBe("OpenPGP Program <a@example.com>");
		} finally {
			await restore();
		}
	});

	it("writes the signing key's name with the company suffix into a new header", async () => {
		const { workspace, restore } = await createShimmedWorkspace("gpg-signing-key-fix-headers", [
			...signingKeyRules,
			{ match: "log -1 --format=%GS", output: null }
		]);
		try {
			await writeGpgShim(workspace, "gpg", KEY_LISTING);
			const result = await fixHeaders({
				cwd: workspace,
				input: "src/main.mjs",
				useGpgSignerAuthor: true,
				company: "CLDMV",
				sampleOutput: true,
				dryRun: true
			});
			const header = result.changes[0]?.sample?.newValue;
			expect(header).toContain("@Author: Nate Corcoran <CLDMV>");
			expect(header).not.toContain("2023 PC");
		} finally {
			await restore();
		}
	});
});

describe("the signing key configured on the machine running the suite", () => {
	// Derived once per test run, straight from git and gpg (tests/helpers/signing-key.mjs); null skips.
	const expectedUid = JSON.parse(process.env[SIGNING_KEY_UID_ENV] ?? "null");

	it.skipIf(expectedUid === null)("readSigningKeyUid returns that key's user ID from the real git config and gpg", async () => {
		const workspace = await createWorkspace("real-signing-key");
		// Lift the suite-wide isolation from the global/system git config for this one check.
		const isolated = { GIT_CONFIG_GLOBAL: process.env.GIT_CONFIG_GLOBAL, GIT_CONFIG_NOSYSTEM: process.env.GIT_CONFIG_NOSYSTEM };
		delete process.env.GIT_CONFIG_GLOBAL;
		delete process.env.GIT_CONFIG_NOSYSTEM;
		try {
			expect(await readSigningKeyUid(workspace)).toBe(expectedUid);
		} finally {
			Object.assign(process.env, isolated);
			await cleanupWorkspace(workspace);
		}
	});
});
