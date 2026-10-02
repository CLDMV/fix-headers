/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /tests/helpers/signing-key.mjs
 *	@Date: 2026-09-28T16:54:43-07:00 (1790639683)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-02T12:28:18-07:00 (1790969298)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview The user ID of the OpenPGP key the machine running the tests signs commits
 * with, derived once per test run.
 *
 * The suite isolates every test from the machine's global git config (see
 * .configs/vitest.config.mjs), so unit tests use stand-in gpg output. This value lets one
 * environment test check the real lookup end to end against the real git config and the
 * real gpg. It is derived straight from git and gpg, without the code under test, before
 * the isolation applies: once in tests/run-vitest.mjs for a normal run (every per-file
 * vitest process inherits it), or in the vitest global setup when vitest is started
 * directly. `null` means the machine has no usable OpenPGP signing key (CI, for example),
 * and the environment test is skipped.
 * @module fix-headers/tests/helpers/signing-key
 */

import { execFileSync } from "node:child_process";

/** Environment variable carrying the derived value as JSON (a string, or `null`). */
export const SIGNING_KEY_UID_ENV = "FIX_HEADERS_TEST_SIGNING_KEY_UID";

/**
 * Runs a command and returns trimmed stdout, or null when it fails or prints nothing.
 * @param {string} program - Executable.
 * @param {string[]} args - Arguments.
 * @returns {string | null} Trimmed stdout.
 */
function run(program, args) {
	try {
		const output = execFileSync(program, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
		return output.length > 0 ? output : null;
	} catch {
		return null;
	}
}

/**
 * Derives the signing key's first valid user ID from the machine's git and gpg setup.
 * @returns {string | null} The user ID, or null when there is no usable OpenPGP signing key.
 */
function deriveSigningKeyUid() {
	const format = run("git", ["config", "--get", "gpg.format"]);
	const key = run("git", ["config", "--get", "user.signingkey"]);
	if ((format !== null && format !== "openpgp") || key === null) {
		return null;
	}
	const program = run("git", ["config", "--get", "gpg.openpgp.program"]) ?? run("git", ["config", "--get", "gpg.program"]) ?? "gpg";
	const listing = run(program, ["--batch", "--with-colons", "--list-keys", key]);
	const uid = listing
		?.split("\n")
		.map((line) => line.split(":"))
		.find((fields) => fields[0] === "uid" && fields[1] !== "r" && fields[1] !== "e" && fields[9]);
	return uid ? uid[9].replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) => String.fromCharCode(Number.parseInt(hex, 16))) : null;
}

/**
 * Makes sure the derived value is in the environment, deriving it only if nothing
 * earlier in this test run has.
 * @returns {string | null} The signing key's user ID, or null.
 */
export function ensureSigningKeyUid() {
	if (process.env[SIGNING_KEY_UID_ENV] === undefined) {
		process.env[SIGNING_KEY_UID_ENV] = JSON.stringify(deriveSigningKeyUid());
	}
	return JSON.parse(process.env[SIGNING_KEY_UID_ENV]);
}
