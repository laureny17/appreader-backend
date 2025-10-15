---
timestamp: 'Wed Oct 15 2025 02:20:53 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_022053.4a28e8f9.md]]'
content_id: 447deaf7903f9b2ce94ef68bd422ab9d244cb7f5867d7fc522c950afcd992072
---

# response:

To effectively test the `EventDirectoryConcept`, we'll create a Deno test suite that meticulously follows the provided trace, verifying the `requires` (preconditions) and `effects` (postconditions) of each action. The test structure will mirror the `LikertSurveyConcept` example, using `Deno.test` with nested `test.step` calls for clarity and sequential execution.

We'll start by setting up a fresh database instance and ensuring our `adminId` is correctly registered as an administrator before proceeding with the scenario. Each step of the trace will then execute an action, assert its return value (success or error), and then query the database to confirm that the expected state changes have occurred.

Here's the test suite:

**file: src/concepts/EventDirectory/EventDirectoryConcept.test.ts**

```typescript
import {
  assert,
  assertEquals,
  assertFalse,
  assertExists,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { Db, MongoClient } from "npm:mongodb";
import { getDb, freshID } from "../../_utils/database.ts"; // Adjusted path
import EventDirectoryConcept from "./EventDirectoryConcept.ts";
import { ID } from "../../_utils/types.ts"; // Adjusted path

// Define generic types used in the concept
type Event = ID;
type User = ID;

// Mock RubricDimension for consistency across tests
const mockRubricDimension1 = {
  name: "Innovation",
  description: "Originality of idea",
  scaleMin: 1,
  scaleMax: 5,
};

const mockRubricDimension2 = {
  name: "Execution",
  description: "Quality of implementation",
  scaleMin: 1,
  scaleMax: 5,
};

Deno.test("EventDirectoryConcept: Principle Fulfillment Trace", async (test) => {
  let db: Db;
  let client: MongoClient;
  let eventDirectory: EventDirectoryConcept;

  // --- Mock IDs ---
  const adminId = "user:admin" as User;
  const readerAId = "user:readerA" as User;
  const readerBId = "user:readerB" as User;
  let eventId1: Event; // This will be assigned dynamically after event creation

  // Setup: Initialize database and make adminId an admin for the test scope
  await test.step("Setup: Initialize database and make adminId an admin", async () => {
    [db, client] = await getDb();
    eventDirectory = new EventDirectoryConcept(db);

    // Clear collections before running tests to ensure a clean slate
    await db.collection("EventDirectory.events").deleteMany({});
    await db.collection("EventDirectory.memberships").deleteMany({});
    await db.collection("EventDirectory.admins").deleteMany({});

    // Manually add the adminId to the admins collection for test purposes
    await db.collection("EventDirectory.admins").insertOne({ _id: adminId });

    // Verify admin status using the concept's private helper (for robust testing)
    const isAdmin = await eventDirectory["_isAdmin"](adminId);
    assert(isAdmin, "adminId should be an admin after setup");
  });

  await test.step("Step 1: Admin creates an event.", async () => {
    // Action: createEvent
    const result = await eventDirectory.createEvent({
      caller: adminId,
      name: "Annual Hackathon",
      requiredReadsPerApp: 2,
      rubric: [mockRubricDimension1],
    });

    // Expected Output: { event: eventId1 }
    assertExists((result as { event: Event }).event, "Event ID should be returned on success");
    assertFalse(!!(result as { error: string }).error, "No error expected when creating event");
    eventId1 = (result as { event: Event }).event; // Store the generated event ID for subsequent steps

    // Expected Effect: A new Event document is added
    const createdEvent = await db.collection("EventDirectory.events").findOne({
      _id: eventId1,
    });
    assertExists(createdEvent, "Event should exist in the database");
    assertEquals(createdEvent.name, "Annual Hackathon");
    assertEquals(createdEvent.active, true, "New event should be active by default");
    assertEquals(createdEvent.requiredReadsPerApp, 2);
    assertEquals(createdEvent.rubric.length, 1);
    assertEquals(createdEvent.rubric[0].name, mockRubricDimension1.name);
    assertEquals(createdEvent.eligibilityCriteria.length, 0, "Eligibility criteria should be empty initially");
  });

  await test.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
    // Action: updateEventConfig
    const result = await eventDirectory.updateEventConfig({
      caller: adminId,
      event: eventId1,
      requiredReadsPerApp: 3,
      rubric: [mockRubricDimension1, mockRubricDimension2],
      eligibilityCriteria: ["Must be enrolled in a university program"],
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object for event configuration update");

    // Expected Effect: The Event document for eventId1 is updated
    const updatedEvent = await db.collection("EventDirectory.events").findOne({
      _id: eventId1,
    });
    assertExists(updatedEvent, "Event should still exist after update");
    assertEquals(updatedEvent.requiredReadsPerApp, 3);
    assertEquals(updatedEvent.rubric.length, 2);
    assertEquals(updatedEvent.rubric[1].name, mockRubricDimension2.name);
    assertEquals(updatedEvent.eligibilityCriteria, ["Must be enrolled in a university program"]);
  });

  await test.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
    // Action: addReader
    const result = await eventDirectory.addReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object when adding readerA");

    // Expected Effect: A Membership document is created
    const membership = await db.collection("EventDirectory.memberships").findOne({
      event: eventId1,
      user: readerAId,
    });
    assertExists(membership, "Membership for readerA should be created");
    assertEquals(membership.event, eventId1);
    assertEquals(membership.user, readerAId);
    assertEquals(membership.verified, true, "readerA should be verified");
  });

  await test.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
    // Action: addReader
    const result = await eventDirectory.addReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: { error: "User 'readerAId' is already a verified reader for event 'eventId1'." }
    assertExists((result as { error: string }).error, "Expected an error when re-adding an already verified reader");
    assertEquals(
      (result as { error: string }).error,
      `User '${readerAId}' is already a verified reader for event '${eventId1}'.`,
      "Error message should indicate user is already verified",
    );

    // Expected Effect: No change to the existing Membership state
    const membership = await db.collection("EventDirectory.memberships").findOne({
      event: eventId1,
      user: readerAId,
    });
    assertEquals(membership?.verified, true, "Membership state for readerA should not change");
  });

  await test.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
    // Action: addReader
    const result = await eventDirectory.addReader({
      caller: adminId,
      event: eventId1,
      user: readerBId,
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object when adding readerB");

    // Expected Effect: A Membership document is created
    const membership = await db.collection("EventDirectory.memberships").findOne({
      event: eventId1,
      user: readerBId,
    });
    assertExists(membership, "Membership for readerB should be created");
    assertEquals(membership.event, eventId1);
    assertEquals(membership.user, readerBId);
    assertEquals(membership.verified, true, "readerB should be verified");
  });

  await test.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
    // Action: inactivateEvent
    const result = await eventDirectory.inactivateEvent({
      caller: adminId,
      name: "Annual Hackathon",
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object when inactivating event");

    // Expected Effect: The Event document for eventId1 has its active flag set to false
    const event = await db.collection("EventDirectory.events").findOne({
      _id: eventId1,
    });
    assertExists(event, "Event should still exist");
    assertEquals(event.active, false, "Event should be inactive after inactivation");
  });

  await test.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
    // Action: updateEventConfig (note: `updateEventConfig` does not require the event to be active)
    const result = await eventDirectory.updateEventConfig({
      caller: adminId,
      event: eventId1,
      requiredReadsPerApp: 4,
      rubric: [mockRubricDimension1, mockRubricDimension2],
      eligibilityCriteria: ["Must be enrolled in a university program", "Attended info session"],
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object, updateEventConfig does not require active event");

    // Expected Effect: The Event document for eventId1 is updated
    const updatedEvent = await db.collection("EventDirectory.events").findOne({
      _id: eventId1,
    });
    assertExists(updatedEvent, "Event should still exist");
    assertEquals(updatedEvent.requiredReadsPerApp, 4);
    assertEquals(updatedEvent.eligibilityCriteria, ["Must be enrolled in a university program", "Attended info session"]);
  });

  await test.step("Step 8: Admin activates the event again.", async () => {
    // Action: activateEvent
    const result = await eventDirectory.activateEvent({
      caller: adminId,
      name: "Annual Hackathon",
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object when activating event");

    // Expected Effect: The Event document for eventId1 has its active flag set back to true
    const event = await db.collection("EventDirectory.events").findOne({
      _id: eventId1,
    });
    assertExists(event, "Event should still exist");
    assertEquals(event.active, true, "Event should be active again after activation");
  });

  await test.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
    // Action: removeReader
    const result = await eventDirectory.removeReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: {}
    assertEquals(result, {}, "Expected empty success object when removing readerA");

    // Expected Effect: The Membership document for readerAId has its verified flag set to false
    const membership = await db.collection("EventDirectory.memberships").findOne({
      event: eventId1,
      user: readerAId,
    });
    assertExists(membership, "Membership for readerA should still exist");
    assertEquals(membership.verified, false, "readerA should be unverified after removal");
  });

  await test.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
    // Action: removeReader
    const result = await eventDirectory.removeReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: { error: "User 'readerAId' is not currently a verified reader for event 'eventId1'." }
    assertExists((result as { error: string }).error, "Expected an error when re-removing an unverified reader");
    assertEquals(
      (result as { error: string }).error,
      `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`,
      "Error message should indicate user is not a verified reader",
    );

    // Expected Effect: No change to the existing Membership state
    const membership = await db.collection("EventDirectory.memberships").findOne({
      event: eventId1,
      user: readerAId,
    });
    assertEquals(membership?.verified, false, "Membership state for readerA should not change");
  });

  await test.step("Step 11: Final verification of reader states.", async () => {
    // Query: Retrieve all Membership records associated with eventId1
    const allMemberships = await db.collection("EventDirectory.memberships").find({
      event: eventId1,
    }).toArray();

    assertEquals(allMemberships.length, 2, "There should be two memberships for eventId1");

    // Expected Outcome: readerBId is verified, readerAId is unverified
    const readerAMembership = allMemberships.find((m) => m.user === readerAId);
    const readerBMembership = allMemberships.find((m) => m.user === readerBId);

    assertExists(readerAMembership, "readerA's membership should exist");
    assertEquals(readerAMembership.verified, false, "readerAId should be unverified");

    assertExists(readerBMembership, "readerB's membership should exist");
    assertEquals(readerBMembership.verified, true, "readerBId should be verified");
  });

  // Teardown: Close database client
  await test.step("Teardown: Close database client", async () => {
    await client.close();
  });
});
```
