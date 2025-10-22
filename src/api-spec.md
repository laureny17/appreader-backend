# API Specification: ApplicationAssignments Concept

**Purpose:** manage the assignment of applications to reviewers

---

## API Endpoints

### POST /api/ApplicationAssignments/assign

**Description:** Assigns a given application to a specific reviewer.

**Requirements:**
- no Assignment for the given application and reviewer already exists

**Effects:**
- creates a new Assignment `a`
- sets the application of `a` to `application`
- sets the reviewer of `a` to `reviewer`
- returns `a` as `assignment`

**Request Body:**
```json
{
  "application": "string",
  "reviewer": "string"
}
```

**Success Response Body (Action):**
```json
{
  "assignment": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ApplicationAssignments/unassign

**Description:** Removes the assignment of an application from a reviewer.

**Requirements:**
- an Assignment for the given application and reviewer exists

**Effects:**
- deletes the Assignment for the given application and reviewer

**Request Body:**
```json
{
  "application": "string",
  "reviewer": "string"
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

### POST /api/ApplicationAssignments/_getAssignments

**Description:** Retrieves all assignments for a given application.

**Requirements:**
- true

**Effects:**
- returns the set of all assignments `a` such that `a`'s application is `application`, each with its assignment and reviewer

**Request Body:**
```json
{
  "application": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "assignment": "string",
    "reviewer": "string"
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

**Purpose:** store file data associated with an application

---

## API Endpoints

### POST /api/ApplicationStorage/put

**Description:** Stores or updates file data associated with an application.

**Requirements:**
- true

**Effects:**
- if an Application with `application` already exists, sets its content to `content`
- otherwise, creates a new Application with `application` and sets its content to `content`

**Request Body:**
```json
{
  "application": "string",
  "content": "string"
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

### POST /api/ApplicationStorage/delete

**Description:** Deletes file data associated with an application.

**Requirements:**
- an Application with `application` exists

**Effects:**
- deletes the Application with `application`

**Request Body:**
```json
{
  "application": "string"
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

### POST /api/ApplicationStorage/_get

**Description:** Retrieves the file data associated with an application.

**Requirements:**
- an Application with `application` exists

**Effects:**
- returns the content of the Application with `application`

**Request Body:**
```json
{
  "application": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "content": "string"
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

**Purpose:** support authentication by associating a user with a username and password

---

## API Endpoints

### POST /api/AuthAccounts/register

**Description:** Registers a new user with a unique username and password.

**Requirements:**
- no User with the given `username` already exists

**Effects:**
- creates a new User `u`
- sets the username of `u` to `username`
- sets the password of `u` to `password`
- returns `u` as `user`

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
  "user": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/AuthAccounts/login

**Description:** Authenticates a user with the provided username and password.

**Requirements:**
- a User `u` with the given `username` and `password` exists

**Effects:**
- returns `u` as `user`

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
  "user": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/AuthAccounts/_getUsername

**Description:** Retrieves the username associated with a given user identifier.

**Requirements:**
- user exists

**Effects:**
- returns the username of the user

**Request Body:**
```json
{
  "user": "string"
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

**Purpose:** provide a directory of events, each with a description and a timestamp

---

## API Endpoints

### POST /api/EventDirectory/create

**Description:** Creates a new event with a description and timestamp.

**Requirements:**
- true

**Effects:**
- creates a new Event `e`
- sets the description of `e` to `description`
- sets the timestamp of `e` to `timestamp`
- returns `e` as `event`

**Request Body:**
```json
{
  "description": "string",
  "timestamp": "number"
}
```

**Success Response Body (Action):**
```json
{
  "event": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/EventDirectory/delete

**Description:** Deletes an existing event.

**Requirements:**
- an Event `e` with `event` exists

**Effects:**
- deletes `e`

**Request Body:**
```json
{
  "event": "string"
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

### POST /api/EventDirectory/_get

**Description:** Retrieves the description and timestamp of a specific event.

**Requirements:**
- an Event `e` with `event` exists

**Effects:**
- returns the description and timestamp of `e`

**Request Body:**
```json
{
  "event": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "description": "string",
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

### POST /api/EventDirectory/_list

**Description:** Lists all events in the directory with their details.

**Requirements:**
- true

**Effects:**
- returns the set of all Events, each with its event, description and timestamp

**Request Body:**
```json
{}
```

**Success Response Body (Query):**
```json
[
  {
    "event": "string",
    "description": "string",
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

# API Specification: ReviewRecords Concept

**Purpose:** support storing review records for applications by reviewers

---

## API Endpoints

### POST /api/ReviewRecords/save

**Description:** Saves or updates a review record for an application by a reviewer.

**Requirements:**
- true

**Effects:**
- if a Record for the given application and reviewer exists, sets its score to `score` and its comment to `comment`
- otherwise, creates a new Record `r`, sets its application to `application`, its reviewer to `reviewer`, its score to `score`, and its comment to `comment`
- returns the (new or updated) `r` as `record`

**Request Body:**
```json
{
  "application": "string",
  "reviewer": "string",
  "score": "number",
  "comment": "string"
}
```

**Success Response Body (Action):**
```json
{
  "record": "string"
}
```

**Error Response Body:**
```json
{
  "error": "string"
}
```
---

### POST /api/ReviewRecords/delete

**Description:** Deletes a specific review record for an application by a reviewer.

**Requirements:**
- a Record for the given application and reviewer exists

**Effects:**
- deletes the Record for the given application and reviewer

**Request Body:**
```json
{
  "application": "string",
  "reviewer": "string"
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

### POST /api/ReviewRecords/_get

**Description:** Retrieves the score and comment of a specific review record.

**Requirements:**
- a Record for the given application and reviewer exists

**Effects:**
- returns the score and comment of the Record for the given application and reviewer

**Request Body:**
```json
{
  "application": "string",
  "reviewer": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "score": "number",
    "comment": "string"
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

### POST /api/ReviewRecords/_listForApplication

**Description:** Lists all review records for a given application.

**Requirements:**
- true

**Effects:**
- returns the set of all Records `r` such that `r`'s application is `application`, each with its record, reviewer, score and comment

**Request Body:**
```json
{
  "application": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "record": "string",
    "reviewer": "string",
    "score": "number",
    "comment": "string"
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

### POST /api/ReviewRecords/_listForReviewer

**Description:** Lists all review records made by a specific reviewer.

**Requirements:**
- true

**Effects:**
- returns the set of all Records `r` such that `r`'s reviewer is `reviewer`, each with its record, application, score and comment

**Request Body:**
```json
{
  "reviewer": "string"
}
```

**Success Response Body (Query):**
```json
[
  {
    "record": "string",
    "application": "string",
    "score": "number",
    "comment": "string"
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
