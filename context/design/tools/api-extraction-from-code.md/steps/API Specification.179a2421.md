---
timestamp: 'Wed Oct 22 2025 12:37:27 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_123727.d77e92a8.md]]'
content_id: 179a2421dc0053b4da7166ff46fba2c8bab29a207cd85883fb4d0c5d3a89e935
---

# API Specification: AuthAccounts Concept

**Purpose:** support authentication by associating a user with a username and password

***

## API Endpoints

### POST /api/AuthAccounts/register

**Description:** Registers a new user with a unique username and password.

**Requirements:**

* no User with the given `username` already exists

**Effects:**

* creates a new User `u`
* sets the username of `u` to `username`
* sets the password of `u` to `password`
* returns `u` as `user`

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

***

### POST /api/AuthAccounts/login

**Description:** Authenticates a user with the provided username and password.

**Requirements:**

* a User `u` with the given `username` and `password` exists

**Effects:**

* returns `u` as `user`

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

***

### POST /api/AuthAccounts/\_getUsername

**Description:** Retrieves the username associated with a given user identifier.

**Requirements:**

* user exists

**Effects:**

* returns the username of the user

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

***
