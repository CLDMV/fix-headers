/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: tests/declaration-copies.test.vitest.mjs
 *	@Date: 2026-11-25T11:25:34-08:00 (1795634734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:49:52-08:00 (1795643392)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { getContentSkipReason } from "../src/detectors/index.mjs";
import { parseCliArgs } from "../src/cli.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Declaration files that carry the header `tsc` copied from their source are left
 * alone, so fix-headers and `tsc` stop rewriting each other's `@Filename` (#195).
 */

const IDENTITY = {
	authorName: "Decl Tester",
	authorEmail: "decl@example.com",
	companyName: "Catalyzed Motivation Inc."
};

const PACKAGE_JSON = `${JSON.stringify({ name: "declaration-copies", version: "1.0.0" }, null, 2)}\n`;

/**
 * A header shaped like the one fix-headers writes, naming the given file.
 * @param {string} filename - The `@Filename` value.
 * @returns {string} Header comment.
 */
function headerNaming(filename) {
	return `/**\n *\n *\t@Project: declaration-copies\n *\t@Filename: ${filename}\n *\t@Date: 2026-01-01T00:00:00-08:00 (1767254400)\n */\n`;
}

const skip = (filePath, content) => nodeDetector.resolveContentSkipReason(content, filePath);

describe("node detector: declaration files copied by tsc", () => {
	it("skips a declaration whose header names its own source file", () => {
		expect(skip("/repo/types/src/x.d.mts", `${headerNaming("/src/x.mts")}export declare const x: 1;\n`)).toMatch(/generated from x\.mts/);
		expect(skip("/repo/types/src/x.d.mts", `${headerNaming("/src/x.mjs")}export {};\n`)).not.toBeNull();
		// The slashless form written since #198, and the slashed form earlier versions wrote.
		expect(skip("/repo/types/src/x.d.mts", `${headerNaming("src/x.mts")}export {};\n`)).not.toBeNull();
		expect(skip("/repo/types/x.d.ts", `${headerNaming("/src/x.ts")}export {};\n`)).not.toBeNull();
		expect(skip("/repo/types/x.d.ts", `${headerNaming("/src/x.tsx")}export {};\n`)).not.toBeNull();
		expect(skip("/repo/types/x.d.ts", `${headerNaming("/lib/x.js")}export {};\n`)).not.toBeNull();
		expect(skip("/repo/types/x.d.cts", `${headerNaming("/src/x.cts")}export {};\n`)).not.toBeNull();
		expect(skip("/repo/types/x.D.MTS", `${headerNaming("/src/x.mjs")}export {};\n`)).not.toBeNull();
		expect(skip("/repo/types/x.d.mts", `\uFEFF${headerNaming("/src/x.mts")}export {};\n`)).not.toBeNull();
		expect(getContentSkipReason("/repo/types/x.d.mts", `${headerNaming("/src/x.mts")}export {};\n`)).not.toBeNull();
	});

	it("fixes declarations that are not copies of their source header", () => {
		// The header fix-headers itself writes into a declaration names the declaration.
		expect(skip("/repo/types/x.d.mts", `${headerNaming("/types/x.d.mts")}export {};\n`)).toBeNull();
		// A hand-written declaration that was renamed or moved still gets its header corrected.
		expect(skip("/repo/types/x.d.mts", `${headerNaming("/types/old.d.mts")}export {};\n`)).toBeNull();
		expect(skip("/repo/types/x.d.mts", `${headerNaming("/src/other.mts")}export {};\n`)).toBeNull();
		// The extension pairs must match: a .d.mts is not emitted from a .ts.
		expect(skip("/repo/types/x.d.mts", `${headerNaming("/src/x.ts")}export {};\n`)).toBeNull();
		expect(skip("/repo/types/x.d.mts", "export declare const x: 1;\n")).toBeNull();
		expect(skip("/repo/types/x.d.mts", "/** Docs only. */\nexport {};\n")).toBeNull();
		expect(skip("/repo/types/x.d.mts", `export {};\n${headerNaming("/src/x.mts")}`)).toBeNull();
		// Only declaration files are considered.
		expect(skip("/repo/src/x.mts", `${headerNaming("/src/other.mts")}export {};\n`)).toBeNull();
		expect(skip("/repo/src/x.ts", `${headerNaming("/src/x.mts")}export {};\n`)).toBeNull();
	});

	it("with rewriteDeclarationCopies: false, leaves tsc's copies untouched in a repo-wide run and still stamps the sources", async () => {
		const workspace = await createWorkspace("declaration-copies-run");
		try {
			const copied = `${headerNaming("/src/x.mts")}export declare const x: 1;\n`;
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "src", "x.mts"), "export const x = 1;\n");
			await writeWorkspaceFile(join(workspace, "types", "src", "x.d.mts"), copied);
			await writeWorkspaceFile(join(workspace, "types", "hand.d.ts"), "export declare const hand: 1;\n");

			const result = await fixHeaders({ cwd: workspace, rewriteDeclarationCopies: false, ...IDENTITY });

			expect(result.changes.map((change) => change.file).sort()).toEqual([join("src", "x.mts"), join("types", "hand.d.ts")]);
			expect(result.skipped).toEqual([{ file: join("types", "src", "x.d.mts"), reason: expect.stringMatching(/tsc copies it/) }]);
			expect(await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8")).toBe(copied);
			expect(await readFile(join(workspace, "types", "hand.d.ts"), "utf8")).toContain("@Filename: types/hand.d.ts");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("rewriteDeclarationCopies, on by default (#201)", () => {
	/**
	 * A full header as fix-headers writes it on a source file, as tsc copies it into the declaration.
	 * @param {string} filename - The `@Filename` value.
	 * @returns {string} Header comment.
	 */
	function sourceHeader(filename) {
		return [
			"/**",
			" *",
			" *\t@Project: declaration-copies",
			` *\t@Filename: ${filename}`,
			" *\t@Date: 2026-01-01T00:00:00-08:00 (1767254400)",
			" *\t@Author: Source Author",
			" *\t@Email: <source@example.com>",
			" *\t-----",
			" *\t@Last modified by: Source Editor (editor@example.com)",
			" *\t@Last modified time: 2026-02-01T00:00:00-08:00 (1769932800)",
			" *\t-----",
			" *\t@Copyright: Copyright (c) 2026 Catalyzed Motivation Inc. All rights reserved.",
			" *",
			" */",
			""
		].join("\n");
	}

	const tag = (content, name) => new RegExp(`@${name}: (.*)`).exec(content)?.[1];

	it("parses --rewrite-declaration-copies [true|false] and --no-rewrite-declaration-copies", () => {
		expect(parseCliArgs(["--rewrite-declaration-copies"]).options).toEqual({ rewriteDeclarationCopies: true });
		expect(parseCliArgs(["--rewrite-declaration-copies", "false"]).options).toEqual({ rewriteDeclarationCopies: false });
		expect(parseCliArgs(["--rewrite-declaration-copies", "true"]).options).toEqual({ rewriteDeclarationCopies: true });
		expect(parseCliArgs(["--no-rewrite-declaration-copies"]).options).toEqual({ rewriteDeclarationCopies: false });
	});

	it("by default restamps a tsc copy for the path it ships at, keeping the source's dates and editor, and is then stable", async () => {
		const workspace = await createWorkspace("declaration-copies-rewrite");
		try {
			const copied = `${sourceHeader("src/x.mts")}export declare const x: 1;\n`;
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "types", "src", "x.d.mts"), copied);
			await writeWorkspaceFile(join(workspace, "types", "src", "old.d.mts"), `${sourceHeader("/src/old.mts")}export {};\n`);

			const result = await fixHeaders({ cwd: workspace, input: "types", ...IDENTITY });

			expect(result.skipped).toEqual([]);
			expect(result.changes.map((change) => change.file).sort()).toEqual([
				join("types", "src", "old.d.mts"),
				join("types", "src", "x.d.mts")
			]);
			const content = await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8");
			expect(tag(content, "Filename")).toBe("types/src/x.d.mts");
			expect(tag(content, "Project")).toBe("declaration-copies");
			expect(tag(content, "Date")).toBe("2026-01-01T00:00:00-08:00 (1767254400)");
			expect(tag(content, "Author")).toBe("Source Author");
			expect(tag(content, "Last modified by")).toBe("Source Editor (editor@example.com)");
			expect(tag(content, "Last modified time")).toBe("2026-02-01T00:00:00-08:00 (1769932800)");
			expect(content.endsWith("export declare const x: 1;\n")).toBe(true);
			// The slashed form earlier versions wrote is recognised as a copy too.
			expect(tag(await readFile(join(workspace, "types", "src", "old.d.mts"), "utf8"), "Filename")).toBe("types/src/old.d.mts");

			const again = await fixHeaders({ cwd: workspace, input: "types", rewriteDeclarationCopies: true, ...IDENTITY });
			expect(again.changes.filter((change) => change.changed)).toEqual([]);
			expect(await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8")).toBe(content);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("names a staged package's declarations from that package's own root and manifest", async () => {
		const workspace = await createWorkspace("declaration-copies-staged");
		try {
			const staged = join(workspace, "dist-packages", "x-types");
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(staged, "package.json"), `${JSON.stringify({ name: "@scope/x-types", version: "1.0.0" }, null, 2)}\n`);
			await writeWorkspaceFile(join(staged, "lib", "x.d.mts"), `${sourceHeader("src/x.mts")}export {};\n`);

			await fixHeaders({ cwd: workspace, input: "dist-packages/x-types", rewriteDeclarationCopies: true, ...IDENTITY });

			const content = await readFile(join(staged, "lib", "x.d.mts"), "utf8");
			expect(tag(content, "Filename")).toBe("lib/x.d.mts");
			expect(tag(content, "Project")).toBe("@scope/x-types");
			expect(tag(content, "Date")).toBe("2026-01-01T00:00:00-08:00 (1767254400)");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("keeps a restamped declaration stable when types/ is gitignored in a git repo", async () => {
		const workspace = await createWorkspace("declaration-copies-gitignored");
		const git = (args) => promisify(execFile)("git", args, { cwd: workspace });
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, ".gitignore"), "types/\n");
			await git(["init", "-q"]);
			await git(["add", "."]);
			await git([
				"-c",
				"user.name=Decl Tester",
				"-c",
				"user.email=decl@example.com",
				"-c",
				"commit.gpgsign=false",
				"commit",
				"-q",
				"-m",
				"initial"
			]);
			await writeWorkspaceFile(join(workspace, "types", "src", "x.d.mts"), `${sourceHeader("src/x.mts")}export {};\n`);

			await fixHeaders({ cwd: workspace, input: "types", ...IDENTITY });
			const first = await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8");
			expect(tag(first, "Filename")).toBe("types/src/x.d.mts");
			expect(tag(first, "Last modified by")).toBe("Source Editor (editor@example.com)");

			const again = await fixHeaders({ cwd: workspace, input: "types", ...IDENTITY });
			expect(again.changes.filter((change) => change.changed)).toEqual([]);
			expect(await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8")).toBe(first);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("still stamps a declaration that is not a copy the usual way", async () => {
		const workspace = await createWorkspace("declaration-copies-rewrite-plain");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "types", "hand.d.ts"), "export declare const hand: 1;\n");

			const result = await fixHeaders({ cwd: workspace, input: "types", rewriteDeclarationCopies: true, ...IDENTITY });

			expect(result.changes.map((change) => change.file)).toEqual([join("types", "hand.d.ts")]);
			const content = await readFile(join(workspace, "types", "hand.d.ts"), "utf8");
			expect(tag(content, "Filename")).toBe("types/hand.d.ts");
			expect(tag(content, "Author")).toBe("Decl Tester");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
