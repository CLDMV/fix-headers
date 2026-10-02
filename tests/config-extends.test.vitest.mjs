/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/config-extends.test.vitest.mjs
 *	@Date: 2026-09-28T21:19:05-07:00 (1790655545)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:17-07:00 (1790969297)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

import { createServer } from "node:http";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { applyConfigFile, runCli } from "../src/cli.mjs";
import { fixHeaders as coreFixHeaders } from "../src/core/fix-headers.mjs";
import { cleanupWorkspace, createWorkspace, writeWorkspaceFile } from "./helpers/workspace.mjs";

/**
 * @fileoverview `extends` in config files: https URLs (fetched every run), npm package
 * paths, and relative/absolute file paths, through both the CLI `--config` and the API
 * `configFile`. URL cases use a local HTTP server bound to 127.0.0.1 — no internet.
 * @module fix-headers/tests/config-extends
 */

const TIMEOUT = 30_000;

/** @type {Map<string, { status?: number, body: string }>} */
const routes = new Map();
/** @type {string[]} */
const requests = [];
/** @type {import("node:http").Server} */
let server;
let origin = "";

beforeAll(async () => {
	server = createServer((request, response) => {
		requests.push(request.url);
		const route = routes.get(request.url);
		if (!route) {
			response.writeHead(404, { "content-type": "text/plain" });
			response.end("not found");
			return;
		}
		response.writeHead(route.status ?? 200, { "content-type": "application/json" });
		response.end(route.body);
	});
	await new Promise((done) => server.listen(0, "127.0.0.1", done));
	origin = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
	server.closeAllConnections();
	await new Promise((done) => server.close(done));
});

beforeEach(() => {
	routes.clear();
	requests.length = 0;
});

/**
 * Serves a JSON value (or raw text) at a path on the test server.
 * @param {string} path - Request path, e.g. `/base.json`.
 * @param {unknown} body - Value to serialize, or a raw string.
 * @param {number} [status=200] - Response status.
 * @returns {string} Absolute URL of the route.
 */
function serve(path, body, status = 200) {
	routes.set(path, { status, body: typeof body === "string" ? body : JSON.stringify(body) });
	return `${origin}${path}`;
}

/**
 * Writes a JSON file into a workspace.
 * @param {string} filePath - Absolute file path.
 * @param {unknown} value - JSON value.
 * @returns {Promise<string>} The file path.
 */
async function writeJson(filePath, value) {
	await writeWorkspaceFile(filePath, JSON.stringify(value, null, 2));
	return filePath;
}

/**
 * Runs `callback` with a fresh workspace and always removes it afterwards.
 * @param {string} name - Workspace name.
 * @param {(workspace: string) => Promise<void>} callback - Test body.
 * @returns {Promise<void>} Completion promise.
 */
async function withWorkspace(name, callback) {
	const workspace = await createWorkspace(name);
	try {
		await callback(workspace);
	} finally {
		await cleanupWorkspace(workspace);
	}
}

/**
 * Loads a config through the CLI helper, the way `--config` does.
 * @param {string} workspace - Workspace used as `cwd`.
 * @param {string} config - Config path.
 * @param {Record<string, unknown>} [options={}] - Direct CLI options.
 * @returns {Promise<Record<string, unknown>>} Effective options.
 */
function loadViaCli(workspace, config, options = {}) {
	return applyConfigFile({ cwd: workspace, config, ...options });
}

describe("config extends: URLs", () => {
	it(
		"extends a config served over HTTP",
		async () => {
			await withWorkspace("extends-url", async (workspace) => {
				const url = serve("/base.json", { companyName: "Remote Co", excludeFolders: ["vendor"] });
				await writeJson(join(workspace, "fix-headers.json"), { extends: url, projectName: "local" });

				const merged = await loadViaCli(workspace, "fix-headers.json");
				expect(merged).toEqual({ cwd: workspace, companyName: "Remote Co", excludeFolders: ["vendor"], projectName: "local" });
				expect(Object.hasOwn(merged, "extends")).toBe(false);
			});
		},
		TIMEOUT
	);

	it(
		"fails the run on a non-2xx response",
		async () => {
			await withWorkspace("extends-url-404", async (workspace) => {
				await writeJson(join(workspace, "fix-headers.json"), { extends: `${origin}/missing.json` });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(
					`Failed to fetch config ${origin}/missing.json: HTTP 404 Not Found`
				);
			});
		},
		TIMEOUT
	);

	it(
		"fails the run when the response is not valid JSON",
		async () => {
			await withWorkspace("extends-url-json", async (workspace) => {
				const url = serve("/broken.json", "{ not json");
				await writeJson(join(workspace, "fix-headers.json"), { extends: url });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(`Config ${url} is not valid JSON:`);
			});
		},
		TIMEOUT
	);

	it(
		"fails the run when the server cannot be reached",
		async () => {
			const unreachable = createServer();
			await new Promise((done) => unreachable.listen(0, "127.0.0.1", done));
			const url = `http://127.0.0.1:${unreachable.address().port}/gone.json`;
			await new Promise((done) => unreachable.close(done));

			await withWorkspace("extends-url-down", async (workspace) => {
				await writeJson(join(workspace, "fix-headers.json"), { extends: url });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(`Failed to fetch config ${url}:`);
			});
		},
		TIMEOUT
	);

	it(
		"fails the run when the URL cannot be requested",
		async () => {
			await withWorkspace("extends-url-credentials", async (workspace) => {
				const url = `http://user:secret@127.0.0.1:${server.address().port}/private.json`;
				await writeJson(join(workspace, "fix-headers.json"), { extends: url });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(
					/Failed to fetch config http:\/\/user:secret@127\.0\.0\.1:\d+\/private\.json: .*credentials/
				);
				expect(requests).toEqual([]);
			});
		},
		TIMEOUT
	);

	it(
		"resolves relative extends inside a fetched config against its URL",
		async () => {
			serve("/shared/root.json", { companyName: "Root", language: "node", marker: "root" });
			serve("/shared/team/sibling.json", { language: "python" });
			serve("/top.json", { marker: "top" });
			const child = serve("/shared/team/child.json", {
				extends: ["../root.json", "./sibling.json", "/top.json"],
				projectName: "child"
			});

			await withWorkspace("extends-url-chain", async (workspace) => {
				await writeJson(join(workspace, "fix-headers.json"), { extends: child });
				const merged = await loadViaCli(workspace, "fix-headers.json");
				expect(merged).toMatchObject({ companyName: "Root", language: "python", marker: "top", projectName: "child" });
				expect(requests).toEqual(["/shared/team/child.json", "/shared/root.json", "/shared/team/sibling.json", "/top.json"]);
			});
		},
		TIMEOUT
	);

	it(
		"fetches on every run with no cache",
		async () => {
			await withWorkspace("extends-url-nocache", async (workspace) => {
				const url = serve("/live.json", { companyName: "First" });
				await writeJson(join(workspace, "fix-headers.json"), { extends: url });

				expect((await loadViaCli(workspace, "fix-headers.json")).companyName).toBe("First");
				serve("/live.json", { companyName: "Second" });
				expect((await loadViaCli(workspace, "fix-headers.json")).companyName).toBe("Second");
				expect(requests).toEqual(["/live.json", "/live.json"]);
			});
		},
		TIMEOUT
	);

	it(
		"refuses plain http to a non-loopback host and unsupported URL schemes",
		async () => {
			await withWorkspace("extends-url-scheme", async (workspace) => {
				await writeJson(join(workspace, "insecure.json"), { extends: "http://example.com/fix-headers.json" });
				await expect(loadViaCli(workspace, "insecure.json")).rejects.toThrow(
					"Refusing to fetch config over plain http: http://example.com/fix-headers.json (use https)"
				);

				await writeJson(join(workspace, "ftp.json"), { extends: "ftp://example.com/fix-headers.json" });
				await expect(loadViaCli(workspace, "ftp.json")).rejects.toThrow('Unsupported extends URL "ftp://example.com/fix-headers.json"');
			});
		},
		TIMEOUT
	);

	it(
		"rejects a package reference inside a fetched config",
		async () => {
			const url = serve("/pkg.json", { extends: "@cldmv/configs/fix-headers.json" });
			await withWorkspace("extends-url-package", async (workspace) => {
				await writeJson(join(workspace, "fix-headers.json"), { extends: url });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(
					`Cannot extend package "@cldmv/configs/fix-headers.json" from the remote config ${url}; use a URL or a relative path`
				);
			});
		},
		TIMEOUT
	);
});

describe("config extends: npm packages", () => {
	it(
		"resolves a package subpath through its exports map",
		async () => {
			await withWorkspace("extends-pkg-exports", async (workspace) => {
				const pkg = join(workspace, "node_modules", "@acme", "configs");
				await writeJson(join(pkg, "package.json"), {
					name: "@acme/configs",
					exports: { "./fix-headers.json": "./dist/fix-headers.json" }
				});
				await writeJson(join(pkg, "dist", "fix-headers.json"), { extends: "./base.json", companyName: "Acme" });
				await writeJson(join(pkg, "dist", "base.json"), { companyName: "Base", language: "node" });
				await writeJson(join(workspace, ".configs", "fix-headers.json"), {
					extends: "@acme/configs/fix-headers.json",
					projectName: "repo"
				});

				const merged = await loadViaCli(workspace, ".configs/fix-headers.json");
				expect(merged).toMatchObject({ companyName: "Acme", language: "node", projectName: "repo" });
			});
		},
		TIMEOUT
	);

	it(
		"honours exports: a subpath the package does not export cannot be extended",
		async () => {
			await withWorkspace("extends-pkg-unexported", async (workspace) => {
				const pkg = join(workspace, "node_modules", "@acme", "configs");
				await writeJson(join(pkg, "package.json"), { name: "@acme/configs", exports: { "./public.json": "./public.json" } });
				await writeJson(join(pkg, "secret.json"), { companyName: "Hidden" });
				await writeJson(join(workspace, "fix-headers.json"), { extends: "@acme/configs/secret.json" });

				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(
					/Cannot resolve extends "@acme\/configs\/secret\.json" from .*fix-headers\.json: Package subpath '\.\/secret\.json' is not defined by "exports"/
				);
			});
		},
		TIMEOUT
	);

	it(
		"resolves a package without an exports map by file path",
		async () => {
			await withWorkspace("extends-pkg-plain", async (workspace) => {
				const pkg = join(workspace, "node_modules", "plain-configs");
				await writeJson(join(pkg, "package.json"), { name: "plain-configs" });
				await writeJson(join(pkg, "fix-headers.json"), { companyName: "Plain" });
				await writeJson(join(workspace, "fix-headers.json"), { extends: "plain-configs/fix-headers.json" });

				expect((await loadViaCli(workspace, "fix-headers.json")).companyName).toBe("Plain");
			});
		},
		TIMEOUT
	);

	it(
		"reports a package that is not installed",
		async () => {
			await withWorkspace("extends-pkg-missing", async (workspace) => {
				await writeJson(join(workspace, "fix-headers.json"), { extends: "fix-headers-missing-configs-pkg/fix-headers.json" });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(
					/Cannot resolve extends "fix-headers-missing-configs-pkg\/fix-headers\.json" from .*fix-headers\.json/
				);
			});
		},
		TIMEOUT
	);
});

describe("config extends: files and merge rules", () => {
	it(
		"applies relative and absolute paths in array order, then the file's own settings",
		async () => {
			await withWorkspace("extends-files", async (workspace) => {
				await writeJson(join(workspace, "shared", "first.json"), { companyName: "First", language: "node", marker: "first" });
				const second = await writeJson(join(workspace, "elsewhere", "second.json"), { language: "python", marker: "second" });
				await writeJson(join(workspace, ".configs", "fix-headers.json"), {
					extends: ["../shared/first.json", second],
					marker: "own"
				});

				const merged = await loadViaCli(workspace, ".configs/fix-headers.json");
				expect(merged).toMatchObject({ companyName: "First", language: "python", marker: "own" });
			});
		},
		TIMEOUT
	);

	it(
		"merges plain objects key by key while arrays and scalars replace",
		async () => {
			await withWorkspace("extends-merge", async (workspace) => {
				await writeJson(join(workspace, "base.json"), {
					includeFolders: ["src", "lib"],
					dryRun: true,
					detectorSyntaxOverrides: {
						node: { blockStart: "/**", blockLinePrefix: " *\t", blockEnd: " */" },
						python: { linePrefix: "#" }
					}
				});
				await writeJson(join(workspace, "fix-headers.json"), {
					extends: "./base.json",
					includeFolders: ["app"],
					dryRun: false,
					detectorSyntaxOverrides: { node: { blockStart: "/*" } }
				});

				const merged = await loadViaCli(workspace, "fix-headers.json");
				expect(merged.includeFolders).toEqual(["app"]);
				expect(merged.dryRun).toBe(false);
				expect(merged.detectorSyntaxOverrides).toEqual({
					node: { blockStart: "/*", blockLinePrefix: " *\t", blockEnd: " */" },
					python: { linePrefix: "#" }
				});
			});
		},
		TIMEOUT
	);

	it(
		"ignores __proto__ keys instead of changing prototypes",
		async () => {
			await withWorkspace("extends-proto", async (workspace) => {
				await writeWorkspaceFile(join(workspace, "base.json"), '{ "__proto__": { "polluted": true }, "companyName": "Base" }');
				await writeWorkspaceFile(join(workspace, "fix-headers.json"), '{ "extends": "./base.json", "__proto__": { "polluted": true } }');

				const merged = await loadViaCli(workspace, "fix-headers.json");
				expect(merged.companyName).toBe("Base");
				expect(merged.polluted).toBeUndefined();
				expect(Object.getPrototypeOf(merged)).toBe(Object.prototype);
			});
		},
		TIMEOUT
	);

	it(
		"lets CLI and API options win over everything from files",
		async () => {
			await withWorkspace("extends-precedence", async (workspace) => {
				const url = serve("/company.json", { companyName: "Remote", authorName: "Remote Author" });
				await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "extends-precedence" }));
				await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
				await writeJson(join(workspace, "fix-headers.json"), {
					extends: url,
					input: "src/one.mjs",
					projectName: "from-file",
					authorName: "File Author"
				});

				const cli = await loadViaCli(workspace, "fix-headers.json", { companyName: "Cli Co" });
				expect(cli).toMatchObject({ companyName: "Cli Co", projectName: "from-file", authorName: "File Author" });

				const result = await coreFixHeaders({
					cwd: workspace,
					configFile: "fix-headers.json",
					companyName: "Api Co",
					dryRun: true
				});
				expect(result.filesScanned).toBe(1);
				expect(result.metadata).toMatchObject({ companyName: "Api Co", projectName: "from-file", authorName: "File Author" });
			});
		},
		TIMEOUT
	);

	it(
		"errors on an extends cycle",
		async () => {
			await withWorkspace("extends-cycle", async (workspace) => {
				await writeJson(join(workspace, "a.json"), { extends: "./b.json" });
				await writeJson(join(workspace, "b.json"), { extends: ["./c.json", "./a.json"] });
				await writeJson(join(workspace, "c.json"), { companyName: "C" });
				await expect(loadViaCli(workspace, "a.json")).rejects.toThrow(
					`Config extends cycle: ${join(workspace, "a.json")} -> ${join(workspace, "b.json")} -> ${join(workspace, "a.json")}`
				);

				await writeJson(join(workspace, "self.json"), { extends: "./self.json" });
				await expect(loadViaCli(workspace, "self.json")).rejects.toThrow("Config extends cycle:");
			});
		},
		TIMEOUT
	);

	it(
		"allows the same config to be extended twice without a cycle",
		async () => {
			await withWorkspace("extends-diamond", async (workspace) => {
				await writeJson(join(workspace, "common.json"), { companyName: "Common" });
				await writeJson(join(workspace, "left.json"), { extends: "./common.json", language: "node" });
				await writeJson(join(workspace, "right.json"), { extends: "./common.json", marker: "right" });
				await writeJson(join(workspace, "fix-headers.json"), { extends: ["./left.json", "./right.json"] });

				expect(await loadViaCli(workspace, "fix-headers.json")).toMatchObject({ companyName: "Common", language: "node", marker: "right" });
			});
		},
		TIMEOUT
	);

	it(
		"rejects an extends value that is not a string or an array of strings",
		async () => {
			await withWorkspace("extends-invalid", async (workspace) => {
				await writeJson(join(workspace, "number.json"), { extends: 5 });
				await expect(loadViaCli(workspace, "number.json")).rejects.toThrow(
					`Config "extends" must be a string or an array of strings: ${join(workspace, "number.json")}`
				);

				await writeJson(join(workspace, "mixed.json"), { extends: ["./ok.json", ""] });
				await expect(loadViaCli(workspace, "mixed.json")).rejects.toThrow('Config "extends" must be a string or an array of strings');
			});
		},
		TIMEOUT
	);

	it(
		"reports invalid JSON and non-object configs with their location",
		async () => {
			await withWorkspace("extends-bad-json", async (workspace) => {
				await writeWorkspaceFile(join(workspace, "broken.json"), "{ nope");
				await writeJson(join(workspace, "fix-headers.json"), { extends: "./broken.json" });
				await expect(loadViaCli(workspace, "fix-headers.json")).rejects.toThrow(
					`Config ${join(workspace, "broken.json")} is not valid JSON:`
				);

				await writeJson(join(workspace, "list.json"), ["not", "an", "object"]);
				await writeJson(join(workspace, "outer.json"), { extends: "./list.json" });
				await expect(loadViaCli(workspace, "outer.json")).rejects.toThrow(
					`Config file must contain a JSON object: ${join(workspace, "list.json")}`
				);
			});
		},
		TIMEOUT
	);
});

describe("config extends: entry points", () => {
	it(
		"works through the CLI --config flag",
		async () => {
			await withWorkspace("extends-cli-flag", async (workspace) => {
				const url = serve("/cli.json", { companyName: "Remote", excludeFolders: ["vendor"] });
				await writeJson(join(workspace, ".configs", "fix-headers.json"), { extends: url, projectName: "cli-project" });

				/** @type {Record<string, unknown>[]} */
				const calls = [];
				const code = await runCli(["--cwd", workspace, "--config", ".configs/fix-headers.json", "--company-name", "Flag Co"], {
					runner: async (options) => {
						calls.push(options);
						return { filesScanned: 0, filesUpdated: 0 };
					},
					stdout: () => {},
					stderr: () => {}
				});

				expect(code).toBe(0);
				expect(calls).toEqual([{ cwd: workspace, companyName: "Flag Co", excludeFolders: ["vendor"], projectName: "cli-project" }]);
			});
		},
		TIMEOUT
	);

	it(
		"fails the CLI run clearly when an extended URL fails",
		async () => {
			await withWorkspace("extends-cli-fail", async (workspace) => {
				await writeJson(join(workspace, "fix-headers.json"), { extends: `${origin}/nope.json` });
				const stderr = [];
				const code = await runCli(["--cwd", workspace, "--config", "fix-headers.json"], {
					runner: async () => ({}),
					stdout: () => {},
					stderr: (message) => stderr.push(message)
				});

				expect(code).toBe(1);
				expect(stderr).toEqual([`fix-headers failed: Failed to fetch config ${origin}/nope.json: HTTP 404 Not Found`]);
			});
		},
		TIMEOUT
	);

	it(
		"works through the API configFile option",
		async () => {
			await withWorkspace("extends-api", async (workspace) => {
				const url = serve("/api.json", { companyName: "Remote API Co", authorName: "Shared Author" });
				await writeWorkspaceFile(join(workspace, "package.json"), JSON.stringify({ name: "extends-api" }));
				await writeWorkspaceFile(join(workspace, "src", "one.mjs"), "export const one = true;\n");
				await writeJson(join(workspace, "local.json"), { projectName: "api-project" });
				await writeJson(join(workspace, ".configs", "fix-headers.json"), { extends: [url, "../local.json"], input: "src/one.mjs" });

				const result = await coreFixHeaders({ cwd: workspace, configFile: ".configs/fix-headers.json", dryRun: true });
				expect(result.filesScanned).toBe(1);
				expect(result.metadata).toMatchObject({ companyName: "Remote API Co", authorName: "Shared Author", projectName: "api-project" });
			});
		},
		TIMEOUT
	);
});
