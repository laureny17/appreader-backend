---
timestamp: 'Wed Oct 22 2025 13:37:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_133732.53312356.md]]'
content_id: b65d43738f160838571055b80fea83e705ab88bbd438d554fbeb1b6443e93e31
---

# API Specification: ApplicationStorage Concept

**Purpose:** manage the storage and retrieval of user-specific application data

***

## API Endpoints

### POST /api/ApplicationStorage/createApplication

**Description:** Registers a new application with the storage system.

**Requirements:**

* No application with the given `name` already exists.

**Effects:**

* Creates a new application `a`; sets `a.name` to `name`; returns `a` as `applicationId`.

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

***

### POST /api/ApplicationStorage/deleteApplication

**Description:** Deletes an existing application and all its associated data.

**Requirements:**

* Application with `applicationId` exists.

**Effects:**

* Deletes the application with `applicationId` and all its associated data (data points for all users).

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

***

### POST /api/ApplicationStorage/saveData

**Description:** Stores or updates a piece of data for a user within a specific application.

**Requirements:**

* User exists (conceptually); Application with `applicationId` exists.

**Effects:**

* Stores `data` for `user` associated with `applicationId`; if data for this user/application/key already exists, it is overwritten.

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

***

### POST /api/ApplicationStorage/\_getData

**Description:** Retrieves a specific piece of data for a user from an application.

**Requirements:**

* User exists (conceptually); Application with `applicationId` exists; Data for the given `user`, `applicationId`, and `key` exists.

**Effects:**

* Returns the stored `data` for the given `user`, `applicationId`, and `key`.

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

***

### POST /api/ApplicationStorage/\_listKeys

**Description:** Lists all data keys stored for a user within a specific application.

**Requirements:**

* User exists (conceptually); Application with `applicationId` exists.

**Effects:**

* Returns a set of all keys associated with the given `user` and `applicationId`.

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

***
