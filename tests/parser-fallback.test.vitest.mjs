/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/parser-fallback.test.vitest.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it, vi } from "vitest";

/**
 * Loads parser module with a mocked syntax resolver result.
 * @param {{kind: "html" | "line" | "block", linePrefix?: string, blockStart?: string, blockEnd?: string}} syntax - Mocked syntax descriptor.
 * @returns {Promise<typeof import("../src/header/parser.mjs")>} Parser module.
 */
async function loadParserWithSyntax(syntax) {
	vi.resetModules();
	vi.doMock("../src/header/syntax.mjs", () => ({
		getHeaderSyntaxForFile() {
			return syntax;
		}
	}));

	return import("../src/header/parser.mjs");
}

describe("header parser fallback tokens", () => {
	it("uses default html block tokens when syntax omits delimiters", async () => {
		const parser = await loadParserWithSyntax({ kind: "html" });
		const content = "<!--\n\t@Project: demo\n-->\n\n<body></body>\n";
		expect(parser.findProjectHeader(content, "file.html")).toEqual({ start: 0, end: 26 });
	});

	it("uses default line prefix when syntax omits prefix", async () => {
		const parser = await loadParserWithSyntax({ kind: "line" });
		const content = "#\t@Project: demo\n\nprint('x')\n";
		expect(parser.findProjectHeader(content, "file.py")).toEqual({ start: 0, end: 18 });
	});

	it("uses default block delimiters when syntax omits delimiters", async () => {
		const parser = await loadParserWithSyntax({ kind: "block" });
		const content = "/**\n *\t@Project: demo\n */\n\nexport const x = 1;\n";
		expect(parser.findProjectHeader(content, "file.mjs")).toEqual({ start: 0, end: 27 });
	});
});
