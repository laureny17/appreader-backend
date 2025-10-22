---
timestamp: 'Wed Oct 22 2025 12:37:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123727.d77e92a8.md]]'
content_id: 951cea2f93099b3584305f1a0c7ce7e37f351d9759515a42ef95f9d36f833e37
---

# API Specification: ApplicationStorage Concept

**Purpose:** store file data associated with an application

***

## API Endpoints

### POST /api/ApplicationStorage/put

**Description:** Stores or updates file data associated with an application.

**Requirements:**

* true

**Effects:**

* if an Application with `application` already exists, sets its content to `content`
* otherwise, creates a new Application with `application` and sets its content to `content`

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

***

### POST /api/ApplicationStorage/delete

**Description:** Deletes file data associated with an application.

**Requirements:**

* an Application with `application` exists

**Effects:**

* deletes the Application with `application`

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

***

### POST /api/ApplicationStorage/\_get

**Description:** Retrieves the file data associated with an application.

**Requirements:**

* an Application with `application` exists

**Effects:**

* returns the content of the Application with `application`

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

***
