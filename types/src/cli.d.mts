#!/usr/bin/env node
/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/cli.mjs
 *	@Date: 2026-03-01T17:59:32-08:00 (1772416772)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-03-01T17:59:32-08:00 (1772416772)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
/**
 * Parses CLI arguments into fixHeaders options and control flags.
 * @param {string[]} argv - Process argument vector without node/script items.
 * @returns {{
 *  options: Record<string, unknown>,
 *  help: boolean,
 *  json: boolean
 * }} Parsed CLI payload.
 */
export declare function parseCliArgs(argv: string[]): {
    options: Record<string, unknown>;
    help: boolean;
    json: boolean;
};
/**
 * Loads extra options from a JSON config file.
 * @param {Record<string, unknown>} options - Current options object.
 * @returns {Promise<Record<string, unknown>>} Merged options object.
 */
export declare function applyConfigFile(options: Record<string, unknown>): Promise<Record<string, unknown>>;
/**
 * Executes CLI flow and returns process-like exit code.
 * @param {string[]} argv - CLI arguments.
 * @param {{
 *  runner?: (options: Record<string, unknown>) => Promise<unknown>,
 *  stdout?: (message: string) => void,
 *  stderr?: (message: string) => void
 * }} [deps={}] - Dependency overrides for tests.
 * @returns {Promise<number>} Exit code.
 */
export declare function runCli(argv: string[], deps?: {
    runner?: (options: Record<string, unknown>) => Promise<unknown>;
    stdout?: (message: string) => void;
    stderr?: (message: string) => void;
}): Promise<number>;
/**
 * Executes CLI flow when the module is the process entrypoint.
 * @param {string[]} [argv=process.argv] - Process argument vector.
 * @param {string} [moduleUrl=import.meta.url] - Current module URL.
 * @param {(args: string[]) => Promise<number>} [executor=runCli] - CLI executor.
 * @returns {boolean} Whether the entrypoint branch was executed.
 */
export declare function runCliAsMain(argv?: string[], moduleUrl?: string, executor?: (args: string[]) => Promise<number>): boolean;
