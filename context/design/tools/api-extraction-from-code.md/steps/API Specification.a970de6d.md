---
timestamp: 'Wed Oct 22 2025 12:37:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123727.d77e92a8.md]]'
content_id: a970de6d0db5e7f45c8866c0994d8001f913294786b7c565ac67ed5668fb4d12
---

# API Specification: ReviewRecords Concept

**Purpose:** support storing review records for applications by reviewers

***

## API Endpoints

### POST /api/ReviewRecords/save

**Description:** Saves or updates a review record for an application by a reviewer.

**Requirements:**

* true

**Effects:**

* if a Record for the given application and reviewer exists, sets its score to `score` and its comment to `comment`
* otherwise, creates a new Record `r`, sets its application to `application`, its reviewer to `reviewer`, its score to `score`, and its comment to `comment`
* returns the (new or updated) `r` as `record`

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

***

### POST /api/ReviewRecords/delete

**Description:** Deletes a specific review record for an application by a reviewer.

**Requirements:**

* a Record for the given application and reviewer exists

**Effects:**

* deletes the Record for the given application and reviewer

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

### POST /api/ReviewRecords/\_get

**Description:** Retrieves the score and comment of a specific review record.

**Requirements:**

* a Record for the given application and reviewer exists

**Effects:**

* returns the score and comment of the Record for the given application and reviewer

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

***

### POST /api/ReviewRecords/\_listForApplication

**Description:** Lists all review records for a given application.

**Requirements:**

* true

**Effects:**

* returns the set of all Records `r` such that `r`'s application is `application`, each with its record, reviewer, score and comment

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

***

### POST /api/ReviewRecords/\_listForReviewer

**Description:** Lists all review records made by a specific reviewer.

**Requirements:**

* true

**Effects:**

* returns the set of all Records `r` such that `r`'s reviewer is `reviewer`, each with its record, application, score and comment

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

***
