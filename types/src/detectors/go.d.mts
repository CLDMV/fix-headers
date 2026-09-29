export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export function resolveCommentSyntax(filePath: any): {
        kind: "block";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview Go detector implementation.
 * @module fix-headers/detectors/go
 */
declare const extensions: string[];
export {};
