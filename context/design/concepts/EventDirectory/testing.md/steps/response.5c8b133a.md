---
timestamp: 'Wed Oct 15 2025 01:59:52 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_015952.fa28fad8.md]]'
content_id: 5c8b133ae18e0e23fbd7427e9c90a620fec1bf27fe38de4fd8d507d1b046cf5c
---

# response:

```typescript
import {
  assert,
  assertEquals,
  assertExists,
  assertNotEquals,
  assertObjectMatch,
  assertArrayIncludes,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { Collection, Db, MongoClient } from "npm:mongodb";
import { getDb, clearDb, freshID } from "@utils/database.ts"; // Assuming these utilities exist
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Re-import the types defined outside the concept class for use in tests
import type {
  Event,
  User,
  IRubricDimension,
  IEvent,
  IMembership,
  IAdmin,
} from "./EventDirectoryConcept.ts"; // Adjusted import path

Deno.test("EventDirectory Concept Principle Fulfillment", async (t) => {
  let db: Db;
  let client: MongoClient;
  let concept: EventDirectoryConcept;

  // Mock User IDs
  const adminId = "user:adminAlice" as User;
  const readerAId = "user:readerBob" as User;
  const readerBId = "user:readerCharlie" as User;
  const nonAdminId = "user:nonAdminDave" as User;

  // Standard rubric for testing
  const standardRubric: IRubricDimension[] = [
    { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
  ];
  const extendedRubric: IRubricDimension[] = [
    { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
    { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
  ];

  // Setup database and concept instance before all tests
  await t.step("Setup", async () => {
    [db, client] = await getDb();
    await clearDb(db); // Ensure a clean slate for each test run
    concept = new EventDirectoryConcept(db);

    // Make adminId an admin, as assumed by the trace
    const addAdminResult = await concept.addAdmin({ caller: adminId, user: adminId });
    assert(addAdminResult.error === undefined, `Setup: Expected adminId to be added as admin without error: ${addAdminResult.error}`);
    const admins = await concept._listAdmins();
    assertArrayIncludes(admins.users, [adminId], "Setup: adminId should be listed as an admin.");
  });

  let eventId1: Event; // To store the ID of the created event

  await t.step("Step 1: Admin creates an event.", async () => {
    // Action: createEvent
    const createResult = await concept.createEvent({
      caller: adminId,
      name: "Annual Hackathon",
      requiredReadsPerApp: 2,
      rubric: standardRubric,
    });

    // Expected Output: { event: eventId1 }
    assertExists((createResult as { event: Event }).event, "Expected an event ID to be returned.");
    assertEquals(
      (createResult as { error: string }).error,
      undefined,
      `Expected no error, but got: ${createResult.error}`,
    );
    eventId1 = (createResult as { event: Event }).event;
    assertNotEquals(eventId1, "", "Event ID should not be empty.");

    // Expected Effect: A new Event document is added to the events collection
    const fetchedEvent = await concept._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "Created event should be found in the database.");
    assertObjectMatch(fetchedEvent.event!, {
      _id: eventId1,
      name: "Annual Hackathon",
      active: true,
      requiredReadsPerApp: 2,
      rubric: standardRubric,
      eligibilityCriteria: [], // Should be initialized as empty
    });
  });

  await t.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
    // Action: updateEventConfig
    const updateResult = await concept.updateEventConfig({
      caller: adminId,
      event: eventId1,
      requiredReadsPerApp: 3,
      rubric: extendedRubric,
      eligibilityCriteria: ["Must be enrolled in a university program"],
    });

    // Expected Output: {}
    assertEquals(updateResult, {}, `Expected empty result for success, but got: ${updateResult.error}`);

    // Expected Effect: The Event document for eventId1 is updated
    const fetchedEvent = await concept._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "Event should still exist after update.");
    assertObjectMatch(fetchedEvent.event!, {
      _id: eventId1,
      requiredReadsPerApp: 3,
      rubric: extendedRubric,
      eligibilityCriteria: ["Must be enrolled in a university program"],
    });
  });

  await t.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
    // Action: addReader
    const addReaderAResult = await concept.addReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: {}
    assertEquals(addReaderAResult, {}, `Expected empty result for success, but got: ${addReaderAResult.error}`);

    // Expected Effect: A Membership document is created
    const membershipA = await concept._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membershipA.membership, "Membership for readerA should be created.");
    assertObjectMatch(membershipA.membership!, {
      event: eventId1,
      user: readerAId,
      verified: true,
    });
  });

  await t.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
    // Action: addReader
    const addReaderADuplicateResult = await concept.addReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: { error: "user is not already a verified user for event" }
    assertExists(addReaderADuplicateResult.error, "Expected an error when adding duplicate verified reader.");
    assertEquals(
      addReaderADuplicateResult.error,
      `User '${readerAId}' is already a verified reader for event '${eventId1}'.`,
      "Error message should indicate user is already a verified reader.",
    );

    // Expected Effect: No change to the existing Membership state.
    const membershipA = await concept._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membershipA.membership, "Membership for readerA should still exist.");
    assertEquals(membershipA.membership?.verified, true, "ReaderA's verified status should remain true.");
  });

  await t.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
    // Action: addReader
    const addReaderBResult = await concept.addReader({
      caller: adminId,
      event: eventId1,
      user: readerBId,
    });

    // Expected Output: {}
    assertEquals(addReaderBResult, {}, `Expected empty result for success, but got: ${addReaderBResult.error}`);

    // Expected Effect: A Membership document is created
    const membershipB = await concept._getReaderMembership({ event: eventId1, user: readerBId });
    assertExists(membershipB.membership, "Membership for readerB should be created.");
    assertObjectMatch(membershipB.membership!, {
      event: eventId1,
      user: readerBId,
      verified: true,
    });
  });

  await t.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
    // Action: inactivateEvent
    const inactivateResult = await concept.inactivateEvent({
      caller: adminId,
      name: "Annual Hackathon",
    });

    // Expected Output: {}
    assertEquals(inactivateResult, {}, `Expected empty result for success, but got: ${inactivateResult.error}`);

    // Expected Effect: The Event document for eventId1 has its active flag set to false.
    const fetchedEvent = await concept._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "Event should still exist after inactivation.");
    assertEquals(fetchedEvent.event?.active, false, "Event should be inactive.");
  });

  await t.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
    // Action: updateEventConfig
    const updateInactiveResult = await concept.updateEventConfig({
      caller: adminId,
      event: eventId1,
      requiredReadsPerApp: 4, // Changed value
      rubric: extendedRubric,
      eligibilityCriteria: ["Must be enrolled in a university program", "Attended info session"], // New criteria
    });

    // Expected Output: {} (updateEventConfig's requires does not prohibit updating inactive events)
    assertEquals(updateInactiveResult, {}, `Expected empty result for success, but got: ${updateInactiveResult.error}`);

    // Expected Effect: The Event document for eventId1 is updated
    const fetchedEvent = await concept._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "Event should still exist after updating inactive event.");
    assertEquals(fetchedEvent.event?.requiredReadsPerApp, 4, "Required reads should be updated.");
    assertArrayIncludes(
      fetchedEvent.event?.eligibilityCriteria || [],
      ["Must be enrolled in a university program", "Attended info session"],
      "Eligibility criteria should be updated.",
    );
  });

  await t.step("Step 8: Admin activates the event again.", async () => {
    // Action: activateEvent
    const activateResult = await concept.activateEvent({
      caller: adminId,
      name: "Annual Hackathon",
    });

    // Expected Output: {}
    assertEquals(activateResult, {}, `Expected empty result for success, but got: ${activateResult.error}`);

    // Expected Effect: The Event document for eventId1 has its active flag set back to true.
    const fetchedEvent = await concept._getEventById({ id: eventId1 });
    assertExists(fetchedEvent.event, "Event should exist after re-activation.");
    assertEquals(fetchedEvent.event?.active, true, "Event should be active again.");
  });

  await t.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
    // Action: removeReader
    const removeReaderAResult = await concept.removeReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: {}
    assertEquals(removeReaderAResult, {}, `Expected empty result for success, but got: ${removeReaderAResult.error}`);

    // Expected Effect: The Membership document for event: eventId1 and User: readerAId has its verified flag set to false.
    const membershipA = await concept._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membershipA.membership, "Membership for readerA should still exist.");
    assertEquals(
      membershipA.membership?.verified,
      false,
      "ReaderA's verified status should be false after removal.",
    );
  });

  await t.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
    // Action: removeReader
    const removeReaderADuplicateResult = await concept.removeReader({
      caller: adminId,
      event: eventId1,
      user: readerAId,
    });

    // Expected Output: { error: "user is a verified reader for the event" }
    assertExists(removeReaderADuplicateResult.error, "Expected an error when removing an already unverified reader.");
    assertEquals(
      removeReaderADuplicateResult.error,
      `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`,
      "Error message should indicate user is not a verified reader.",
    );

    // Expected Effect: No change to the existing Membership state.
    const membershipA = await concept._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membershipA.membership, "Membership for readerA should still exist.");
    assertEquals(membershipA.membership?.verified, false, "ReaderA's verified status should remain false.");
  });

  await t.step("Step 11: Final verification of reader states.", async () => {
    // Query: _getVerifiedReadersForEvent
    const verifiedReaders = await concept._getVerifiedReadersForEvent({ event: eventId1 });
    assertArrayIncludes(verifiedReaders.users, [readerBId], "ReaderB should still be a verified reader.");
    assertEquals(
      verifiedReaders.users.includes(readerAId),
      false,
      "ReaderA should NOT be in the list of verified readers.",
    );

    // Query: _getReaderMembership for ReaderA
    const membershipA = await concept._getReaderMembership({ event: eventId1, user: readerAId });
    assertExists(membershipA.membership, "Membership for readerA should exist.");
    assertEquals(membershipA.membership?.verified, false, "ReaderA's membership should show as unverified.");

    // Query: _getReaderMembership for ReaderB
    const membershipB = await concept._getReaderMembership({ event: eventId1, user: readerBId });
    assertExists(membershipB.membership, "Membership for readerB should exist.");
    assertEquals(membershipB.membership?.verified, true, "ReaderB's membership should show as verified.");
  });

  // Cleanup database and close connection after all tests
  await t.step("Cleanup", async () => {
    await clearDb(db);
    await client.close();
  });
});

// Additional tests for edge cases and other actions
Deno.test("EventDirectory Concept Admin Actions and Edge Cases", async (t) => {
  let db: Db;
  let client: MongoClient;
  let concept: EventDirectoryConcept;

  const admin1 = "user:admin1" as User;
  const admin2 = "user:admin2" as User;
  const regularUser = "user:regular" as User;
  let eventId: Event;

  await t.step("Setup for Admin Actions tests", async () => {
    [db, client] = await getDb();
    await clearDb(db);
    concept = new EventDirectoryConcept(db);

    // Add initial admins
    await concept.addAdmin({ caller: admin1, user: admin1 });
    await concept.addAdmin({ caller: admin1, user: admin2 });

    const createResult = await concept.createEvent({
      caller: admin1,
      name: "Test Event",
      requiredReadsPerApp: 1,
      rubric: [],
    });
    assertExists((createResult as { event: Event }).event);
    eventId = (createResult as { event: Event }).event;
  });

  await t.step("Non-admin attempts to create event", async () => {
    const result = await concept.createEvent({
      caller: regularUser,
      name: "Unauthorized Event",
      requiredReadsPerApp: 1,
      rubric: [],
    });
    assertEquals(result.error, "Only admins can create events.");
  });

  await t.step("Admin adds a new admin", async () => {
    const newAdminId = "user:newAdmin" as User;
    const result = await concept.addAdmin({ caller: admin1, user: newAdminId });
    assertEquals(result, {});
    const admins = await concept._listAdmins();
    assertArrayIncludes(admins.users, [admin1, admin2, newAdminId]);
  });

  await t.step("Admin attempts to add an existing admin", async () => {
    const result = await concept.addAdmin({ caller: admin1, user: admin2 });
    assertEquals(result.error, `User '${admin2}' is already an admin.`);
  });

  await t.step("Non-admin attempts to add an admin", async () => {
    const result = await concept.addAdmin({ caller: regularUser, user: "user:anotherNewAdmin" as User });
    assertEquals(result.error, "Only existing admins can add new admins.");
  });

  await t.step("Admin removes another admin", async () => {
    const newAdminId = "user:newAdmin" as User; // Assuming newAdminId was added in a prior step
    const result = await concept.removeAdmin({ caller: admin1, user: newAdminId });
    assertEquals(result, {});
    const admins = await concept._listAdmins();
    assertEquals(admins.users.includes(newAdminId), false);
  });

  await t.step("Admin attempts to remove themselves when they are the last admin", async () => {
    // First, remove admin2 to make admin1 the last admin if newAdmin was also removed
    await concept.removeAdmin({ caller: admin1, user: admin2 });
    const adminsAfterRemovingOne = await concept._listAdmins();
    assertEquals(adminsAfterRemovingOne.users.length, 1);
    assertEquals(adminsAfterRemovingOne.users[0], admin1);

    const result = await concept.removeAdmin({ caller: admin1, user: admin1 });
    assertEquals(result.error, "Cannot remove the last remaining admin, especially yourself. Add another admin first.");
  });

  await t.step("Non-admin attempts to remove an admin", async () => {
    const result = await concept.removeAdmin({ caller: regularUser, user: admin1 });
    assertEquals(result.error, "Only admins can remove other admins.");
  });

  await t.step("Admin removes a non-admin (should error)", async () => {
    const result = await concept.removeAdmin({ caller: admin1, user: regularUser });
    assertEquals(result.error, `User '${regularUser}' is not an admin.`);
  });

  await t.step("Cleanup for Admin Actions tests", async () => {
    await clearDb(db);
    await client.close();
  });
});
```
