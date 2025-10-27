---
timestamp: 'Wed Oct 22 2025 13:37:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_133732.53312356.md]]'
content_id: e7a189f9223198476955c1ce5ba28e971d0e739724a2b09c01e379a2d5e7b1e3
---

# API Specification: AuthAccounts Concept

**Purpose:** support the creation, authentication, and management of user accounts

***

## API Endpoints

### POST /api/AuthAccounts/createAccount

**Description:** Creates a new user account with a unique username and password.

**Requirements:**

* No user with the given `username` already exists.

**Effects:**

* Creates a new User `u`; sets `u.username` to `username` and `u.password` to `password`; returns `u` as `userId`.

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
  "userId": "ID"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/AuthAccounts/authenticate

**Description:** Authenticates a user based on their username and password.

**Requirements:**

* User with `username` and `password` exists.

**Effects:**

* Returns the `userId` of the authenticated user.

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
  "userId": "ID"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/AuthAccounts/changePassword

**Description:** Allows an authenticated user to change their password.

**Requirements:**

* User with `userId` and `oldPassword` exists.

**Effects:**

* Updates the password of the user `userId` to `newPassword`.

**Request Body:**

```json
{
  "userId": "ID",
  "oldPassword": "string",
  "newPassword": "string"
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

### POST /api/AuthAccounts/deleteAccount

**Description:** Deletes a user account and all associated authentication data.

**Requirements:**

* User with `userId` exists.

**Effects:**

* Deletes the user `userId` from the system.

**Request Body:**

```json
{
  "userId": "ID"
}
```

\*\*Success Response Body (Action):

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

### POST /api/AuthAccounts/\_getAccountDetails

**Description:** Retrieves the username for a given user ID.

**Requirements:**

* User with `userId` exists.

**Effects:**

* Returns the username associated with `userId`.

**Request Body:**

```json
{
  "userId": "ID"
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
