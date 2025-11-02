# API Specification: AuthAccounts Concept

**Purpose:** Handle user registration and login securely with hashed passwords and unique emails.

---

## API Endpoints

### POST /api/AuthAccounts/register

**Description:** Creates a new user account with a unique email and hashed password.

**Requirements:**

- `name`, `email`, and `password` are provided.
- No existing account with the same `email`.

**Effects:**

- Hashes the password.
- Creates a new user account and returns its ID.

**Request Body:**
{
"name": "string",
"email": "string",
"password": "string"
}

**Success Response Body (Action):**
{
"user": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/AuthAccounts/login

**Description:** Authenticates a user using their email and password.

**Requirements:**

- An account with the given `email` exists.
- The provided `password` matches the stored hash.

**Effects:**

- Returns the authenticated user’s ID.

**Request Body:**
{
"email": "string",
"password": "string"
}

**Success Response Body (Action):**
{
"user": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/AuthAccounts/\_getAccountByUserId

**Description:** Retrieves an account by its user ID.

**Requirements:**

- The user ID exists.

**Effects:**

- Returns the account document.

**Request Body:**
{
"userId": "ID"
}

**Success Response Body (Query):**
{
"_id": "ID",
"email": "string",
"name": "string",
"passwordHash": "string"
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/AuthAccounts/\_getAccountByEmail

**Description:** Retrieves an account by its email.

**Requirements:**

- An account with the given email exists.

**Effects:**

- Returns the account document.

**Request Body:**
{
"email": "string"
}

**Success Response Body (Query):**
{
"_id": "ID",
"email": "string",
"name": "string",
"passwordHash": "string"
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/AuthAccounts/\_getNameByUserId

**Description:** Retrieves the name for a given user ID (without sensitive data).

**Requirements:**

- The user ID exists.

**Effects:**

- Returns the name of the user.

**Request Body:**
{
"userId": "ID"
}

**Success Response Body (Query):**
"string" | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/AuthAccounts/\_getAccountByIdSafe

**Description:** Retrieves account details without password hash for a given user ID.

**Requirements:**

- The user ID exists.

**Effects:**

- Returns the account details without password hash.

**Request Body:**
{
"userId": "ID"
}

**Success Response Body (Query):**
{
"name": "string",
"email": "string"
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/AuthAccounts/\_getAllUsers

**Description:** Retrieves all users in the system (for admin use).

**Requirements:**

- Caller is an admin.

**Effects:**

- Returns all user accounts with their details (without password hash).

**Request Body:**
{
"caller": "ID"
}

**Success Response Body (Query):**
[
{
"\_id": "ID",
"name": "string",
"email": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

# API Specification: ApplicationAssignments Concept

**Purpose:** Manage user-to-application assignment data, track reads, and assign applications one at a time to users for review, allowing skips.

---

## API Endpoints

### POST /api/ApplicationAssignments/registerApplicationForAssignment

**Description:** Registers a new application for assignment within an event.

**Requirements:**

- None; if already registered, no effect.

**Effects:**

- Creates an `AppStatus` entry for the `(application, event)` pair with `readsCompleted = 0` and empty readers list.

**Request Body:**
{
"application": "ID",
"event": "ID"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/getNextAssignment

**Description:** Assigns the next eligible application to a user for review. Automatically expires assignments older than 12 hours.

**Requirements:**

- The user has no current assignment for this event, or their current assignment is older than 12 hours.

**Effects:**

- If the user has an assignment older than 12 hours, it is deleted.
- If the user has a valid current assignment, it is returned.
- Otherwise, selects an application the user has not read/skipped and that has the fewest reads so far.
- Creates a new `CurrentAssignment` record (if no valid assignment existed).

**Request Body:**
{
"user": "ID",
"event": "ID",
"startTime": "Date"
}

**Success Response Body (Action):**
{
"assignment": {
"\_id": "ID",
"user": "ID",
"application": "ID",
"startTime": "Date",
"event": "ID"
}
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/skipAssignment

**Description:** Allows a user to skip their current assignment.

**Requirements:**

- The specified assignment exists and belongs to the user.

**Effects:**

- Deletes any existing review record for this application by this user (if it exists).
- Removes any flags associated with the deleted review.
- Deletes any scores and comments associated with the deleted review.
- Creates a skip record (increments skip count).
- Adds the user to the readers set for the related `AppStatus`.
- Deletes the current assignment.

**Request Body:**
{
"user": "ID",
"assignment": {
"\_id": "ID",
"user": "ID",
"application": "ID",
"startTime": "Date",
"event": "ID"
}
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/submitAndIncrement

**Description:** Submits a completed assignment and increments the read count for that application.

**Requirements:**

- The specified assignment exists and belongs to the user.

**Effects:**

- Increments `readsCompleted` in `AppStatus`.
- Adds the user to the readers set.
- Deletes the current assignment.
- Returns the `application` ID.

**Request Body:**
{
"user": "ID",
"assignment": {
"\_id": "ID",
"user": "ID",
"application": "ID",
"startTime": "Date",
"event": "ID"
},
"endTime": "Date",
"activeTime": "number (optional)"
}

**Success Response Body (Action):**
{
"application": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/abandonAssignment

**Description:** Allows a user to abandon their current assignment and mark it as incomplete.

**Requirements:**

- The user has an active assignment for this event.

**Effects:**

- Deletes the user's current assignment from the database without incrementing reads or adding to readers.

**Request Body:**
{
"user": "ID",
"event": "ID"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/getCurrentAssignment

**Description:** Returns the user's current active assignment for an event, if one exists. Automatically expires assignments older than 12 hours.

**Requirements:**

- None.

**Effects:**

- Returns the current assignment if it exists and is not older than 12 hours.
- Returns null if no assignment exists or the assignment has expired.

**Request Body:**
{
"user": "ID",
"event": "ID"
}

**Success Response Body (Query):**
{
"assignment": {
"\_id": "ID",
"user": "ID",
"application": "ID",
"startTime": "Date",
"event": "ID"
} | null
}

**Error Response Body:**
{
"error": "string"
}

---

# API Specification: ApplicationStorage Concept

**Purpose:** Store and manage applications and AI-generated review comments based on rubric and questions.

---

## API Endpoints

### POST /api/ApplicationStorage/addApplication

**Description:** Adds a new application to an event.

**Requirements:**

- `applicantID` and `applicantYear` are non-empty.
- `answers` is non-empty.

**Effects:**

- Creates an application record for the event with applicant data and answers.

**Request Body:**
{
"adder": "string",
"event": "ID",
"applicantID": "string",
"applicantYear": "string",
"answers": ["string"]
}

**Success Response Body (Action):**
{
"application": "ID",
"event": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/generateAIComments

**Description:** Generates AI feedback comments for an application using rubric and questions.

**Requirements:**

- Application with the given ID exists.

**Effects:**

- Deletes existing AI comments.
- Inserts AI-generated comments grouped by category (`Strong`, `Weak`, `Attention`).

**Request Body:**
{
"application": "ID",
"questions": ["string"],
"rubric": ["string"],
"eligibilityCriteria": ["string"]
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/\_getAICommentsByApplication

**Description:** Retrieves all AI comments for a specific application.

**Requirements:**

- Application exists.

**Effects:**

- Returns all stored comments.

**Request Body:**
{
"application": "ID"
}

**Success Response Body (Query):**
[
{
"_id": "ID",
"application": "ID",
"category": "Strong|Weak|Attention",
"quotedSnippet": "string",
"justification": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/\_getApplication

**Description:** Retrieves an application by its ID.

**Requirements:**

- Application exists.

**Effects:**

- Returns the application document.

**Request Body:**
{
"application": "ID"
}

**Success Response Body (Query):**
[
{
"\_id": "ID",
"event": "ID",
"applicantID": "string",
"applicantYear": "string",
"answers": ["string"]
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/\_getApplicationsByEvent

**Description:** Retrieves all applications for a specific event.

**Requirements:**

- Event exists.

**Effects:**

- Returns all application documents for the event.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
[
{
"\_id": "ID",
"event": "ID",
"applicantID": "string",
"applicantYear": "string",
"answers": ["string"]
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/_bulkImportApplications

**Description:** Bulk import applications from CSV data.

**Requirements:**

- Event exists and is valid
- `importedBy` user exists and is admin
- Each application has valid `applicantID`, `applicantYear`, and `answers` array
- `answers` array length must match the number of questions for the event
- No duplicate `applicantID` values within the same event

**Effects:**

- Creates Application documents for each valid application
- Calls `generateAIComments` for each successfully created application
- Returns count of successful imports and list of errors for failed imports

**Request Body:**
{
"event": "string (event ID)",
"applications": [
{
"applicantID": "string",
"applicantYear": "string",
"answers": ["string", "string", ...]
}
],
"importedBy": "string (user ID)"
}

**Success Response Body (Action):**
{
"success": true,
"importedCount": 5,
"errors": [
{
"applicantID": "string",
"error": "string"
}
]
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/_getFlaggedApplications

**Description:** Get all flagged applications for an event (for admin dashboard). This endpoint looks for applications that have been flagged by readers through the ReviewRecords system.

**Requirements:**

- Event exists

**Effects:**

- Returns all flagged applications with flagging and disqualification details
- Sources flagging data from ReviewRecords.redFlags collection
- Sorted by review submission time (newest first)
- flagReason will be "Flagged by reader" (default value)

**Request Body:**
{
"event": "string (event ID)"
}

**Success Response Body (Query):**
[
{
"_id": "string",
"applicantID": "string",
"applicantYear": "string",
"answers": ["string", "string", ...],
"flaggedBy": "string (user who flagged the review)",
"flaggedAt": "string (ISO date - review submission time)",
"flagReason": "string (always 'Flagged by reader')",
"disqualified": boolean,
"disqualificationReason": "string",
"disqualifiedAt": "string (ISO date)",
"disqualifiedBy": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/_disqualifyApplication

**Description:** Officially disqualify a flagged application (admin action).

**Requirements:**

- Application exists and is flagged
- disqualifiedBy user is admin
- reason is non-empty

**Effects:**

- Set disqualification details on the application
- Log the disqualification action

**Request Body:**
{
"application": "string (application ID)",
"reason": "string (disqualification reason)",
"disqualifiedBy": "string (admin user ID)",
"disqualifiedAt": "string (ISO date)"
}

**Success Response Body (Action):**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/_removeFlag

**Description:** Remove flag from an application (admin action). This endpoint removes the actual red flags from the ReviewRecords system.

**Requirements:**

- Application exists and is flagged
- removedBy user is admin

**Effects:**

- Remove red flags from ReviewRecords.redFlags collection
- Keep disqualification status if already disqualified
- Log the flag removal action

**Request Body:**
{
"application": "string (application ID)",
"removedBy": "string (admin user ID)",
"removedAt": "string (ISO date)"
}

**Success Response Body (Action):**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/_undisqualifyApplication

**Description:** Remove disqualification status from an application (admin action).

**Requirements:**

- Admin authorization required
- Application must be currently disqualified
- Application must exist

**Effects:**

- Removes disqualification status from the application
- Preserves flagging status (application remains flagged if it was flagged)
- Logs the un-disqualification action with timestamp and admin user

**Request Body:**
{
"application": "string (application ID)",
"undisqualifiedBy": "string (admin user ID)",
"reason": "string (optional reason for un-disqualification)"
}

**Success Response Body:**
{
"success": true,
"message": "Application un-disqualified successfully"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationStorage/_getDisqualifiedApplications

**Description:** Get all disqualified applications for CSV export.

**Requirements:**

- Event exists

**Effects:**

- Returns all disqualified applications with disqualification details
- Sorted by disqualifiedAt (newest first)

**Request Body:**
{
"event": "string (event ID)"
}

**Success Response Body (Query):**
[
{
"_id": "string",
"applicantID": "string",
"disqualificationReason": "string",
"disqualifiedAt": "string (ISO date)",
"disqualifiedBy": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

# API Specification: EventDirectory Concept

**Purpose:** Manage events, admins, and reader memberships with configuration and verification controls.

---

## API Endpoints

### POST /api/EventDirectory/createEvent

**Description:** Creates a new event.

**Requirements:**

- Caller is an admin.
- No event with the same name exists.

**Effects:**

- Adds a new event, sets it active, and returns its ID. Stores the optional `"endDate"` field if provided.

**Request Body:**
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
"endDate": "Date (optional)"
}

**Success Response Body (Action):**
{
"event": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/activateEvent

**Description:** Activates an event.

**Requirements:**

- Caller is admin.
- Event exists and is inactive.

**Effects:**

- Sets `active = true`.

**Request Body:**
{
"caller": "ID",
"name": "string"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/inactivateEvent

**Description:** Inactivates an event.

**Requirements:**

- Caller is admin.
- Event exists and is active.

**Effects:**

- Sets `active = false`.

**Request Body:**
{
"caller": "ID",
"name": "string"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/updateEventConfig

**Description:** Updates event settings.

**Requirements:**

- Caller is admin.
- Event exists.

**Effects:**

- Updates `rubric`, `requiredReadsPerApp`, `eligibilityCriteria`, or `endDate` for the event.

**Request Body:**
{
"caller": "ID",
"event": "ID",
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
"eligibilityCriteria": ["string"],
"endDate": "Date (optional)"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/addReader

**Description:** Approves a user as a verified reader for an event.

**Requirements:**

- Caller is admin.
- Event exists.

**Effects:**

- Adds or updates a membership record with `verified = true`.

**Request Body:**
{
"caller": "ID",
"event": "ID",
"user": "ID"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/removeReader

**Description:** Revokes a reader’s verification.

**Requirements:**

- Caller is admin.
- User is verified for the event.

**Effects:**

- Updates membership to `verified = false`.

**Request Body:**
{
"caller": "ID",
"event": "ID",
"user": "ID"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/addAdmin

**Description:** Grants admin privileges to a user.

**Requirements:**

- Caller is admin.
- Target user is not already admin.

**Effects:**

- Inserts user into admins collection.

**Request Body:**
{
"caller": "ID",
"user": "ID"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/removeAdmin

**Description:** Removes admin privileges.

**Requirements:**

- Caller is admin.
- User is admin.

**Effects:**

- Deletes user from admin collection.

**Request Body:**
{
"caller": "ID",
"user": "ID"
}

**Success Response Body (Action):**
{}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_getEventByName

**Description:** Retrieves event details by name.

**Requirements:**

- Event exists.

**Effects:**

- Returns event document.

**Request Body:**
{
"name": "string"
}

**Success Response Body (Query):**
{
"\_id": "ID",
"name": "string",
"active": "boolean",
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
"eligibilityCriteria": ["string"],
"questions": ["string"],
"endDate": "Date"
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_getEventById

**Description:** Retrieves event details by event ID.

**Requirements:**

- Event with the given ID exists.

**Effects:**

- Returns the event document.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
{
"\_id": "ID",
"name": "string",
"active": "boolean",
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
"eligibilityCriteria": ["string"],
"questions": ["string"],
"endDate": "Date"
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_isReaderVerified

**Description:** Checks whether a user is a verified reader for a given event.

**Requirements:**

- Event and user IDs are valid.

**Effects:**

- Returns the verification status.

**Request Body:**
{
"event": "ID",
"user": "ID"
}

**Success Response Body (Query):**
{
"verified": true | false
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_getUserMembership

**Description:** Retrieves the membership record for a user in a specific event.

**Requirements:**

- Event and user IDs are valid.

**Effects:**

- Returns the membership document if it exists.

**Request Body:**
{
"event": "ID",
"user": "ID"
}

**Success Response Body (Query):**
{
"\_id": "ID",
"event": "ID",
"user": "ID",
"verified": true | false
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_getVerifiedEventsForUser

**Description:** Retrieves all events for which the user is a verified reader.

**Requirements:**

- User ID is valid.

**Effects:**

- Returns a list of event IDs.

**Request Body:**
{
"user": "ID"
}

**Success Response Body (Query):**
[
{
"event": "ID",
"name": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_getActiveVerifiedEventsForUser

**Description:** Retrieves all ACTIVE events for which the user is a verified reader. This is similar to `_getVerifiedEventsForUser` but filters to only return events where `active === true`.

**Requirements:**

- User ID is valid.
- Only returns events where the user is a verified reader AND the event is active.

**Effects:**

- Returns a list of event IDs and names for active events only.

**Request Body:**
{
"user": "ID"
}

**Success Response Body (Query):**
[
{
"event": "ID",
"name": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/flagAndSkip

**Description:** Flags an application and skips to the next one by creating a review record with a red flag.

**Requirements:**

- Assignment exists and belongs to the user.

**Effects:**

- Creates a review record with current timestamp (so flagged applications appear in history).
- Adds a red flag to the review (proper flagging in ReviewRecords system).
- Does NOT create skip record (flagging should not increment skip count).
- Adds user to readers set (prevents random re-assignment, but accessible via dropdown).
- Deletes the current assignment.

**Request Body:**
{
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

**Success Response Body:**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/\_getUserFlaggedApplications

**Description:** Retrieves all applications a user has flagged (without reviewing).

**Requirements:**

- User and event IDs are valid.

**Effects:**

- Returns all applications the user has flagged for this event with timestamps and application details.

**Request Body:**
{
"user": "ID",
"event": "ID"
}

**Success Response Body (Query):**
[
{
"application": "ID",
"timestamp": "string (ISO timestamp)",
"reason": "string (optional)",
"applicationDetails": {
"_id": "string",
"applicantID": "string",
"applicantYear": "string"
}
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_getPendingReadersForEvent

**Description:** Retrieves all users who have requested to be readers for an event but are not yet verified.

**Requirements:**

- Event ID is valid.

**Effects:**

- Returns a list of user IDs who are pending verification for the event.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
[
{
"user": "ID"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/\_isAdmin

**Description:** Checks whether a user is an administrator.

**Requirements:**

- User ID is valid.

**Effects:**

- Returns the admin status of the user.

**Request Body:**
{
"user": "ID"
}

**Success Response Body (Query):**
{
"isAdmin": true | false
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/_getQuestionsForEvent

**Description:** Retrieves the questions for a specific event.

**Requirements:**

- Event exists.

**Effects:**

- Returns the questions array for the event.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
{
"questions": ["string"]
} | {
"error": "string"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/_getVerifiedReadersForEvent

**Description:** Returns all verified readers for a specific event with their names.

**Requirements:**

- Event with the given ID exists.

**Effects:**

- Returns an array of verified members with their user IDs and names.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
[
{
"user": "ID",
"name": "string"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/_getAllMembersForEvent

**Description:** Returns all members (both verified and unverified) for a specific event with their names.

**Requirements:**

- Event with the given ID exists.

**Effects:**

- Returns an array of all members with their user IDs, names, and verification status.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
[
{
"user": "ID",
"name": "string",
"verified": true | false
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/EventDirectory/getAllEvents

**Description:** Retrieves all events in the system (admin only).

**Requirements:**

- Caller is an admin.

**Effects:**

- Returns all events with their full details.

**Request Body:**
{
"caller": "ID"
}

**Success Response Body (Query):**
[
{
"\_id": "ID",
"name": "string",
"active": "boolean",
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
"eligibilityCriteria": ["string"],
"questions": ["string"],
"endDate": "Date"
}
]

**Error Response Body:**
{
"error": "string"
}

---

# API Specification: ReviewRecords Concept

**Purpose:** Store and manage reviews, scores, flags, and comments for each application.

---

## API Endpoints

### POST /api/ReviewRecords/submitReview

**Description:** Submits a new review for an application.

**Requirements:**

- Author has not already reviewed the application.

**Effects:**

- Creates a review document and returns its ID.

**Request Body:**
{
"author": "ID",
"application": "ID",
"currentTime": "Date",
"activeTime": "number (optional)"
}

**Success Response Body (Action):**
{
"review": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/setScore

**Description:** Sets or updates a score for a criterion in a review.

**Requirements:**

- Author must be the review’s creator.

**Effects:**

- Inserts or updates a score document for that criterion.

**Request Body:**
{
"author": "ID",
"review": "ID",
"criterion": "string",
"value": "number"
}

**Success Response Body (Action):**
{
"application": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/editReview

**Description:** Allows an author to mark a review as editable.

**Requirements:**

- Editor is the author.

**Effects:**

- Enables subsequent score edits.

**Request Body:**
{
"editor": "ID",
"review": "ID"
}

**Success Response Body (Action):**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/addRedFlag

**Description:** Adds a red flag to a review.

**Requirements:**

- Author is the review’s author.
- Author hasn’t flagged this review before.

**Effects:**

- Creates a RedFlag document.

**Request Body:**
{
"author": "ID",
"review": "ID"
}

**Success Response Body (Action):**
{
"flag": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/removeRedFlag

**Description:** Removes a red flag.

**Requirements:**

- Author previously added a flag to this review.

**Effects:**

- Deletes the RedFlag document.

**Request Body:**
{
"author": "ID",
"review": "ID"
}

**Success Response Body (Action):**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/addComment

**Description:** Adds a comment directly to an application.

**Requirements:**

- Application exists.
- `text` is non-empty.

**Effects:**

- Creates a new UserComment document linked to the application.
- Returns the comment ID.

**Request Body:**
{
"author": "ID",
"application": "ID",
"text": "string",
"quotedSnippet": "string"
}

**Success Response Body (Action):**
{
"comment": "ID"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/editComment

**Description:** Edits a comment text.

**Requirements:**

- Author is the comment's author.
- `newText` is non-empty.

**Effects:**

- Updates the comment text.

**Request Body:**
{
"author": "ID",
"comment": "ID",
"newText": "string"
}

**Success Response Body (Action):**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/deleteComment

**Description:** Deletes a comment.

**Requirements:**

- Author is the comment's author.

**Effects:**

- Deletes the comment.

**Request Body:**
{
"author": "ID",
"comment": "ID"
}

**Success Response Body (Action):**
{
"success": true
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/_getReviewsWithScoresByApplication

**Description:** Retrieves all reviews and their scores for a specific application.

**Requirements:**

- Application exists.

**Effects:**

- Returns all reviews with their scores for the application.

**Request Body:**
{
"application": "ID"
}

**Success Response Body (Query):**
[
{
"review": "ID",
"author": "ID",
"submittedAt": "Date",
"activeTime": "number",
"scores": [
{
"criterion": "string",
"value": "number"
}
]
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/_calculateWeightedAverages

**Description:** Calculates weighted average scores for all applications based on provided criterion weights.

**Requirements:**

- Total weight must be greater than zero.

**Effects:**

- Returns weighted averages for each application.

**Request Body:**
{
"weights": {
"criterion1": "number",
"criterion2": "number"
}
}

**Success Response Body (Query):**
[
{
"application": "ID",
"weightedAverage": "number",
"numReviews": "number"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/\_getUserReviewProgress

**Description:** Retrieves review progress for a user in an event.

**Requirements:**

- Event exists.

**Effects:**

- Returns the number of reviews completed and total reviews needed for the user.

**Request Body:**
{
"user": "ID",
"event": "ID"
}

**Success Response Body (Query):**
{
"reviewsCompleted": "number",
"totalNeeded": "number"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/\_getCommentsByApplication

**Description:** Retrieves all comments for a specific application.

**Requirements:**

- Application exists (or return empty array).

**Effects:**

- Returns all comments associated with this application, ordered by timestamp.

**Request Body:**
{
"application": "ID"
}

**Success Response Body (Query):**
[
{
"_id": "string",
"author": "string (user ID)",
"text": "string",
"quotedSnippet": "string",
"timestamp": "string (ISO date)"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/\_getReaderStatsForEvent

**Description:** Get comprehensive reader statistics for all readers in an event.

**Requirements:**

- Event ID is valid.

**Effects:**

- Returns array of reader statistics with read counts and total times.
- Includes all users who have at least one review.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
[
{
"userId": "string",
"readCount": "number",
"totalTime": "number"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ApplicationAssignments/\_getSkipStatsForEvent

**Description:** Get skip statistics for all users who interacted with assignments in an event.

**Requirements:**

- Event ID is valid.

**Effects:**

- Returns skip counts per user.

**Request Body:**
{
"event": "ID"
}

**Success Response Body (Query):**
[
{
"userId": "string",
"skipCount": "number"
}
]

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/deleteReview

**Description:** Deletes a review by its ID. Only the author of the review can delete it.

**Requirements:**

- User must be authenticated.
- User must be the author of the review being deleted.
- Review ID must exist.

**Effects:**

- Removes the review from the database.
- Deletes all related scores and red flags.
- Returns success confirmation.

**Request Body:**
{
"reviewId": "ID",
"user": "ID"
}

**Success Response Body:**
{
"success": true,
"message": "string"
}

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/\_hasUserFlaggedApplication

**Description:** Checks if a user has flagged a specific application.

**Requirements:**

- User and application IDs are valid.

**Effects:**

- Returns true if the user has flagged this application, false otherwise.

**Request Body:**
{
"user": "ID",
"application": "ID"
}

**Success Response Body (Query):**
true | false

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/\_getUserScoresForApplication

**Description:** Retrieves all scores a user submitted for a specific application in their review.

**Requirements:**

- User and application IDs are valid.

**Effects:**

- Returns the review ID and all scores the user submitted for this application.
- Returns null if the user hasn't reviewed this application yet.

**Request Body:**
{
"user": "ID",
"application": "ID"
}

**Success Response Body (Query):**
{
"review": "ID",
"scores": [
{
"criterion": "string",
"value": "number"
}
]
} | null

**Error Response Body:**
{
"error": "string"
}

---

### POST /api/ReviewRecords/\_getUserReviewedApplications

**Description:** Retrieves all applications a user has reviewed for a specific event.

**Requirements:**

- User and event IDs are valid.

**Effects:**

- Returns all applications the user has reviewed for this event with timestamps and application details.

**Request Body:**
{
"user": "ID",
"event": "ID"
}

**Success Response Body (Query):**
[
{
"application": "ID",
"submittedAt": "string (ISO timestamp)",
"applicationDetails": {
"_id": "string",
"applicantID": "string",
"applicantYear": "string"
},
"isFlagged": "boolean (optional)",
"flagReason": "string (optional)"
}
]

**Error Response Body:**
{
"error": "string"
}
