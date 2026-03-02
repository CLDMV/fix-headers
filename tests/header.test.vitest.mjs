import { describe, expect, it } from "vitest";
import { buildHeader } from "../src/header/template.mjs";
import { findProjectHeader, replaceOrInsertHeader } from "../src/header/parser.mjs";

describe("header/template + parser", () => {
	it("builds canonical header", () => {
		const header = buildHeader({
			absoluteFilePath: "/repo/src/a.mjs",
			projectRoot: "/repo",
			projectName: "my-project",
			authorName: "Test Author",
			authorEmail: "test@example.com",
			createdAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1735689600 },
			lastModifiedAt: { date: "2026-01-02 00:00:00 +00:00", timestamp: 1735776000 },
			copyrightStartYear: 2013,
			companyName: "Catalyzed Motivation Inc.",
			currentYear: 2026
		});

		expect(header).toContain("@Project: my-project");
		expect(header).toContain("@Filename: /src/a.mjs");
		expect(header).toContain("Copyright (c) 2013-2026");
	});

	it("finds project header when present", () => {
		const content = `/**\n *\t@Project: x\n */\n\nexport const value = 1;\n`;
		const found = findProjectHeader(content);
		expect(found).toEqual({ start: 0, end: 24 });
	});

	it("returns null when no header or no project tag", () => {
		expect(findProjectHeader("export const value = 1;\n")).toBeNull();
		expect(findProjectHeader("/**\n * generic doc\n */\nconst value = 1;\n")).toBeNull();
	});

	it("inserts header when absent", () => {
		const content = "\n\nexport const value = 1;\n";
		const replacement = replaceOrInsertHeader(content, "/**\\n *\\t@Project: x\\n */");
		expect(replacement.changed).toBe(true);
		expect(replacement.nextContent.startsWith("/**")).toBe(true);
	});

	it("replaces header when present", () => {
		const content = `/**\n *\t@Project: old\n */\n\nexport const value = 1;\n`;
		const replacement = replaceOrInsertHeader(content, "/**\\n *\\t@Project: new\\n */");
		expect(replacement.changed).toBe(true);
		expect(replacement.nextContent).toContain("@Project: new");
		expect(replacement.nextContent).not.toContain("@Project: old");
	});

	it("builds html comment headers for html files", () => {
		const header = buildHeader({
			absoluteFilePath: "/repo/src/page.html",
			projectRoot: "/repo",
			projectName: "my-project",
			authorName: "Test Author",
			authorEmail: "test@example.com",
			createdAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1735689600 },
			lastModifiedAt: { date: "2026-01-02 00:00:00 +00:00", timestamp: 1735776000 },
			copyrightStartYear: 2013,
			companyName: "Catalyzed Motivation Inc.",
			currentYear: 2026
		});

		expect(header.startsWith("<!--")).toBe(true);
		expect(header).toContain("@Filename: /src/page.html");
		const replacement = replaceOrInsertHeader("<html></html>\n", header, "/repo/src/page.html");
		expect(replacement.nextContent.startsWith("<!--")).toBe(true);
	});

	it("builds hash comment headers for python files", () => {
		const header = buildHeader({
			absoluteFilePath: "/repo/src/app.py",
			projectRoot: "/repo",
			projectName: "my-project",
			authorName: "Test Author",
			authorEmail: "test@example.com",
			createdAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1735689600 },
			lastModifiedAt: { date: "2026-01-02 00:00:00 +00:00", timestamp: 1735776000 },
			copyrightStartYear: 2013,
			companyName: "Catalyzed Motivation Inc.",
			currentYear: 2026
		});

		expect(header.startsWith("#\t@Project:")).toBe(true);
		const found = findProjectHeader(`${header}\n\nprint('x')\n`, "/repo/src/app.py");
		expect(found).not.toBeNull();
	});

	it("applies detector block syntax overrides for node files", () => {
		const syntaxOptions = {
			detectorSyntaxOverrides: {
				node: {
					blockStart: "/*",
					blockLinePrefix: " * ",
					blockEnd: " */"
				}
			}
		};

		const header = buildHeader({
			absoluteFilePath: "/repo/src/a.mjs",
			syntaxOptions,
			projectRoot: "/repo",
			projectName: "my-project",
			authorName: "Test Author",
			authorEmail: "test@example.com",
			createdAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1735689600 },
			lastModifiedAt: { date: "2026-01-02 00:00:00 +00:00", timestamp: 1735776000 },
			copyrightStartYear: 2013,
			companyName: "Catalyzed Motivation Inc.",
			currentYear: 2026
		});

		expect(header.startsWith("/*\n")).toBe(true);
		const replacement = replaceOrInsertHeader("export const value = 1;\n", header, "/repo/src/a.mjs", syntaxOptions);
		expect(replacement.changed).toBe(true);
		expect(replacement.nextContent.startsWith("/*")).toBe(true);
	});

	it("applies detector line syntax overrides for python files", () => {
		const syntaxOptions = {
			detectorSyntaxOverrides: {
				python: {
					linePrefix: ";;"
				}
			}
		};

		const header = buildHeader({
			absoluteFilePath: "/repo/src/app.py",
			syntaxOptions,
			projectRoot: "/repo",
			projectName: "my-project",
			authorName: "Test Author",
			authorEmail: "test@example.com",
			createdAt: { date: "2026-01-01 00:00:00 +00:00", timestamp: 1735689600 },
			lastModifiedAt: { date: "2026-01-02 00:00:00 +00:00", timestamp: 1735776000 },
			copyrightStartYear: 2013,
			companyName: "Catalyzed Motivation Inc.",
			currentYear: 2026
		});

		expect(header.startsWith(";;\t@Project:")).toBe(true);
		expect(findProjectHeader(`${header}\n\nprint('x')\n`, "/repo/src/app.py", syntaxOptions)).not.toBeNull();
	});
});
