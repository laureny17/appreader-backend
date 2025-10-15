---
timestamp: 'Wed Oct 15 2025 01:04:57 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_010457.e960b2a3.md]]'
content_id: 690f302f7b7c2b39878c67764d9c54b8351ccb914fa9f155b4b810a9ae8d9bec
---

# trace:

This trace demonstrates how the `EventDirectory` concept fulfills its principle, highlighting both administrative control over events and the user journey to becoming an approved reader. It also notes a crucial aspect regarding the current action set's ability to fully model the user registration part of the principle.

**Setup:**

* `adminId`: An existing `User` ID with admin privileges (e.g., `admin:Alice`).
* `applicantId`: A `User` ID who wants to become a reader (e.g., `user:Bob`).
* `anotherApplicantId`: Another `User` ID (e.g., `user:Charlie`).
* `nonAdminId`: A `User` ID without admin privileges (e.g., `user:David`).
* `event1Name`: "Annual Tech Conference 2024"
* `event2Name`: "AI Ethics Workshop"
* `rubricData`: `[{ name: "Clarity", description: "Is the content clear?", scaleMin: 1, scaleMax: 5 }, { name: "Originality", description: "Is the idea novel?", scaleMin: 1, scaleMax: 5 }]`

**Sequence of Actions:**

1. **Admin creates an active event.**
   * **Action**: `createEvent(caller: adminId, name: event1Name, requiredReadsPerApp: 3, rubric: rubricData)`
   * **Requires**: `adminId` is an admin; no other event exists with `event1Name`.
   * **Effects**: A new `EventE1` is created, `active` is `true`, and its configuration is set.
   * **Principle Fulfillment**: Demonstrates "The admin can create events."

2. **Admin updates the event's configuration.**
   * **Action**: `updateEventConfig(caller: adminId, event: EventE1, requiredReadsPerApp: 5, rubric: [...rubricData, { name: "Impact", description: "Potential impact", scaleMin: 1, scaleMax: 10 }], eligibilityCriteria: ["has a valid academic email"])`
   * **Requires**: `adminId` is an admin.
   * **Effects**: `EventE1`'s `requiredReadsPerApp`, `rubric`, and `eligibilityCriteria` fields are updated.
   * **Principle Fulfillment**: Demonstrates "manage rubric/scoring guidelines, number of required reads per application."

3. **Applicant expresses interest in `EventE1` (Hypothetical Action).**
   * **Note**: The principle states, "Users can register for a chosen event and can become a reader if approved (automatically 'pending' for approval)". The current `EventDirectory` concept specification *lacks a direct action* for a non-admin user to "register" or "express interest" in an event, which would initially create an `Membership` entry with `verified: false`. The `addReader` action specifically requires the user to *already be an unverified user*.
   * **For this trace, we assume an implicit or externally-managed mechanism creates a Membership entry for `(EventE1, applicantId)` with `verified: false`.** This represents the "pending for approval" state.
   * **Effects (Hypothetical)**: A `Membership` entry is created for `(EventE1, applicantId)` with `verified: false`.
   * **Principle Fulfillment**: Models the initial "pending" state of user registration.

4. **Admin approves the applicant to become a reader for `EventE1`.**
   * **Action**: `addReader(caller: adminId, event: EventE1, user: applicantId)`
   * **Requires**: `adminId` is an admin; `applicantId` is an unverified user for `EventE1` (as established in step 3); `applicantId` is not already a verified user.
   * **Effects**: The `Membership` for `(EventE1, applicantId)` is updated to `verified: true`.
   * **Principle Fulfillment**: Models the "can become a reader if approved" part and contributes to managing "approved readers for the active event."

5. **Admin attempts to add `anotherApplicantId` as a reader directly (without prior interest).**
   * **Action**: `addReader(caller: adminId, event: EventE1, user: anotherApplicantId)`
   * **Expected Result**: Returns an `error:` (e.g., "User is not an unverified user for event...") because `anotherApplicantId` does not have a `Membership` entry with `verified: false`, failing the `requires` condition.
   * **Principle Test**: This step helps confirm the `requires` clause of `addReader` and the intended workflow where a user first expresses interest.

6. **Non-admin attempts to add another user as an admin.**
   * **Action**: `addAdmin(caller: nonAdminId, user: anotherApplicantId)`
   * **Expected Result**: Returns an `error:` (e.g., "Caller is not an admin.") because `nonAdminId` lacks admin privileges, violating the `requires` clause.
   * **Principle Test**: Confirms the access control for administrative actions.

7. **Admin inactivates `EventE1` (archiving).**
   * **Action**: `inactivateEvent(caller: adminId, name: event1Name)`
   * **Requires**: `adminId` is an admin; `EventE1` is currently active.
   * **Effects**: `EventE1`'s `active` flag is set to `false`.
   * **Principle Fulfillment**: Demonstrates "The admin can ... archive events."

8. **Admin creates another event, `EventE2`.**
   * **Action**: `createEvent(caller: adminId, name: event2Name, requiredReadsPerApp: 2, rubric: [])`
   * **Requires**: `adminId` is an admin; no other event exists with `event2Name`.
   * **Effects**: A new `EventE2` is created, `active` is `true`.
   * **Principle Fulfillment**: Further demonstrates "The admin can create events."

9. **Admin removes `applicantId` as a reader from `EventE1`.**
   * **Action**: `removeReader(caller: adminId, event: EventE1, user: applicantId)`
   * **Requires**: `adminId` is an admin; `applicantId` is a *verified* reader for `EventE1`.
   * **Effects**: The `Membership` for `(EventE1, applicantId)` is updated to `verified: false`. `applicantId` is no longer an approved reader for `EventE1`.
   * **Principle Fulfillment**: Demonstrates the admin's ability to manage "approved readers for the active event" by revoking their verified status.

10. **Admin removes `adminId` as an admin (self-removal).**
    * **Action**: `removeAdmin(caller: adminId, user: adminId)`
    * **Requires**: `adminId` is an admin; `adminId` is also the `caller`.
    * **Effects**: `adminId` is no longer an admin.
    * **Principle Test**: Demonstrates the `removeAdmin` functionality, including self-removal as an edge case for its `requires` conditions.
