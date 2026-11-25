export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export function resolveContentSkipReason(content: any): string;
    export function resolveCommentSyntax(filePath: any): {
        kind: "block";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview C and C++ detector implementation.
 * @module fix-headers/detectors/c
 */
declare const extensions: string[];
export {};
