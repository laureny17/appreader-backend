---
timestamp: 'Wed Oct 15 2025 01:43:08 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_014308.1aca5874.md]]'
content_id: 87f003af8cedeb5529402ce842f0b266ad703173cb524ecb76ddb950519beb1e
---

# trace: EventDirectory Principle Fulfillment

This trace demonstrates how the `EventDirectory` concept fulfills its principle, focusing on the administrative management of events and readers, and verifying the `requires` and `effects` of the actions. It also highlights the "approval" aspect of a user becoming a reader.

* **Assumptions**:
  * `adminId` is a valid `User` ID and is already an administrator in the system (managed by an external `Admin` concept or pre-existing state in this concept).
  * `readerAId`, `readerBId` are valid `User` IDs representing potential readers.
  * Initial state: No events, no memberships, no rubric dimensions.

* **Goal**: Demonstrate an administrator's ability to create, configure, activate/inactivate events, and manage event readers, ensuring pre-conditions are met and effects are observed.

* **Step 1: Admin creates an event.**
  * **Action**: `createEvent`
  * **Input**: `caller: adminId`, `name: "Annual Hackathon"`, `requiredReadsPerApp: 2`, `rubric: [{name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5}]`
  * **Expected Output**: `{ event: eventId1 }` (where `eventId1` is the ID of the newly created event).
  * **Expected Effect**: A new `Event` document is added to the `events` collection with `_id: eventId1`, `name: "Annual Hackathon"`, `requiredReadsPerApp: 2`, `rubric` as specified, and `active: true`.

* **Step 2: Admin updates the event configuration, adding more detail.**
  * **Action**: `updateEventConfig`
  * **Input**: `caller: adminId`, `event: eventId1`, `requiredReadsPerApp: 3`, `rubric: [{name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5}, {name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5}]`, `eligibilityCriteria: ["Must be enrolled in a university program"]`
  * **Expected Output**: `{}` (empty record for success).
  * **Expected Effect**: The `Event` document for `eventId1` is updated: `requiredReadsPerApp` changes to `3`, `rubric` now contains two dimensions, and `eligibilityCriteria` is set to the provided array.

* **Step 3: Admin adds a user (`readerAId`) as a verified reader for the event.**
  * **Action**: `addReader`
  * **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
  * **Expected Output**: `{}`.
  * **Expected Effect**: A `Membership` document is created in the `memberships` collection with `event: eventId1`, `User: readerAId`, and `verified: true`. (This fulfills the admin's part of the "can become a reader if approved" principle statement).

* **Step 4: Admin attempts to add the same user (`readerAId`) as a reader again (testing 'requires').**
  * **Action**: `addReader`
  * **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
  * **Expected Output**: `{ error: "user is not already a verified user in event" }` (or similar, reflecting the `requires` clause: "user is not already a verified user in event").
  * **Expected Effect**: No change to the existing `Membership` state.

* **Step 5: Admin adds another user (`readerBId`) as a verified reader.**
  * **Action**: `addReader`
  * **Input**: `caller: adminId`, `event: eventId1`, `user: readerBId`
  * **Expected Output**: `{}`.
  * **Expected Effect**: A `Membership` document is created with `event: eventId1`, `User: readerBId`, and `verified: true`.

* **Step 6: Admin inactivates the event ("archives" it).**
  * **Action**: `inactivateEvent`
  * **Input**: `caller: adminId`, `name: "Annual Hackathon"`
  * **Expected Output**: `{}`.
  * **Expected Effect**: The `Event` document for `eventId1` has its `active` flag set to `false`.

* **Step 7: Admin attempts to update the configuration of the now inactive event.**
  * **Action**: `updateEventConfig`
  * **Input**: `caller: adminId`, `event: eventId1`, `requiredReadsPerApp: 4`, `rubric: [...current rubric...]`, `eligibilityCriteria: ["Must be enrolled in a university program", "Attended info session"]`
  * **Expected Output**: `{}`. (The `updateEventConfig` action's `requires` does not specify the event must be active, so this action should succeed).
  * **Expected Effect**: The `Event` document for `eventId1` is updated with `requiredReadsPerApp: 4` and new `eligibilityCriteria`.

* **Step 8: Admin activates the event again.**
  * **Action**: `activateEvent`
  * **Input**: `caller: adminId`, `name: "Annual Hackathon"`
  * **Expected Output**: `{}`.
  * **Expected Effect**: The `Event` document for `eventId1` has its `active` flag set back to `true`.

* **Step 9: Admin removes a reader (`readerAId`) from the event.**
  * **Action**: `removeReader`
  * **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
  * **Expected Output**: `{}`.
  * **Expected Effect**: The `Membership` document for `event: eventId1` and `User: readerAId` has its `verified` flag set to `false` (making `readerAId` an unverified user for the event).

* **Step 10: Admin attempts to remove the same user (`readerAId`) again (negative test for 'requires').**
  * **Action**: `removeReader`
  * **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
  * **Expected Output**: `{ error: "user is a verified reader for the event" }` (or similar, reflecting the `requires` clause: "user is a verified reader for the event", which `readerAId` no longer is).
  * **Expected Effect**: No change to the existing `Membership` state.

* **Step 11: Final verification of reader states.**
  * **Query**: A hypothetical query (e.g., `_getEventMemberships({ event: eventId1 })`) to retrieve all `Membership` records associated with `eventId1`.
  * **Expected Outcome**: The query returns a list of memberships including:
    * A record for `User: readerBId` with `verified: true`.
    * A record for `User: readerAId` with `verified: false`.
    * This confirms `readerBId` remains an approved reader and `readerAId` has been unverified.
