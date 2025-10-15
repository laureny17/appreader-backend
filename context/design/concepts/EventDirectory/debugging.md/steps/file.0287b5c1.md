---
timestamp: 'Wed Oct 15 2025 02:36:08 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_023608.43b10183.md]]'
content_id: 0287b5c11854ac3d20fe8d0245e18efee14ba20da4cb46e66b3ea3f698eee1b6
---

# file: src/concepts/EventDirectory/EventDirectoryConcept.test.ts

```typescript
import { assertEquals, assertExists } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { getDb } from "@utils/database.ts";
import { ID, Empty } from "@utils/types.ts";
import AuthAccountsConcept from "@concepts/AuthAccounts/AuthAccountsConcept.ts";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Test data
const adminId = "user:admin" as ID;
const readerAId = "user:readerA" as ID;
const readerBId = "user:readerB" as ID;

Deno.test("EventDirectoryConcept: Principle Fulfillment Trace", async (test) => {
  const [db, client] = await getDb();
  let authAccounts: AuthAccountsConcept;
  let eventDirectory: EventDirectoryConcept;

  let eventId1: ID; // Event ID will be stored here

  await test.step("Setup: Initialize database and make adminId an admin", async () => {
    // Clear collections for EventDirectory and AuthAccounts
    await db.collection("AuthAccounts.accounts").deleteMany({});
    await db.collection("EventDirectory.events").deleteMany({});
    await db.collection("EventDirectory.readers").deleteMany({});
    // NOTE: If AuthAccountsConcept uses other collections (e.g., "AuthAccounts.admins"),
    // they would need to be cleared here as well for a truly clean state.

    authAccounts = new AuthAccountsConcept(db);
    eventDirectory = new EventDirectoryConcept(db, authAccounts);

    // Make adminId an admin
    const adminResult = await authAccounts.makeAdmin({ admin: adminId });
    assertEquals(adminResult, {}, "makeAdmin should return empty object on success");

    // Verify admin status
    const isAdminCheckResult = await authAccounts._isAdmin({ account: adminId });
    // This is the failing assertion in the original logs.
    // Log for clearer debugging of AuthAccountsConcept itself.
    if (isAdminCheckResult !== true) {
      console.error(`DEBUG: AuthAccounts._isAdmin for ${adminId} returned:`, isAdminCheckResult);
    }
    assertEquals(isAdminCheckResult, true, "adminId should be an admin after setup");
    // If this assertion fails, all subsequent admin-gated actions in EventDirectoryConcept will
    // also likely fail with "Only admins can..." errors, indicating a bug in AuthAccountsConcept.
  });

  await test.step("Step 1: Admin creates an event.", async () => {
    const createResult = await eventDirectory.createEvent({
      name: "Event 1",
      admin: adminId,
    });
    // Explicitly check for an error return. If admin check fails, this will be an error object.
    if ("error" in createResult) {
      // If the admin check is truly failing, this assertion will fail and provide the error message.
      throw new Error(`Event creation failed unexpectedly: ${createResult.error}`);
    }
    eventId1 = createResult.eventId;
    assertExists(eventId1, "Event ID should be returned on success");

    // Verify event details
    const event = await eventDirectory._getEvent({ eventId: eventId1 });
    assertExists(event, "Event should exist after creation");
    assertEquals(event?.name, "Event 1", "Event name should match");
    assertEquals(event?.admin, adminId, "Event admin should match");
    assertEquals(event?.active, true, "Event should be active by default");
    assertEquals(Object.keys(event?.config || {}).length, 0, "Event config should be empty initially");
  });

  await test.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
    assertExists(eventId1, "eventId1 must exist to update configuration");
    const updateResult = await eventDirectory.updateEventConfig({
      admin: adminId,
      eventId: eventId1,
      config: { description: "A detailed event description", maxReaders: 100 },
    });
    if ("error" in updateResult) {
      throw new Error(`Event config update failed unexpectedly: ${updateResult.error}`);
    }
    assertEquals(updateResult, {}, "Expected empty success object for event configuration update");

    // Verify update
    const event = await eventDirectory._getEvent({ eventId: eventId1 });
    assertEquals(event?.config, { description: "A detailed event description", maxReaders: 100 }, "Event config should be updated");
  });

  await test.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
    assertExists(eventId1, "eventId1 must exist to add reader");
    const addReaderResult = await eventDirectory.addReader({
      admin: adminId,
      event: eventId1,
      reader: readerAId,
    });
    if ("error" in addReaderResult) {
      throw new Error(`Adding readerA failed unexpectedly: ${addReaderResult.error}`);
    }
    assertEquals(addReaderResult, {}, "Expected empty success object when adding readerA");

    // Verify readerA is a member
    const memberships = await eventDirectory._getEventMemberships({ event: eventId1 });
    assertEquals(memberships.some(m => m.reader === readerAId), true, "readerA should be a member");
  });

  await test.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
    assertExists(eventId1, "eventId1 must exist to re-add reader");
    const addReaderResult = await eventDirectory.addReader({
      admin: adminId,
      event: eventId1,
      reader: readerAId,
    });
    // This assertion expects the specific error message, assuming admin check passes.
    assertEquals(addReaderResult, { error: `User '${readerAId}' is already a verified reader for event '${eventId1}'.` }, "Error message should indicate user is already verified");
  });

  await test.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
    assertExists(eventId1, "eventId1 must exist to add reader");
    const addReaderResult = await eventDirectory.addReader({
      admin: adminId,
      event: eventId1,
      reader: readerBId,
    });
    if ("error" in addReaderResult) {
      throw new Error(`Adding readerB failed unexpectedly: ${addReaderResult.error}`);
    }
    assertEquals(addReaderResult, {}, "Expected empty success object when adding readerB");

    // Verify readerB is a member
    const memberships = await eventDirectory._getEventMemberships({ event: eventId1 });
    assertEquals(memberships.some(m => m.reader === readerBId), true, "readerB should be a member");
  });

  await test.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
    assertExists(eventId1, "eventId1 must exist to inactivate event");
    const inactivateResult = await eventDirectory.inactivateEvent({ admin: adminId, eventId: eventId1 });
    if ("error" in inactivateResult) {
      throw new Error(`Inactivating event failed unexpectedly: ${inactivateResult.error}`);
    }
    assertEquals(inactivateResult, {}, "Expected empty success object when inactivating event");

    const event = await eventDirectory._getEvent({ eventId: eventId1 });
    assertEquals(event?.active, false, "Event should be inactive");
  });

  await test.step("Step 7: Admin attempts to update the configuration of the now inactive event. (Does not require active event)", async () => {
    assertExists(eventId1, "eventId1 must exist to update inactive event");
    const updateResult = await eventDirectory.updateEventConfig({
      admin: adminId,
      eventId: eventId1,
      config: { description: "Updated description for an inactive event" },
    });
    // updateEventConfig does not require active event. So this should succeed if admin check passes.
    if ("error" in updateResult) {
      throw new Error(`Updating inactive event config failed unexpectedly: ${updateResult.error}`);
    }
    assertEquals(updateResult, {}, "Expected empty success object, updateEventConfig does not require active event");

    const event = await eventDirectory._getEvent({ eventId: eventId1 });
    assertEquals(event?.config?.description, "Updated description for an inactive event", "Config should be updated for inactive event");
  });

  await test.step("Step 8: Admin activates the event again.", async () => {
    assertExists(eventId1, "eventId1 must exist to activate event");
    const activateResult = await eventDirectory.activateEvent({ admin: adminId, eventId: eventId1 });
    if ("error" in activateResult) {
      throw new Error(`Activating event failed unexpectedly: ${activateResult.error}`);
    }
    assertEquals(activateResult, {}, "Expected empty success object when activating event");

    const event = await eventDirectory._getEvent({ eventId: eventId1 });
    assertEquals(event?.active, true, "Event should be active again");
  });

  await test.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
    assertExists(eventId1, "eventId1 must exist to remove reader");
    const removeReaderResult = await eventDirectory.removeReader({
      admin: adminId,
      event: eventId1,
      reader: readerAId,
    });
    if ("error" in removeReaderResult) {
      throw new Error(`Removing readerA failed unexpectedly: ${removeReaderResult.error}`);
    }
    assertEquals(removeReaderResult, {}, "Expected empty success object when removing readerA");

    // Verify readerA is no longer a member
    const memberships = await eventDirectory._getEventMemberships({ event: eventId1 });
    assertEquals(memberships.some(m => m.reader === readerAId), false, "readerA should not be a member");
  });

  await test.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
    assertExists(eventId1, "eventId1 must exist to re-remove reader");
    const removeReaderResult = await eventDirectory.removeReader({
      admin: adminId,
      event: eventId1,
      reader: readerAId,
    });
    // This assertion expects the specific error message, assuming admin check passes.
    assertEquals(removeReaderResult, { error: `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.` }, "Error message should indicate user is not a verified reader");
  });

  await test.step("Step 11: Final verification of reader states.", async () => {
    assertExists(eventId1, "eventId1 must exist for final verification");
    const memberships = await eventDirectory._getEventMemberships({ event: eventId1 });
    // Corrected assertion: readerA was removed, so only readerB should remain.
    assertEquals(memberships.length, 1, "There should be one membership (readerB) for eventId1");
    assertEquals(memberships[0]?.reader, readerBId, "The remaining reader should be readerB");
  });

  await test.step("Teardown: Close database client", async () => {
    await client.close();
  });
});
```
