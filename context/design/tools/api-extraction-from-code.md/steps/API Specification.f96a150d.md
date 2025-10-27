---
timestamp: 'Wed Oct 22 2025 13:37:32 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251022_133732.53312356.md]]'
content_id: f96a150dbc5ca816283726ccebfc86a1ea6282600092bd662cb5eaa7c14a220d
---

# API Specification: ReviewRecords Concept

**Purpose:** manage and store reviews for items, allowing users to submit ratings and comments

***

## API Endpoints

### POST /api/ReviewRecords/submitReview

**Description:** Submits a new review for a given item by a user.

**Requirements:**

* `item` and `user` exist (conceptually); `rating` is between 1 and 5.
* No existing review from `user` for `item`.

**Effects:**

* Creates a new Review `r`; sets `r.item` to `item`, `r.user` to `user`, `r.rating` to `rating`, `r.comment` to `comment`, `r.timestamp` to current time; returns `r` as `reviewId`.

**Request Body:**

```json
{
  "item": "ID",
  "user": "ID",
  "rating": "number",
  "comment": "string"
}
```

**Success Response Body (Action):**

```json
{
  "reviewId": "ID"
}
```

**Error Response Body:**

```json
{
  "error": "string"
}
```

***

### POST /api/ReviewRecords/updateReview

**Description:** Updates the rating and/or comment of an existing review.

**Requirements:**

* Review with `reviewId` exists and belongs to `user` for `item`.
* If `newRating` is provided, it must be between 1 and 5.

**Effects:**

* Updates the `rating` and/or `comment` of the review `reviewId`; updates `r.timestamp` to current time.

**Request Body:**

```json
{
  "reviewId": "ID",
  "item": "ID",
  "user": "ID",
  "newRating": "number",
  "newComment": "string"
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

### POST /api/ReviewRecords/deleteReview

**Description:** Deletes a specific review.

**Requirements:**

* Review with `reviewId` exists and belongs to `user` for `item`.

**Effects:**

* Deletes the review `reviewId`.

**Request Body:**

```json
{
  "reviewId": "ID",
  "item": "ID",
  "user": "ID"
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

### POST /api/ReviewRecords/\_getReviewsForItem

**Description:** Retrieves all reviews for a given item.

**Requirements:**

* `item` exists (conceptually).

**Effects:**

* Returns a set of reviews for `item`, each with its `reviewId`, `user`, `rating`, `comment`, and `timestamp`.

**Request Body:**

```json
{
  "item": "ID"
}
```

**Success Response Body (Query):**

```json
[
  {
    "reviewId": "ID",
    "user": "ID",
    "rating": "number",
    "comment": "string",
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

### POST /api/ReviewRecords/\_getReviewsByUser

**Description:** Retrieves all reviews submitted by a given user.

**Requirements:**

* `user` exists (conceptually).

**Effects:**

* Returns a set of reviews by `user`, each with its `reviewId`, `item`, `rating`, `comment`, and `timestamp`.

**Request Body:**

```json
{
  "user": "ID"
}
```

**Success Response Body (Query):**

```json
[
  {
    "reviewId": "ID",
    "item": "ID",
    "rating": "number",
    "comment": "string",
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

### POST /api/ReviewRecords/\_getAverageRatingForItem

**Description:** Calculates the average rating for a given item.

**Requirements:**

* `item` exists (conceptually).

**Effects:**

* Returns the average rating for `item`.

**Request Body:**

```json
{
  "item": "ID"
}
```

**Success Response Body (Query):**

```json
[
  {
    "averageRating": "number"
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
