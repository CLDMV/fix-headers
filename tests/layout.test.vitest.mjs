/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/layout.test.vitest.mjs
 *	@Date: 2026-09-29T01:20:00-07:00 (1790670000)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-29T01:20:00-07:00 (1790670000)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli.mjs";
import { DEFAULT_HEADER_MARGIN, DEFAULT_HEADER_SPACING, resolveLayoutCount } from "../src/constants.mjs";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { replaceOrInsertHeader } from "../src/header/parser.mjs";
import { getHeaderSyntaxForFile, renderHeaderLines } from "../src/header/syntax.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

const IDENTITY = {
	authorName: "Layout Tester",
	authorEmail: "layout@example.com",
	companyName: "Catalyzed Motivation Inc.",
	dryRun: false
};

describe("header layout: spacing and margin", () => {
	it("defaults to one empty comment line and a two line margin", () => {
		expect(DEFAULT_HEADER_SPACING).toBe(1);
		expect(DEFAULT_HEADER_MARGIN).toBe(2);
		expect(resolveLayoutCount(undefined, "spacing", 1)).toBe(1);
		expect(resolveLayoutCount(null, "margin", 2)).toBe(2);
		expect(resolveLayoutCount(0, "margin", 2)).toBe(0);
		expect(resolveLayoutCount(3, "spacing", 1)).toBe(3);
	});

	it("rejects negative, fractional and non-numeric counts", () => {
		for (const bad of [-1, 1.5, "2", Number.NaN, true]) {
			expect(() => resolveLayoutCount(bad, "spacing", 1)).toThrow(/spacing must be a whole number of 0 or more/);
		}
	});

	it("frames block headers with an empty comment line inside the delimiters", () => {
		expect(renderHeaderLines(getHeaderSyntaxForFile("a.mjs"), ["@Project: x"])).toBe("/**\n *\n *\t@Project: x\n *\n */");
		expect(renderHeaderLines(getHeaderSyntaxForFile("a.mjs", { spacing: 0 }), ["@Project: x"])).toBe("/**\n *\t@Project: x\n */");
		expect(renderHeaderLines(getHeaderSyntaxForFile("a.mjs", { spacing: 2 }), ["@Project: x"])).toBe(
			"/**\n *\n *\n *\t@Project: x\n *\n *\n */"
		);
	});

	it("frames line-comment headers with bare comment lines above and below", () => {
		expect(renderHeaderLines(getHeaderSyntaxForFile("a.py"), ["@Project: x"])).toBe("#\n#\t@Project: x\n#");
		expect(renderHeaderLines(getHeaderSyntaxForFile("a.py", { spacing: 0 }), ["@Project: x"])).toBe("#\t@Project: x");
		expect(renderHeaderLines(getHeaderSyntaxForFile("a.py", { spacing: 2 }), ["@Project: x"])).toBe("#\n#\n#\t@Project: x\n#\n#");
	});

	it("frames html headers inside the comment delimiters", () => {
		const html = renderHeaderLines(getHeaderSyntaxForFile("a.html"), ["@Project: x"]);
		const lines = html.split("\n");
		expect(lines[0]).toBe("<!--");
		expect(lines.at(-1)).toBe("-->");
		expect(lines).toHaveLength(5);
		expect(lines[1].trim()).toBe("");
		expect(lines[3].trim()).toBe("");
	});

	it("puts `margin` blank lines between the header and the body", () => {
		const header = "/**\n *\t@Project: x\n */";
		expect(replaceOrInsertHeader("export const a = 1;\n", header, "/r/a.mjs").nextContent).toBe(`${header}\n\n\nexport const a = 1;\n`);
		expect(replaceOrInsertHeader("export const a = 1;\n", header, "/r/a.mjs", { margin: 0 }).nextContent).toBe(
			`${header}\nexport const a = 1;\n`
		);
		expect(replaceOrInsertHeader("export const a = 1;\n", header, "/r/a.mjs", { margin: 1 }).nextContent).toBe(
			`${header}\n\nexport const a = 1;\n`
		);
		expect(replaceOrInsertHeader("export const a = 1;\n", header, "/r/a.mjs", { margin: 4 }).nextContent).toBe(
			`${header}\n\n\n\n\nexport const a = 1;\n`
		);
	});

	it("restyles an existing header in place, whatever layout it had", () => {
		const header = "/**\n *\n *\t@Project: new\n *\n */";
		const oldStyle = "/**\n *\t@Project: old\n */\n\nexport const a = 1;\n";
		const result = replaceOrInsertHeader(oldStyle, header, "/r/a.mjs");
		expect(result.changed).toBe(true);
		expect(result.nextContent).toBe(`${header}\n\n\nexport const a = 1;\n`);
		expect(replaceOrInsertHeader(result.nextContent, header, "/r/a.mjs").changed).toBe(false);
	});

	it("keeps at least one blank line after a line-comment header so the next comment stays separate", () => {
		const header = "#\n#\t@Project: x\n#";
		const body = "# a note about the code\nprint('x')\n";
		const zero = replaceOrInsertHeader(body, header, "/r/a.py", { margin: 0 }).nextContent;
		expect(zero).toBe(`${header}\n\n${body}`);
		expect(replaceOrInsertHeader(zero, header, "/r/a.py", { margin: 0 }).changed).toBe(false);
		expect(replaceOrInsertHeader(body, header, "/r/a.py").nextContent).toBe(`${header}\n\n\n${body}`);
	});

	it("keeps a shebang above the header and applies the margin below it", () => {
		const header = "#\n#\t@Project: x\n#";
		const result = replaceOrInsertHeader("#!/usr/bin/env python3\nprint('x')\n", header, "/r/a.py");
		expect(result.nextContent).toBe(`#!/usr/bin/env python3\n${header}\n\n\nprint('x')\n`);
	});

	it("rejects an invalid margin", () => {
		expect(() => replaceOrInsertHeader("x\n", "/**\n */", "/r/a.mjs", { margin: -1 })).toThrow(/margin must be a whole number/);
	});

	it("reads --spacing and --margin from the command line", () => {
		const parsed = parseCliArgs(["--spacing", "0", "--margin", "3"]);
		expect(parsed.options.spacing).toBe(0);
		expect(parsed.options.margin).toBe(3);
		expect(parseCliArgs([]).options.spacing).toBeUndefined();
	});

	it("applies the layout end to end and settles after one run, for each option value", async () => {
		const cases = [
			{
				options: {},
				expectedOpen: "/**\n *\n *\t@Project:",
				expectedClose: /All rights reserved\.\n \*\n \*\/\n\n\nexport const one = true;\n$/
			},
			{
				options: { spacing: 0, margin: 1 },
				expectedOpen: "/**\n *\t@Project:",
				expectedClose: /All rights reserved\.\n \*\/\n\nexport const one = true;\n$/
			},
			{
				options: { spacing: 2, margin: 0 },
				expectedOpen: "/**\n *\n *\n *\t@Project:",
				expectedClose: /All rights reserved\.\n \*\n \*\n \*\/\nexport const one = true;\n$/
			}
		];
		for (const { options, expectedOpen, expectedClose } of cases) {
			const workspace = await createWorkspace("layout-e2e");
			try {
				await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "layout-e2e" }, null, 2));
				await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
				const first = await fixHeaders({ cwd: workspace, input: "src/one.mjs", ...IDENTITY, ...options });
				expect(first.filesUpdated).toBe(1);
				const content = await readFile(join(workspace, "src", "one.mjs"), "utf8");
				expect(content.startsWith(expectedOpen)).toBe(true);
				expect(content).toMatch(expectedClose);
				const second = await fixHeaders({ cwd: workspace, input: "src/one.mjs", ...IDENTITY, ...options });
				expect(second.filesUpdated).toBe(0);
			} finally {
				await cleanupWorkspace(workspace);
			}
		}
	});

	it("rewrites a header written with a different layout when the option changes", async () => {
		const workspace = await createWorkspace("layout-restyle");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "layout-restyle" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
			await fixHeaders({ cwd: workspace, input: "src/one.mjs", ...IDENTITY, spacing: 0, margin: 1 });
			const flat = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			const restyled = await fixHeaders({ cwd: workspace, input: "src/one.mjs", ...IDENTITY });
			expect(restyled.filesUpdated).toBe(1);
			const framed = await readFile(join(workspace, "src", "one.mjs"), "utf8");
			expect(framed).not.toBe(flat);
			expect(framed.match(/@Project:/g)).toHaveLength(1);
			expect(framed.startsWith("/**\n *\n *\t@Project:")).toBe(true);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("rejects an invalid layout option before touching any file", async () => {
		const workspace = await createWorkspace("layout-invalid");
		try {
			await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "layout-invalid" }, null, 2));
			await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
			await expect(fixHeaders({ cwd: workspace, ...IDENTITY, spacing: -1 })).rejects.toThrow(/spacing must be a whole number/);
			await expect(fixHeaders({ cwd: workspace, ...IDENTITY, margin: 1.5 })).rejects.toThrow(/margin must be a whole number/);
			expect(await readFile(join(workspace, "src", "one.mjs"), "utf8")).toBe("export const one = true;\n");
		} finally {
			await cleanupWorkspace(workspace);
		}
	});
});
