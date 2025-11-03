/**
 * Syncs for ApplicationStorage admin actions
 *
 * NOTE: Methods starting with "_" (like _bulkImportApplications, _disqualifyApplication, etc.)
 * are treated as queries by the engine and cannot be excluded or called in sync then clauses.
 * These remain included (passthrough) and concepts verify authorization internally.
 *
 * This file would contain syncs for non-_ prefixed actions if any are excluded in the future.
 */

// No syncs needed - all ApplicationStorage methods starting with "_" cannot be excluded
// because they're treated as queries by the engine
