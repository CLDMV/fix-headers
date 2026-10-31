/**
 * @fileoverview Public module API exposing a single function for header updates.
 * @module fix-headers
 */
/**
 * Runs header fix-up using automatic metadata detection and optional overrides.
 * @param {Parameters<typeof fixHeadersCore>[0]} [options] - Runtime options.
 * @returns {ReturnType<typeof fixHeadersCore>} Update report.
 */
export function fixHeaders(options?: Parameters<typeof fixHeadersCore>[0]): ReturnType<typeof fixHeadersCore>;
export default fixHeaders;
import { fixHeaders as fixHeadersCore } from "./core/fix-headers.mjs";
