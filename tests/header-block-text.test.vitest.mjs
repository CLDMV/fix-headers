/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/header-block-text.test.vitest.mjs
 *	@Date: 2026-10-30T12:00:00-07:00 (1793386800)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-30T12:00:00-07:00 (1793386800)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import {
	extractForeignHeaderLines,
	extractHeaderlessBody,
	findProjectHeader,
	replaceOrInsertHeader,
	splitHeaderText
} from "../src/header/parser.mjs";
import { getHeaderSyntaxForFile, renderHeaderLines } from "../src/header/syntax.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview Text in an existing header that is not a header field is never deleted
 * (#160): with strictHeaderBlock (the default) it moves to its own comment block directly
 * below the header; with strictHeaderBlock: false it stays inside the header after the fields.
 */

const FIELDS = [
	"@Project: demo",
	"@Filename: /src/file",
	"@Date: 2026-01-01T00:00:00-08:00 (1767254400)",
	"@Author: Tester",
	"@Email: <t@example.com>",
	"-----",
	"@Last modified by: Tester (t@example.com)",
	"@Last modified time: 2026-01-02T00:00:00-08:00 (1767340800)",
	"-----",
	"@Copyright: Copyright (c) 2026-2026 Example Inc. All rights reserved."
];

/**
 * Renders a header for a file path with the given lines.
 * @param {string} filePath - File path used for syntax selection.
 * @param {string[]} [lines=FIELDS] - Header lines without comment wrappers.
 * @returns {string} Header block.
 */
function header(filePath, lines = FIELDS) {
	return renderHeaderLines(getHeaderSyntaxForFile(filePath), lines);
}

/**
 * Renders an existing header that carries description lines after its fields, the way a
 * hand-written header does: an empty comment line, then the text.
 * @param {string} filePath - File path used for syntax selection.
 * @param {string[]} description - Description lines without comment wrappers.
 * @returns {string} Header block.
 */
function headerWithText(filePath, description) {
	return header(filePath, [...FIELDS, "", ...description]).replace(/\n(#|[ ]\*)\t\n/g, "\n$1\n");
}

const NEW_FIELDS = FIELDS.map((line) => line.replace("@Project: demo", "@Project: renamed"));

const CASES = [
	{ name: "JS block comment", file: "/r/src/a.mjs", body: "export const a = 1;\n", raw: [" *\tWhat this pins.", " *", " *\tAnd why."] },
	{ name: "JSONC block comment", file: "/r/src/a.jsonc", body: '{ "a": 1 }\n', raw: [" *\tWhat this pins.", " *", " *\tAnd why."] },
	{ name: "CSS block comment", file: "/r/src/a.css", body: "a { color: red; }\n", raw: [" *\tWhat this pins.", " *", " *\tAnd why."] },
	{ name: "PHP block comment", file: "/r/src/a.php", body: "echo 1;\n", raw: [" *\tWhat this pins.", " *", " *\tAnd why."] },
	{ name: "Go block comment", file: "/r/src/a.go", body: "package main\n", raw: [" *\tWhat this pins.", " *", " *\tAnd why."] },
	{ name: "Rust block comment", file: "/r/src/a.rs", body: "fn main() {}\n", raw: [" *\tWhat this pins.", " *", " *\tAnd why."] },
	{ name: "HTML comment", file: "/r/src/a.html", body: "<p></p>\n", raw: ["\tWhat this pins.", "", "\tAnd why."] },
	{ name: "YAML # comment", file: "/r/src/a.yaml", body: "name: x\n", raw: ["#\tWhat this pins.", "#", "#\tAnd why."] },
	{ name: "Python # comment", file: "/r/src/a.py", body: "print(1)\n", raw: ["#\tWhat this pins.", "#", "#\tAnd why."] }
];

describe("non-field text in an existing header (#160)", () => {
	for (const { name, file, body, raw } of CASES) {
		const syntax = getHeaderSyntaxForFile(file);
		const original = `${headerWithText(file, ["What this pins.", "", "And why."])}\n\n${body}`;
		const next = header(file, NEW_FIELDS);

		it(`${name}: finds the text as written`, () => {
			expect(extractForeignHeaderLines(original, file)).toEqual(raw);
		});

		it(`${name}: strict (default) moves the text to its own block below the header, and a second run is a no-op`, () => {
			const first = replaceOrInsertHeader(original, next, file);
			const block = syntax.kind === "line" ? raw.join("\n") : [syntax.blockStart, ...raw, syntax.blockEnd].join("\n");
			expect(first.nextContent).toBe(`${next}\n\n\n${block}\n\n\n${body}`);
			expect(first.header).toBe(next);
			const second = replaceOrInsertHeader(first.nextContent, next, file);
			expect(second.changed).toBe(false);
			expect(replaceOrInsertHeader(first.nextContent, next, file, { strictHeaderBlock: true }).changed).toBe(false);
		});

		it(`${name}: non-strict keeps the text inside the header after the fields, and a second run is a no-op`, () => {
			const options = { strictHeaderBlock: false };
			const first = replaceOrInsertHeader(original, next, file, options);
			expect(first.nextContent).toBe(`${first.header}\n\n\n${body}`);
			for (const line of raw) {
				expect(first.header.split("\n")).toContain(line);
			}
			expect(first.header).toContain("@Project: renamed");
			expect(first.header.indexOf(raw[0])).toBeGreaterThan(first.header.indexOf("@Copyright:"));
			expect(replaceOrInsertHeader(first.nextContent, next, file, options).changed).toBe(false);
		});

		it(`${name}: moving the text out is not a content edit`, () => {
			const moved = replaceOrInsertHeader(original, next, file).nextContent;
			const kept = replaceOrInsertHeader(original, next, file, { strictHeaderBlock: false }).nextContent;
			expect(extractHeaderlessBody(moved, file)).toBe(extractHeaderlessBody(original, file));
			expect(extractHeaderlessBody(kept, file, { strictHeaderBlock: false })).toBe(extractHeaderlessBody(original, file));
		});

		it(`${name}: a header with only fields is rewritten as before, in both modes`, () => {
			const plain = `${header(file)}\n\n${body}`;
			expect(extractForeignHeaderLines(plain, file)).toEqual([]);
			for (const options of [{}, { strictHeaderBlock: false }]) {
				expect(replaceOrInsertHeader(plain, next, file, options).nextContent).toBe(`${next}\n\n\n${body}`);
			}
		});
	}

	it("keeps text found between fields, unknown @tags and text on the opener line, in order", () => {
		const content = [
			"/** Opener text.",
			" *\t@Project: demo",
			" *\tBetween fields.",
			" *\t@Custom: kept",
			" *\t@Copyright: x",
			" */",
			"",
			"code();",
			""
		].join("\n");
		expect(extractForeignHeaderLines(content, "/r/a.mjs")).toEqual([" *\tOpener text.", " *\tBetween fields.", " *\t@Custom: kept"]);
	});

	it("collects the text of stacked headers in order", () => {
		const content = "/**\n *\t@Project: one\n *\tFirst.\n */\n/**\n *\t@Project: two\n *\tSecond.\n */\n\ncode();\n";
		const { nextContent } = replaceOrInsertHeader(content, "/**\n *\t@Project: x\n */", "/r/a.mjs");
		expect(nextContent).toBe("/**\n *\t@Project: x\n */\n\n\n/**\n *\tFirst.\n *\tSecond.\n */\n\n\ncode();\n");
	});

	it("ends the file with the moved block when the header was all there was", () => {
		const content = "/**\n *\t@Project: one\n *\tOnly text.\n */\n";
		expect(replaceOrInsertHeader(content, "/**\n *\t@Project: x\n */", "/r/a.mjs").nextContent).toBe(
			"/**\n *\t@Project: x\n */\n\n\n/**\n *\tOnly text.\n */\n"
		);
	});

	it("reads --no-strict-header-block from the command line", () => {
		expect(parseCliArgs(["--no-strict-header-block"]).options.strictHeaderBlock).toBe(false);
		expect(parseCliArgs([]).options.strictHeaderBlock).toBeUndefined();
	});

	it("reads --strict-header-block bare, with true, and with false", () => {
		expect(parseCliArgs(["--strict-header-block"]).options.strictHeaderBlock).toBe(true);
		expect(parseCliArgs(["--strict-header-block", "--dry-run"]).options).toEqual({ strictHeaderBlock: true, dryRun: true });
		expect(parseCliArgs(["--strict-header-block", "true"]).options.strictHeaderBlock).toBe(true);
		expect(parseCliArgs(["--strict-header-block", "false"]).options.strictHeaderBlock).toBe(false);
		expect(parseCliArgs(["--strict-header-block", "false", "--check"]).options).toEqual({ strictHeaderBlock: false, check: true });
	});

	it("applies both settings end to end, and settles after one run", async () => {
		const identity = { authorName: "Run Identity", authorEmail: "run@example.com", companyName: "Example Inc." };
		const description = " *\tWhat this test pins and why.\n *\tSecond line.";
		const existing = [
			"/**",
			" *",
			" *\t@Project: block-text",
			" *\t@Filename: /src/one.mjs",
			" *\t@Date: 2026-01-01T00:00:00-08:00 (1767254400)",
			" *\t@Author: Original <CLDMV>",
			" *\t@Email: <original@example.com>",
			" *\t-----",
			" *\t@Last modified by: Editor (editor@example.com)",
			" *\t@Last modified time: 2026-01-02T00:00:00-08:00 (1767340800)",
			" *\t-----",
			" *\t@Copyright: Copyright (c) 2026-2026 Example Inc. All rights reserved.",
			" *",
			description,
			" */",
			"",
			"export const one = true;",
			""
		].join("\n");
		for (const strictHeaderBlock of [undefined, true, false]) {
			const workspace = await createWorkspace("header-block-text");
			try {
				await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "block-text" }, null, 2));
				await writeWorkspaceFile(join(workspace, "src", "one.mjs"), existing);
				const options = { cwd: workspace, input: "src/one.mjs", ...identity, normalizeDateFormat: true, strictHeaderBlock };
				const first = await fixHeaders(options);
				expect(first.filesUpdated).toBe(1);
				const content = await readFile(join(workspace, "src", "one.mjs"), "utf8");
				expect(content).toContain(description);
				const headerEnd = content.indexOf(" */");
				if (strictHeaderBlock === false) {
					expect(content.indexOf(description)).toBeLessThan(headerEnd);
				} else {
					expect(content.slice(headerEnd)).toMatch(
						/^ \*\/\n\n\n\/\*\*\n \*\tWhat this test pins and why\.\n \*\tSecond line\.\n \*\/\n\n\nexport const one = true;\n$/
					);
				}
				const second = await fixHeaders(options);
				expect(second.filesUpdated).toBe(0);
				expect(await readFile(join(workspace, "src", "one.mjs"), "utf8")).toBe(content);
			} finally {
				await cleanupWorkspace(workspace);
			}
		}
	});

	describe("text that looks like a field", () => {
		const fields = [
			"/**",
			" *",
			" *\t@Project: demo",
			" *\t@Date: 2026-01-01T00:00:00-08:00 (1767254400)",
			" *\t@Author: Tester",
			" *\t-----",
			" *\t@Copyright: Copyright (c) 2026-2026 Example Inc. All rights reserved.",
			" *"
		];
		const text = [
			" *\t@Author: Second Author",
			" *\t@Copyright: Portions (c) 2019 Foo Corp, MIT licence",
			" *\tWhat changed:",
			" *\t---",
			" *\t@Date: see changelog"
		];
		const content = [...fields, ...text, " */", "", "code();", ""].join("\n");
		const next = header("/r/a.mjs", NEW_FIELDS);

		it("keeps a repeated tag, a dash line among text and a tag inside a description, in both modes", () => {
			expect(extractForeignHeaderLines(content, "/r/a.mjs")).toEqual(text);
			const strict = replaceOrInsertHeader(content, next, "/r/a.mjs");
			expect(strict.nextContent).toBe(`${next}\n\n\n${["/**", ...text, " */"].join("\n")}\n\n\ncode();\n`);
			expect(replaceOrInsertHeader(strict.nextContent, next, "/r/a.mjs").changed).toBe(false);
			const kept = replaceOrInsertHeader(content, next, "/r/a.mjs", { strictHeaderBlock: false });
			for (const line of text) {
				expect(kept.header.split("\n")).toContain(line);
			}
			expect(replaceOrInsertHeader(kept.nextContent, next, "/r/a.mjs", { strictHeaderBlock: false }).changed).toBe(false);
		});

		it("still treats a dash line next to a field as a separator", () => {
			const separated = ["/**", " *\t@Project: demo", " *\t-----", " *\t@Author: A", " *", " *\tText.", " */", ""].join("\n");
			expect(extractForeignHeaderLines(separated, "/r/a.mjs")).toEqual([" *\tText."]);
		});

		describe("a line wrapping a field's value is text, never deleted", () => {
			const repros = [
				["a star-less block header", "/*\n\t@Project: demo\n\t@Copyright: (c) X\nDescription line\n*/\n\ncode();\n", ["Description line"]],
				[
					"a deeper-indented co-author line",
					"/**\n *\t@Project: demo\n *\t@Author: A\n *\t\tand B (co-author)\n */\n\ncode();\n",
					[" *\t\tand B (co-author)"]
				],
				[
					"a licence line under @Copyright",
					"/**\n *\t@Project: demo\n *\t@Copyright: (c) X\n *\t    Licensed MIT, see LICENSE\n */\n\ncode();\n",
					[" *\t    Licensed MIT, see LICENSE"]
				]
			];
			for (const [name, content, kept] of repros) {
				it(`${name}, in both modes`, () => {
					expect(extractForeignHeaderLines(content, "/r/a.mjs")).toEqual(kept);
					for (const options of [{}, { strictHeaderBlock: false }]) {
						const first = replaceOrInsertHeader(content, next, "/r/a.mjs", options);
						for (const line of kept) {
							expect(first.nextContent.split("\n")).toContain(line);
						}
						if (options.strictHeaderBlock === false) {
							expect(first.header.split("\n")).toContain(kept[0]);
						} else {
							expect(first.header).not.toContain(kept[0].trim());
						}
						expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.mjs", options).changed).toBe(false);
					}
				});
			}
		});
	});

	describe("comment lines directly above a # header", () => {
		const header = "#\n#\t@Project: renamed\n#";
		for (const [name, file, directive] of [
			["a Python coding line", "/r/a.py", "# -*- coding: utf-8 -*-"],
			["#cloud-config", "/r/a.yaml", "#cloud-config"],
			["a yaml-language-server modeline", "/r/a.yaml", "# yaml-language-server: $schema=./schema.json"],
			["a vim modeline", "/r/a.py", "# vim: set ts=4 sw=4:"]
		]) {
			it(`keeps ${name} in place above the header, in both modes`, () => {
				const content = `${directive}\n#\n#\t@Project: demo\n#\t@Copyright: c\n#\n#\tText.\n\nkey: 1\n`;
				expect(splitHeaderText(content, file)).toEqual({ above: [directive], foreign: ["#\tText."] });
				for (const options of [{}, { strictHeaderBlock: false }]) {
					const first = replaceOrInsertHeader(content, header, file, options);
					expect(first.nextContent.startsWith(`${directive}\n#\n#\t@Project: renamed`)).toBe(true);
					expect(first.nextContent).toContain("#\tText.");
					expect(replaceOrInsertHeader(first.nextContent, header, file, options).changed).toBe(false);
				}
			});
		}

		it("treats a description above the first field as header text, in both modes", () => {
			const content = "#\tMy script does X\n#\n#\t@Project: demo\n#\t@Copyright: c\n#\n\nprint(1)\n";
			expect(splitHeaderText(content, "/r/a.py")).toEqual({ above: [], foreign: ["#\tMy script does X"] });
			const strict = replaceOrInsertHeader(content, header, "/r/a.py");
			expect(strict.nextContent).toBe(`${header}\n\n\n#\tMy script does X\n\n\nprint(1)\n`);
			expect(replaceOrInsertHeader(strict.nextContent, header, "/r/a.py").changed).toBe(false);
			const kept = replaceOrInsertHeader(content, header, "/r/a.py", { strictHeaderBlock: false });
			expect(kept.nextContent).toBe(`${kept.header}\n\n\nprint(1)\n`);
			expect(kept.header.split("\n")).toContain("#\tMy script does X");
			expect(kept.header.indexOf("My script")).toBeGreaterThan(kept.header.indexOf("@Project"));
		});

		it("keeps a coding line under a shebang on line 2", () => {
			const content = "#!/usr/bin/env python3\n# -*- coding: utf-8 -*-\n#\n#\t@Project: demo\n#\n\nprint(1)\n";
			const { nextContent } = replaceOrInsertHeader(content, header, "/r/a.py");
			expect(nextContent.split("\n").slice(0, 3)).toEqual(["#!/usr/bin/env python3", "# -*- coding: utf-8 -*-", "#"]);
		});
	});

	it("writes the header and the moved block with the file's own CRLF line endings, and a second run is a no-op", () => {
		const content = "/**\r\n *\t@Project: demo\r\n *\r\n *\tText one.\r\n *\tText two.\r\n */\r\n\r\ncode();\r\n";
		const next = "/**\n *\t@Project: renamed\n */";
		const first = replaceOrInsertHeader(content, next, "/r/a.mjs");
		expect(first.nextContent).toBe(
			`${next.replace(/\n/g, "\r\n")}\r\n\r\n\r\n/**\r\n *\tText one.\r\n *\tText two.\r\n */\r\n\r\n\r\ncode();\r\n`
		);
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.mjs").changed).toBe(false);
	});

	it("moves the text of a Markdown (forced detector) header", () => {
		const options = { forcedDetectors: ["markdown"] };
		const content = "<!--\n\t@Project: demo\n\n\tText.\n-->\n\n# Title\n";
		const next = "<!--\n\t@Project: renamed\n-->";
		const first = replaceOrInsertHeader(content, next, "/r/a.md", options);
		expect(first.nextContent).toBe(`${next}\n\n\n<!--\n\tText.\n-->\n\n\n# Title\n`);
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.md", options).changed).toBe(false);
		const kept = replaceOrInsertHeader(content, next, "/r/a.md", { ...options, strictHeaderBlock: false });
		expect(kept.header).toContain("\tText.");
		expect(replaceOrInsertHeader(kept.nextContent, next, "/r/a.md", { ...options, strictHeaderBlock: false }).changed).toBe(false);
	});

	it("puts the moved block on the next line with margin 0, and a second run is a no-op", () => {
		const content = "/**\n *\t@Project: demo\n *\n *\tText.\n */\ncode();\n";
		const next = "/**\n *\t@Project: renamed\n */";
		const first = replaceOrInsertHeader(content, next, "/r/a.mjs", { margin: 0 });
		expect(first.nextContent).toBe(`${next}\n/**\n *\tText.\n */\ncode();\n`);
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.mjs", { margin: 0 }).changed).toBe(false);
	});

	it("reports the moved text as moved in the sample diff, not deleted", async () => {
		const workspace = await createWorkspace("header-block-text-diff");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "block-text" }, null, 2));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				"/**\n *\t@Project: old-name\n *\n *\tKeep me.\n */\n\nexport const one = 1;\n"
			);
			const result = await fixHeaders({
				cwd: workspace,
				input: "src/one.mjs",
				authorName: "A",
				authorEmail: "a@example.com",
				sampleOutput: true,
				dryRun: true
			});
			const { sample } = result.changes[0];
			expect(sample.newValue).toContain("@Project: block-text");
			expect(sample.newValue.endsWith("/**\n *\tKeep me.\n */")).toBe(true);
			expect(sample.diff.split("\n").some((line) => line.startsWith("-") && line.includes("Keep me."))).toBe(false);
			expect(sample.diff.split("\n")).toContain("  *\tKeep me.");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("reads strictHeaderBlock: false from a config file", async () => {
		const workspace = await createWorkspace("header-block-text-config");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "block-text" }, null, 2));
			await writeWorkspaceFile(join(workspace, "fix-headers.json"), JSON.stringify({ strictHeaderBlock: false }));
			await writeWorkspaceFile(
				join(workspace, "src", "one.mjs"),
				"/**\n *\t@Project: old-name\n *\n *\tKeep me.\n */\n\nexport const one = 1;\n"
			);
			const options = {
				cwd: workspace,
				input: "src/one.mjs",
				authorName: "A",
				authorEmail: "a@example.com",
				configFile: "fix-headers.json"
			};
			expect((await fixHeaders(options)).filesUpdated).toBe(1);
			const content = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(content.indexOf("Keep me.")).toBeLessThan(content.indexOf(" */"));
			expect(content).toMatch(/ \*\/\n\n\nexport const one = 1;\n$/);
			expect((await fixHeaders(options)).filesUpdated).toBe(0);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	describe("a moved block is never taken back into the header", () => {
		const jsHeader = header("/r/a.mjs", FIELDS);
		const yamlHeader = header("/r/a.yaml", FIELDS);
		const yamlTwice = `${headerWithText("/r/a.yaml", FIELDS)}\n\nkey: 1\n`;
		const repros = [
			[
				"a JS header with a second @Project line",
				"/r/a.mjs",
				jsHeader,
				"/**\n *\t@Project: demo\n *\t@Project: legacy-name (renamed 2024)\n */\n\ncode();\n",
				["@Project: legacy-name (renamed 2024)"]
			],
			["a # header holding two copies of the header", "/r/a.yaml", yamlHeader, yamlTwice, FIELDS.filter((line) => line !== "-----")]
		];
		for (const [name, file, next, content, kept] of repros) {
			for (const options of [{}, { margin: 0 }, { strictHeaderBlock: false }, { strictHeaderBlock: false, margin: 0 }]) {
				it(`${name}: three runs with ${JSON.stringify(options)} keep every line and settle after the first`, () => {
					const runs = [];
					let current = content;
					for (let run = 0; run < 3; run += 1) {
						current = replaceOrInsertHeader(current, next, file, options).nextContent;
						runs.push(current);
					}
					expect(runs[1]).toBe(runs[0]);
					expect(runs[2]).toBe(runs[0]);
					for (const line of kept) {
						// Each kept line appears once in the regenerated header (when it is a field) plus once as kept text.
						expect(runs[2].split(line).length - 1).toBeGreaterThanOrEqual(next.includes(line) ? 2 : 1);
					}
				});
			}
		}

		it("only takes a following comment as a stacked header when it starts with @Project:", () => {
			const content = "/**\n *\t@Project: demo\n */\n\n/**\n *\tNotes.\n *\t@Project: mentioned\n */\n\ncode();\n";
			expect(findProjectHeader(content, "/r/a.mjs")).toEqual({ start: 0, end: content.indexOf("/**", 1) });
			const stacked = "/**\n *\t@Project: demo\n */\n\n/**\n *\n *\t@Project: copy\n */\n\ncode();\n";
			expect(findProjectHeader(stacked, "/r/a.mjs").end).toBe(stacked.indexOf("code();"));
		});
	});

	describe("prose is not a directive", () => {
		for (const prose of ["#\tDecoding: base64 helpers", "#\tUse it like vi: modal"]) {
			it(`moves "${prose}" with the header text instead of keeping it above the header`, () => {
				const content = `${prose}\n#\n#\t@Project: demo\n#\n\nprint(1)\n`;
				expect(splitHeaderText(content, "/r/a.py")).toEqual({ above: [], foreign: [prose] });
			});
		}

		it("counts an encoding declaration only on the file's first two lines", () => {
			const content = "# -*- coding: utf-8 -*-\n#\n#\t@Project: demo\n#\n";
			expect(splitHeaderText(content, "/r/a.py", {}, 1).above).toEqual(["# -*- coding: utf-8 -*-"]);
			expect(splitHeaderText(content, "/r/a.py", {}, 2)).toEqual({ above: [], foreign: ["# -*- coding: utf-8 -*-"] });
			expect(splitHeaderText("# coding=utf-8\n#\t@Project: demo\n", "/r/a.py").above).toEqual(["# coding=utf-8"]);
		});
	});
});
