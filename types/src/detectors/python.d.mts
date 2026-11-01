export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export { keepsAboveHeader };
    export function resolveCommentSyntax(filePath: any): {
        kind: string;
        linePrefix: string;
    };
}
/**
 * @fileoverview Python detector implementation.
 * @module fix-headers/detectors/python
 */
declare const extensions: string[];
/**
 * Whether a line at the top of a Python file keeps its place above the header: a shebang on
 * line 1, or a PEP 263 encoding declaration on line 1 or 2 (Python reads it nowhere else).
 * @param {string} line - The line.
 * @param {number} index - Zero-based line number.
 * @returns {boolean} Whether the line stays above the header.
 */
declare function keepsAboveHeader(line: string, index: number): boolean;
export {};
