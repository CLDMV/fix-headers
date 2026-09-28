/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/header-fields.test.vitest.mjs
 *	@Date: 2026-09-28T09:14:18-07:00 (1790612058)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T09:14:18-07:00 (1790612058)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */

import { describe, expect, it } from "vitest";
import { compareHeaderFields, HEADER_FIELDS, parseHeaderFields } from "../src/header/fields.mjs";

const FULL_HEADER = [
	"/**",
	" *\t@Project: @scope/pkg",
	" *\t@Filename: /src/main.mjs",
	" *\t@Date: 2026-01-01 00:00:00 +00:00 (1767225600)",
	" *\t@Author: Jane Doe <ACME>",
	" *\t@Email: <jane@example.com>",
	" *\t-----",
	" *\t@Last modified by: John Roe (john@example.com)",
	" *\t@Last modified time: 2026-02-01 00:00:00 +00:00 (1769904000)",
	" *\t-----",
	" *\t@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.",
	" */"
].join("\n");

describe("parseHeaderFields", () => {
	it("parses every field of a rendered header", () => {
		expect(parseHeaderFields(FULL_HEADER)).toEqual({
			projectName: "@scope/pkg",
			filename: "/src/main.mjs",
			createdAt: "2026-01-01 00:00:00 +00:00 (1767225600)",
			authorName: "Jane Doe <ACME>",
			authorEmail: "jane@example.com",
			lastModifiedByName: "John Roe",
			lastModifiedByEmail: "john@example.com",
			lastModifiedAt: "2026-02-01 00:00:00 +00:00 (1769904000)",
			copyrightStartYear: "2013",
			copyrightEndYear: "2026",
			companyName: "Catalyzed Motivation Inc."
		});
	});

	it("parses line-comment headers", () => {
		const fields = parseHeaderFields("#\t@Project: py-pkg\n#\t@Copyright: Copyright (c) 2020-2021 ACME All rights reserved.");
		expect(fields.projectName).toBe("py-pkg");
		expect(fields.copyrightStartYear).toBe("2020");
		expect(fields.copyrightEndYear).toBe("2021");
		expect(fields.companyName).toBe("ACME");
	});

	it("returns null for every field of an empty header", () => {
		const fields = parseHeaderFields("");
		expect(Object.keys(fields)).toEqual([...HEADER_FIELDS]);
		expect(Object.values(fields).every((value) => value === null)).toBe(true);
	});

	it("treats an empty tag value as missing and keeps an unbracketed email as written", () => {
		const fields = parseHeaderFields(" *\t@Project:\n *\t@Email: plain@example.com");
		expect(fields.projectName).toBeNull();
		expect(fields.authorEmail).toBe("plain@example.com");
	});

	it("handles partial last-modified-by values", () => {
		expect(parseHeaderFields("@Last modified by: Only Name")).toMatchObject({ lastModifiedByName: "Only Name", lastModifiedByEmail: null });
		expect(parseHeaderFields("@Last modified by: (only@example.com)")).toMatchObject({
			lastModifiedByName: null,
			lastModifiedByEmail: "only@example.com"
		});
		expect(parseHeaderFields("@Last modified by: Name ()")).toMatchObject({ lastModifiedByName: "Name", lastModifiedByEmail: null });
	});

	it("handles single-year, company-less and unrecognised copyright notices", () => {
		expect(parseHeaderFields("@Copyright: Copyright (c) 2026 ACME All rights reserved.")).toMatchObject({
			copyrightStartYear: "2026",
			copyrightEndYear: null,
			companyName: "ACME"
		});
		expect(parseHeaderFields("@Copyright: Copyright (c) 2025-2026 All rights reserved.")).toMatchObject({
			copyrightStartYear: "2025",
			copyrightEndYear: "2026",
			companyName: null
		});
		expect(parseHeaderFields("@Copyright: (c) ACME")).toMatchObject({
			copyrightStartYear: null,
			copyrightEndYear: null,
			companyName: null
		});
	});
});

describe("compareHeaderFields", () => {
	it("returns no issues for identical headers", () => {
		expect(compareHeaderFields(FULL_HEADER, FULL_HEADER)).toEqual([]);
	});

	it("lists only the differing fields, in header order", () => {
		const next = FULL_HEADER.replace("@Project: @scope/pkg", "@Project: @scope/renamed")
			.replace("2013-2026 Catalyzed Motivation Inc.", "2013-2027 CLDMV")
			.replace("<jane@example.com>", "<jane@acme.test>");

		expect(compareHeaderFields(FULL_HEADER, next)).toEqual([
			{ field: "projectName", previous: "@scope/pkg", detected: "@scope/renamed" },
			{ field: "authorEmail", previous: "jane@example.com", detected: "jane@acme.test" },
			{ field: "copyrightEndYear", previous: "2026", detected: "2027" },
			{ field: "companyName", previous: "Catalyzed Motivation Inc.", detected: "CLDMV" }
		]);
	});

	it("reports every field as missing when there was no previous header", () => {
		const issues = compareHeaderFields(null, FULL_HEADER);
		expect(issues.map((issue) => issue.field)).toEqual([...HEADER_FIELDS]);
		expect(issues.every((issue) => issue.previous === null)).toBe(true);
		expect(issues[0].detected).toBe("@scope/pkg");
	});
});

describe("parseHeaderFields splitting edge cases", () => {
	/**
	 * Parses a header holding only the given last-modified-by and copyright values.
	 * @param {string} lastModifiedBy - Raw `@Last modified by` value.
	 * @param {string} copyright - Raw `@Copyright` value.
	 * @returns {ReturnType<typeof parseHeaderFields>} Parsed fields.
	 */
	function parse(lastModifiedBy, copyright) {
		return parseHeaderFields(` *\t@Last modified by: ${lastModifiedBy}\n *\t@Copyright: ${copyright}\n`);
	}

	it("takes the closing parenthesised group as the last-modified email", () => {
		expect(parse("Jane (Ops) (jane@example.com)", "x")).toMatchObject({
			lastModifiedByName: "Jane (Ops)",
			lastModifiedByEmail: "jane@example.com"
		});
		expect(parse("(jane@example.com)", "x")).toMatchObject({ lastModifiedByName: null, lastModifiedByEmail: "jane@example.com" });
		expect(parse("Jane ()", "x")).toMatchObject({ lastModifiedByName: "Jane", lastModifiedByEmail: null });
		expect(parse("Jane) x)", "x")).toMatchObject({ lastModifiedByName: "Jane) x)", lastModifiedByEmail: null });
		expect(parse("Jane Doe", "x")).toMatchObject({ lastModifiedByName: "Jane Doe", lastModifiedByEmail: null });
	});

	it("splits copyright notices with and without a year range or trailing period", () => {
		expect(parse("x", "Copyright (c) 2013 - 2026 ACME Inc. All rights reserved")).toMatchObject({
			copyrightStartYear: "2013",
			copyrightEndYear: "2026",
			companyName: "ACME Inc."
		});
		expect(parse("x", "copyright (C) 2020 all rights reserved.")).toMatchObject({
			copyrightStartYear: "2020",
			copyrightEndYear: null,
			companyName: null
		});
	});

	it("rejects copyright notices that do not fit the shape", () => {
		const none = { copyrightStartYear: null, copyrightEndYear: null, companyName: null };
		expect(parse("x", "Copyright (c) 20134 ACME All rights reserved.")).toMatchObject(none);
		expect(parse("x", "Copyright (c) 2013-20260 ACME All rights reserved.")).toMatchObject(none);
		expect(parse("x", "Copyright (c) 2013 ACME")).toMatchObject(none);
		expect(parse("x", "(c) 2013 ACME All rights reserved.")).toMatchObject(none);
	});

	it("parses adversarial values in linear time", () => {
		// Inputs that make a backtracking regex for these fields run for minutes (CodeQL js/polynomial-redos).
		const started = Date.now();
		const fields = parse(`(${"(".repeat(100000)}`, `Copyright (c) 2013${" ".repeat(100000)}x`);
		expect(Date.now() - started).toBeLessThan(2000);
		expect(fields).toMatchObject({ lastModifiedByEmail: null, copyrightStartYear: null });
	});
});
