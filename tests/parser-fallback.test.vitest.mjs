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
