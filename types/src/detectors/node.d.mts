export namespace detector {
    export let id: string;
    export { extensions };
    export let enabledByDefault: boolean;
    export { isShebang as keepsAboveHeader };
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
