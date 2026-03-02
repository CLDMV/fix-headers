/**
 * @fileoverview Shared constants for project/language detection and header defaults.
 * @module fix-headers/constants
 */

export { DETECTOR_PROFILES, getAllowedExtensions, getEnabledDetectors } from "./detectors/index.mjs";

/** @type {string} */
export const DEFAULT_COMPANY_NAME = "Catalyzed Motivation Inc.";

/** @type {number} */
export const DEFAULT_MAX_HEADER_SCAN_LINES = 40;

/** @type {Set<string>} */
export const DEFAULT_IGNORE_FOLDERS = new Set([".git", "node_modules", "dist", "build", "coverage", "tmp", ".next", ".turbo"]);
