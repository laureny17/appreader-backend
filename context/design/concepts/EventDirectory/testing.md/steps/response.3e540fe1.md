---
timestamp: 'Wed Oct 15 2025 02:06:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_020617.b39fa017.md]]'
content_id: 3e540fe11a234328eb8fd50acee68245640e3e42f5e2c8668b4e84bb841feb82
---

# response:

To make the `EventDirectory` trace compatible with the Deno testing framework, we need to:

1. Add necessary Deno and MongoDB imports.
2. Wrap the test logic within a `Deno.test` block, using `t.step` for each logical step described in the trace.
3. Set up and tear down the database connection and concept instance.
4. Translate the "Expected Output" and "Expected Effect" from the trace into Deno's `assertEquals` and `assertExists` assertions.
5. Ensure the initial state (e.g., `adminId` being an admin) is correctly set up.
6. Add query methods to the `EventDirectoryConcept` to allow verification of state changes if they don't already exist (these were added in the previous concept implementation response).

Since no `LikertSurvey` test file was provided as a template, the structure below follows standard Deno testing practices, providing a direct implementation of the `EventDirectory` principle fulfillment trace.

```typescript
// file: src/concepts/EventDirectory/EventDirectoryConcept.test.ts

// Required imports for Deno testing and MongoDB interactions
import { assertEquals, assertExists, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Db, MongoClient } from "npm:mongodb";
import { getDb, freshID } from "@utils/database.ts";
import { ID } from "@utils/types.ts";

// Import the concept class from its assumed relative path
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Create test user/event IDs using type branding for consistency
const adminId = "user:admin_test" as ID;
const readerAId = "user:readerA_test" as ID;
const readerBId = "user:readerB_test" as ID;

// Define a Deno test suite for the EventDirectory Concept
Deno.test("EventDirectory Concept Principle Fulfillment", async (t) => {
  let db: Db;
  let client: MongoClient;
  let eventDirectory: EventDirectoryConcept;
  let eventId1: Event; // This will store the ID of the event created in the test

  // Setup hook: This runs once before all steps in this `Deno.test` block.
  // It initializes the database connection and the concept instance,
  // and ensures a clean slate for the test run.
  await t.step("Setup: Initialize database and concept, add initial admin", async () => {
    // 1. Get a database connection
    [db, client] = await getDb();
    // 2. Drop the existing database to ensure a clean state for the test suite
    await db.dropDatabase();
    // 3. Instantiate the EventDirectoryConcept
    eventDirectory = new EventDirectoryConcept(db);

    // Bootstrap the initial admin user as required by the trace's assumption:
    // "adminId is a valid User ID and is already an administrator".
    // The `addAdmin` action requires an existing admin, so for bootstrapping,
    // we directly insert the first admin into the 'admins' collection.
    await eventDirectory.admins.insertOne({ _id: adminId });
    // Verify the admin was added
    assertEquals(await eventDirectory._listAdmins().then(res => res.users), [adminId], "Admin should be present after bootstrapping.");
  });


  // Step 1: Admin creates an event.
  await t.step("Step 1: Admin creates an event", async () => {
    const initialRubric = [{ name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 }];
    const result = await eventDirectory.createEvent({
      caller: adminId,
      name: "Annual Hackathon",
      requiredReadsPerApp: 2,
      rubric: initialRubric,
    });

    // Check for error, then cast and store the event ID
    if ('error' in result) throw new Error(`createEvent failed: ${result.error}`);
    assertExists(result.event, "Event ID should be returned on successful creation.");
    eventId1 = result.event; // Store the ID for subsequent steps

    // Verify the state change: A new Event document is added to the events collection.
    const fetchedEvent = await eventDirectory._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "The created event should be retrievable.");
    assertEquals(fetchedEvent.event?.name, "Annual Hackathon");
    assertEquals(fetchedEvent.event?.active, true);
    assertEquals(fetchedEvent.event?.requiredReadsPerApp, 2);
    assertEquals(fetchedEvent.event?.rubric, initialRubric);
    assertEquals(fetchedEvent.event?.eligibilityCriteria, [], "eligibilityCriteria should be initialized as empty.");
  });

  // Step 2: Admin updates the event configuration, adding more detail.
  await t.step("Step 2: Admin updates the event configuration", async () => {
    const updatedRubric = [
      { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
      { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
    ];
    const eligibility = ["Must be enrolled in a university program"];

    const result = await eventDirectory.updateEventConfig({
      caller: adminId,
      event: eventId1,
      requiredReadsPerApp: 3,
      rubric: updatedRubric,
      eligibilityCriteria: eligibility,
    });

    if ('error' in result) throw new Error(`updateEventConfig failed: ${result.error}`);
    assertEquals(result, {}, "Update event config should return an empty object on success.");

    // Verify the state change: The Event document for eventId1 is updated.
    const fetchedEvent = await eventDirectory._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "Event should still be retrievable after update.");
    assertEquals(fetchedEvent.event?.requiredReadsPerApp, 3);
    assertEquals(fetchedEvent.event?.rubric, updatedRubric);
    assertEquals(fetchedEvent.event?.eligibilityCriteria, eligibility);
  });

  // Step 3: Admin adds a user (readerAId) as a verified reader for the event.
  await t.step("Step 3: Admin adds readerA as a verified reader", async () => {
    const result = await eventDirectory.addReader({ caller: adminId, event: eventId1, user: readerAId });
    if ('error' in result) throw new Error(`addReader failed: ${result.error}`);
    assertEquals(result, {}, "Adding readerA should succeed.");

    // Verify the state change: A Membership document is created for readerA, verified: true.
    const membership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membership.membership, "Membership for readerA should exist.");
    assertEquals(membership.membership?.verified, true);
    assertEquals(membership.membership?.event, eventId1);
    assertEquals(membership.membership?.user, readerAId);
  });

  // Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').
  await t.step("Step 4: Admin attempts to re-add readerA (expecting error)", async () => {
    const result = await eventDirectory.addReader({ caller: adminId, event: eventId1, user: readerAId });
    assertExists((result as { error: string }).error, "Re-adding readerA should return an error.");
    assertEquals((result as { error: string }).error, `User '${readerAId}' is already a verified reader for event '${eventId1}'.`);

    // Verify state is unchanged
    const membership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerAId });
    assertEquals(membership.membership?.verified, true, "ReaderA's membership should still be verified.");
  });

  // Step 5: Admin adds another user (readerBId) as a verified reader.
  await t.step("Step 5: Admin adds readerB as a verified reader", async () => {
    const result = await eventDirectory.addReader({ caller: adminId, event: eventId1, user: readerBId });
    if ('error' in result) throw new Error(`addReader failed for readerB: ${result.error}`);
    assertEquals(result, {}, "Adding readerB should succeed.");

    // Verify the state change: A Membership document is created for readerB, verified: true.
    const membership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerBId });
    assertExists(membership.membership, "Membership for readerB should exist.");
    assertEquals(membership.membership?.verified, true);
    assertEquals(membership.membership?.event, eventId1);
    assertEquals(membership.membership?.user, readerBId);
  });

  // Step 6: Admin inactivates the event ("archives" it).
  await t.step("Step 6: Admin inactivates the event", async () => {
    const result = await eventDirectory.inactivateEvent({ caller: adminId, name: "Annual Hackathon" });
    if ('error' in result) throw new Error(`inactivateEvent failed: ${result.error}`);
    assertEquals(result, {}, "Inactivating event should succeed.");

    // Verify the state change: The Event document for eventId1 has its active flag set to false.
    const fetchedEvent = await eventDirectory._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event);
    assertEquals(fetchedEvent.event?.active, false, "Event should be inactive.");
  });

  // Step 7: Admin attempts to update the configuration of the now inactive event.
  await t.step("Step 7: Admin updates config of inactive event", async () => {
    const updatedRubric = [
      { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
      { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
      { name: "Impact", description: "Potential societal benefit", scaleMin: 1, scaleMax: 5 },
    ];
    const eligibility = ["Must be enrolled in a university program", "Attended info session"];

    const result = await eventDirectory.updateEventConfig({
      caller: adminId,
      event: eventId1,
      requiredReadsPerApp: 4,
      rubric: updatedRubric,
      eligibilityCriteria: eligibility,
    });
    if ('error' in result) throw new Error(`updateEventConfig of inactive event failed: ${result.error}`);
    assertEquals(result, {}, "Updating config of an inactive event should succeed.");

    // Verify the state change: The Event document for eventId1 is updated with new configuration.
    const fetchedEvent = await eventDirectory._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event);
    assertEquals(fetchedEvent.event?.requiredReadsPerApp, 4);
    assertEquals(fetchedEvent.event?.rubric, updatedRubric);
    assertEquals(fetchedEvent.event?.eligibilityCriteria, eligibility);
  });

  // Step 8: Admin activates the event again.
  await t.step("Step 8: Admin activates the event", async () => {
    const result = await eventDirectory.activateEvent({ caller: adminId, name: "Annual Hackathon" });
    if ('error' in result) throw new Error(`activateEvent failed: ${result.error}`);
    assertEquals(result, {}, "Activating event should succeed.");

    // Verify the state change: The Event document for eventId1 has its active flag set back to true.
    const fetchedEvent = await eventDirectory._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event);
    assertEquals(fetchedEvent.event?.active, true, "Event should be active.");
  });

  // Step 9: Admin removes a reader (readerAId) from the event.
  await t.step("Step 9: Admin removes readerA", async () => {
    const result = await eventDirectory.removeReader({ caller: adminId, event: eventId1, user: readerAId });
    if ('error' in result) throw new Error(`removeReader failed: ${result.error}`);
    assertEquals(result, {}, "Removing readerA should succeed.");

    // Verify the state change: ReaderA's Membership document has its verified flag set to false.
    const membership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membership.membership);
    assertEquals(membership.membership?.verified, false, "ReaderA's membership should be unverified.");
  });

  // Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').
  await t.step("Step 10: Admin attempts to re-remove readerA (expecting error)", async () => {
    const result = await eventDirectory.removeReader({ caller: adminId, event: eventId1, user: readerAId });
    assertExists((result as { error: string }).error, "Re-removing readerA should return an error.");
    assertEquals((result as { error: string }).error, `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`);

    // Verify state is unchanged
    const membership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerAId });
    assertEquals(membership.membership?.verified, false, "ReaderA's membership should still be unverified.");
  });

  // Step 11: Final verification of reader states.
  await t.step("Step 11: Final verification of reader states", async () => {
    // Query for all verified readers for eventId1
    const verifiedReaders = await eventDirectory._getVerifiedReadersForEvent({ event: eventId1 });
    assertEquals(verifiedReaders.users.length, 1, "Should be one verified reader.");
    assertEquals(verifiedReaders.users[0], readerBId, "The verified reader should be readerB.");

    // Query individual memberships to confirm statuses
    const readerAMembership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerAId });
    assertEquals(readerAMembership.membership?.verified, false, "ReaderA should be unverified.");

    const readerBMembership = await eventDirectory._getReaderMembership({ event: eventId1, user: readerBId });
    assertEquals(readerBMembership.membership?.verified, true, "ReaderB should be verified.");
  });

  // Teardown hook: This runs once after all steps in this `Deno.test` block.
  // It cleans up the database and closes the client connection.
  await t.step("Teardown: Clean up database and close connection", async () => {
    await db.dropDatabase(); // Clean up all data created during the test suite
    await client.close();
  });
});
```
