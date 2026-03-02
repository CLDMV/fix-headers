#!/usr/bin/env node
/**
 * Parses CLI arguments into fixHeaders options and control flags.
 * @param {string[]} argv - Process argument vector without node/script items.
 * @returns {{
 *  options: Record<string, unknown>,
 *  help: boolean,
 *  json: boolean
 * }} Parsed CLI payload.
 */
export function parseCliArgs(argv: string[]): {
    options: Record<string, unknown>;
    help: boolean;
    json: boolean;
};
/**
 * Loads extra options from a JSON config file.
 * @param {Record<string, unknown>} options - Current options object.
 * @returns {Promise<Record<string, unknown>>} Merged options object.
 */
export function applyConfigFile(options: Record<string, unknown>): Promise<Record<string, unknown>>;
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
export function runCli(argv: string[], deps?: {
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
export function runCliAsMain(argv?: string[], moduleUrl?: string, executor?: (args: string[]) => Promise<number>): boolean;
