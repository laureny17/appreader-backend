---
timestamp: 'Wed Oct 15 2025 02:52:23 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_025223.aa7e93f2.md]]'
content_id: 1be5e2050b963aaa6a2ba6e7ab0e5d495f1ffb9505e615f28df91cb18eda3463
---

# file: src/concepts/EventDirectory/EventDirectoryConcept.test.ts

```typescript
import {
  assert,
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { ID, UserID } from "@utils/types.ts";
import { getTestDb, purgeTestDb } from "@utils/database.ts";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Test data
const adminId: UserID = "user:admin" as UserID;
const readerAId: UserID = "user:readerA" as UserID;
const readerBId: UserID = "user:readerB" as UserID;

Deno.test("EventDirectoryConcept: Principle Fulfillment Trace", async (test) => {
  const [testDb, client] = await getTestDb();
  await purgeTestDb(testDb);

  // FIX: Mock _isAdmin function.
  // This mock allows the EventDirectoryConcept to function without depending on AuthAccountsConcept
  // in the test environment, adhering to the "no other concepts" rule for testing.
  const mockIsAdmin = async (id: UserID): Promise<boolean> => {
    return id === adminId;
  };

  const concept = new EventDirectoryConcept(testDb, mockIsAdmin);
  let eventId1: ID; // To store the ID of the created event

  await test.step("Setup: Initialize database and make adminId an admin", async () => {
    // In a real scenario, AuthAccountsConcept would be used here.
    // For this test, we simulate admin status via mockIsAdmin.
    const isAdmin = await mockIsAdmin(adminId);
    assert(isAdmin, "adminId should be an admin after setup");
  });

  await test.step("Step 1: Admin creates an event.", async () => {
    const result = await concept.createEvent({
      adminId,
      name: "Test Event 1",
      description: "A description for Test Event 1",
    });

    // FIX: Check for the eventId in the result object and assign it.
    assertExists((result as { eventId: ID }).eventId, "Event ID should be returned on success");
    eventId1 = (result as { eventId: ID }).eventId;

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist in the database");
    assertEquals(event.name, "Test Event 1", "Event name should match");
    assertEquals(event.description, "A description for Test Event 1", "Event description should match");
    assertEquals(event.active, true, "New event should be active");
    assertEquals(event.verifiedReaders.length, 0, "New event should have no readers initially");
  });

  await test.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
    const newConfig = { maxReaders: 100, applicationDeadline: "2024-12-31" };
    const result = await concept.updateEventConfig({
      adminId,
      eventId: eventId1,
      config: newConfig,
    });
    // FIX: Expect an empty success object, not an error related to admin privileges
    assertEquals(result, {}, "Expected empty success object for event configuration update");

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should still exist");
    assertEquals(event.config, newConfig, "Event configuration should be updated");
  });

  await test.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
    const result = await concept.addReader({
      adminId,
      eventId: eventId1,
      readerId: readerAId,
    });
    // FIX: Expect an empty success object, not an error related to admin privileges
    assertEquals(result, {}, "Expected empty success object when adding readerA");

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist");
    assert(
      event.verifiedReaders.includes(readerAId),
      "readerAId should be a verified reader",
    );
  });

  await test.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
    const result = await concept.addReader({
      adminId,
      eventId: eventId1,
      readerId: readerAId,
    });
    assertExists(result as { error: string }, "Expected an error message");
    // FIX: Ensure error message is specific and uses eventId1
    assertEquals(
      (result as { error: string }).error,
      `User '${readerAId}' is already a verified reader for event '${eventId1}'.`,
      "Error message should indicate user is already verified",
    );
  });

  await test.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
    const result = await concept.addReader({
      adminId,
      eventId: eventId1,
      readerId: readerBId,
    });
    // FIX: Expect an empty success object, not an error related to admin privileges
    assertEquals(result, {}, "Expected empty success object when adding readerB");

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist");
    assert(
      event.verifiedReaders.includes(readerBId),
      "readerBId should be a verified reader",
    );
  });

  await test.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
    const result = await concept.inactivateEvent({ adminId, eventId: eventId1 });
    // FIX: Expect an empty success object, not an error related to admin privileges
    assertEquals(result, {}, "Expected empty success object when inactivating event");

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist");
    assertEquals(event.active, false, "Event should be inactive");
  });

  await test.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
    const updatedConfig = { maxReaders: 150 };
    const result = await concept.updateEventConfig({
      adminId,
      eventId: eventId1,
      config: updatedConfig,
    });
    // FIX: Expect an empty success object, updateEventConfig does not require active event
    assertEquals(
      result,
      {},
      "Expected empty success object, updateEventConfig does not require active event",
    );

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist");
    assertEquals(
      event.config.maxReaders,
      150,
      "Configuration should be updated even for inactive event",
    );
  });

  await test.step("Step 8: Admin activates the event again.", async () => {
    const result = await concept.activateEvent({ adminId, eventId: eventId1 });
    // FIX: Expect an empty success object, not an error related to admin privileges
    assertEquals(result, {}, "Expected empty success object when activating event");

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist");
    assertEquals(event.active, true, "Event should be active again");
  });

  await test.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
    const result = await concept.removeReader({
      adminId,
      eventId: eventId1,
      readerId: readerAId,
    });
    // FIX: Expect an empty success object, not an error related to admin privileges
    assertEquals(result, {}, "Expected empty success object when removing readerA");

    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist");
    assert(
      !event.verifiedReaders.includes(readerAId),
      "readerAId should no longer be a verified reader",
    );
    assert(
      event.verifiedReaders.includes(readerBId),
      "readerBId should still be a verified reader",
    );
  });

  await test.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
    const result = await concept.removeReader({
      adminId,
      eventId: eventId1,
      readerId: readerAId,
    });
    assertExists(result as { error: string }, "Expected an error message");
    // FIX: Ensure error message is specific and uses eventId1
    assertEquals(
      (result as { error: string }).error,
      `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`,
      "Error message should indicate user is not a verified reader",
    );
  });

  await test.step("Step 11: Final verification of reader states.", async () => {
    const [event] = await concept._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist for final verification");

    const verifiedReaders = event.verifiedReaders;
    // FIX: After readerA is removed, only readerB should remain.
    assertEquals(verifiedReaders.length, 1, "There should be one membership for eventId1 (readerBId)");
    assert(verifiedReaders.includes(readerBId), "readerBId should be present");
    assert(!verifiedReaders.includes(readerAId), "readerAId should not be present");

    const eventsForReaderB = await concept._getEventsByReader({ readerId: readerBId });
    assertEquals(eventsForReaderB.length, 1, "ReaderB should be associated with one event");
    assertEquals(eventsForReaderB[0]._id, eventId1, "ReaderB's event should be eventId1");

    const eventsForReaderA = await concept._getEventsByReader({ readerId: readerAId });
    assertEquals(eventsForReaderA.length, 0, "ReaderA should not be associated with any events");
  });

  await test.step("Teardown: Close database client", async () => {
    await client.close();
  });
});

```
