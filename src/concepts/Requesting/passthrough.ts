/**
 * The Requesting concept exposes passthrough routes by default,
 * which allow POSTs to the route:
 *
 * /{REQUESTING_BASE_URL}/{Concept name}/{action or query}
 *
 * to passthrough directly to the concept action or query.
 * This is a convenient and natural way to expose concepts to
 * the world, but should only be done intentionally for public
 * actions and queries.
 *
 * This file allows you to explicitly set inclusions and exclusions
 * for passthrough routes:
 * - inclusions: those that you can justify their inclusion
 * - exclusions: those to exclude, using Requesting routes instead
 *
 * SECURITY NOTES:
 * - INCLUDED routes are directly accessible (passthrough)
 * - EXCLUDED routes will be handled by Requesting.request and can have syncs add authentication
 * - Concepts check authorization on parameters but don't verify the HTTP caller matches those parameters
 * - Routes that take user/admin parameters should be EXCLUDED to add caller verification via syncs
 *
 * CONSERVATIVE APPROACH:
 * - For now, keeping most routes INCLUDED to maintain backward compatibility
 * - Only EXCLUDING routes that expose sensitive data (password hashes) or are clearly admin-only
 * - You can move more routes to EXCLUDED later as you write authentication syncs
 */

/**
 * INCLUSIONS
 *
 * Each inclusion must include a justification for why you think
 * the passthrough is appropriate (e.g. public query).
 *
 * inclusions = {"route": "justification"}
 */

export const inclusions: Record<string, string> = {
  // ========== AuthAccounts ==========
  "/api/AuthAccounts/register": "public registration - no auth needed",
  "/api/AuthAccounts/login": "public login - no auth needed",
  "/api/AuthAccounts/_getNameByUserId": "public query for user name - safe to expose",
  "/api/AuthAccounts/_getAccountByIdSafe": "public query - only returns name/email (no password hash)",
  "/api/AuthAccounts/_getAccountByUserId": "query endpoint - concept should verify authorization internally",
  "/api/AuthAccounts/_getAccountByEmail": "query endpoint - concept should verify authorization internally",
  "/api/AuthAccounts/_getAllUsers": "admin query - concept verifies admin status internally",

  // ========== ApplicationAssignments ==========
  "/api/ApplicationAssignments/registerApplicationForAssignment": "idempotent action - concept handles checks",
  "/api/ApplicationAssignments/getNextAssignment": "action - concept validates assignment ownership internally",
  "/api/ApplicationAssignments/skipAssignment": "action - concept validates assignment belongs to user",
  "/api/ApplicationAssignments/submitAndIncrement": "action - concept validates assignment belongs to user",
  "/api/ApplicationAssignments/abandonAssignment": "action - concept validates assignment exists",
  "/api/ApplicationAssignments/getCurrentAssignment": "query - concept validates assignment ownership",
  "/api/ApplicationAssignments/flagAndSkip": "action - concept validates assignment belongs to user",
  "/api/ApplicationAssignments/_getSkipStatsForEvent": "query with event - stats are viewable",
  "/api/ApplicationAssignments/_getUserFlaggedApplications": "query with user/event - concept validates inputs",

  // ========== ApplicationStorage ==========
  "/api/ApplicationStorage/addApplication": "action - concept handles validation",
  "/api/ApplicationStorage/generateAIComments": "action - concept handles validation",
  "/api/ApplicationStorage/_getAICommentsByApplication": "query with application - AI comments are viewable",
  "/api/ApplicationStorage/_getApplication": "query with application - application data needed for reviewing",
  "/api/ApplicationStorage/_getApplicationsByEvent": "query with event - needed for assignment flow",
  "/api/ApplicationStorage/_bulkImportApplications": "admin action (but named with _ prefix - treated as query by engine)",
  "/api/ApplicationStorage/_getFlaggedApplications": "admin query - concept verifies admin status internally",
  "/api/ApplicationStorage/_disqualifyApplication": "admin action (but named with _ prefix - treated as query by engine)",
  "/api/ApplicationStorage/_removeFlag": "admin action (but named with _ prefix - treated as query by engine)",
  "/api/ApplicationStorage/_undisqualifyApplication": "admin action (but named with _ prefix - treated as query by engine)",
  "/api/ApplicationStorage/_getDisqualifiedApplications": "admin query - concept verifies admin status internally",
  // NOTE: All methods starting with "_" are treated as queries and cannot be excluded
  // (they can't be called in sync then clauses). Only non-_ methods can be excluded.

  // ========== EventDirectory - Public Queries ==========
  "/api/EventDirectory/_getEventByName": "public query - event info is public",
  "/api/EventDirectory/_getEventById": "public query - event info is public",
  "/api/EventDirectory/_getQuestionsForEvent": "public query - event questions are public",
  "/api/EventDirectory/_isReaderVerified": "query with user/event - concept validates inputs",
  "/api/EventDirectory/_getUserMembership": "query with user/event - concept validates inputs",
  "/api/EventDirectory/_getVerifiedEventsForUser": "query with user - concept validates inputs",
  "/api/EventDirectory/_getActiveVerifiedEventsForUser": "query with user - concept validates inputs",
  "/api/EventDirectory/_getPendingReadersForEvent": "query with event - concept validates inputs",
  "/api/EventDirectory/_isAdmin": "public query - checks admin status (no sensitive data)",
  "/api/EventDirectory/_getVerifiedReadersForEvent": "query with event - public list of readers",
  "/api/EventDirectory/_getAllMembersForEvent": "query with event - public list of members",
  "/api/EventDirectory/getAllEvents": "admin query - concept verifies admin status internally",
  // NOTE: Admin actions excluded for security (queries can't be excluded as they can't be in sync then clauses)

  // ========== ReviewRecords ==========
  "/api/ReviewRecords/submitReview": "action - concept validates author hasn't already reviewed",
  "/api/ReviewRecords/setScore": "action - concept validates author is review creator",
  "/api/ReviewRecords/editReview": "action - concept validates editor is review author",
  "/api/ReviewRecords/addRedFlag": "action - concept validates author is review author",
  "/api/ReviewRecords/removeRedFlag": "action - concept validates author is review author",
  "/api/ReviewRecords/addComment": "action - concept validates application exists",
  "/api/ReviewRecords/editComment": "action - concept validates author is comment author",
  "/api/ReviewRecords/deleteComment": "action - concept validates author is comment author",
  "/api/ReviewRecords/deleteReview": "action - concept validates user is review author",
  "/api/ReviewRecords/_getReviewsWithScoresByApplication": "query with application - reviews visible to readers",
  "/api/ReviewRecords/_getCommentsByApplication": "query with application - comments visible to readers",
  "/api/ReviewRecords/_hasUserFlaggedApplication": "query with user/application - concept validates inputs",
  "/api/ReviewRecords/_getUserScoresForApplication": "query with user/application - concept validates inputs",
  "/api/ReviewRecords/_calculateWeightedAverages": "query with weights - calculation query",
  "/api/ReviewRecords/_getReaderStatsForEvent": "query with event - stats are viewable",
  "/api/ReviewRecords/_getUserReviewProgress": "query with user/event - concept validates inputs",
  "/api/ReviewRecords/_getUserReviewedApplications": "query with user/event - concept validates inputs",
};

/**
 * EXCLUSIONS
 *
 * Excluded routes fall back to the Requesting concept, and will
 * instead trigger the normal Requesting.request action. As this
 * is the intended behavior, no justification is necessary.
 *
 * exclusions = ["route"]
 *
 * SECURITY: These routes need authentication/authorization syncs to verify:
 * - The HTTP caller matches the user/admin parameters in the request
 * - The caller is authorized to perform the action
 *
 * NOTE: Excluding these routes means they won't work until you write syncs for them.
 * Consider keeping some INCLUDED temporarily if you need them to work immediately.
 */

export const exclusions: Array<string> = [
  // Private/internal methods should not be exposed
  "/api/EventDirectory/_isAdminInternal",

  // LikertSurvey concept not used in this app
  "/api/LikertSurvey/createSurvey",
  "/api/LikertSurvey/addQuestion",
  "/api/LikertSurvey/submitResponse",
  "/api/LikertSurvey/updateResponse",
  "/api/LikertSurvey/_getSurveyQuestions",
  "/api/LikertSurvey/_getSurveyResponses",
  "/api/LikertSurvey/_getRespondentAnswers",

  // ========== AuthAccounts - Security: Expose Password Hashes ==========
  // NOTE: Query endpoints (_getAccountByUserId, _getAccountByEmail, _getAllUsers)
  // cannot be excluded because queries cannot be called in sync then clauses.
  // These remain included (passthrough) and concepts verify authorization internally.

  // ========== EventDirectory - Admin Actions ==========
  "/api/EventDirectory/createEvent", // Admin action - must verify caller is admin
  "/api/EventDirectory/activateEvent", // Admin action - must verify caller is admin
  "/api/EventDirectory/inactivateEvent", // Admin action - must verify caller is admin
  "/api/EventDirectory/updateEventConfig", // Admin action - must verify caller is admin
  "/api/EventDirectory/addReader", // Admin action - must verify caller is admin
  "/api/EventDirectory/removeReader", // Admin action - must verify caller is admin
  "/api/EventDirectory/addAdmin", // Admin action - must verify caller is admin
  "/api/EventDirectory/removeAdmin", // Admin action - must verify caller is admin
  // NOTE: getAllEvents is a query and can't be excluded (queries can't be called in sync then clauses)

  // ========== ApplicationStorage - Admin Actions/Queries ==========
  // NOTE: All methods starting with "_" are treated as queries by the engine and cannot be
  // excluded (they can't be called in sync then clauses). These remain included and
  // concepts should verify authorization internally:
  // - _bulkImportApplications (action, but named with _ prefix)
  // - _disqualifyApplication (action, but named with _ prefix)
  // - _removeFlag (action, but named with _ prefix)
  // - _undisqualifyApplication (action, but named with _ prefix)
  // - _getFlaggedApplications (query)
  // - _getDisqualifiedApplications (query)

  // NOTE: Keeping addApplication and generateAIComments INCLUDED for now - can exclude later
  // NOTE: Most user actions are INCLUDED because concepts validate ownership internally
  //       You can exclude them later to add explicit caller verification via syncs
];
