/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/cjs/entry.test.cjs
 *	@Date: 2026-10-03T10:28:39-07:00 (1791048519)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T15:37:24-07:00 (1793486244)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * CommonJS entry tests. These run under Node's own test runner (`node --test`), not Vitest:
 * Vitest loads files through its own module runner, so it cannot show whether a plain
 * `require()` of the package works the way it does for a CommonJS consumer.
 */
"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "../..");

test("require() returns the same fixHeaders function as import's default", async () => {
	const required = require("../../dist/index.cjs");
	const esm = await import("../../dist/index.mjs");

	assert.equal(required, esm.default);
	assert.equal(required, esm.fixHeaders);
	assert.equal(typeof required, "function");
});

test("require() fails with a clear message where Node.js has no require(esm)", () => {
	// --no-experimental-require-module turns require(esm) off, which is what Node.js
	// versions before 20.19 / 22.12 look like to the entry.
	const res = spawnSync(process.execPath, ["--no-experimental-require-module", "-e", "require('./dist/index.cjs')"], {
		cwd: repoRoot,
		encoding: "utf8"
	});

	assert.notEqual(res.status, 0);
	assert.match(res.stderr, /ERR_REQUIRE_ESM/);
	assert.match(res.stderr, /require\(\) needs Node\.js \^20\.19\.0 or >=22\.12\.0/);
	assert.match(res.stderr, /import\(\)/);
});

test("src/index.cjs loads from source and returns the ESM entry's default export", async () => {
	const required = require("../../src/index.cjs");
	const esm = await import("../../src/index.mjs");

	assert.equal(required, esm.default);
	assert.equal(required, esm.fixHeaders);
});

test("the fix-headers-dev condition routes require() and import() of the package to src/", async () => {
	// The suite runs with --conditions=fix-headers-dev (package.json "test:cjs"), so the
	// package's self-reference resolves through that branch of the "." export.
	assert.equal(require.resolve("@cldmv/fix-headers"), path.join(repoRoot, "src", "index.cjs"));
	assert.equal(require("@cldmv/fix-headers"), require("../../src/index.cjs"));
	const esm = await import("@cldmv/fix-headers");
	assert.equal(esm.default, (await import("../../src/index.mjs")).default);
});

test("the built API and CLI import ../devcheck.mjs instead of bundling it", () => {
	const fs = require("node:fs");
	for (const built of ["dist/index.mjs", "bin/fix-headers.mjs"]) {
		const source = fs.readFileSync(path.join(repoRoot, built), "utf8");
		assert.match(source, /["']\.\.\/devcheck\.mjs["']/, `${built} should load ../devcheck.mjs`);
		assert.doesNotMatch(source, /Development environment not properly configured/, `${built} should not inline devcheck`);
	}
});
