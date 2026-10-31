/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/header-line-endings.test.vitest.mjs
 *	@Date: 2026-10-31T12:00:00-07:00 (1793473200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T12:00:00-07:00 (1793473200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { extractHeaderlessBody, findProjectHeader, replaceOrInsertHeader } from "../src/header/parser.mjs";
import { getHeaderSyntaxForFile, renderHeaderLines } from "../src/header/syntax.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview An existing header in a CRLF file or a file starting with a UTF-8 byte order
 * mark is found and replaced in place (#162): a CRLF file keeps CRLF line endings, header
 * included, and a byte order mark stays at byte 0 with the header after it.
 */

const BOM = "﻿";
const OLD = ["@Project: demo", "@Copyright: c"];
const NEW = ["@Project: renamed", "@Copyright: c"];

/**
 * Renders a header for a file path.
 * @param {string} file - File path used for syntax selection.
 * @param {string[]} lines - Header lines without comment wrappers.
 * @param {object} [options={}] - Syntax options.
 * @returns {string} Header block with \n line breaks.
 */
function header(file, lines, options = {}) {
	return renderHeaderLines(getHeaderSyntaxForFile(file, options), lines);
}

/**
 * Converts \n line breaks to CRLF.
 * @param {string} text - Text with \n line breaks.
 * @returns {string} The text with CRLF line breaks.
 */
const crlf = (text) => text.replace(/\n/g, "\r\n");

/**
 * Whether a text has a \n that is not part of a CRLF.
 * @param {string} text - Text to check.
 * @returns {boolean} Whether a bare \n is present.
 */
const hasBareLf = (text) => /(?<!\r)\n/.test(text);

const CASES = [
	{ name: "YAML # header", file: "/r/a.yaml", body: "key: 1\n", options: {} },
	{ name: "Python # header", file: "/r/a.py", body: "print(1)\n", options: {} },
	{ name: "JS block header", file: "/r/a.mjs", body: "code();\n", options: {} },
	{ name: "CSS block header", file: "/r/a.css", body: "a { color: red; }\n", options: {} },
	{ name: "Markdown HTML header", file: "/r/a.md", body: "# Title\n", options: { forcedDetectors: ["markdown"] } }
];

describe("headers in CRLF and byte-order-mark files (#162)", () => {
	for (const { name, file, body, options } of CASES) {
		const original = `${header(file, OLD, options)}\n\n${body}`;
		const next = header(file, NEW, options);
		const expected = `${next}\n\n\n${body}`;

		it(`${name}: a CRLF header is found and replaced in place with CRLF line endings, and a second run is a no-op`, () => {
			const content = crlf(original);
			expect(findProjectHeader(content, file, options)).toEqual({ start: 0, end: content.indexOf(crlf(body)) });
			const first = replaceOrInsertHeader(content, next, file, options);
			expect(first.nextContent).toBe(crlf(expected));
			expect(first.header).toBe(crlf(next));
			expect(replaceOrInsertHeader(first.nextContent, next, file, options).changed).toBe(false);
		});

		it(`${name}: a header after a byte order mark is found and replaced after it, and a second run is a no-op`, () => {
			const content = `${BOM}${original}`;
			expect(findProjectHeader(content, file, options)).toEqual({ start: 1, end: content.indexOf(body) });
			const first = replaceOrInsertHeader(content, next, file, options);
			expect(first.nextContent).toBe(`${BOM}${expected}`);
			expect(first.nextContent.split(BOM).length - 1).toBe(1);
			expect(replaceOrInsertHeader(first.nextContent, next, file, options).changed).toBe(false);
		});

		it(`${name}: a byte order mark and CRLF together`, () => {
			const content = `${BOM}${crlf(original)}`;
			const first = replaceOrInsertHeader(content, next, file, options);
			expect(first.nextContent).toBe(`${BOM}${crlf(expected)}`);
			expect(replaceOrInsertHeader(first.nextContent, next, file, options).changed).toBe(false);
		});

		it(`${name}: a new header goes after a byte order mark, in the file's line ending`, () => {
			const bom = replaceOrInsertHeader(`${BOM}${body}`, next, file, options);
			expect(bom.nextContent).toBe(`${BOM}${expected}`);
			const crlfFile = replaceOrInsertHeader(crlf(body), next, file, options);
			expect(crlfFile.nextContent).toBe(crlf(expected));
			expect(crlfFile.written).toBe(crlf(next));
		});
	}

	it("keeps a byte order mark ahead of a shebang", () => {
		const content = `${BOM}#!/usr/bin/env node\n/**\n *\t@Project: demo\n */\n\ncode();\n`;
		expect(findProjectHeader(content, "/r/a.mjs")?.start).toBe(content.indexOf("/**"));
		const { nextContent } = replaceOrInsertHeader(content, "/**\n *\t@Project: x\n */", "/r/a.mjs");
		expect(nextContent).toBe(`${BOM}#!/usr/bin/env node\n/**\n *\t@Project: x\n */\n\n\ncode();\n`);
	});

	it("moves text out of a CRLF # header with CRLF line endings, and a second run is a no-op", () => {
		const content = "#\r\n#\t@Project: demo\r\n#\r\n#\tText.\r\n#\r\n\r\nprint(1)\r\n";
		const next = "#\n#\t@Project: x\n#";
		const first = replaceOrInsertHeader(content, next, "/r/a.py");
		expect(first.nextContent).toBe("#\r\n#\t@Project: x\r\n#\r\n\r\n\r\n#\tText.\r\n\r\n\r\nprint(1)\r\n");
		expect(hasBareLf(first.nextContent)).toBe(false);
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.py").changed).toBe(false);
		const kept = replaceOrInsertHeader(content, next, "/r/a.py", { strictHeaderBlock: false });
		expect(hasBareLf(kept.nextContent)).toBe(false);
		expect(kept.header.split("\r\n")).toContain("#\tText.");
		expect(replaceOrInsertHeader(kept.nextContent, next, "/r/a.py", { strictHeaderBlock: false }).changed).toBe(false);
	});

	it("rewrites a \\n header an earlier run wrote into a CRLF file with CRLF", () => {
		const content = "/**\n *\t@Project: x\n */\n\n\n\r\n\r\ncode();\r\n";
		const next = "/**\n *\t@Project: x\n */";
		const first = replaceOrInsertHeader(content, next, "/r/a.mjs");
		expect(first.nextContent).toBe("/**\r\n *\t@Project: x\r\n */\r\n\r\n\r\ncode();\r\n");
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.mjs").changed).toBe(false);
	});

	it("ends a CRLF file holding only a header with CRLF", () => {
		expect(replaceOrInsertHeader("#\r\n#\t@Project: demo\r\n#\r\n", "#\n#\t@Project: x\n#", "/r/a.py").nextContent).toBe(
			"#\r\n#\t@Project: x\r\n#\r\n"
		);
		expect(replaceOrInsertHeader("\r\n", "#\n#\t@Project: x\n#", "/r/a.py").nextContent).toBe("#\r\n#\t@Project: x\r\n#\r\n");
	});

	it("writes \\n line endings for a one-line header with no line break in the file", () => {
		expect(replaceOrInsertHeader("/** @Project: demo */", "/**\n *\t@Project: x\n */", "/r/a.mjs").nextContent).toBe(
			"/**\n *\t@Project: x\n */\n"
		);
	});

	it("reads the same body with or without the header in a CRLF or byte-order-mark file", () => {
		const content = `${BOM}#\r\n#\t@Project: demo\r\n#\r\n\r\nprint(1)\r\n`;
		expect(extractHeaderlessBody(content, "/r/a.py")).toBe(`${BOM}print(1)\r\n`);
		expect(extractHeaderlessBody(`${BOM}\r\nprint(1)\r\n`, "/r/a.py")).toBe(`${BOM}print(1)\r\n`);
	});

	it("updates CRLF and byte-order-mark # files end to end without stacking a second header, and settles after one run", async () => {
		const workspace = await createWorkspace("header-line-endings");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "line-endings" }, null, 2));
			const files = {
				"crlf.py": "#\r\n#\t@Project: old\r\n#\t@Copyright: c\r\n#\r\n\r\nprint(1)\r\n",
				"bom.py": `${BOM}#\n#\t@Project: old\n#\t@Copyright: c\n#\n\nprint(1)\n`,
				"bom.mjs": `${BOM}/**\n *\t@Project: old\n */\n\ncode();\n`
			};
			for (const [name, content] of Object.entries(files)) {
				await writeWorkspaceFile(join(workspace, "src", name), content);
			}
			const options = { cwd: workspace, input: "src", authorName: "A", authorEmail: "a@example.com" };
			expect((await fixHeaders(options)).filesUpdated).toBe(3);
			expect((await fixHeaders(options)).filesUpdated).toBe(0);
			for (const name of Object.keys(files)) {
				const content = await readFile(join(workspace, "src", name), "utf8");
				expect(content.split("@Project:").length - 1).toBe(1);
				expect(content).toContain("@Project: line-endings");
				expect(content.startsWith(BOM)).toBe(name.startsWith("bom"));
				expect(content.indexOf(BOM, 1)).toBe(-1);
				expect(hasBareLf(content)).toBe(!name.startsWith("crlf"));
			}
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
