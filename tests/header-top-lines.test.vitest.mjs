/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/header-top-lines.test.vitest.mjs
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
import { getContentSkipReason } from "../src/detectors/index.mjs";
import { isModeline } from "../src/detectors/top-lines.mjs";
import { findProjectHeader, replaceOrInsertHeader, splitHeaderText } from "../src/header/parser.mjs";
import { getHeaderSyntaxForFile, renderHeaderLines } from "../src/header/syntax.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview What stays above the header (#162): only lines already at the very top of the
 * file whose position matters to the file or its tooling. Nothing further down is moved up.
 */

/**
 * Renders a header for a file path.
 * @param {string} file - File path used for syntax selection.
 * @param {string} project - The @Project value.
 * @param {object} [options={}] - Syntax options.
 * @returns {string} Header block.
 */
function header(file, project, options = {}) {
	return renderHeaderLines(getHeaderSyntaxForFile(file, options), [`@Project: ${project}`, "@Copyright: c"]);
}

const CONSTRUCTS = [
	["a node shebang", "/r/a.mjs", "#!/usr/bin/env -S node --no-warnings", "code();\n"],
	["a bun shebang", "/r/a.ts", "#!/usr/bin/env bun", "code();\n"],
	["a python shebang", "/r/a.py", "#!/usr/bin/env python3", "print(1)\n"],
	["a PEP 263 coding line on line 1", "/r/a.py", "# -*- coding: utf-8 -*-", "print(1)\n"],
	["a shebang and a coding line on line 2", "/r/a.py", "#!/usr/bin/env python3\n# coding=latin-1", "print(1)\n"],
	["a cargo script shebang", "/r/a.rs", "#!/usr/bin/env -S cargo +nightly -Zscript", "fn main() {}\n"],
	["#cloud-config", "/r/a.yaml", "#cloud-config", "packages: []\n"],
	["@charset", "/r/a.css", '@charset "UTF-8";', "a { color: red; }\n"],
	["the PHP opening tag", "/r/a.php", "<?php", "echo 1;\n"],
	["the PHP opening tag with code on its line", "/r/a.php", "<?php declare(strict_types=1);", "echo 1;\n"],
	["a vim modeline", "/r/a.py", "# vim: set ts=4 sw=4:", "print(1)\n"],
	["a vim modeline of options only", "/r/a.py", "# vim: ts=4 sw=4 et", "print(1)\n"],
	["a vi set modeline", "/r/a.yaml", "# vi: set ts=8:", "key: 1\n"],
	["a versioned vim modeline", "/r/a.py", "# vim600: set foldmethod=marker:", "print(1)\n"],
	["a modeline of one boolean option", "/r/a.py", "# vim: noexpandtab", "print(1)\n"],
	["an ex modeline", "/r/a.py", "# ex: set sw=2:", "print(1)\n"],
	["a Vim: set modeline", "/r/a.py", "# Vim: set ts=4: trailing text", "print(1)\n"],
	["a modeline with an escaped colon in a value", "/r/a.py", "# vim: set fdm=marker fmr=a\\:b:", "print(1)\n"],
	["a // modeline", "/r/a.mjs", "// vim: set ts=2 sw=2 et:", "code();\n"],
	["a /* */ modeline", "/r/a.css", "/* vim: set ts=2: */", "a { color: red; }\n"],
	["an HTML comment modeline", "/r/a.html", "<!-- vim: set ts=2: -->", "<p></p>\n"],
	["a shebang and a modeline", "/r/a.mjs", "#!/usr/bin/env node\n// vim: set ts=2:", "code();\n"]
];

describe("lines kept above the header (#162)", () => {
	for (const [name, file, top, body] of CONSTRUCTS) {
		const next = header(file, "x");

		it(`${name}: a new header goes below it, and a second run is a no-op`, () => {
			const first = replaceOrInsertHeader(`${top}\n${body}`, next, file);
			expect(first.nextContent).toBe(`${top}\n${next}\n\n\n${body}`);
			expect(replaceOrInsertHeader(first.nextContent, next, file).changed).toBe(false);
		});

		it(`${name}: an existing header below it is found and replaced in place, in both modes`, () => {
			const content = `${top}\n${header(file, "old")}\n\n${body}`;
			expect(findProjectHeader(content, file)?.start).toBe(top.length + 1);
			for (const options of [{}, { strictHeaderBlock: false }]) {
				expect(replaceOrInsertHeader(content, next, file, options).nextContent).toBe(`${top}\n${next}\n\n\n${body}`);
			}
		});

		it(`${name}: not at the top of the file, it stays where it is and the header goes on line 1`, () => {
			const content = `${body}${top}\n`;
			expect(replaceOrInsertHeader(content, next, file).nextContent).toBe(`${next}\n\n\n${body}${top}\n`);
		});
	}

	it("keeps Go build constraints and the blank line after them above the header", () => {
		const top = "//go:build linux\n// +build linux\n\n";
		const next = header("/r/a.go", "x");
		const first = replaceOrInsertHeader(`${top}package main\n`, next, "/r/a.go");
		expect(first.nextContent).toBe(`${top}${next}\n\n\npackage main\n`);
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.go").changed).toBe(false);
		expect(replaceOrInsertHeader(`${top}${header("/r/a.go", "old")}\n\npackage main\n`, next, "/r/a.go").nextContent).toBe(
			first.nextContent
		);
		const modelineOnly = replaceOrInsertHeader("// vim: set ts=4:\npackage main\n", next, "/r/a.go").nextContent;
		expect(modelineOnly).toBe(`// vim: set ts=4:\n${next}\n\n\npackage main\n`);
		const later = "// Package main does x.\n//go:build linux\n\npackage main\n";
		expect(replaceOrInsertHeader(later, next, "/r/a.go").nextContent).toBe(`${next}\n\n\n${later}`);
	});

	it("keeps Markdown front matter and a modeline after it above the header", () => {
		const options = { forcedDetectors: ["markdown"] };
		const next = header("/r/a.md", "x", options);
		const content = "---\ntitle: x\n---\n<!-- vim: set tw=80: -->\n# Title\n";
		const first = replaceOrInsertHeader(content, next, "/r/a.md", options);
		expect(first.nextContent).toBe(`---\ntitle: x\n---\n<!-- vim: set tw=80: -->\n${next}\n\n\n# Title\n`);
		expect(replaceOrInsertHeader(first.nextContent, next, "/r/a.md", options).changed).toBe(false);
	});

	it("puts the header on its own line after a kept line that ends the file without a line break", () => {
		const next = header("/r/a.mjs", "x");
		expect(replaceOrInsertHeader("#!/usr/bin/env node", next, "/r/a.mjs").nextContent).toBe(`#!/usr/bin/env node\n${next}\n`);
		expect(replaceOrInsertHeader("\uFEFF#!/usr/bin/env node", next, "/r/a.mjs").nextContent).toBe(`\uFEFF#!/usr/bin/env node\n${next}\n`);
	});

	describe("lines whose place does not matter, or that are not at the top, are not kept", () => {
		for (const [name, file, line] of [
			["a coding line on line 3", "/r/a.py", "# A script.\n# More.\n# -*- coding: utf-8 -*-"],
			["#cloud-config on line 2", "/r/a.yaml", "# user data\n#cloud-config"],
			["a yaml-language-server comment, which works anywhere", "/r/a.yaml", "# yaml-language-server: $schema=./schema.json"],
			["a Rust inner attribute", "/r/a.rs", "#![allow(dead_code)]"],
			["@charset in another form", "/r/a.css", "@charset 'UTF-8';"],
			["a coding line in YAML", "/r/a.yaml", "# -*- coding: utf-8 -*-"]
		]) {
			it(`${name}: the header goes on line 1`, () => {
				const next = header(file, "x");
				expect(replaceOrInsertHeader(`${line}\nrest\n`, next, file).nextContent).toBe(`${next}\n\n\n${line}\nrest\n`);
			});
		}

		it("keeps a shebang but not a coding line on line 3 after it", () => {
			const next = header("/r/a.py", "x");
			const content = "#!/usr/bin/env python3\n# A script.\n# -*- coding: utf-8 -*-\nprint(1)\n";
			expect(replaceOrInsertHeader(content, next, "/r/a.py").nextContent).toBe(
				`#!/usr/bin/env python3\n${next}\n\n\n# A script.\n# -*- coding: utf-8 -*-\nprint(1)\n`
			);
		});

		it("treats a yaml-language-server line at the top of a header comment as header text", () => {
			const content = "# yaml-language-server: $schema=./schema.json\n#\n#\t@Project: demo\n#\n\nkey: 1\n";
			expect(splitHeaderText(content, "/r/a.yaml")).toEqual({ foreign: ["# yaml-language-server: $schema=./schema.json"], copyrights: [] });
		});

		for (const prose of [
			"#\tDecoding: base64 helpers",
			"#\tUse it like vi: modal",
			"#\tvi: is the editor we use",
			"# vim: is great, ts=4",
			"# vim: set the record straight: twice",
			"# Vim: ts=4 sw=4",
			"# vim:"
		]) {
			it(`moves "${prose}" with the header text instead of keeping it above the header`, () => {
				const content = `${prose}\n#\n#\t@Project: demo\n#\n\nprint(1)\n`;
				expect(isModeline(prose)).toBe(false);
				expect(splitHeaderText(content, "/r/a.py")).toEqual({ foreign: [prose], copyrights: [] });
			});
		}
	});

	describe("a PHP file that does not open with <?php", () => {
		it("cannot carry a header, and is skipped with the reason", async () => {
			expect(getContentSkipReason("/r/a.php", "<?php\necho 1;\n")).toBeNull();
			expect(getContentSkipReason("/r/a.php", "\uFEFF<?PHP\necho 1;\n")).toBeNull();
			expect(getContentSkipReason("/r/a.mjs", "code();\n")).toBeNull();
			const workspace = await createWorkspace("header-top-lines-php");
			try {
				await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "top-lines" }, null, 2));
				const template = "<html><?= $title ?></html>\n";
				await writeWorkspaceFile(join(workspace, "src", "page.php"), template);
				await writeWorkspaceFile(join(workspace, "src", "code.php"), "<?php\necho 1;\n");
				const result = await fixHeaders({ cwd: workspace, input: "src", authorName: "A", authorEmail: "a@example.com" });
				expect(result.skipped).toEqual([
					{ file: join("src", "page.php"), reason: "the file does not start with <?php, so a comment at the top would be output as text" }
				]);
				expect(result.filesUpdated).toBe(1);
				expect(await readFile(join(workspace, "src", "page.php"), "utf8")).toBe(template);
				expect((await readFile(join(workspace, "src", "code.php"), "utf8")).startsWith("<?php\n/**\n")).toBe(true);
			} finally {
				await cleanupWorkspace(workspace);
			}
		});
	});
});
