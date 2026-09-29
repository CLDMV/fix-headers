export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export function resolveCommentSyntax(filePath: any): {
        kind: "html";
        blockStart: string;
        blockLinePrefix: string;
        blockEnd: string;
    };
}
/**
 * @fileoverview HTML detector implementation.
 * @module fix-headers/detectors/html
 */
declare const extensions: string[];
export {};
