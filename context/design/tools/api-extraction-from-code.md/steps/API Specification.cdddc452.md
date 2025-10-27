---
timestamp: 'Wed Oct 22 2025 13:37:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_133732.53312356.md]]'
content_id: cdddc45259d664d8cc320f1ad3e64b29e783caff763bfe8a6603b23d8991befe
---

# API Specification: ApplicationAssignments Concept

**Purpose:** manage the assignment of users to applications, allowing users to apply for applications and administrators to assign them

***

## API Endpoints

### POST /api/ApplicationAssignments/applyForApplication

**Description:** Allows a user to apply for a specific application, creating an assignment record.

**Requirements:**

* user and application exist; no existing assignment for this user and application with status "applied" or "assigned"

**Effects:**

* creates a new Assignment `a`; sets `a.user` to `user`, `a.application` to `application`, `a.status` to "applied", `a.timestamp` to current time; returns `a` as `assignmentId`

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

***

### POST /api/ApplicationAssignments/assignUserToApplication

**Description:** Assigns a user to an application, updating an existing assignment or creating a new one.

**Requirements:**

* user and application exist; no existing assignment for this user and application with status "assigned"

**Effects:**

* if an assignment `a` for `user` and `application` exists, updates `a.status` to "assigned" and `a.timestamp` to current time; otherwise, creates a new Assignment `a`, sets `a.user` to `user`, `a.application` to `application`, `a.status` to "assigned", `a.timestamp` to current time; returns `a` as `assignmentId`

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

***

### POST /api/ApplicationAssignments/unassignUserFromApplication

**Description:** Unassigns a user from an application by changing the assignment status.

**Requirements:**

* user and application exist; an existing assignment for this user and application with status "assigned"

**Effects:**

* updates the assignment `a` for `user` and `application` by setting `a.status` to "unassigned" and `a.timestamp` to current time

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

***

### POST /api/ApplicationAssignments/\_getAssignmentsByUser

**Description:** Retrieves all assignments associated with a given user.

**Requirements:**

* user exists

**Effects:**

* returns a set of assignments associated with the given user

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

***

### POST /api/ApplicationAssignments/\_getAssignmentsByApplication

**Description:** Retrieves all assignments associated with a given application.

**Requirements:**

* application exists

**Effects:**

* returns a set of assignments associated with the given application

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

***
