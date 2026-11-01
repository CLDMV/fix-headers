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
export function isModeline(line: string): boolean;
/**
 * A shebang (`#!`), which only works on a file's first line.
 * @param {string} line - The line.
 * @param {number} index - Zero-based line number in the file.
 * @returns {boolean} Whether the line is a shebang on the first line.
 */
export function isShebang(line: string, index: number): boolean;
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
export function takeTopLines(content: string, keep: (line: string, index: number) => boolean, firstIndex?: number): string;
