---
timestamp: 'Wed Oct 22 2025 12:31:52 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123152.93d18d4d.md]]'
content_id: 126adb267ddbf6e52211915db24354a084cbdfe4651a260e94b30276101bafd7
---

# API Specification: ApplicationStorage Concept

**Disclaimer:** The following API documentation for the `ApplicationStorage` concept, including its purpose, principle, actions, and queries, has been **inferred** based on the concept name and typical functionalities found in similar systems, as the explicit concept specification was not provided.

**Purpose:** Provide a persistent and isolated storage mechanism for applications to store configuration or metadata.

***

## API Endpoints

### POST /api/ApplicationStorage/setValue

**Description:** Stores a string value associated with a specific key for a given application.

**Requirements:**

* Application with `applicationId` must exist.
* `key` must be a non-empty string.

**Effects:**

* If an entry for `applicationId` and `key` already exists, its `value` is updated.
* If no entry exists, a new entry is created with the `applicationId`, `key`, and `value`.

**Request Body:**

```json
{
  "applicationId": "string",
  "key": "string",
  "value": "string"
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

### POST /api/ApplicationStorage/deleteKey

**Description:** Deletes a stored key-value pair for a given application.

**Requirements:**

* Application with `applicationId` must exist.
* A value for `key` must exist for `applicationId`.

**Effects:**

* Removes the key-value pair identified by `applicationId` and `key`.

**Request Body:**

```json
{
  "applicationId": "string",
  "key": "string"
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

### POST /api/ApplicationStorage/\_getValue

**Description:** Retrieves the string value associated with a specific key for a given application.

**Requirements:**

* Application with `applicationId` must exist.
* A value for `key` must exist for `applicationId`.

**Effects:**

* Returns the stored value associated with `applicationId` and `key`.

**Request Body:**

```json
{
  "applicationId": "string",
  "key": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "value": "string"
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
