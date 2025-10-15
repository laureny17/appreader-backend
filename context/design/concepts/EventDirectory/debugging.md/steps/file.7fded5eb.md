---
timestamp: 'Wed Oct 15 2025 02:42:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_024217.f24eceb2.md]]'
content_id: 7fded5ebea039e14e593dd1ce6d302cf9dc5adc473e4ea6a5f72acb3455220dd
---

# file: src/concepts/EventDirectory/EventDirectoryConcept.test.ts

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { getDb, dropDb, freshID } from "@utils/database.ts";
import EventDirectoryConcept from "@concepts/EventDirectory/EventDirectoryConcept.ts";
import AuthAccountsConcept from "@concepts/AuthAccounts/AuthAccountsConcept.ts";
import { ID, UserID } from "@utils/types.ts";

Deno.test("EventDirectoryConcept: Principle Fulfillment Trace", async (test) => {
  const [db, client] = await getDb();
  await dropDb(db);

  // Initialize AuthAccountsConcept to manage admin roles
  const authAccounts = new AuthAccountsConcept(db);

  // FIX: Initialize EventDirectoryConcept, passing a wrapped _isAdmin function from AuthAccountsConcept
  // authAccounts._isAdmin expects { userId: UserID }, but EventDirectoryConcept expects (id: UserID) => Promise<boolean>
  const eventDirectory = new EventDirectoryConcept(
    db,
    async (id: UserID) => await authAccounts._isAdmin({ userId: id }),
  );

  const adminId: UserID = "user:admin" as UserID;
  const readerAId: UserID = "user:readerA" as UserID;
  const readerBId: UserID = "user:readerB" as UserID;

  let eventId1: EventID; // This will hold the ID of the created event

  await test.step("Setup: Initialize database and make adminId an admin", async () => {
    // Make adminId an admin
    const addAdminResult = await authAccounts.addAdmin({ adminId });
    assertEquals(addAdminResult, {}, "Expected empty success object for adding admin");

    // Verify admin status
    const isAdmin = await authAccounts._isAdmin({ userId: adminId });
    assertEquals(isAdmin, true, "adminId should be an admin after setup");
  });

  await test.step("Step 1: Admin creates an event.", async () => {
    const createResult = await eventDirectory.createEvent({
      name: "Research Event 2024",
      description: "Annual research event for 2024",
      config: { maxReaders: 100, startDate: "2024-01-01" },
      adminId,
    });
    // FIX: Expect an object with eventId, and assign it
    assertExists(createResult.eventId, "Event ID should be returned on success");
    eventId1 = createResult.eventId as EventID; // Assign the returned ID
    assertEquals(Object.keys(createResult).length, 1, "Only eventId should be returned on success");
  });

  await test.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
    const updateConfigResult = await eventDirectory.updateEventConfig({
      eventId: eventId1,
      config: { maxReaders: 150, endDate: "2024-12-31", type: "conference" },
      adminId,
    });
    assertEquals(updateConfigResult, {}, "Expected empty success object for event configuration update");

    const [updatedEvent] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(updatedEvent, "Event should exist after update");
    assertEquals(updatedEvent.config.maxReaders, 150, "maxReaders should be updated");
    assertEquals(updatedEvent.config.type, "conference", "type should be added to config");
  });

  await test.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
    const addReaderAResult = await eventDirectory.addReader({
      eventId: eventId1,
      readerId: readerAId,
      adminId,
    });
    assertEquals(addReaderAResult, {}, "Expected empty success object when adding readerA");

    const [eventAfterAddA] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(eventAfterAddA, "Event should exist after adding readerA");
    assertEquals(
      eventAfterAddA.verifiedReaders.includes(readerAId),
      true,
      "readerAId should be a verified reader",
    );
  });

  await test.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
    const addReaderADuplicateResult = await eventDirectory.addReader({
      eventId: eventId1,
      readerId: readerAId,
      adminId,
    });
    // FIX: Correct error message and include eventId1
    assertEquals(
      addReaderADuplicateResult,
      { error: `User '${readerAId}' is already a verified reader for event '${eventId1}'.` },
      "Error message should indicate user is already verified",
    );
  });

  await test.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
    const addReaderBResult = await eventDirectory.addReader({
      eventId: eventId1,
      readerId: readerBId,
      adminId,
    });
    assertEquals(addReaderBResult, {}, "Expected empty success object when adding readerB");

    const [eventAfterAddB] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(eventAfterAddB, "Event should exist after adding readerB");
    assertEquals(
      eventAfterAddB.verifiedReaders.includes(readerBId),
      true,
      "readerBId should be a verified reader",
    );
  });

  await test.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
    const inactivateResult = await eventDirectory.inactivateEvent({ eventId: eventId1, adminId });
    assertEquals(inactivateResult, {}, "Expected empty success object when inactivating event");

    const [inactiveEvent] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(inactiveEvent, "Event should exist after inactivation");
    assertEquals(inactiveEvent.active, false, "Event should be inactive");
  });

  await test.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
    // According to the concept spec, updating config doesn't require the event to be active.
    // So, this should succeed.
    const updateConfigInactiveResult = await eventDirectory.updateEventConfig({
      eventId: eventId1,
      config: { maxReaders: 200, status: "archived" },
      adminId,
    });
    assertEquals(
      updateConfigInactiveResult,
      {},
      "Expected empty success object, updateEventConfig does not require active event",
    );

    const [eventAfterInactiveConfigUpdate] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(eventAfterInactiveConfigUpdate, "Event should exist");
    assertEquals(
      eventAfterInactiveConfigUpdate.config.maxReaders,
      200,
      "maxReaders should be updated even if inactive",
    );
    assertEquals(
      eventAfterInactiveConfigUpdate.config.status,
      "archived",
      "status should be added to config",
    );
  });

  await test.step("Step 8: Admin activates the event again.", async () => {
    const activateResult = await eventDirectory.activateEvent({ eventId: eventId1, adminId });
    assertEquals(activateResult, {}, "Expected empty success object when activating event");

    const [activeEvent] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(activeEvent, "Event should exist after activation");
    assertEquals(activeEvent.active, true, "Event should be active");
  });

  await test.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
    const removeReaderAResult = await eventDirectory.removeReader({
      eventId: eventId1,
      readerId: readerAId,
      adminId,
    });
    assertEquals(removeReaderAResult, {}, "Expected empty success object when removing readerA");

    const [eventAfterRemoveA] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(eventAfterRemoveA, "Event should exist after removing readerA");
    assertEquals(
      eventAfterRemoveA.verifiedReaders.includes(readerAId),
      false,
      "readerAId should no longer be a verified reader",
    );
  });

  await test.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
    const removeReaderADuplicateResult = await eventDirectory.removeReader({
      eventId: eventId1,
      readerId: readerAId,
      adminId,
    });
    // FIX: Correct error message and include eventId1
    assertEquals(
      removeReaderADuplicateResult,
      {
        error: `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`,
      },
      "Error message should indicate user is not a verified reader",
    );
  });

  await test.step("Step 11: Final verification of reader states.", async () => {
    const readerAEvents = await eventDirectory._getEventsByReader({ readerId: readerAId });
    assertEquals(
      readerAEvents.length,
      0,
      "readerA should not be a reader for any events after removal",
    );

    const readerBEvents = await eventDirectory._getEventsByReader({ readerId: readerBId });
    assertEquals(
      readerBEvents.length,
      1,
      "readerB should still be a reader for one event",
    );
    assertEquals(readerBEvents[0]._id, eventId1, "readerB should be a reader for eventId1");

    const [finalEvent] = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(finalEvent, "Final event state should exist");
    // FIX: There should only be 1 reader (readerB) left after readerA was removed.
    assertEquals(finalEvent.verifiedReaders.length, 1, "There should be one membership for eventId1");
    assertEquals(finalEvent.verifiedReaders[0], readerBId, "The remaining reader should be readerBId");
  });

  await test.step("Teardown: Close database client", async () => {
    await client.close();
  });
});
```
