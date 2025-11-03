# Synchronization Specification

**Purpose:** This document describes all backend synchronizations that handle authentication and authorization for excluded API routes.

---

## Important Limitation

**Query methods (methods starting with `_`) cannot be excluded or handled by syncs** because:
- The engine treats all methods starting with `_` as queries
- Queries are not instrumented as actions and cannot be called in sync `then` clauses
- Therefore, all query endpoints remain **included** (passthrough) and concepts verify authorization internally

**Only non-`_` prefixed actions can be excluded and handled by syncs.**

---

## Overview

The backend uses a synchronization-based authentication system. Certain **action** routes have been **excluded** from direct passthrough and instead require authentication via synchronizations. When a request hits an excluded route, it triggers a `Requesting.request` action that is caught by syncs, which:

1. Verify the caller's identity and permissions
2. Call the actual concept action if authorized
3. Return the response via `Requesting.respond`

**Critical Requirement:** All excluded routes now require a `caller` parameter in the request body representing the authenticated user ID.

---

# EventDirectory Admin Action Syncs

All EventDirectory admin **actions** (non-`_` prefixed) are excluded and handled by syncs. These syncs verify that the caller is an admin before executing the action.

## Common Pattern

All EventDirectory admin action syncs follow this pattern:
1. **Request Sync**: Catches `Requesting.request`, verifies caller is admin via `verifyAdmin` helper, then calls the concept action
2. **Response Syncs**: Two separate syncs handle success and error responses:
   - **ResponseSuccess**: Catches successful action result (`{}`) and responds via `Requesting.respond`
   - **ResponseError**: Catches error result (`{ error }`) and responds via `Requesting.respond`

**Exception:** `createEvent` uses a single combined Response sync that handles both success (`{ event }`) and error (`{ error }`).

**Authentication Requirement:** `caller` must be an admin (verified via `EventDirectory._isAdmin` returning array `[{ isAdmin: true }]`)

---

## POST /api/EventDirectory/createEvent

**Sync Name:** `CreateEventRequest` / `CreateEventResponse`

**Description:** Creates a new event (admin only).

**Request Body:**
```json
{
  "caller": "ID",
  "name": "string",
  "requiredReadsPerApp": "number",
  "rubric": [
    {
      "name": "string",
      "description": "string",
      "scaleMin": "number",
      "scaleMax": "number",
      "guidelines": ["string (optional)"]
    }
  ],
  "questions": ["string"],
  "endDate": "Date (optional)"
}
```

**Success Response Body (Action):**
```json
{
  "event": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

## POST /api/EventDirectory/activateEvent

**Sync Name:** `ActivateEventRequest` / `ActivateEventResponseSuccess` / `ActivateEventResponseError`

**Description:** Activates an event (admin only).

**Request Body:**
```json
{
  "caller": "ID",
  "name": "string"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

## POST /api/EventDirectory/inactivateEvent

**Sync Name:** `InactivateEventRequest` / `InactivateEventResponseSuccess` / `InactivateEventResponseError`

**Description:** Inactivates an event (admin only).

**Request Body:**
```json
{
  "caller": "ID",
  "name": "string"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

## POST /api/EventDirectory/updateEventConfig

**Sync Name:** `UpdateEventConfigRequest` / `UpdateEventConfigResponseSuccess` / `UpdateEventConfigResponseError`

**Description:** Updates event configuration (admin only). All parameters except `caller` and `event` are optional. Only the parameters provided will be updated.

**Request Body:**
```json
{
  "caller": "ID",
  "event": "ID",
  "requiredReadsPerApp": "number (optional)",
  "rubric": [
    {
      "name": "string",
      "description": "string",
      "scaleMin": "number",
      "scaleMax": "number",
      "guidelines": ["string (optional)"]
    }
  ] (optional),
  "eligibilityCriteria": ["string"] (optional),
  "questions": ["string"] (optional),
  "endDate": "Date (optional)"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Note:** You can send only the parameters you want to update. For example, to update just the rubric, send only `{ "caller": "ID", "event": "ID", "rubric": [...] }`.

---

## POST /api/EventDirectory/addReader

**Sync Name:** `AddReaderRequest` / `AddReaderResponseSuccess` / `AddReaderResponseError`

**Description:** Approves a user as a verified reader for an event (admin only).

**Request Body:**
```json
{
  "caller": "ID",
  "event": "ID",
  "user": "ID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

## POST /api/EventDirectory/removeReader

**Sync Name:** `RemoveReaderRequest` / `RemoveReaderResponseSuccess` / `RemoveReaderResponseError`

**Description:** Revokes a reader's verification for an event (admin only).

**Request Body:**
```json
{
  "caller": "ID",
  "event": "ID",
  "user": "ID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

---

## POST /api/EventDirectory/addAdmin

**Sync Name:** `AddAdminRequest` / `AddAdminResponseSuccess` / `AddAdminResponseError`

**Description:** Grants admin privileges to a user (admin only).

**Requirements:**

- Caller is admin.
- Target user is not already an admin.

**Effects:**

- Inserts user into admins collection.

**Request Body:**
```json
{
  "caller": "ID",
  "user": "ID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Common Errors:**
- `"Only existing admins can add new admins."` - Caller is not an admin
- `"User 'ID' is already an admin."` - Target user is already an admin

---

## POST /api/EventDirectory/removeAdmin

**Sync Name:** `RemoveAdminRequest` / `RemoveAdminResponseSuccess` / `RemoveAdminResponseError`

**Description:** Removes admin privileges from a user (admin only).

**Requirements:**

- Caller is admin.
- Target user is currently an admin.
- If removing self and there's only one admin, this will fail.

**Effects:**

- Deletes user from admins collection.

**Request Body:**
```json
{
  "caller": "ID",
  "user": "ID"
}
```

**Success Response Body (Action):**
```json
{}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Common Errors:**
- `"Only admins can remove other admins."` - Caller is not an admin
- `"User 'ID' is not an admin."` - Target user is not currently an admin
- `"Cannot remove the last remaining admin."` - Attempting to remove the only admin

---

# Query Endpoints (Cannot Be Excluded)

The following endpoints **cannot be excluded** because they are queries (start with `_`):

## AuthAccounts Queries
- `POST /api/AuthAccounts/_getAccountByUserId` - Concept verifies caller owns account or is admin
- `POST /api/AuthAccounts/_getAccountByEmail` - Concept verifies caller owns account or is admin
- `POST /api/AuthAccounts/_getAllUsers` - Concept verifies caller is admin

## EventDirectory Queries
- `POST /api/EventDirectory/getAllEvents` - Concept verifies caller is admin (note: doesn't start with `_` but is treated as a query and is included)

## ApplicationStorage Queries/Actions (named with `_` prefix)
- `POST /api/ApplicationStorage/_bulkImportApplications` - Concept verifies importedBy is admin
- `POST /api/ApplicationStorage/_getFlaggedApplications` - Concept verifies caller is admin
- `POST /api/ApplicationStorage/_disqualifyApplication` - Concept verifies disqualifiedBy is admin
- `POST /api/ApplicationStorage/_removeFlag` - Concept verifies removedBy is admin
- `POST /api/ApplicationStorage/_undisqualifyApplication` - Concept verifies undisqualifiedBy is admin
- `POST /api/ApplicationStorage/_getDisqualifiedApplications` - Concept verifies caller is admin

**Note:** These remain included (passthrough) and concepts verify authorization internally. They do **not** require a `caller` parameter for sync-based authentication, but may require it for concept-level verification.

---

## Summary

### Endpoints with Syncs (Excluded)
- **8 EventDirectory admin actions** (excluded and handled by syncs):
  1. `createEvent`
  2. `activateEvent`
  3. `inactivateEvent`
  4. `updateEventConfig`
  5. `addReader`
  6. `removeReader`
  7. `addAdmin`
  8. `removeAdmin`

- **Total: 23 syncs**:
  - `createEvent`: 2 syncs (Request + combined Response handling both success/error)
  - Other 7 actions: 21 syncs (7 × 3: Request + ResponseSuccess + ResponseError)

### Endpoints Without Syncs (Included/Passthrough)
- All query endpoints (methods starting with `_`) - **cannot be excluded due to engine limitations**
- All ApplicationStorage methods starting with `_` (treated as queries by engine)
- `getAllEvents` (included, concept handles auth)
- All other non-excluded endpoints

**Important:** Query endpoints remain included because the engine treats methods starting with `_` as queries, and queries cannot be called in sync `then` clauses. These endpoints rely on concept-level authorization.

### Response Formats
**No changes** - All response formats remain identical to api-spec.md. Syncs only add authentication checks; they don't modify the API contract for responses.

### Authentication Failures
- **Excluded routes (sync-based):** If authentication fails (caller is not authorized), the request will timeout with no response (504 Gateway Timeout). The frontend should handle this appropriately.
- **Included query endpoints (concept-based):** Authentication failures are handled by the concepts and return normal error responses with `{ "error": "string" }`.

### Why Only 8 Actions Have Syncs?

The engine has a technical limitation: **methods starting with `_` are treated as queries and cannot be called in sync `then` clauses**. This means:
- ❌ Query endpoints (e.g., `_getAccountByUserId`) **cannot** be excluded or have syncs
- ❌ ApplicationStorage methods like `_bulkImportApplications` **cannot** be excluded (they start with `_`)
- ✅ Only non-`_` prefixed **actions** can be excluded and have syncs
- ✅ EventDirectory admin actions (e.g., `createEvent`, `addReader`) don't start with `_`, so they **can** be excluded and have syncs

This is why only the 8 EventDirectory admin actions have syncs - they're the only admin-only actions that don't start with `_`.

---

# ReviewRecords User Action Syncs

All ReviewRecords critical user **actions** listed below are excluded and handled by syncs. These syncs verify that the HTTP `caller` matches the user parameter in the action (`caller === author` or `caller === user`).

## Common Pattern

All ReviewRecords user action syncs follow this pattern:
1. **Request Sync**: Catches `Requesting.request`, verifies `caller === author/user` via `verifyCaller` helper, then calls the concept action
2. **Response Syncs**: Two separate syncs handle success and error responses:
   - **ResponseSuccess**: Catches successful action result and responds via `Requesting.respond`
   - **ResponseError**: Catches error result (`{ error }`) and responds via `Requesting.respond`

**Authentication Requirement:** `caller` must match the user parameter (`author` or `user`) in the action (verified via `verifyCaller` helper)

---

## POST /api/ReviewRecords/submitReview

**Sync Name:** `SubmitReviewRequest` / `SubmitReviewResponseSuccess` / `SubmitReviewResponseError`

**Description:** Submits a new review for an application (user action - caller must match author).

**Request Body:**
```json
{
  "caller": "ID",
  "author": "ID",
  "application": "ID",
  "currentTime": "Date",
  "activeTime": "number (optional)"
}
```

**Success Response Body (Action):**
```json
{
  "review": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Note:** The `caller` must match `author`. The sync verifies this before allowing the action to proceed.

---

## POST /api/ReviewRecords/setScore

**Sync Name:** `SetScoreRequest` / `SetScoreResponseSuccess` / `SetScoreResponseError`

**Description:** Sets or updates a score for a criterion in a review (user action - caller must match author).

**Request Body:**
```json
{
  "caller": "ID",
  "author": "ID",
  "review": "ID",
  "criterion": "string",
  "value": "number"
}
```

**Success Response Body (Action):**
```json
{
  "application": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Note:** The `caller` must match `author`. The sync verifies this before allowing the action to proceed.

---

## POST /api/ReviewRecords/deleteReview

**Sync Name:** `DeleteReviewRequest` / `DeleteReviewResponseSuccess` / `DeleteReviewResponseError`

**Description:** Deletes a review by its ID (user action - caller must match user).

**Request Body:**
```json
{
  "caller": "ID",
  "reviewId": "ID",
  "user": "ID"
}
```

**Success Response Body (Action):**
```json
{
  "success": true,
  "message": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Note:** The `caller` must match `user`. The sync verifies this before allowing the action to proceed.

---

# ApplicationAssignments User Action Syncs

All ApplicationAssignments critical user **actions** listed below are excluded and handled by syncs. These syncs verify that the HTTP `caller` matches the `user` parameter in the action.

## Common Pattern

All ApplicationAssignments user action syncs follow this pattern:
1. **Request Sync**: Catches `Requesting.request`, verifies `caller === user` via `verifyCaller` helper, then calls the concept action
2. **Response Syncs**: Two separate syncs handle success and error responses:
   - **ResponseSuccess**: Catches successful action result and responds via `Requesting.respond`
   - **ResponseError**: Catches error result (`{ error }`) and responds via `Requesting.respond`

**Authentication Requirement:** `caller` must match the `user` parameter in the action (verified via `verifyCaller` helper)

---

## POST /api/ApplicationAssignments/submitAndIncrement

**Sync Name:** `SubmitAndIncrementRequest` / `SubmitAndIncrementResponseSuccess` / `SubmitAndIncrementResponseError`

**Description:** Submits a completed assignment and increments the read count (user action - caller must match user).

**Request Body:**
```json
{
  "caller": "ID",
  "user": "ID",
  "assignment": {
    "_id": "ID",
    "user": "ID",
    "application": "ID",
    "startTime": "Date",
    "event": "ID"
  },
  "endTime": "Date",
  "activeTime": "number (optional)"
}
```

**Success Response Body (Action):**
```json
{
  "application": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Note:** The `caller` must match `user`. The sync verifies this before allowing the action to proceed.

---

## POST /api/ApplicationAssignments/flagAndSkip

**Sync Name:** `FlagAndSkipRequest` / `FlagAndSkipResponseSuccess` / `FlagAndSkipResponseError`

**Description:** Flags an application and skips to the next one (user action - caller must match user).

**Request Body:**
```json
{
  "caller": "ID",
  "user": "ID",
  "assignment": {
    "_id": "ID",
    "user": "ID",
    "application": "ID",
    "startTime": "Date",
    "event": "ID"
  },
  "reason": "string (optional)"
}
```

**Success Response Body (Action):**
```json
{
  "success": true
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```

**Note:** The `caller` must match `user`. The sync verifies this before allowing the action to proceed.

---

## Summary - Updated

### Endpoints with Syncs (Excluded)
- **8 EventDirectory admin actions** (excluded and handled by syncs):
  1. `createEvent`
  2. `activateEvent`
  3. `inactivateEvent`
  4. `updateEventConfig`
  5. `addReader`
  6. `removeReader`
  7. `addAdmin`
  8. `removeAdmin`

- **3 ReviewRecords user actions** (excluded and handled by syncs):
  1. `submitReview`
  2. `setScore`
  3. `deleteReview`

- **2 ApplicationAssignments user actions** (excluded and handled by syncs):
  1. `submitAndIncrement`
  2. `flagAndSkip`

- **Total: 33 syncs**:
  - EventDirectory: 23 syncs (8 actions: 1×2 + 7×3)
  - ReviewRecords: 9 syncs (3 actions × 3: Request + ResponseSuccess + ResponseError)
  - ApplicationAssignments: 6 syncs (2 actions × 3: Request + ResponseSuccess + ResponseError)
