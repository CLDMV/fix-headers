/**
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/config/load.mjs
 *	@Date: 2026-09-28T21:19:05-07:00 (1790655545)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-09-28T21:19:05-07:00 (1790655545)
 *	-----
 *	@Copyright: Copyright (c) 2026-2026 Catalyzed Motivation Inc. All rights reserved.
 */
export type ConfigSource = {
    kind: "file";
    path: string;
} | {
    kind: "url";
    href: string;
};
/**
 * Merges `override` onto `base`: plain objects merge key by key, arrays and scalars replace.
 * Neither input is modified. `__proto__` keys are skipped so a config can't change prototypes.
 * @param {Record<string, unknown>} base - Lower-precedence settings.
 * @param {Record<string, unknown>} override - Higher-precedence settings.
 * @returns {Record<string, unknown>} Merged settings.
 */
export declare function mergeConfig(base: Record<string, unknown>, override: Record<string, unknown>): Record<string, unknown>;
/**
 * Loads a JSON config file and resolves its `extends` chain.
 * @param {string} configPath - Config file path, absolute or relative to `cwd`.
 * @param {string} [cwd=process.cwd()] - Folder a relative `configPath` resolves from.
 * @returns {Promise<Record<string, unknown>>} Fully merged settings from the file and everything it extends.
 */
export declare function loadConfigFile(configPath: string, cwd?: string): Promise<Record<string, unknown>>;
/**
 * Applies the config file named by `options[key]` underneath `options`: settings from the file
 * (and everything it extends) fill in, and every option passed directly wins over them. The
 * config-file key itself is removed from the result. Returns `options` unchanged when no config
 * file is named.
 * @template {Record<string, unknown>} T
 * @param {T} options - Direct options (CLI flags or API call options).
 * @param {string} key - Option naming the config file (`config` for the CLI, `configFile` for the API).
 * @returns {Promise<T>} Effective options.
 */
export declare function applyConfigOption<T extends Record<string, unknown>>(options: T, key: string): Promise<T>;
