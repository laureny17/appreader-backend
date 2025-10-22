---
timestamp: 'Wed Oct 22 2025 12:37:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123727.d77e92a8.md]]'
content_id: dcd0a00db98ede9a32847a580363639cc0e05b2fe1c83e5bad80942705a52ad2
---

# API Specification: ApplicationAssignments Concept

**Purpose:** manage the assignment of applications to reviewers

***

## API Endpoints

### POST /api/ApplicationAssignments/assign

**Description:** Assigns a given application to a specific reviewer.

**Requirements:**

* no Assignment for the given application and reviewer already exists

**Effects:**

* creates a new Assignment `a`
* sets the application of `a` to `application`
* sets the reviewer of `a` to `reviewer`
* returns `a` as `assignment`

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

***

### POST /api/ApplicationAssignments/unassign

**Description:** Removes the assignment of an application from a reviewer.

**Requirements:**

* an Assignment for the given application and reviewer exists

**Effects:**

* deletes the Assignment for the given application and reviewer

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

***

### POST /api/ApplicationAssignments/\_getAssignments

**Description:** Retrieves all assignments for a given application.

**Requirements:**

* true

**Effects:**

* returns the set of all assignments `a` such that `a`'s application is `application`, each with its assignment and reviewer

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

***
