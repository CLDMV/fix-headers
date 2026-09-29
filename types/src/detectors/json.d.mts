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
 * @fileoverview JSON-family detector implementation.
 * @module fix-headers/detectors/json
 */
declare const extensions: string[];
export {};
