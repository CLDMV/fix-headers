/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: tests/c-and-mts.test.vitest.mjs
 *	@Date: 2026-11-25T08:41:48-08:00 (1795624908)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-25T13:07:26-08:00 (1795640846)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { detector as cDetector } from "../src/detectors/c.mjs";
import { detector as nodeDetector } from "../src/detectors/node.mjs";
import { getContentSkipReason, getHeaderSkipReason } from "../src/detectors/index.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview `.mts` / `.cts` in the node detector and the C/C++ detector, including the
 * skip for third-party C that carries its own license notice (#192).
 */

const IDENTITY = {
	authorName: "C Tester",
	authorEmail: "c@example.com",
	companyName: "Catalyzed Motivation Inc."
};

const PACKAGE_JSON = `${JSON.stringify({ name: "c-and-mts", version: "1.0.0" }, null, 2)}\n`;

const GLUE_C = '#include <stdint.h>\n#include "sqlite3.h"\n\nint glue_version(void) { return sqlite3_libversion_number(); }\n';

const GUARDED_H = "#pragma once\n#ifndef GLUE_H\n#define GLUE_H\nint glue_version(void);\n#endif\n";

// Shaped like the SQLite amalgamation: a descriptive comment, a few #defines, then the
// public-domain notice.
const AMALGAMATION_C = [
	"/******************************************************************************",
	"** This file is an amalgamation of many separate C source files from SQLite.",
	"*/",
	"#define SQLITE_CORE 1",
	"#define SQLITE_AMALGAMATION 1",
	"#ifndef SQLITE_PRIVATE",
	"# define SQLITE_PRIVATE static \\",
	"    /* continued */",
	"#endif",
	"/************** Begin file sqliteInt.h ***************************************/",
	"/*",
	"** 2001 September 15",
	"**",
	"** The author disclaims copyright to this source code.  In place of",
	"** a legal notice, here is a blessing:",
	"*/",
	"int sqlite3_libversion_number(void) { return 1; }",
	""
].join("\n");

const SPDX_H = "// SPDX-License-Identifier: MIT\n// Copyright (c) 2020 Someone Else\n#pragma once\nint other(void);\n";

describe("node detector: .mts and .cts", () => {
	it("handles .mts and .cts with the TypeScript block comment", () => {
		for (const file of ["/repo/src/a.mts", "/repo/src/a.cts", "/repo/src/a.MTS"]) {
			expect(nodeDetector.resolveCommentSyntax(file)).toEqual({
				kind: "block",
				blockStart: "/**",
				blockLinePrefix: " *\t",
				blockEnd: " */"
			});
			expect(getHeaderSkipReason(file)).toBeNull();
		}
	});

	it("stamps .mts and .cts files in a repo-wide run", async () => {
		const workspace = await createWorkspace("mts-cts-run");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "src", "db.mts"), "export const db = 1;\n");
			await writeWorkspaceFile(join(workspace, "src", "legacy.cts"), "export = 1;\n");

			const result = await fixHeaders({ cwd: workspace, ...IDENTITY });

			expect(result.changes.map((change) => change.file).sort()).toEqual([join("src", "db.mts"), join("src", "legacy.cts")]);
			const mts = await readFile(join(workspace, "src", "db.mts"), "utf8");
			expect(mts).toMatch(/^\/\*\*\n/);
			expect(mts).toContain("@Filename: src/db.mts");
			expect(mts.endsWith("export const db = 1;\n")).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});

describe("c detector", () => {
	it("handles C and C++ sources and headers with a plain /* */ comment", () => {
		for (const extension of [".c", ".h", ".cc", ".cpp", ".cxx", ".hh", ".hpp", ".hxx"]) {
			expect(cDetector.resolveCommentSyntax(`/repo/src/file${extension}`)).toEqual({
				kind: "block",
				blockStart: "/*",
				blockLinePrefix: " *\t",
				blockEnd: " */"
			});
			expect(getHeaderSkipReason(`/repo/src/file${extension}`)).toBeNull();
		}
		expect(cDetector.resolveCommentSyntax("/repo/src/file.cs")).toBeNull();
		expect(getHeaderSkipReason("/repo/src/file.c", { disabledDetectors: ["c"] })).toMatch(/no enabled detector handles \.c files/);
	});

	it("skips third-party C carrying its own license notice", () => {
		expect(cDetector.resolveContentSkipReason(AMALGAMATION_C)).toMatch(/license or copyright notice/);
		expect(cDetector.resolveContentSkipReason(SPDX_H)).toMatch(/third-party/);
		expect(cDetector.resolveContentSkipReason("\uFEFF/* Licensed under the Apache License */\nint x;\n")).not.toBeNull();
		expect(cDetector.resolveContentSkipReason("/*\r\n * This file is in the public domain.\r\n */\r\nint x;\r\n")).not.toBeNull();
		expect(getContentSkipReason("/repo/sqlite3.c", AMALGAMATION_C)).not.toBeNull();
		expect(getContentSkipReason("/repo/sqlite3.c", AMALGAMATION_C, { disabledDetectors: ["c"] })).toBeNull();
	});

	it("does not skip the project's own C", () => {
		expect(cDetector.resolveContentSkipReason(GLUE_C)).toBeNull();
		expect(cDetector.resolveContentSkipReason(GUARDED_H)).toBeNull();
		expect(cDetector.resolveContentSkipReason("")).toBeNull();
		expect(cDetector.resolveContentSkipReason("/* Small helpers. */\n// more notes\n\nint x;\n")).toBeNull();
		// The prologue ends at the first line of code: a notice further down is not the file's.
		expect(cDetector.resolveContentSkipReason("int x;\n/* Copyright (c) 2001 Someone */\n")).toBeNull();
		expect(cDetector.resolveContentSkipReason("/* helpers */ int x;\n/* Copyright (c) 2001 Someone */\n")).toBeNull();
		// A file whose first comment is a fix-headers header is the project's own, even when it
		// keeps another holder's notice below it.
		const stamped =
			"/*\n *\t@Project: demo\n *\t@Copyright: Copyright (c) 2026 Demo\n */\n\n/* Portions Copyright (c) 2001 Someone */\nint x;\n";
		expect(cDetector.resolveContentSkipReason(stamped)).toBeNull();
		// An unterminated comment is read to the end of the scanned lines.
		expect(cDetector.resolveContentSkipReason("/* notes\n * still notes\n")).toBeNull();
		expect(cDetector.resolveContentSkipReason("// a\n// b")).toBeNull();
	});

	it("stamps the project's C above its #include / #pragma lines and leaves vendored C untouched", async () => {
		const workspace = await createWorkspace("c-detector-run");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
			await writeWorkspaceFile(join(workspace, "src", "c", "glue.c"), GLUE_C);
			await writeWorkspaceFile(join(workspace, "src", "c", "glue.h"), GUARDED_H);
			await writeWorkspaceFile(join(workspace, "src", "c", "sqlite3.c"), AMALGAMATION_C);
			await writeWorkspaceFile(join(workspace, "src", "c", "other.h"), SPDX_H);

			const result = await fixHeaders({ cwd: workspace, ...IDENTITY });

			expect(result.changes.map((change) => change.file).sort()).toEqual([join("src", "c", "glue.c"), join("src", "c", "glue.h")]);
			expect(result.skipped.map((entry) => entry.file).sort()).toEqual([join("src", "c", "other.h"), join("src", "c", "sqlite3.c")]);
			expect(await readFile(join(workspace, "src", "c", "sqlite3.c"), "utf8")).toBe(AMALGAMATION_C);
			expect(await readFile(join(workspace, "src", "c", "other.h"), "utf8")).toBe(SPDX_H);

			const glue = await readFile(join(workspace, "src", "c", "glue.c"), "utf8");
			expect(glue).toMatch(/^\/\*\n \*\n \*\t@Project: c-and-mts\n/);
			expect(glue).toContain("@Filename: src/c/glue.c");
			expect(glue.endsWith(GLUE_C)).toBe(true);
			const header = await readFile(join(workspace, "src", "c", "glue.h"), "utf8");
			expect(header.endsWith(GUARDED_H)).toBe(true);
			expect(header.indexOf("*/")).toBeLessThan(header.indexOf("#pragma once"));

			// A second run updates the header in place instead of skipping the stamped file.
			const again = await fixHeaders({ cwd: workspace, ...IDENTITY });
			expect(again.skipped.map((entry) => entry.file).sort()).toEqual([join("src", "c", "other.h"), join("src", "c", "sqlite3.c")]);
			expect(await readFile(join(workspace, "src", "c", "glue.c"), "utf8")).toBe(glue);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
