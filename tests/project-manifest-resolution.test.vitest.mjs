/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/project-manifest-resolution.test.vitest.mjs
 *	@Date: 2026-09-28T19:05:00-07:00 (1790647500)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:18-07:00 (1790969298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { execFile } from "node:child_process";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { fixHeaders } from "../src/fix-header.mjs";
import { cleanupWorkspace, createIsolatedWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview End-to-end checks that `@Project` comes from the manifest of the project a
 * file belongs to, whatever the file's type: every supported file type in a project of every
 * manifest kind, the nearest project folder winning, the per-folder driver order and per-field
 * fallback, nameless and malformed manifests, the no-manifest fallback, the `projectName`
 * override, and git history lookups running against the resolved project root.
 * @module fix-headers/tests/project-manifest-resolution
 */

const execFileAsync = promisify(execFile);

/** One source file per supported file type, keyed by its path under `src/`. */
const SOURCE_FILES = {
	"src/s.css": "a { color: red; }\n",
	"src/p.html": "<p>x</p>\n",
	"src/c.yml": "k: v\n",
	"src/d.yaml": "k: v\n",
	"src/j.jsonc": "{}\n",
	"src/m.mjs": "export const x = 1;\n",
	"src/t.ts": "export const t = 1;\n",
	"src/p.py": "x = 1\n",
	"src/i.php": "<?php echo 1;\n",
	"src/l.rs": "fn main() {}\n",
	"src/g.go": "package main\n"
};

/** A named manifest of every kind the drivers read, with the name it carries. */
const MANIFESTS = [
	{ file: "package.json", content: JSON.stringify({ name: "@scope/node-name" }), name: "@scope/node-name", driver: "node" },
	{ file: "pyproject.toml", content: '[project]\nname = "py-name"\n', name: "py-name", driver: "python" },
	{ file: "setup.cfg", content: "[metadata]\nname = cfg-name\n", name: "cfg-name", driver: "python" },
	{ file: "setup.py", content: 'from setuptools import setup\n\nsetup(name="setup-py-name")\n', name: "setup-py-name", driver: "python" },
	{ file: "composer.json", content: JSON.stringify({ name: "vendor/php-name" }), name: "vendor/php-name", driver: "php" },
	{ file: "Cargo.toml", content: '[package]\nname = "rust-name"\n', name: "rust-name", driver: "rust" },
	{ file: "go.mod", content: "module example.com/go-name\n\ngo 1.22\n", name: "example.com/go-name", driver: "go" }
];

/**
 * Writes files relative to a workspace.
 * @param {string} workspace - Workspace path.
 * @param {Record<string, string>} files - Relative path → content.
 * @returns {Promise<void>} Completion promise.
 */
async function writeFiles(workspace, files) {
	for (const [relativePath, content] of Object.entries(files)) {
		await writeWorkspaceFile(join(workspace, relativePath), content);
	}
}

/**
 * Runs a dry fixHeaders pass and returns, per changed file, the resolved detected values plus
 * the `@Project` (`header`) and `@Filename` (`filename`) the new header carries.
 * @param {string} workspace - Workspace path (the scan root).
 * @param {Record<string, unknown>} [options={}] - Extra fixHeaders options.
 * @returns {Promise<Record<string, Record<string, any>>>} File → detected values (+ `header`).
 */
async function resolveAll(workspace, options = {}) {
	const result = await fixHeaders({ cwd: workspace, includeFolders: ["src"], dryRun: true, sampleOutput: true, ...options });
	return Object.fromEntries(
		result.changes.map((change) => [
			change.file,
			{
				...change.sample?.detectedValues,
				header: change.sample?.newValue.match(/@Project: (.+)/)?.[1],
				filename: change.sample?.newValue.match(/@Filename: (.+)/)?.[1]
			}
		])
	);
}

/**
 * Maps every changed file to the `@Project` its new header carries.
 * @param {string} workspace - Workspace path (the scan root).
 * @param {Record<string, unknown>} [options={}] - Extra fixHeaders options.
 * @returns {Promise<Record<string, string | undefined>>} File → `@Project`.
 */
async function projectNames(workspace, options = {}) {
	const resolved = await resolveAll(workspace, options);
	return Object.fromEntries(Object.entries(resolved).map(([file, values]) => [file, values.header]));
}

/**
 * Builds the expected file → name map for every source file.
 * @param {string} name - Expected `@Project`.
 * @param {string[]} [files=Object.keys(SOURCE_FILES)] - Files to include.
 * @returns {Record<string, string>} Expected map.
 */
function allNamed(name, files = Object.keys(SOURCE_FILES)) {
	return Object.fromEntries(files.map((file) => [file, name]));
}

describe("every file type takes @Project from the project's manifest", () => {
	for (const manifest of MANIFESTS) {
		it(`${manifest.file} project: every file type gets its name`, async () => {
			const workspace = await createWorkspace(`manifest-${manifest.driver}`);
			try {
				await writeFiles(workspace, { [manifest.file]: manifest.content, ...SOURCE_FILES });

				const resolved = await resolveAll(workspace);
				expect(Object.fromEntries(Object.entries(resolved).map(([file, values]) => [file, values.header]))).toEqual(
					allNamed(manifest.name)
				);
				for (const values of Object.values(resolved)) {
					expect(values.projectName).toBe(manifest.name);
					expect(values.projectNameSource).toEqual({ from: "manifest", driver: manifest.driver, manifest: manifest.file, dir: workspace });
					expect(values.projectRoot).toBe(workspace);
					expect(values.marker).toBe(manifest.file);
				}
				// Comment syntax and the reported language stay per file type.
				expect(resolved["src/s.css"].language).toBe("css");
				expect(resolved["src/c.yml"].language).toBe("yaml");
				expect(resolved["src/p.py"].language).toBe("python");
			} finally {
				await cleanupWorkspace(workspace);
			}
		}, 30000);
	}

	it("a .py file in a folder with only package.json takes the package.json name", async () => {
		const workspace = await createWorkspace("manifest-py-in-node");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "node-host" }),
				"src/tool.py": "print(1)\n",
				// A requirements.txt names nothing and does not claim a folder.
				"src/requirements.txt": "requests\n"
			});
			expect(await projectNames(workspace)).toEqual({ "src/tool.py": "node-host" });
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});

describe("the nearest project folder wins", () => {
	it("a sub-project's manifest beats a farther one, whatever the file type", async () => {
		const workspace = await createWorkspace("manifest-nearest");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "outer" }),
				"src/a.css": "a {}\n",
				"src/inner/pyproject.toml": '[project]\nname = "inner-py"\n',
				"src/inner/deep/b.mjs": "export const b = 1;\n",
				"src/inner/c.yml": "k: v\n",
				"src/rust/Cargo.toml": '[package]\nname = "inner-rs"\n',
				"src/rust/src/d.css": "a {}\n"
			});
			const resolved = await resolveAll(workspace);
			expect(Object.fromEntries(Object.entries(resolved).map(([file, values]) => [file, values.header]))).toEqual({
				"src/a.css": "outer",
				"src/inner/deep/b.mjs": "inner-py",
				"src/inner/c.yml": "inner-py",
				"src/rust/src/d.css": "inner-rs"
			});
			expect(resolved["src/inner/deep/b.mjs"].projectRoot).toBe(join(workspace, "src", "inner"));
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});

describe("several manifests in one folder", () => {
	it("the file's own ecosystem wins; neutral files follow node, python, php, rust, go", async () => {
		const workspace = await createWorkspace("manifest-native");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "node-name" }),
				"pyproject.toml": '[project]\nname = "py-name"\n',
				"composer.json": JSON.stringify({ name: "vendor/php-name" }),
				"Cargo.toml": '[package]\nname = "rust-name"\n',
				"go.mod": "module example.com/go-name\n",
				...SOURCE_FILES
			});
			const resolved = await resolveAll(workspace);
			expect(Object.fromEntries(Object.entries(resolved).map(([file, values]) => [file, values.header]))).toEqual({
				...allNamed("node-name", ["src/s.css", "src/p.html", "src/c.yml", "src/d.yaml", "src/j.jsonc", "src/m.mjs", "src/t.ts"]),
				"src/p.py": "py-name",
				"src/i.php": "vendor/php-name",
				"src/l.rs": "rust-name",
				"src/g.go": "example.com/go-name"
			});
			expect(resolved["src/p.py"].projectNameSource.driver).toBe("python");
			expect(resolved["src/p.py"].marker).toBe("pyproject.toml");
			expect(resolved["src/s.css"].projectNameSource.driver).toBe("node");
			expect(resolved["src/s.css"].marker).toBe("package.json");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	for (const [label, files, expected] of [
		[
			"python before php, rust and go",
			{
				"pyproject.toml": '[project]\nname = "py-name"\n',
				"composer.json": '{"name":"v/php"}',
				"Cargo.toml": '[package]\nname = "rs"\n',
				"go.mod": "module g\n"
			},
			"py-name"
		],
		[
			"php before rust and go",
			{ "composer.json": '{"name":"v/php"}', "Cargo.toml": '[package]\nname = "rs"\n', "go.mod": "module g\n" },
			"v/php"
		],
		["rust before go", { "Cargo.toml": '[package]\nname = "rs"\n', "go.mod": "module g\n" }, "rs"]
	]) {
		it(`neutral files use the fixed order: ${label}`, async () => {
			const workspace = await createWorkspace("manifest-order");
			try {
				await writeFiles(workspace, { ...files, "src/s.css": "a {}\n", "src/c.yml": "k: v\n" });
				expect(await projectNames(workspace)).toEqual({ "src/s.css": expected, "src/c.yml": expected });
			} finally {
				await cleanupWorkspace(workspace);
			}
		}, 30000);
	}

	it("a field missing from the first manifest comes from the next one that has it", async () => {
		const workspace = await createWorkspace("manifest-field-fallback");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ private: true }),
				"pyproject.toml": '[project]\nname = "py-name"\n',
				"src/s.css": "a {}\n",
				"src/m.mjs": "export const x = 1;\n"
			});
			const resolved = await resolveAll(workspace);
			expect(resolved["src/s.css"].header).toBe("py-name");
			expect(resolved["src/m.mjs"].header).toBe("py-name");
			expect(resolved["src/m.mjs"].projectNameSource).toEqual({
				from: "manifest",
				driver: "python",
				manifest: "pyproject.toml",
				dir: workspace
			});
			// The marker names the root's first manifest in the file's order, not the name's source.
			expect(resolved["src/m.mjs"].marker).toBe("package.json");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("a .py file falls back to package.json when the Python manifests carry no name", async () => {
		const workspace = await createWorkspace("manifest-field-fallback-py");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "node-name" }),
				"pyproject.toml": "[tool.ruff]\nline-length = 100\n",
				"src/p.py": "x = 1\n"
			});
			expect(await projectNames(workspace)).toEqual({ "src/p.py": "node-name" });
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});

describe("nameless and malformed manifests, with the scan root at the project", () => {
	for (const [file, content] of [
		["package.json", "{ not json"],
		["package.json", JSON.stringify({ version: "1.0.0" })],
		["pyproject.toml", "[tool.black]\nline-length = 88\n"],
		["composer.json", "{ nope"],
		["Cargo.toml", "[workspace]\nmembers = []\n"],
		["go.mod", "go 1.22\n"]
	]) {
		it(`${file} without a usable name: the project folder name; a named manifest above the scan root is not used`, async () => {
			const workspace = await createWorkspace("manifest-nameless");
			try {
				await writeFiles(workspace, {
					"package.json": JSON.stringify({ name: "outer-must-not-win" }),
					[`proj/${file}`]: content,
					"proj/src/s.css": "a {}\n",
					"proj/src/m.mjs": "export const x = 1;\n"
				});
				const root = join(workspace, "proj");
				const resolved = await resolveAll(root);
				expect(resolved["src/s.css"].header).toBe("proj");
				expect(resolved["src/m.mjs"].header).toBe("proj");
				expect(resolved["src/s.css"].projectNameSource).toEqual({ from: "folder", dir: root });
				expect(resolved["src/s.css"].projectRoot).toBe(root);
				expect(resolved["src/s.css"].marker).toBe(file);
			} finally {
				await cleanupWorkspace(workspace);
			}
		}, 30000);
	}
});

describe("no manifest anywhere", () => {
	it("stops at the repository root and uses its folder name", async () => {
		const workspace = await createWorkspace("manifest-none-git");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "enclosing-project" }),
				"vendor/lib/src/s.css": "a {}\n",
				"vendor/lib/src/m.mjs": "export const x = 1;\n"
			});
			const repo = join(workspace, "vendor", "lib");
			await execFileAsync("git", ["init", "-q"], { cwd: repo });

			// Scanned from the enclosing project: the nested repository is a project of its own.
			const resolved = await resolveAll(workspace, { includeFolders: ["vendor"] });
			expect(resolved["vendor/lib/src/s.css"].header).toBe("lib");
			expect(resolved["vendor/lib/src/m.mjs"].header).toBe("lib");
			expect(resolved["vendor/lib/src/s.css"].projectRoot).toBe(repo);
			expect(resolved["vendor/lib/src/s.css"].marker).toBe(".git");
			expect(resolved["vendor/lib/src/s.css"].filename).toBe("/src/s.css");
			expect(resolved["vendor/lib/src/s.css"].projectNameSource).toEqual({ from: "folder", dir: repo });
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("outside any repository uses the file's own folder", async () => {
		const workspace = await createIsolatedWorkspace("manifest-none");
		try {
			await writeFiles(workspace, { "src/s.css": "a {}\n", "src/p.py": "x = 1\n" });
			const resolved = await resolveAll(workspace);
			expect(resolved["src/s.css"].header).toBe("src");
			expect(resolved["src/p.py"].header).toBe("src");
			expect(resolved["src/s.css"].projectRoot).toBe(join(workspace, "src"));
			expect(resolved["src/s.css"].filename).toBe("/s.css");
			expect(resolved["src/s.css"].marker).toBeNull();
			expect(resolved["src/s.css"].language).toBe("css");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});

describe("overrides and git history", () => {
	it("projectName overrides every manifest", async () => {
		const workspace = await createWorkspace("manifest-override");
		try {
			await writeFiles(workspace, { "pyproject.toml": '[project]\nname = "py-name"\n', ...SOURCE_FILES });
			const resolved = await resolveAll(workspace, { projectName: "@override/name" });
			for (const values of Object.values(resolved)) {
				expect(values.header).toBe("@override/name");
				expect(values.projectNameSource).toEqual({ from: "option" });
			}
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("git history of a file in a sub-project resolves from the sub-project's root", async () => {
		const workspace = await createWorkspace("manifest-git-subproject");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "monorepo" }),
				"packages/py/pyproject.toml": '[tool.poetry]\nname = "poetry-pkg"\n',
				"packages/py/src/s.css": "a {}\n"
			});
			const git = (args) => execFileAsync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: workspace });
			await git(["init", "-q"]);
			await git(["config", "user.name", "Manifest Tester"]);
			await git(["config", "user.email", "manifest@example.com"]);
			await git(["add", "."]);
			await git(["commit", "-q", "-m", "initial", "--date", "2001-02-03T04:05:06Z"]);

			const result = await fixHeaders({ cwd: workspace, includeFolders: ["packages"], dryRun: true, sampleOutput: true });
			const values = result.changes.find((change) => change.file === "packages/py/src/s.css")?.sample?.detectedValues;
			expect(values?.projectName).toBe("poetry-pkg");
			expect(values?.projectRoot).toBe(join(workspace, "packages", "py"));
			expect(values?.createdAtSource).toBe("git-created");
			expect(values?.createdAt.timestamp).toBe(Date.parse("2001-02-03T04:05:06Z") / 1000);
			expect(result.metadata.projectName).toBe("monorepo");
			expect(basename(result.metadata.projectRoot)).toBe(basename(workspace));
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});

/**
 * Initializes a git repository with a deterministic identity and one commit dated 2001.
 * @param {string} dir - Repository folder.
 * @returns {Promise<void>} Completion promise.
 */
async function commitAll(dir) {
	const git = (args) => execFileAsync("git", ["-c", "commit.gpgsign=false", ...args], { cwd: dir });
	await git(["init", "-q"]);
	await git(["config", "user.name", "Manifest Tester"]);
	await git(["config", "user.email", "manifest@example.com"]);
	await git(["add", "."]);
	await git(["commit", "-q", "-m", "initial", "--date", "2001-02-03T04:05:06Z"]);
}

describe("values missing from the nearest manifests climb to the scan root", () => {
	it("a nameless sub-package takes the repository's name; its root, @Filename and git lookups stay the sub-package", async () => {
		const workspace = await createWorkspace("manifest-climb-repo");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "@scope/repo-name" }),
				"packages/a/package.json": JSON.stringify({ private: true }),
				"packages/a/src/x.mjs": "export const x = 1;\n",
				"packages/a/src/y.css": "a {}\n"
			});
			await commitAll(workspace);

			const resolved = await resolveAll(workspace, { includeFolders: ["packages"] });
			const subPackage = join(workspace, "packages", "a");
			for (const file of ["packages/a/src/x.mjs", "packages/a/src/y.css"]) {
				expect(resolved[file].header).toBe("@scope/repo-name");
				expect(resolved[file].projectNameSource).toEqual({ from: "manifest", driver: "node", manifest: "package.json", dir: workspace });
				expect(resolved[file].projectRoot).toBe(subPackage);
				expect(resolved[file].marker).toBe("package.json");
				expect(resolved[file].createdAtSource).toBe("git-created");
				expect(resolved[file].createdAt.timestamp).toBe(Date.parse("2001-02-03T04:05:06Z") / 1000);
			}
			expect(resolved["packages/a/src/x.mjs"].filename).toBe("/src/x.mjs");
			expect(resolved["packages/a/src/y.css"].filename).toBe("/src/y.css");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("climbs across drivers: a nameless node folder under a named Python project takes the Python name", async () => {
		const workspace = await createWorkspace("manifest-climb-mixed");
		try {
			await writeFiles(workspace, {
				"pyproject.toml": '[project]\nname = "py-parent"\n',
				"web/package.json": JSON.stringify({ private: true }),
				"web/src/x.mjs": "export const x = 1;\n",
				"web/src/y.css": "a {}\n"
			});
			const resolved = await resolveAll(workspace, { includeFolders: ["web"] });
			for (const file of ["web/src/x.mjs", "web/src/y.css"]) {
				expect(resolved[file].header).toBe("py-parent");
				expect(resolved[file].projectNameSource).toEqual({
					from: "manifest",
					driver: "python",
					manifest: "pyproject.toml",
					dir: workspace
				});
				expect(resolved[file].projectRoot).toBe(join(workspace, "web"));
				expect(resolved[file].marker).toBe("package.json");
			}
			expect(resolved["web/src/x.mjs"].filename).toBe("/src/x.mjs");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("skips unclaimed folders on the way up and stops at the scan root", async () => {
		const workspace = await createWorkspace("manifest-climb-stop");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "above-scan-root" }),
				"scan/Cargo.toml": '[package]\nname = "scan-root-name"\n',
				"scan/mid/deeper/go.mod": "go 1.22\n",
				"scan/mid/deeper/src/g.go": "package main\n",
				"other/pyproject.toml": "[tool.black]\n",
				"other/src/p.py": "x = 1\n"
			});
			const scanned = await resolveAll(join(workspace, "scan"), { includeFolders: ["mid"] });
			expect(scanned["mid/deeper/src/g.go"].header).toBe("scan-root-name");
			expect(scanned["mid/deeper/src/g.go"].filename).toBe("/src/g.go");
			expect(scanned["mid/deeper/src/g.go"].projectNameSource.dir).toBe(join(workspace, "scan"));

			// Scanned from `other`: the named manifest above the scan root is not used.
			const other = await resolveAll(join(workspace, "other"));
			expect(other["src/p.py"].header).toBe("other");
			expect(other["src/p.py"].projectNameSource).toEqual({ from: "folder", dir: join(workspace, "other") });
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("does not climb out of a nested repository", async () => {
		const workspace = await createWorkspace("manifest-climb-git");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "enclosing-project" }),
				"vendor/lib/package.json": JSON.stringify({ private: true }),
				"vendor/lib/src/x.mjs": "export const x = 1;\n"
			});
			await execFileAsync("git", ["init", "-q"], { cwd: join(workspace, "vendor", "lib") });
			const resolved = await resolveAll(workspace, { includeFolders: ["vendor"] });
			expect(resolved["vendor/lib/src/x.mjs"].header).toBe("lib");
			expect(resolved["vendor/lib/src/x.mjs"].filename).toBe("/src/x.mjs");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});

describe("@Filename is relative to the nearest claimed folder", () => {
	it("a named sub-package: relative to the sub-package, not to the repository or the scan root", async () => {
		const workspace = await createWorkspace("manifest-filename-named");
		try {
			await writeFiles(workspace, {
				"package.json": JSON.stringify({ name: "repo" }),
				"packages/b/composer.json": JSON.stringify({ name: "vendor/b" }),
				"packages/b/src/x.mjs": "export const x = 1;\n",
				"packages/b/src/deep/y.php": "<?php echo 1;\n"
			});
			const resolved = await resolveAll(workspace, { includeFolders: ["packages"] });
			expect(resolved["packages/b/src/x.mjs"].header).toBe("vendor/b");
			expect(resolved["packages/b/src/x.mjs"].filename).toBe("/src/x.mjs");
			expect(resolved["packages/b/src/deep/y.php"].filename).toBe("/src/deep/y.php");
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);

	it("a run from a folder holding several repositories: relative to each file's own project", async () => {
		const workspace = await createWorkspace("manifest-filename-multi");
		try {
			await writeFiles(workspace, {
				"one/package.json": JSON.stringify({ name: "repo-one" }),
				"one/src/a.mjs": "export const a = 1;\n",
				"two/pyproject.toml": '[project]\nname = "repo-two"\n',
				"two/pkg/b.py": "x = 1\n",
				"two/pkg/c.yml": "k: v\n"
			});
			const resolved = await resolveAll(workspace, { includeFolders: ["one", "two"] });
			expect(resolved["one/src/a.mjs"]).toMatchObject({ header: "repo-one", filename: "/src/a.mjs", projectRoot: join(workspace, "one") });
			expect(resolved["two/pkg/b.py"]).toMatchObject({ header: "repo-two", filename: "/pkg/b.py", projectRoot: join(workspace, "two") });
			expect(resolved["two/pkg/c.yml"]).toMatchObject({ header: "repo-two", filename: "/pkg/c.yml" });
		} finally {
			await cleanupWorkspace(workspace);
		}
	}, 30000);
});
