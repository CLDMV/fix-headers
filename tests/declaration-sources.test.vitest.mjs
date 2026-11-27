/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: tests/declaration-sources.test.vitest.mjs
 *	@Date: 2026-11-27T12:45:35-08:00 (1795812335)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-11-27T12:45:42-08:00 (1795812342)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { join } from "node:path";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/core/fix-headers.mjs";
import { parseCliArgs } from "../src/cli.mjs";
import {
	createDeclarationSourceResolver,
	findDeclarationSource,
	parseJsonc,
	readDeclarationLayout
} from "../src/core/declaration-sources.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview A declaration `tsc` emitted without its source's header (it drops the header when
 * imports follow it) takes the source's header dates and author, found through the tsconfig (#214).
 */

const IDENTITY = {
	authorName: "Run Identity",
	authorEmail: "run@example.com",
	companyName: "Catalyzed Motivation Inc."
};

const PACKAGE_JSON = `${JSON.stringify({ name: "declaration-sources", version: "1.0.0" }, null, 2)}\n`;

const SOURCE_HEADER = [
	"/**",
	" *",
	" *\t@Project: declaration-sources",
	" *\t@Filename: src/x.mjs",
	" *\t@Date: 2026-01-01T00:00:00-08:00 (1767254400)",
	" *\t@Author: Source Author",
	" *\t@Email: <source@example.com>",
	" *\t-----",
	" *\t@Last modified by: Source Editor (editor@example.com)",
	" *\t@Last modified time: 2026-02-01T00:00:00-08:00 (1769932800)",
	" *\t-----",
	" *\t@Copyright: Copyright (c) 2026 Catalyzed Motivation Inc. All rights reserved.",
	" *",
	" */",
	""
].join("\n");

// What tsc emits for a source whose header is followed by imports: no header.
const HEADERLESS_DECLARATION = 'export function x(): number;\nimport { y } from "./y.mjs";\n';

const tag = (content, name) => new RegExp(`@${name}: (.*)`).exec(content)?.[1];

/**
 * Writes a workspace with a package, a source file with a header, and its headerless declaration.
 * @param {string} name - Workspace name.
 * @param {{ tsconfigPath?: string, tsconfig?: object | string }} [layout] - Where the tsconfig goes and what it holds.
 * @returns {Promise<string>} Workspace path.
 */
async function writeProject(name, { tsconfigPath = join(".configs", "tsconfig.json"), tsconfig } = {}) {
	const workspace = await createWorkspace(name);
	await writeWorkspaceFile(join(workspace, "package.json"), PACKAGE_JSON);
	await writeWorkspaceFile(
		join(workspace, "src", "x.mjs"),
		`${SOURCE_HEADER}\nimport { y } from "./y.mjs";\nexport function x() { return y; }\n`
	);
	await writeWorkspaceFile(join(workspace, "types", "src", "x.d.mts"), HEADERLESS_DECLARATION);
	const config = tsconfig ?? { compilerOptions: { rootDir: "..", outDir: "../types" } };
	await writeWorkspaceFile(join(workspace, tsconfigPath), typeof config === "string" ? config : JSON.stringify(config));
	return workspace;
}

describe("declaration sources from the tsconfig (#214)", () => {
	it("parses tsconfig JSON with comments and trailing commas", () => {
		expect(parseJsonc('{\n\t// a comment\n\t"a": "x//y", /* b */ "c": [1, 2,],\n}')).toEqual({ a: "x//y", c: [1, 2] });
		expect(parseJsonc('{"a": "q\\"/*"}')).toEqual({ a: 'q"/*' });
		expect(parseJsonc('{"a": ",}", "b": [",]",],}')).toEqual({ a: ",}", b: [",]"] });
		expect(() => parseJsonc('{"a": 1 /* unterminated')).toThrow(SyntaxError);
	});

	it("reads rootDir, outDir and declarationDir through extends, relative to the config that sets them", async () => {
		const workspace = await createWorkspace("declaration-sources-extends");
		try {
			await writeWorkspaceFile(
				join(workspace, "base", "tsconfig.json"),
				JSON.stringify({ compilerOptions: { rootDir: "../lib", outDir: "../out" } })
			);
			await writeWorkspaceFile(
				join(workspace, "mid.json"),
				JSON.stringify({ extends: "./base/tsconfig.json", compilerOptions: { declarationDir: "decl" } })
			);
			await writeWorkspaceFile(join(workspace, "tsconfig.json"), JSON.stringify({ extends: ["./mid"] }));
			expect(await readDeclarationLayout(join(workspace, "tsconfig.json"))).toEqual({
				rootDir: join(workspace, "lib"),
				outDir: join(workspace, "out"),
				declarationDir: join(workspace, "decl"),
				configDir: workspace
			});

			await writeWorkspaceFile(join(workspace, "loop-a.json"), JSON.stringify({ extends: "./loop-b.json" }));
			await writeWorkspaceFile(join(workspace, "loop-b.json"), JSON.stringify({ extends: "./loop-a.json" }));
			await expect(readDeclarationLayout(join(workspace, "loop-a.json"))).rejects.toThrow(/extends itself/);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("resolves a package extends through node resolution", async () => {
		const workspace = await createWorkspace("declaration-sources-package");
		try {
			await writeWorkspaceFile(
				join(workspace, "node_modules", "shared-tsconfig", "package.json"),
				JSON.stringify({ name: "shared-tsconfig", exports: { "./base.json": "./base.json" } })
			);
			await writeWorkspaceFile(
				join(workspace, "node_modules", "shared-tsconfig", "base.json"),
				JSON.stringify({ compilerOptions: { outDir: "dist" } })
			);
			await writeWorkspaceFile(join(workspace, "tsconfig.json"), JSON.stringify({ extends: "shared-tsconfig/base.json" }));
			const layout = await readDeclarationLayout(join(workspace, "tsconfig.json"));
			expect(layout.outDir).toBe(join(workspace, "node_modules", "shared-tsconfig", "dist"));
			expect(layout.rootDir).toBeNull();
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("maps a declaration to the first source extension that exists", async () => {
		const workspace = await createWorkspace("declaration-sources-map");
		try {
			await writeWorkspaceFile(join(workspace, "src", "a.mts"), "");
			await writeWorkspaceFile(join(workspace, "src", "a.mjs"), "");
			await writeWorkspaceFile(join(workspace, "src", "b.jsx"), "");
			await writeWorkspaceFile(join(workspace, "src", "c.cjs"), "");
			const layout = { rootDir: join(workspace, "src"), outDir: join(workspace, "types"), declarationDir: null, configDir: workspace };
			expect(await findDeclarationSource(join(workspace, "types", "a.d.mts"), layout)).toBe(join(workspace, "src", "a.mts"));
			expect(await findDeclarationSource(join(workspace, "types", "b.d.ts"), layout)).toBe(join(workspace, "src", "b.jsx"));
			expect(await findDeclarationSource(join(workspace, "types", "c.d.cts"), layout)).toBe(join(workspace, "src", "c.cjs"));
			expect(await findDeclarationSource(join(workspace, "types", "missing.d.mts"), layout)).toBeNull();
			// Outside the emit folder, not a declaration, or no emit folder at all.
			expect(await findDeclarationSource(join(workspace, "other", "a.d.mts"), layout)).toBeNull();
			expect(await findDeclarationSource(join(workspace, "types", "a.mts"), layout)).toBeNull();
			expect(await findDeclarationSource(join(workspace, "types", "a.d.mts"), { ...layout, outDir: null })).toBeNull();
			// declarationDir wins over outDir; without rootDir the tsconfig's folder is the root.
			const declLayout = {
				rootDir: null,
				outDir: join(workspace, "dist"),
				declarationDir: join(workspace, "types"),
				configDir: join(workspace, "src")
			};
			expect(await findDeclarationSource(join(workspace, "types", "a.d.mts"), declLayout)).toBe(join(workspace, "src", "a.mts"));
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("gives a headerless declaration its source's dates and author, naming the declaration, and stays stable", async () => {
		const workspace = await writeProject("declaration-sources-run");
		try {
			await fixHeaders({ cwd: workspace, input: "types", ...IDENTITY });
			const first = await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8");
			expect(tag(first, "Filename")).toBe("types/src/x.d.mts");
			expect(tag(first, "Project")).toBe("declaration-sources");
			expect(tag(first, "Date")).toBe("2026-01-01T00:00:00-08:00 (1767254400)");
			expect(tag(first, "Author")).toBe("Source Author");
			expect(tag(first, "Last modified by")).toBe("Source Editor (editor@example.com)");
			expect(tag(first, "Last modified time")).toBe("2026-02-01T00:00:00-08:00 (1769932800)");
			expect(first.endsWith(HEADERLESS_DECLARATION)).toBe(true);

			// tsc regenerates the declaration without a header; the result is the same.
			await writeWorkspaceFile(join(workspace, "types", "src", "x.d.mts"), HEADERLESS_DECLARATION);
			await fixHeaders({ cwd: workspace, input: "types", ...IDENTITY });
			expect(await readFile(join(workspace, "types", "src", "x.d.mts"), "utf8")).toBe(first);

			// And a run over the restamped file changes nothing.
			const again = await fixHeaders({ cwd: workspace, input: "types", ...IDENTITY });
			expect(again.changes.filter((change) => change.changed)).toEqual([]);
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("uses the tsconfig option and falls back to ./tsconfig.json", async () => {
		const named = await writeProject("declaration-sources-option", {
			tsconfigPath: join("build", "types.json"),
			tsconfig: { compilerOptions: { rootDir: "..", outDir: "../types" } }
		});
		const root = await writeProject("declaration-sources-root", {
			tsconfigPath: "tsconfig.json",
			tsconfig: '{ "compilerOptions": { "outDir": "types", }, }'
		});
		try {
			await fixHeaders({ cwd: named, input: "types", tsconfig: "build/types.json", ...IDENTITY });
			expect(tag(await readFile(join(named, "types", "src", "x.d.mts"), "utf8"), "Author")).toBe("Source Author");
			await fixHeaders({ cwd: root, input: "types", ...IDENTITY });
			expect(tag(await readFile(join(root, "types", "src", "x.d.mts"), "utf8"), "Author")).toBe("Source Author");
			await writeWorkspaceFile(join(root, "types", "src", "x.d.mts"), HEADERLESS_DECLARATION);
			await expect(fixHeaders({ cwd: root, input: "types", tsconfig: "nope.json", ...IDENTITY })).rejects.toThrow(
				/tsconfig not found: nope\.json/
			);
		} finally {
			await cleanupWorkspace(named);
			await cleanupWorkspace(root);
		}
	});

	it("stamps the declaration as new without a usable tsconfig or source header, or when declaration rewrites are off", async () => {
		const broken = await writeProject("declaration-sources-broken", { tsconfig: "{ not json" });
		const off = await writeProject("declaration-sources-off");
		const bare = await writeProject("declaration-sources-bare");
		try {
			// An unreadable default tsconfig is ignored.
			await fixHeaders({ cwd: broken, input: "types", ...IDENTITY });
			expect(tag(await readFile(join(broken, "types", "src", "x.d.mts"), "utf8"), "Author")).toBe("Run Identity");
			await fixHeaders({ cwd: off, input: "types", rewriteDeclarationCopies: false, ...IDENTITY });
			expect(tag(await readFile(join(off, "types", "src", "x.d.mts"), "utf8"), "Author")).toBe("Run Identity");
			await writeWorkspaceFile(join(bare, "src", "x.mjs"), "export function x() { return 1; }\n");
			await fixHeaders({ cwd: bare, input: "types", ...IDENTITY });
			expect(tag(await readFile(join(bare, "types", "src", "x.d.mts"), "utf8"), "Author")).toBe("Run Identity");
		} finally {
			await cleanupWorkspace(broken);
			await cleanupWorkspace(off);
			await cleanupWorkspace(bare);
		}
	});

	it("loads the tsconfig once per run and returns null with no tsconfig", async () => {
		const workspace = await createWorkspace("declaration-sources-none");
		try {
			const find = createDeclarationSourceResolver({ scanRoot: workspace });
			expect(await find(join(workspace, "types", "x.d.mts"))).toBeNull();
			expect(await find(join(workspace, "types", "y.d.mts"))).toBeNull();
		} finally {
			await cleanupWorkspace(workspace);
		}
	});

	it("parses --tsconfig", () => {
		expect(parseCliArgs(["--tsconfig", "build/types.json"]).options).toEqual({ tsconfig: "build/types.json" });
	});
});
