/**
 * Authentication syncs for AuthAccounts concept
 *
 * NOTE: Query endpoints (_getAccountByUserId, _getAccountByEmail, _getAllUsers)
 * cannot be excluded because queries cannot be called in sync then clauses.
 * These queries remain included and should verify authorization internally.
 *
 * This file only contains syncs for actions (if any are added in the future).
 */

// No syncs needed for AuthAccounts queries - they remain included (passthrough)
// The concepts themselves verify authorization
