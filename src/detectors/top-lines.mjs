/**
 *
 *	@Project: @cldmv/fix-headers
 *	@Filename: /src/detectors/top-lines.mjs
 *	@Date: 2026-10-31T12:00:00-07:00 (1793473200)
 *	@Author: Nate Corcoran <CLDMV>
 *	@Email: <Shinrai@users.noreply.github.com>
 *	-----
 *	@Last modified by: Nate Corcoran <CLDMV> (Shinrai@users.noreply.github.com)
 *	@Last modified time: 2026-10-31T12:00:00-07:00 (1793473200)
 *	-----
 *	@Copyright: Copyright (c) 2013-2026 Catalyzed Motivation Inc. All rights reserved.
 *
 */

/**
 * @fileoverview Lines that keep their place above the header: a run of lines at the very top
 * of a file whose position matters to the file or its tooling (a shebang, a PEP 263 encoding
 * declaration, `#cloud-config`, `@charset`, an editor modeline, ...). Nothing further down is
 * ever moved up.
 * @module fix-headers/detectors/top-lines
 */

/**
 * The start of a vi/Vim/ex modeline in a comment line: the comment opener (`#`, `//`, `/*` or
 * `<!--`), white space, then `vi:`, `vim:`, `vim<version>:` (with an optional `<`, `=` or `>`),
 * `Vim:` or `ex:`. The rest of the line is captured; {@link isModeline} trims it and takes a
 * closing `*\/` or `-->` off with string operations, so no two quantifiers compete for the same
 * white space.
 * @type {RegExp}
 */
const MODELINE_START = /^(?:#|\/\/|\/\*+|<!--)[ \t]+(vi|vim(?:[<=>]?\d+)?|Vim|ex):(.*)$/;

/**
 * One option of a modeline: `opt`, `noopt`, `opt!`, `opt&`, or `opt=val` (also `+=`, `-=`,
 * `^=`), where a value runs to white space or an unescaped `:`.
 * @type {RegExp}
 */
const MODELINE_OPTION = /^[a-z]+(?:[!&]|[+^-]?=(?:\\.|[^\s:\\])*)?$/;

/**
 * Boolean options common enough in modelines to mark a line as one on their own (`vim: et`,
 * `vim: noexpandtab`). Any other bare word could be prose, so a line of bare words needs one of
 * these, or an `opt=val` option, to count.
 * @type {Set<string>}
 */
const MODELINE_BOOLEANS = new Set([
	"et",
	"expandtab",
	"ai",
	"autoindent",
	"si",
	"smartindent",
	"ro",
	"readonly",
	"bin",
	"binary",
	"noet",
	"noexpandtab",
	"noai",
	"noautoindent",
	"nosi",
	"nosmartindent",
	"noro",
	"noreadonly",
	"nobin",
	"nobinary",
	"nowrap",
	"nolist",
	"nospell",
	"nofen",
	"nofoldenable",
	"noeol",
	"nofixeol",
	"nofixendofline"
]);

/**
 * Whether a comment line is a vi/Vim/ex modeline, in either of Vim's forms:
 * `vim: set ts=4 sw=4:` (`se`/`set`, options, a closing `:`, then any text) or
 * `vim: ts=4 sw=4 et` (options to the end of the line, separated by white space or `:`).
 * Every option must be option syntax, and at least one must be `opt=val` or a common boolean
 * option, so prose such as `vi: is the editor we use` is not a modeline. Vim reads modelines
 * only in the first and last few lines of a file (`modelines`, default 5), so one at the top
 * stops working once a header is put above it.
 * @param {string} line - The comment line, comment opener included.
 * @returns {boolean} Whether the line is a modeline.
 */
export function isModeline(line) {
	const start = line.match(MODELINE_START);
	if (!start) {
		return false;
	}
	let rest = start[2].trim();
	if (rest.endsWith("-->")) {
		rest = rest.slice(0, -3).trimEnd();
	} else if (rest.endsWith("*/")) {
		let end = rest.length - 2;
		while (end > 0 && rest[end - 1] === "*") {
			end -= 1;
		}
		rest = rest.slice(0, end).trimEnd();
	}
	// One white space character after `set`: the options may start with more, which the option
	// split ignores, and a single character leaves no choice of where the options begin.
	const set = rest.match(/^se(?:t)?[ \t]((?:\\.|[^:\\])*):/);
	if (!set && start[1] === "Vim") {
		// `Vim:` only opens the `set` form.
		return false;
	}
	const options = set ? set[1].match(/(?:\\.|[^\s\\])+/g) : rest.match(/(?:\\.|[^\s:\\])+/g);
	return (
		options !== null &&
		options.every((option) => MODELINE_OPTION.test(option)) &&
		options.some((option) => option.includes("=") || MODELINE_BOOLEANS.has(option))
	);
}

/**
 * A shebang (`#!`), which only works on a file's first line.
 * @param {string} line - The line.
 * @param {number} index - Zero-based line number in the file.
 * @returns {boolean} Whether the line is a shebang on the first line.
 */
export function isShebang(line, index) {
	return index === 0 && line.startsWith("#!");
}

/**
 * Takes the run of lines at the start of `content` that `keep` accepts, line endings included.
 * The run stops at the first line `keep` rejects (or at a last line without a line break, which
 * is taken when accepted).
 * @param {string} content - Text starting at a line start.
 * @param {(line: string, index: number) => boolean} keep - Whether a line (without its line
 * ending) at a zero-based line number of the file stays above the header.
 * @param {number} [firstIndex=0] - Line number of the first line of `content` in the file.
 * @returns {string} The lines taken.
 */
export function takeTopLines(content, keep, firstIndex = 0) {
	let taken = 0;
	let index = firstIndex;
	while (taken < content.length) {
		const end = content.indexOf("\n", taken);
		const next = end === -1 ? content.length : end + 1;
		if (!keep(content.slice(taken, next).replace(/\r?\n$/, ""), index)) {
			break;
		}
		taken = next;
		index += 1;
	}
	return content.slice(0, taken);
}
