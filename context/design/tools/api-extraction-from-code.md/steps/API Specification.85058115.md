---
timestamp: 'Wed Oct 22 2025 12:37:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123727.d77e92a8.md]]'
content_id: 850581151624c1e26af784cd838e117fba63eb087c149db0dc0dbe4754cbc7d5
---

# API Specification: EventDirectory Concept

**Purpose:** provide a directory of events, each with a description and a timestamp

***

## API Endpoints

### POST /api/EventDirectory/create

**Description:** Creates a new event with a description and timestamp.

**Requirements:**

* true

**Effects:**

* creates a new Event `e`
* sets the description of `e` to `description`
* sets the timestamp of `e` to `timestamp`
* returns `e` as `event`

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

***

### POST /api/EventDirectory/delete

**Description:** Deletes an existing event.

**Requirements:**

* an Event `e` with `event` exists

**Effects:**

* deletes `e`

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

***

### POST /api/EventDirectory/\_get

**Description:** Retrieves the description and timestamp of a specific event.

**Requirements:**

* an Event `e` with `event` exists

**Effects:**

* returns the description and timestamp of `e`

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

***

### POST /api/EventDirectory/\_list

**Description:** Lists all events in the directory with their details.

**Requirements:**

* true

**Effects:**

* returns the set of all Events, each with its event, description and timestamp

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

***
