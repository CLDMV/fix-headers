/**
 * @fileoverview Vitest global setup for the fix-headers test suite.
 *
 * Reaps ONLY stale fixture directories (see reapStaleWorkspaces in
 * tests/helpers/workspace.mjs) before and after the run, so orphans from a
 * previously crashed/interrupted run self-heal WITHOUT touching fixtures a
 * concurrent, still-running suite (another shard, or CI + local at once) is
 * actively using — those have a fresh mtime and are left alone. Per-test cleanup
 * (cleanupWorkspace) still handles the happy path; this is the crash-path backstop.
 * @module fix-headers/vitest-global-setup
 */

import { ensureSigningKeyUid } from "../tests/helpers/signing-key.mjs";
import { reapStaleWorkspaces } from "../tests/helpers/workspace.mjs";

/** Reap orphans left by a prior aborted run (age-guarded). @returns {Promise<void>} */
export async function setup() {
	// Already derived by tests/run-vitest.mjs for a normal run; this covers vitest started directly.
	ensureSigningKeyUid();
	await reapStaleWorkspaces();
}

/** Reap any now-stale orphans on the way out (never this run's or a peer's live fixtures). @returns {Promise<void>} */
export async function teardown() {
	await reapStaleWorkspaces();
}
