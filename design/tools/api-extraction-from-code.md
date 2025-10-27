[@api-extraction-from-spec](api-extraction-from-spec.md)

# Extracting from code

The following is an explanation of how concepts are implemented, for the purposes of understanding how to extract an API.

[@implementing-concepts](../background/implementing-concepts.md)

# prompt:

Now, analyze the following Concept Implementation and generate the API documentation based on these instructions.
[ApplicationAssignmentsSpec](../concepts/ApplicationAssignments/ApplicationAssignmentsSpec.md)
[@ApplicationAssignmentsConcept](src/concepts/ApplicationAssignments/ApplicationAssignmentsConcept.ts)
[ApplicationStorageSpec](../concepts/ApplicationStorage/ApplicationStorageSpec.md)
[@ApplicationStorageConcept](src/concepts/ApplicationStorage/ApplicationStorageConcept.ts)
[AuthAccountsSpec](../concepts/AuthAccounts/AuthAccountsSpec.md)
[@AuthAccountsConcept](src/concepts/AuthAccounts/AuthAccountsConcept.ts)
[EventDirectorySpec](../concepts/EventDirectory/EventDirectorySpec.md)
[@EventDirectoryConcept](src/concepts/EventDirectory/EventDirectoryConcept.ts)
[ReviewRecordsSpec](../concepts/ReviewRecords/ReviewRecordsSpec.md)
[@ReviewRecordsConcept](src/concepts/ReviewRecords/ReviewRecordsConcept.ts)

# response:


# response:

# API Specification: ApplicationAssignments Concept

**Purpose:** manage the assignment of users to applications, allowing users to apply for applications and administrators to assign them

---

## API Endpoints

### POST /api/ApplicationAssignments/applyForApplication

**Description:** Allows a user to apply for a specific application, creating an assignment record.

**Requirements:**
- user and application exist; no existing assignment for this user and application with status "applied" or "assigned"

**Effects:**
- creates a new Assignment `a`; sets `a.user` to `user`, `a.application` to `application`, `a.status` to "applied", `a.timestamp` to current time; returns `a` as `assignmentId`

**Request Body:**
```json
{
  "user": "ID",
  "application": "ID"
}
```

**Success Response Body (Action):**
```json
{
  "assignmentId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ApplicationAssignments/assignUserToApplication

**Description:** Assigns a user to an application, updating an existing assignment or creating a new one.

**Requirements:**
- user and application exist; no existing assignment for this user and application with status "assigned"

**Effects:**
- if an assignment `a` for `user` and `application` exists, updates `a.status` to "assigned" and `a.timestamp` to current time; otherwise, creates a new Assignment `a`, sets `a.user` to `user`, `a.application` to `application`, `a.status` to "assigned", `a.timestamp` to current time; returns `a` as `assignmentId`

**Request Body:**
```json
{
  "user": "ID",
  "application": "ID"
}
```

**Success Response Body (Action):**
```json
{
  "assignmentId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ApplicationAssignments/unassignUserFromApplication

**Description:** Unassigns a user from an application by changing the assignment status.

**Requirements:**
- user and application exist; an existing assignment for this user and application with status "assigned"

**Effects:**
- updates the assignment `a` for `user` and `application` by setting `a.status` to "unassigned" and `a.timestamp` to current time

**Request Body:**
```json
{
  "user": "ID",
  "application": "ID"
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

### POST /api/ApplicationAssignments/_getAssignmentsByUser

**Description:** Retrieves all assignments associated with a given user.

**Requirements:**
- user exists

**Effects:**
- returns a set of assignments associated with the given user

**Request Body:**
```json
{
  "user": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "id": "ID",
    "application": "ID",
    "status": "string",
    "timestamp": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ApplicationAssignments/_getAssignmentsByApplication

**Description:** Retrieves all assignments associated with a given application.

**Requirements:**
- application exists

**Effects:**
- returns a set of assignments associated with the given application

**Request Body:**
```json
{
  "application": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "id": "ID",
    "user": "ID",
    "status": "string",
    "timestamp": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

# API Specification: ApplicationStorage Concept

**Purpose:** manage the storage and retrieval of user-specific application data

---

## API Endpoints

### POST /api/ApplicationStorage/createApplication

**Description:** Registers a new application with the storage system.

**Requirements:**
- No application with the given `name` already exists.

**Effects:**
- Creates a new application `a`; sets `a.name` to `name`; returns `a` as `applicationId`.

**Request Body:**
```json
{
  "name": "string"
}
```

**Success Response Body (Action):**
```json
{
  "applicationId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ApplicationStorage/deleteApplication

**Description:** Deletes an existing application and all its associated data.

**Requirements:**
- Application with `applicationId` exists.

**Effects:**
- Deletes the application with `applicationId` and all its associated data (data points for all users).

**Request Body:**
```json
{
  "applicationId": "ID"
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

### POST /api/ApplicationStorage/saveData

**Description:** Stores or updates a piece of data for a user within a specific application.

**Requirements:**
- User exists (conceptually); Application with `applicationId` exists.

**Effects:**
- Stores `data` for `user` associated with `applicationId`; if data for this user/application/key already exists, it is overwritten.

**Request Body:**
```json
{
  "user": "ID",
  "applicationId": "ID",
  "key": "string",
  "data": "string"
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

### POST /api/ApplicationStorage/_getData

**Description:** Retrieves a specific piece of data for a user from an application.

**Requirements:**
- User exists (conceptually); Application with `applicationId` exists; Data for the given `user`, `applicationId`, and `key` exists.

**Effects:**
- Returns the stored `data` for the given `user`, `applicationId`, and `key`.

**Request Body:**
```json
{
  "user": "ID",
  "applicationId": "ID",
  "key": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "data": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ApplicationStorage/_listKeys

**Description:** Lists all data keys stored for a user within a specific application.

**Requirements:**
- User exists (conceptually); Application with `applicationId` exists.

**Effects:**
- Returns a set of all keys associated with the given `user` and `applicationId`.

**Request Body:**
```json
{
  "user": "ID",
  "applicationId": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "key": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

# API Specification: AuthAccounts Concept

**Purpose:** support the creation, authentication, and management of user accounts

---

## API Endpoints

### POST /api/AuthAccounts/createAccount

**Description:** Creates a new user account with a unique username and password.

**Requirements:**
- No user with the given `username` already exists.

**Effects:**
- Creates a new User `u`; sets `u.username` to `username` and `u.password` to `password`; returns `u` as `userId`.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**
```json
{
  "userId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/AuthAccounts/authenticate

**Description:** Authenticates a user based on their username and password.

**Requirements:**
- User with `username` and `password` exists.

**Effects:**
- Returns the `userId` of the authenticated user.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response Body (Action):**
```json
{
  "userId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/AuthAccounts/changePassword

**Description:** Allows an authenticated user to change their password.

**Requirements:**
- User with `userId` and `oldPassword` exists.

**Effects:**
- Updates the password of the user `userId` to `newPassword`.

**Request Body:**
```json
{
  "userId": "ID",
  "oldPassword": "string",
  "newPassword": "string"
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

### POST /api/AuthAccounts/deleteAccount

**Description:** Deletes a user account and all associated authentication data.

**Requirements:**
- User with `userId` exists.

**Effects:**
- Deletes the user `userId` from the system.

**Request Body:**
```json
{
  "userId": "ID"
}
```

**Success Response Body (Action):
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

### POST /api/AuthAccounts/_getAccountDetails

**Description:** Retrieves the username for a given user ID.

**Requirements:**
- User with `userId` exists.

**Effects:**
- Returns the username associated with `userId`.

**Request Body:**
```json
{
  "userId": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "username": "string"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

# API Specification: EventDirectory Concept

**Purpose:** provide a centralized directory for events, allowing users to register, view, and manage event details

---

## API Endpoints

### POST /api/EventDirectory/createEvent

**Description:** Creates a new event with a given name, description, and start/end times.

**Requirements:**
- No event with the given `name` already exists.
- `startTime` is before `endTime`.

**Effects:**
- Creates a new Event `e`; sets `e.name` to `name`, `e.description` to `description`, `e.startTime` to `startTime`, `e.endTime` to `endTime`; returns `e` as `eventId`.

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "startTime": "number",
  "endTime": "number"
}
```

**Success Response Body (Action):**
```json
{
  "eventId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/EventDirectory/updateEvent

**Description:** Updates the details of an existing event.

**Requirements:**
- Event with `eventId` exists.
- If `newStartTime` and `newEndTime` are provided, `newStartTime` must be before `newEndTime`.

**Effects:**
- Updates the `name`, `description`, `startTime`, and/or `endTime` of the event `eventId` if provided.

**Request Body:**
```json
{
  "eventId": "ID",
  "name": "string",
  "description": "string",
  "startTime": "number",
  "endTime": "number"
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

### POST /api/EventDirectory/deleteEvent

**Description:** Deletes an event from the directory.

**Requirements:**
- Event with `eventId` exists.

**Effects:**
- Deletes the event `eventId` and all associated data.

**Request Body:**
```json
{
  "eventId": "ID"
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

### POST /api/EventDirectory/_getEventDetails

**Description:** Retrieves the details of a specific event.

**Requirements:**
- Event with `eventId` exists.

**Effects:**
- Returns the `name`, `description`, `startTime`, and `endTime` of the event `eventId`.

**Request Body:**
```json
{
  "eventId": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "name": "string",
    "description": "string",
    "startTime": "number",
    "endTime": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/EventDirectory/_listAllEvents

**Description:** Lists all events currently in the directory.

**Requirements:**
- true

**Effects:**
- Returns a set of all events, each with its `eventId`, `name`, `description`, `startTime`, and `endTime`.

**Request Body:**
```json
{}
```

**Success Response Body (Query):**
```json
[
  {
    "eventId": "ID",
    "name": "string",
    "description": "string",
    "startTime": "number",
    "endTime": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/EventDirectory/_searchEventsByName

**Description:** Searches for events whose names contain a given query string.

**Requirements:**
- true

**Effects:**
- Returns a set of events whose `name` contains the `query` string, each with its `eventId`, `name`, `description`, `startTime`, and `endTime`.

**Request Body:**
```json
{
  "query": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "eventId": "ID",
    "name": "string",
    "description": "string",
    "startTime": "number",
    "endTime": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

# API Specification: ReviewRecords Concept

**Purpose:** manage and store reviews for items, allowing users to submit ratings and comments

---

## API Endpoints

### POST /api/ReviewRecords/submitReview

**Description:** Submits a new review for a given item by a user.

**Requirements:**
- `item` and `user` exist (conceptually); `rating` is between 1 and 5.
- No existing review from `user` for `item`.

**Effects:**
- Creates a new Review `r`; sets `r.item` to `item`, `r.user` to `user`, `r.rating` to `rating`, `r.comment` to `comment`, `r.timestamp` to current time; returns `r` as `reviewId`.

**Request Body:**
```json
{
  "item": "ID",
  "user": "ID",
  "rating": "number",
  "comment": "string"
}
```

**Success Response Body (Action):**
```json
{
  "reviewId": "ID"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ReviewRecords/updateReview

**Description:** Updates the rating and/or comment of an existing review.

**Requirements:**
- Review with `reviewId` exists and belongs to `user` for `item`.
- If `newRating` is provided, it must be between 1 and 5.

**Effects:**
- Updates the `rating` and/or `comment` of the review `reviewId`; updates `r.timestamp` to current time.

**Request Body:**
```json
{
  "reviewId": "ID",
  "item": "ID",
  "user": "ID",
  "newRating": "number",
  "newComment": "string"
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

### POST /api/ReviewRecords/deleteReview

**Description:** Deletes a specific review.

**Requirements:**
- Review with `reviewId` exists and belongs to `user` for `item`.

**Effects:**
- Deletes the review `reviewId`.

**Request Body:**
```json
{
  "reviewId": "ID",
  "item": "ID",
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

### POST /api/ReviewRecords/_getReviewsForItem

**Description:** Retrieves all reviews for a given item.

**Requirements:**
- `item` exists (conceptually).

**Effects:**
- Returns a set of reviews for `item`, each with its `reviewId`, `user`, `rating`, `comment`, and `timestamp`.

**Request Body:**
```json
{
  "item": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "reviewId": "ID",
    "user": "ID",
    "rating": "number",
    "comment": "string",
    "timestamp": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ReviewRecords/_getReviewsByUser

**Description:** Retrieves all reviews submitted by a given user.

**Requirements:**
- `user` exists (conceptually).

**Effects:**
- Returns a set of reviews by `user`, each with its `reviewId`, `item`, `rating`, `comment`, and `timestamp`.

**Request Body:**
```json
{
  "user": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "reviewId": "ID",
    "item": "ID",
    "rating": "number",
    "comment": "string",
    "timestamp": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ReviewRecords/_getAverageRatingForItem

**Description:** Calculates the average rating for a given item.

**Requirements:**
- `item` exists (conceptually).

**Effects:**
- Returns the average rating for `item`.

**Request Body:**
```json
{
  "item": "ID"
}
```

**Success Response Body (Query):**
```json
[
  {
    "averageRating": "number"
  }
]
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---