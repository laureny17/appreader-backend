---
timestamp: 'Wed Oct 22 2025 12:31:52 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123152.93d18d4d.md]]'
content_id: 47f01790994dfad8aaa411220f81eba3352ca2968cb592f1a7375f0886565a1e
---

# API Specification: EventDirectory Concept

**Disclaimer:** The following API documentation for the `EventDirectory` concept, including its purpose, principle, actions, and queries, has been **inferred** based on the concept name and typical functionalities found in similar systems, as the explicit concept specification was not provided.

**Purpose:** Organize and list events, associating them with performers and maintaining event details.

***

## API Endpoints

### POST /api/EventDirectory/createEvent

**Description:** Creates a new event record in the directory.

**Requirements:**

* `name` must be a non-empty string.
* `startTime` must be a valid date/time.
* `performerId` (if provided) must refer to an existing performer.

**Effects:**

* Creates a new event `e`.
* Sets the name, start time, and (optional) performer for `e`.
* Returns the identifier of the new event.

**Request Body:**

```json
{
  "name": "string",
  "description": "string",
  "startTime": "string",
  "location": "string",
  "performerId": "string"
}
```

**Success Response Body (Action):**

```json
{
  "eventId": "string"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/EventDirectory/updateEventDetails

**Description:** Updates details for an existing event.

**Requirements:**

* Event with `eventId` must exist.

**Effects:**

* Updates the specified fields (name, description, startTime, location, performerId) for the event.

**Request Body:**

```json
{
  "eventId": "string",
  "name": "string",
  "description": "string",
  "startTime": "string",
  "location": "string",
  "performerId": "string"
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

### POST /api/EventDirectory/\_getEventsByPerformer

**Description:** Retrieves all events associated with a specific performer.

**Requirements:**

* Performer with `performerId` must exist.

**Effects:**

* Returns a list of events linked to `performerId`.

**Request Body:**

```json
{
  "performerId": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "eventId": "string",
    "name": "string",
    "startTime": "string"
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

### POST /api/EventDirectory/\_getEventDetails

**Description:** Retrieves full details for a specific event.

**Requirements:**

* Event with `eventId` must exist.

**Effects:**

* Returns all available details for the event identified by `eventId`.

**Request Body:**

```json
{
  "eventId": "string"
}
```

**Success Response Body (Query):**

```json
[
  {
    "eventId": "string",
    "name": "string",
    "description": "string",
    "startTime": "string",
    "location": "string",
    "performerId": "string"
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
