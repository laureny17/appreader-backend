[@testing-concepts](../background/testing-concepts.md)

[@EventDirectorySpec](../concepts/EventDirectory/EventDirectorySpec.md)
[@implementation](../concepts/EventDirectory/implementation.md)

[@implementation](../concepts/LikertSurvey/implementation.md)
[@LikertSurvey](../concepts/LikertSurvey/LikertSurvey.md)
[@testing](../concepts/LikertSurvey/testing.md)
# prompt: Observing the sample concept LikertSurvey and how a ~10 step long trace, demonstrating how the principle of the LikertSurvey concept is fulfilled by a sequence of actions, was written for LikertSurvey, brainstorm a similarly in-depth and similar-length trace for the EventDirectory concept, in line with the current spec. Do not implement the actual concept or test suite in code; only provide the trace in bullet points in Markdown.
# response:

# file: src/eventdirectory/EventDirectoryConcept.test.ts

```typescript
// This file would contain the Deno test suite for the EventDirectory concept,
// following the trace outlined below to verify the concept's implementation
// against its specification and principle.
//
// Example structure:
// import { testDb } from "@utils/database.ts";
// import { assertEquals, assertRejects } from "jsr:@std/assert";
// import EventDirectoryConcept from "./EventDirectoryConcept.ts";
// import { ID } from "@utils/types.ts";
//
// Deno.test("EventDirectory Concept Trace", async (test) => {
//   const [db, client] = await testDb();
//   const concept = new EventDirectoryConcept(db);
//
//   const adminId = "user:admin" as ID;
//   const readerAId = "user:alice" as ID;
//   const readerBId = "user:bob" as ID;
//
//   let eventId1: ID;
//
//   await test.step("Step 1: Admin creates an event.", async () => {
//     const rubric = [{ name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 }];
//     const result = await concept.createEvent({ caller: adminId, name: "Annual Hackathon", requiredReadsPerApp: 2, rubric });
//     assert(!("error" in result), `Expected success, got error: ${result.error}`);
//     eventId1 = result.event;
//     assert(eventId1, "Expected event ID to be returned.");
//
//     // Verification (using a hypothetical query or direct collection access)
//     const event = await concept.events.findOne({ _id: eventId1 });
//     assertEquals(event?.name, "Annual Hackathon");
//     assertEquals(event?.active, true);
//     assertEquals(event?.requiredReadsPerApp, 2);
//     assertEquals(event?.rubric?.length, 1);
//   });
//
//   // ... subsequent test steps following the trace
//
//   await client.close();
// });
```

# trace: EventDirectory Principle Fulfillment

This trace demonstrates how the `EventDirectory` concept fulfills its principle, focusing on the administrative management of events and readers, and verifying the `requires` and `effects` of the actions. It also highlights the "approval" aspect of a user becoming a reader.

*   **Assumptions**:
    *   `adminId` is a valid `User` ID and is already an administrator in the system (managed by an external `Admin` concept or pre-existing state in this concept).
    *   `readerAId`, `readerBId` are valid `User` IDs representing potential readers.
    *   Initial state: No events, no memberships, no rubric dimensions.
*   **Goal**: Demonstrate an administrator's ability to create, configure, activate/inactivate events, and manage event readers, ensuring pre-conditions are met and effects are observed.

*   **Step 1: Admin creates an event.**
    *   **Action**: `createEvent`
    *   **Input**: `caller: adminId`, `name: "Annual Hackathon"`, `requiredReadsPerApp: 2`, `rubric: [{name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5}]`
    *   **Expected Output**: `{ event: eventId1 }` (where `eventId1` is the ID of the newly created event).
    *   **Expected Effect**: A new `Event` document is added to the `events` collection with `_id: eventId1`, `name: "Annual Hackathon"`, `requiredReadsPerApp: 2`, `rubric` as specified, and `active: true`.

*   **Step 2: Admin updates the event configuration, adding more detail.**
    *   **Action**: `updateEventConfig`
    *   **Input**: `caller: adminId`, `event: eventId1`, `requiredReadsPerApp: 3`, `rubric: [{name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5}, {name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5}]`, `eligibilityCriteria: ["Must be enrolled in a university program"]`
    *   **Expected Output**: `{}` (empty record for success).
    *   **Expected Effect**: The `Event` document for `eventId1` is updated: `requiredReadsPerApp` changes to `3`, `rubric` now contains two dimensions, and `eligibilityCriteria` is set to the provided array.

*   **Step 3: Admin adds a user (`readerAId`) as a verified reader for the event.**
    *   **Action**: `addReader`
    *   **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
    *   **Expected Output**: `{}`.
    *   **Expected Effect**: A `Membership` document is created in the `memberships` collection with `event: eventId1`, `User: readerAId`, and `verified: true`. (This fulfills the admin's part of the "can become a reader if approved" principle statement).

*   **Step 4: Admin attempts to add the same user (`readerAId`) as a reader again (testing 'requires').**
    *   **Action**: `addReader`
    *   **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
    *   **Expected Output**: `{ error: "user is not already a verified user in event" }` (or similar, reflecting the `requires` clause: "user is not already a verified user in event").
    *   **Expected Effect**: No change to the existing `Membership` state.

*   **Step 5: Admin adds another user (`readerBId`) as a verified reader.**
    *   **Action**: `addReader`
    *   **Input**: `caller: adminId`, `event: eventId1`, `user: readerBId`
    *   **Expected Output**: `{}`.
    *   **Expected Effect**: A `Membership` document is created with `event: eventId1`, `User: readerBId`, and `verified: true`.

*   **Step 6: Admin inactivates the event ("archives" it).**
    *   **Action**: `inactivateEvent`
    *   **Input**: `caller: adminId`, `name: "Annual Hackathon"`
    *   **Expected Output**: `{}`.
    *   **Expected Effect**: The `Event` document for `eventId1` has its `active` flag set to `false`.

*   **Step 7: Admin attempts to update the configuration of the now inactive event.**
    *   **Action**: `updateEventConfig`
    *   **Input**: `caller: adminId`, `event: eventId1`, `requiredReadsPerApp: 4`, `rubric: [...current rubric...]`, `eligibilityCriteria: ["Must be enrolled in a university program", "Attended info session"]`
    *   **Expected Output**: `{}`. (The `updateEventConfig` action's `requires` does not specify the event must be active, so this action should succeed).
    *   **Expected Effect**: The `Event` document for `eventId1` is updated with `requiredReadsPerApp: 4` and new `eligibilityCriteria`.

*   **Step 8: Admin activates the event again.**
    *   **Action**: `activateEvent`
    *   **Input**: `caller: adminId`, `name: "Annual Hackathon"`
    *   **Expected Output**: `{}`.
    *   **Expected Effect**: The `Event` document for `eventId1` has its `active` flag set back to `true`.

*   **Step 9: Admin removes a reader (`readerAId`) from the event.**
    *   **Action**: `removeReader`
    *   **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
    *   **Expected Output**: `{}`.
    *   **Expected Effect**: The `Membership` document for `event: eventId1` and `User: readerAId` has its `verified` flag set to `false` (making `readerAId` an unverified user for the event).

*   **Step 10: Admin attempts to remove the same user (`readerAId`) again (negative test for 'requires').**
    *   **Action**: `removeReader`
    *   **Input**: `caller: adminId`, `event: eventId1`, `user: readerAId`
    *   **Expected Output**: `{ error: "user is a verified reader for the event" }` (or similar, reflecting the `requires` clause: "user is a verified reader for the event", which `readerAId` no longer is).
    *   **Expected Effect**: No change to the existing `Membership` state.

*   **Step 11: Final verification of reader states.**
    *   **Query**: A hypothetical query (e.g., `_getEventMemberships({ event: eventId1 })`) to retrieve all `Membership` records associated with `eventId1`.
    *   **Expected Outcome**: The query returns a list of memberships including:
        *   A record for `User: readerBId` with `verified: true`.
        *   A record for `User: readerAId` with `verified: false`.
        *   This confirms `readerBId` remains an approved reader and `readerAId` has been unverified.