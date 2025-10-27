---
timestamp: 'Wed Oct 22 2025 13:37:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_133732.53312356.md]]'
content_id: 4bfcae835b4ef085116a6173177e2c1e695d72509bfb3fec067a1dd6c2354175
---

# API Specification: EventDirectory Concept

**Purpose:** provide a centralized directory for events, allowing users to register, view, and manage event details

***

## API Endpoints

### POST /api/EventDirectory/createEvent

**Description:** Creates a new event with a given name, description, and start/end times.

**Requirements:**

* No event with the given `name` already exists.
* `startTime` is before `endTime`.

**Effects:**

* Creates a new Event `e`; sets `e.name` to `name`, `e.description` to `description`, `e.startTime` to `startTime`, `e.endTime` to `endTime`; returns `e` as `eventId`.

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

***

### POST /api/EventDirectory/updateEvent

**Description:** Updates the details of an existing event.

**Requirements:**

* Event with `eventId` exists.
* If `newStartTime` and `newEndTime` are provided, `newStartTime` must be before `newEndTime`.

**Effects:**

* Updates the `name`, `description`, `startTime`, and/or `endTime` of the event `eventId` if provided.

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

***

### POST /api/EventDirectory/deleteEvent

**Description:** Deletes an event from the directory.

**Requirements:**

* Event with `eventId` exists.

**Effects:**

* Deletes the event `eventId` and all associated data.

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

***

### POST /api/EventDirectory/\_getEventDetails

**Description:** Retrieves the details of a specific event.

**Requirements:**

* Event with `eventId` exists.

**Effects:**

* Returns the `name`, `description`, `startTime`, and `endTime` of the event `eventId`.

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

***

### POST /api/EventDirectory/\_listAllEvents

**Description:** Lists all events currently in the directory.

**Requirements:**

* true

**Effects:**

* Returns a set of all events, each with its `eventId`, `name`, `description`, `startTime`, and `endTime`.

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

***

### POST /api/EventDirectory/\_searchEventsByName

**Description:** Searches for events whose names contain a given query string.

**Requirements:**

* true

**Effects:**

* Returns a set of events whose `name` contains the `query` string, each with its `eventId`, `name`, `description`, `startTime`, and `endTime`.

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

***
