export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export function keepsAboveHeader(line: any, index: any): boolean;
    export function resolveContentSkipReason(content: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: "block";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview PHP detector implementation.
 * @module fix-headers/detectors/php
 */
declare const extensions: string[];
export {};
