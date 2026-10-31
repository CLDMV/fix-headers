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
import { parseCliArgs, runCli } from "../src/cli.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import {
	copyrightHolder,
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

		it("drops a repeated tag as a duplicate, keeps another holder's @Copyright as a field and description text as text, in both modes (#162)", () => {
			const extra = " *\t@Copyright: Portions (c) 2019 Foo Corp, MIT licence";
			const withExtra = next.replace(/( \*\t@Copyright: [^\n]*)/, `$1\n${extra}`);
			expect(splitHeaderText(content, "/r/a.mjs")).toEqual({
				foreign: [" *\tWhat changed:"],
				copyrights: ["Portions (c) 2019 Foo Corp, MIT licence"]
			});
			const strict = replaceOrInsertHeader(content, next, "/r/a.mjs");
			expect(strict.extraCopyrights).toEqual(["Portions (c) 2019 Foo Corp, MIT licence"]);
			expect(strict.nextContent).toBe(`${withExtra}\n\n\n/**\n *\tWhat changed:\n */\n\n\ncode();\n`);
			expect(strict.nextContent).not.toContain("Second Author");
			expect(strict.nextContent).not.toContain("see changelog");
			const again = replaceOrInsertHeader(strict.nextContent, next, "/r/a.mjs");
			expect(again.changed).toBe(false);
			expect(again.extraCopyrights).toEqual(["Portions (c) 2019 Foo Corp, MIT licence"]);
			const kept = replaceOrInsertHeader(content, next, "/r/a.mjs", { strictHeaderBlock: false });
			expect(kept.header.split("\n")).toContain(" *\tWhat changed:");
			expect(kept.header.split("\n")).toContain(extra);
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
		it("treats a description above the first field as header text, in both modes", () => {
			const content = "#\tMy script does X\n#\n#\t@Project: demo\n#\t@Copyright: c\n#\n\nprint(1)\n";
			expect(splitHeaderText(content, "/r/a.py")).toEqual({ foreign: ["#\tMy script does X"], copyrights: [] });
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
				"a JS header with a second @Project line, which is a duplicate",
				"/r/a.mjs",
				jsHeader,
				"/**\n *\t@Project: demo\n *\t@Project: legacy-name (renamed 2024)\n *\n *\tKept.\n */\n\ncode();\n",
				["Kept."],
				["legacy-name"]
			],
			["a # header holding two copies of the header", "/r/a.yaml", yamlHeader, yamlTwice, [], []],
			[
				"a JS header holding text and then a second copy of the fields",
				"/r/a.mjs",
				jsHeader,
				`${headerWithText("/r/a.mjs", ["Old header:", ...FIELDS.map((line) => line.replace("demo", "other"))])}\n\ncode();\n`,
				["Old header:"],
				["@Project: other"]
			],
			[
				"a # header holding text and then a second copy of the fields",
				"/r/a.yaml",
				yamlHeader,
				`${headerWithText("/r/a.yaml", ["Old header:", ...FIELDS.map((line) => line.replace("demo", "other"))])}\n\nkey: 1\n`,
				["Old header:"],
				["@Project: other"]
			]
		];
		for (const [name, file, next, content, kept, gone] of repros) {
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
						expect(runs[2].split(line).length - 1).toBe(1);
					}
					for (const text of gone) {
						expect(runs[2]).not.toContain(text);
					}
					// One header, and nothing below it is a file header (no @Project: or @Filename: line).
					expect(runs[2].match(/@Project:/g)).toHaveLength(1);
					expect(runs[2].match(/@Filename:/g)).toHaveLength(1);
					expect(runs[2]).not.toContain("Moved out of the file header by fix-headers:");
				});
			}
		}

		it("takes every following comment with a @Project: or @Filename: line for a copy of the header, and no other (#162)", () => {
			const lead = "/**\n *\t@Project: demo\n */\n\n";
			for (const comment of ["/**\n *\tNotes.\n *\t@Project: mentioned\n */", "/**\n *\tNotes.\n *\t@Filename: /x\n */"]) {
				const content = `${lead}${comment}\n\ncode();\n`;
				expect(findProjectHeader(content, "/r/a.mjs")?.end).toBe(content.indexOf("code();"));
			}
			for (const comment of ["/**\n *\tNotes about @Project: names.\n */", "/**\n *\t@Author: x\n *\t@Copyright: y\n */"]) {
				const content = `${lead}${comment}\n\ncode();\n`;
				expect(findProjectHeader(content, "/r/a.mjs")).toEqual({ start: 0, end: lead.length });
			}
		});
	});

	describe("one header per file (#162)", () => {
		const OTHER = [
			"@Project: other-project",
			"@Filename: /other/file",
			"@Author: Someone Else",
			"-----",
			"@Copyright: Copyright (c) 2015 Example Inc. All rights reserved."
		];

		/**
		 * Renders a comment holding the given lines, as a hand-written header copy would be.
		 * @param {string} file - File path used for syntax selection.
		 * @param {string[]} lines - Lines without comment wrappers.
		 * @returns {string} The comment.
		 */
		const copy = (file, lines) => header(file, lines).replace(/\n(#|[ ]\*)\t\n/g, "\n$1\n");

		it("takes a comment with @Filename: and no @Project: for the file's header and rewrites it in place", () => {
			for (const [file, body] of [
				["/r/a.mjs", "code();\n"],
				["/r/a.yaml", "key: 1\n"]
			]) {
				const content = `${header(file, ["@Filename: /src/a", "@Author: Tester"])}\n\n${body}`;
				const next = header(file, NEW_FIELDS);
				expect(findProjectHeader(content, file)).toEqual({ start: 0, end: content.indexOf(body) });
				const first = replaceOrInsertHeader(content, next, file);
				expect(first.nextContent).toBe(`${next}\n\n\n${body}`);
				expect(replaceOrInsertHeader(first.nextContent, next, file).changed).toBe(false);
			}
		});

		for (const { name, file, body } of [CASES[0], CASES[7]]) {
			const syntax = getHeaderSyntaxForFile(file);
			const next = header(file, NEW_FIELDS);
			const prefix = syntax.kind === "line" ? "#\t" : " *\t";
			const block = (lines) => (syntax.kind === "line" ? lines.join("\n") : [syntax.blockStart, ...lines, syntax.blockEnd].join("\n"));

			it(`${name}: merges a stacked copy that starts with text and names another project, keeping its text and dropping its fields, in both modes`, () => {
				const content = `${header(file)}\n\n${copy(file, ["Old notes.", "", ...OTHER])}\n\n${body}`;
				expect(findProjectHeader(content, file)).toEqual({ start: 0, end: content.indexOf(body) });
				const strict = replaceOrInsertHeader(content, next, file);
				expect(strict.nextContent).toBe(`${next}\n\n\n${block([`${prefix}Old notes.`])}\n\n\n${body}`);
				expect(replaceOrInsertHeader(strict.nextContent, next, file).changed).toBe(false);
				const options = { strictHeaderBlock: false };
				const kept = replaceOrInsertHeader(content, next, file, options);
				expect(kept.nextContent).toBe(`${kept.header}\n\n\n${body}`);
				expect(kept.header.split("\n")).toContain(`${prefix}Old notes.`);
				expect(kept.nextContent).not.toContain("other-project");
				expect(replaceOrInsertHeader(kept.nextContent, next, file, options).changed).toBe(false);
			});

			it(`${name}: merges two stacked copies, keeping their text in order`, () => {
				const content = `${header(file)}\n\n${copy(file, ["First.", "", ...OTHER])}\n\n${copy(file, [...OTHER, "", "Second."])}\n\n${body}`;
				const first = replaceOrInsertHeader(content, next, file);
				expect(first.nextContent).toBe(`${next}\n\n\n${block([`${prefix}First.`, `${prefix}Second.`])}\n\n\n${body}`);
				expect(replaceOrInsertHeader(first.nextContent, next, file).changed).toBe(false);
			});

			it(`${name}: merges a copy that fix-headers 2.2.3 moved out with a lead line, dropping the lead line`, () => {
				const moved = copy(file, ["Moved out of the file header by fix-headers:", "@Project: legacy", "Notes."]);
				const content = `${header(file, NEW_FIELDS)}\n\n${moved}\n\n${body}`;
				const first = replaceOrInsertHeader(content, next, file);
				expect(first.nextContent).toBe(`${next}\n\n\n${block([`${prefix}Notes.`])}\n\n\n${body}`);
				expect(replaceOrInsertHeader(first.nextContent, next, file).changed).toBe(false);
			});

			it(`${name}: leaves a lead-line block with no @Project: or @Filename: line alone`, () => {
				const content = `${next}\n\n\n${block([`${prefix}Moved out of the file header by fix-headers:`, `${prefix}Notes.`])}\n\n\n${body}`;
				expect(replaceOrInsertHeader(content, next, file).changed).toBe(false);
			});

			it(`${name}: leaves a @Copyright line in a comment that is not a file header alone, with no warning`, () => {
				const notice = block([`${prefix}Bundled code:`, `${prefix}@Copyright: Copyright (c) 2010 Mozilla Foundation`]);
				const content = `${next}\n\n\n${notice}\n\n\n${body}`;
				const result = replaceOrInsertHeader(content, next, file);
				expect(result.changed).toBe(false);
				expect(result.extraCopyrights).toEqual([]);
			});
		}

		describe("repeated @Copyright lines", () => {
			const file = "/r/a.mjs";
			const next = header(file, NEW_FIELDS);
			const own = " *\t@Copyright: Copyright (c) 2026-2026 Example Inc. All rights reserved.";

			it("drops one naming the same holder with another year range", () => {
				const content = `${header(file, [...FIELDS, "@Copyright: Copyright (c) 2013-2025 Example Inc. All rights reserved."])}\n\ncode();\n`;
				const first = replaceOrInsertHeader(content, next, file);
				expect(first.nextContent).toBe(`${next}\n\n\ncode();\n`);
				expect(first.extraCopyrights).toEqual([]);
			});

			it("keeps ones naming other holders as fields under the header's own, in order, in both modes, and a second run is a no-op", () => {
				const extras = ["Copyright (c) 2010 Mozilla Foundation", "(c) 2012 Other Ltd"];
				const content = `${header(file, [...FIELDS, ...extras.map((value) => `@Copyright: ${value}`), "", "Text."])}\n\ncode();\n`;
				for (const options of [{}, { strictHeaderBlock: false }]) {
					const first = replaceOrInsertHeader(content, next, file, options);
					const lines = first.header.split("\n");
					expect(lines.slice(lines.indexOf(own), lines.indexOf(own) + 3)).toEqual([
						own,
						...extras.map((value) => ` *\t@Copyright: ${value}`)
					]);
					expect(first.extraCopyrights).toEqual(extras);
					expect(first.nextContent).toContain("Text.");
					const second = replaceOrInsertHeader(first.nextContent, next, file, options);
					expect(second.changed).toBe(false);
					expect(second.extraCopyrights).toEqual(extras);
				}
			});

			it("compares the copyright of a stacked copy with the header's own", () => {
				const content = `${header(file)}\n\n${copy(file, ["@Project: old", "@Copyright: Copyright (c) 2014 Example Inc.", "@Copyright: © 2010 Mozilla Foundation. All rights reserved."])}\n\ncode();\n`;
				const first = replaceOrInsertHeader(content, next, file);
				expect(first.extraCopyrights).toEqual(["© 2010 Mozilla Foundation. All rights reserved."]);
				expect(first.nextContent).toBe(
					`${next.replace(own, `${own}\n *\t@Copyright: © 2010 Mozilla Foundation. All rights reserved.`)}\n\n\ncode();\n`
				);
				expect(replaceOrInsertHeader(first.nextContent, next, file).changed).toBe(false);
			});

			it("names the holder without the notice words, years and punctuation", () => {
				expect(copyrightHolder("Copyright (c) 2013-2025 Catalyzed Motivation Inc. All rights reserved.")).toBe("catalyzed motivation inc");
				expect(copyrightHolder("© 2010, 2012  Mozilla   Foundation")).toBe("mozilla foundation");
				expect(copyrightHolder("Copyright (c) 2019-2026 All rights reserved.")).toBe("");
			});

			it("warns in the result and the CLI output on every run, and the second run writes nothing", async () => {
				const workspace = await createWorkspace("header-block-text-copyright");
				try {
					await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "block-text" }, null, 2));
					await writeWorkspaceFile(
						join(workspace, "src", "one.mjs"),
						"/**\n *\t@Project: old-name\n *\t@Copyright: Copyright (c) 2020 Old Inc.\n *\t@Copyright: Copyright (c) 2010 Mozilla Foundation\n */\n\nexport const one = 1;\n"
					);
					const options = { cwd: workspace, input: "src/one.mjs", authorName: "A", authorEmail: "a@example.com" };
					const warning = { file: join("src", "one.mjs"), copyright: "Copyright (c) 2010 Mozilla Foundation" };
					const first = await fixHeaders(options);
					expect(first.filesUpdated).toBe(1);
					expect(first.copyrightWarnings).toEqual([warning]);
					expect(first.changes[0].extraCopyrights).toEqual([warning.copyright]);
					const content = await readFile(join(workspace, "src", "one.mjs"), "utf8");
					expect(content).toContain(" *\t@Copyright: Copyright (c) 2010 Mozilla Foundation\n");
					expect(content).not.toContain("Old Inc.");
					const second = await fixHeaders(options);
					expect(second.filesUpdated).toBe(0);
					expect(second.copyrightWarnings).toEqual([warning]);
					const stdout = [];
					const code = await runCli(
						["--cwd", workspace, "--input", "src/one.mjs", "--author-name", "A", "--author-email", "a@example.com"],
						{
							stdout: (message) => stdout.push(message)
						}
					);
					expect(code).toBe(0);
					expect(stdout[0]).toContain("updated=0, warnings=1");
					expect(stdout).toContain(`warning: ${warning.file} keeps an additional @Copyright: ${warning.copyright}`);
					const checkOut = [];
					expect(
						await runCli(["--cwd", workspace, "--input", "src/one.mjs", "--check"], { stdout: (message) => checkOut.push(message) })
					).toBe(0);
					expect(checkOut).toContain(`warning: ${warning.file} keeps an additional @Copyright: ${warning.copyright}`);
				} finally {
					await cleanupWorkspace(workspace);
				}
			});
		});
	});
});
