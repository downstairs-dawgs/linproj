/**
 * Preload file for E2E tests.
 *
 * This file is loaded before any test files via `bun test --preload`.
 * It sets a longer timeout for E2E tests that hit real APIs.
 */

import { setDefaultTimeout } from 'bun:test';

// E2E tests hit real APIs and can be slow - use 30 second timeout
// (increased from 15s to account for CI variability)
setDefaultTimeout(30_000);
