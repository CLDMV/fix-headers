/**
 * Whether a path names a TypeScript declaration file (`.d.ts`, `.d.mts` or `.d.cts`).
 * @param {string} filePath - File path.
 * @returns {boolean} True for a declaration file.
 */
export function isDeclarationFile(filePath: string): boolean;
/**
 * Says why a generated declaration file is skipped. `tsc` copies the source file's header into
 * the `.d.ts` / `.d.mts` / `.d.cts` it emits, `@Filename` included, and the source run already
 * maintains that header. Rewriting the copy only makes fix-headers and `tsc` undo each other on
 * every run, so a declaration file whose header names its own source file is left alone. A
 * declaration whose header names any other file (a hand-written one that was moved) is fixed as usual.
 * @param {string} content - File content.
 * @param {string} filePath - File path.
 * @returns {string | null} Skip reason, or null.
 */
export function declarationCopySkipReason(content: string, filePath: string): string | null;
export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export { isShebang as keepsAboveHeader };
    export function resolveContentSkipReason(content: any, filePath: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: "block";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview Node.js detector implementation.
 * @module fix-headers/detectors/node
 */
declare const extensions: string[];
import { isShebang } from "./top-lines.mjs";
export {};
