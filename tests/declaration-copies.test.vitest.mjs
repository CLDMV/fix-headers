/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/declaration-copies.test.vitest.mjs
 *	@Date: 2026-11-25T11:25:34-08:00 (1795634734)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T11:25:45-08:00 (1795634745)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { getContentSkipReason } from "../src/detectors/index.mjs";
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

	it("leaves tsc's copies untouched in a repo-wide run and still stamps the sources", async () => {
		const workspace = await createWorkspace("declaration-copies-run");
		try {
			const copied = `${headerNaming("/src/x.mts")}export declare const x: 1;\n`;
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "src", "x.mts"), "export const x = 1;\n");
			await writeWorkspaceFile(join(workspace, "types", "src", "x.d.mts"), copied);
			await writeWorkspaceFile(join(workspace, "types", "hand.d.ts"), "export declare const hand: 1;\n");

			const result = await fixHeaders({ cwd: workspace, ...IDENTITY });

			expect(result.changes.map((change) => change.file).sort()).toEqual([join("src", "x.mts"), join("types", "hand.d.ts")]);
			expect(result.skipped).toEqual([{ file: join("types", "src", "x.d.mts"), reason: expect.stringMatching(/tsc copies it/) }]);
			expect(await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8")).toBe(copied);
			expect(await readFile(join(workspace, "types", "hand.d.ts"), "utf8")).toContain("@Filename: /types/hand.d.ts");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
