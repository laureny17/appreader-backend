---
timestamp: 'Wed Oct 15 2025 02:09:25 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_020925.bafafd09.md]]'
content_id: 1c524b3f1d4e7ed8f46f0aa0c6893831feb44f04c94a917a9023750c8f0f55d8
---

# response:

To make the `EventDirectory` concept compatible with the Deno testing framework, a new test file will be created following the structure of `LikertSurveyConcept.test.ts` and strictly adhering to the "trace: EventDirectory Principle Fulfillment" narrative. The types `Event` and `User` will be treated as `ID` from `@utils/types.ts` as established in the concept implementation. The test file will include necessary Deno imports and setup/teardown procedures, with each step of the trace converted into a `Deno.test` step.

Here is the Deno-compatible test file for `EventDirectoryConcept`:

```typescript
// Required Deno testing framework imports
import { Deno } from "https://deno.land/std@0.210.0/testing/mod.ts";
import {
  assertExists,
  assertEquals,
  assertNotEquals,
  assertArrayIncludes,
} from "https://deno.land/std@0.210.0/assert/mod.ts";

// MongoDB client and utilities
import { MongoClient, Db } from "npm:mongodb";
import { getDb, resetDb } from "../../utils/database.ts"; // Adjusted path to utils
import { ID } from "../../utils/types.ts"; // Adjusted path to utils

// Import the concept to be tested
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Define generic types locally for test clarity, matching the concept's external types
type Event = ID;
type User = ID;

Deno.test("EventDirectory Concept Principle Fulfillment", async (t) => {
  let db: Db;
  let client: MongoClient;
  let concept: EventDirectoryConcept;

  // Define test users and event ID placeholder
  const adminId: User = "user:admin" as ID;
  const readerAId: User = "user:readerA" as ID;
  const readerBId: User = "user:readerB" as ID;
  let eventId1: Event; // This will hold the ID of the event created in step 1

  try {
    // Setup: Initialize database and concept instance
    [db, client] = await getDb();
    concept = new EventDirectoryConcept(db);

    // Reset database to ensure a clean state for the test suite
    await resetDb(db);

    // Initial Admin Setup (direct insert, as per discussion on bootstrapping the first admin)
    await t.step("Initial Admin Setup: Insert first admin directly", async () => {
      await concept["admins"].insertOne({ _id: adminId }); // Accessing private collection for bootstrapping
      const admins = await concept._listAdmins();
      assertExists(admins.users);
      assertArrayIncludes(admins.users, [adminId], `Admin ${adminId} should be in the admin list.`);
    });

    // Step 1: Admin creates an event.
    await t.step("Step 1: Admin creates an event.", async () => {
      const rubricDimensions = [{ name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 }];
      const result = await concept.createEvent({
        caller: adminId,
        name: "Annual Hackathon",
        requiredReadsPerApp: 2,
        rubric: rubricDimensions,
      });

      assertExists(result, "Result should not be undefined");
      assertNotEquals((result as { error?: string }).error, `Only admins can create events.`, "Error: Only admins can create events.");
      assertNotEquals((result as { error?: string }).error, `An event with the name 'Annual Hackathon' already exists.`, "Error: Event name conflict.");
      
      const successfulResult = result as { event: Event };
      assertExists(successfulResult.event, "Event ID should be returned on successful creation.");
      eventId1 = successfulResult.event; // Store the event ID for subsequent steps

      // Verify the state effect
      const event = await concept._getEventById({ id: eventId1 });
      assertExists(event.event, "Newly created event should exist in the database.");
      assertEquals(event.event.name, "Annual Hackathon", "Event name should match.");
      assertEquals(event.event.requiredReadsPerApp, 2, "requiredReadsPerApp should match.");
      assertEquals(event.event.rubric, rubricDimensions, "Rubric should match.");
      assertEquals(event.event.active, true, "Event should be active by default.");
      assertEquals(event.event.eligibilityCriteria, [], "Eligibility criteria should be an empty array initially.");
    });

    // Step 2: Admin updates the event configuration, adding more detail.
    await t.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
      const updatedRubric = [
        { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
        { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
      ];
      const eligibilityCriteria = ["Must be enrolled in a university program"];

      const result = await concept.updateEventConfig({
        caller: adminId,
        event: eventId1,
        requiredReadsPerApp: 3, // Changed from 2
        rubric: updatedRubric,
        eligibilityCriteria: eligibilityCriteria,
      });

      assertEquals(result, {}, "updateEventConfig should return an empty object on success.");

      // Verify the state effect
      const event = await concept._getEventById({ id: eventId1 });
      assertExists(event.event, "Event should still exist after update.");
      assertEquals(event.event.requiredReadsPerApp, 3, "requiredReadsPerApp should be updated to 3.");
      assertEquals(event.event.rubric, updatedRubric, "Rubric should be updated.");
      assertEquals(event.event.eligibilityCriteria, eligibilityCriteria, "Eligibility criteria should be updated.");
    });

    // Step 3: Admin adds a user (readerAId) as a verified reader for the event.
    await t.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
      const result = await concept.addReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      assertEquals(result, {}, "addReader should return an empty object on success.");

      // Verify the state effect
      const membership = await concept._getReaderMembership({ event: eventId1, user: readerAId });
      assertExists(membership.membership, "ReaderA's membership should exist.");
      assertEquals(membership.membership.event, eventId1, "Membership event ID should match.");
      assertEquals(membership.membership.user, readerAId, "Membership user ID should match.");
      assertEquals(membership.membership.verified, true, "ReaderA should be a verified reader.");
    });

    // Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').
    await t.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
      const result = await concept.addReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      assertExists((result as { error: string }).error, "Should return an error for re-adding a verified reader.");
      assertEquals((result as { error: string }).error, `User '${readerAId}' is already a verified reader for event '${eventId1}'.`, "Error message should indicate user is already verified.");

      // Verify no state change
      const membership = await concept._getReaderMembership({ event: eventId1, user: readerAId });
      assertExists(membership.membership);
      assertEquals(membership.membership.verified, true, "ReaderA should still be verified.");
    });

    // Step 5: Admin adds another user (readerBId) as a verified reader.
    await t.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
      const result = await concept.addReader({
        caller: adminId,
        event: eventId1,
        user: readerBId,
      });

      assertEquals(result, {}, "addReader should return an empty object on success for readerB.");

      // Verify the state effect
      const membership = await concept._getReaderMembership({ event: eventId1, user: readerBId });
      assertExists(membership.membership, "ReaderB's membership should exist.");
      assertEquals(membership.membership.event, eventId1, "Membership event ID should match for readerB.");
      assertEquals(membership.membership.user, readerBId, "Membership user ID should match for readerB.");
      assertEquals(membership.membership.verified, true, "ReaderB should be a verified reader.");
    });

    // Step 6: Admin inactivates the event ("archives" it).
    await t.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
      const result = await concept.inactivateEvent({
        caller: adminId,
        name: "Annual Hackathon",
      });

      assertEquals(result, {}, "inactivateEvent should return an empty object on success.");

      // Verify the state effect
      const event = await concept._getEventById({ id: eventId1 });
      assertExists(event.event);
      assertEquals(event.event.active, false, "Event should now be inactive.");
    });

    // Step 7: Admin attempts to update the configuration of the now inactive event.
    await t.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
      const currentRubric = [
        { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
        { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
      ]; // Re-using the rubric from Step 2 for clarity
      const newRequiredReads = 4; // Changed from 3
      const newEligibilityCriteria = ["Must be enrolled in a university program", "Attended info session"];

      const result = await concept.updateEventConfig({
        caller: adminId,
        event: eventId1,
        requiredReadsPerApp: newRequiredReads,
        rubric: currentRubric,
        eligibilityCriteria: newEligibilityCriteria,
      });

      assertEquals(result, {}, "updateEventConfig should succeed even for inactive events.");

      // Verify the state effect
      const event = await concept._getEventById({ id: eventId1 });
      assertExists(event.event);
      assertEquals(event.event.requiredReadsPerApp, newRequiredReads, "Required reads should be updated.");
      assertEquals(event.event.eligibilityCriteria, newEligibilityCriteria, "Eligibility criteria should be updated.");
    });

    // Step 8: Admin activates the event again.
    await t.step("Step 8: Admin activates the event again.", async () => {
      const result = await concept.activateEvent({
        caller: adminId,
        name: "Annual Hackathon",
      });

      assertEquals(result, {}, "activateEvent should return an empty object on success.");

      // Verify the state effect
      const event = await concept._getEventById({ id: eventId1 });
      assertExists(event.event);
      assertEquals(event.event.active, true, "Event should now be active again.");
    });

    // Step 9: Admin removes a reader (readerAId) from the event.
    await t.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
      const result = await concept.removeReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      assertEquals(result, {}, "removeReader should return an empty object on success.");

      // Verify the state effect
      const membership = await concept._getReaderMembership({ event: eventId1, user: readerAId });
      assertExists(membership.membership);
      assertEquals(membership.membership.verified, false, "ReaderA should now be unverified.");
    });

    // Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').
    await t.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
      const result = await concept.removeReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      assertExists((result as { error: string }).error, "Should return an error when trying to remove an already unverified reader.");
      assertEquals((result as { error: string }).error, `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`, "Error message should state user is not verified.");

      // Verify no state change
      const membership = await concept._getReaderMembership({ event: eventId1, user: readerAId });
      assertExists(membership.membership);
      assertEquals(membership.membership.verified, false, "ReaderA should remain unverified.");
    });

    // Step 11: Final verification of reader states.
    await t.step("Step 11: Final verification of reader states.", async () => {
      // Verify readerBId is still a verified reader
      const readerBMemb = await concept._getReaderMembership({ event: eventId1, user: readerBId });
      assertExists(readerBMemb.membership, "ReaderB's membership should still exist.");
      assertEquals(readerBMemb.membership.verified, true, "ReaderB should still be verified.");

      // Verify readerAId is an unverified reader
      const readerAMemb = await concept._getReaderMembership({ event: eventId1, user: readerAId });
      assertExists(readerAMemb.membership, "ReaderA's membership should still exist.");
      assertEquals(readerAMemb.membership.verified, false, "ReaderA should still be unverified.");

      // Verify _getVerifiedReadersForEvent only returns readerBId
      const verifiedReadersResult = await concept._getVerifiedReadersForEvent({ event: eventId1 });
      assertExists(verifiedReadersResult.users, "Verified readers list should exist.");
      assertEquals(verifiedReadersResult.users.length, 1, "Only one verified reader (readerB) should be returned.");
      assertEquals(verifiedReadersResult.users[0], readerBId, "The verified reader should be readerB.");
    });

  } finally {
    // Teardown: Close the MongoDB client connection
    await client.close();
  }
});
```
