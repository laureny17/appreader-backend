---
timestamp: 'Wed Oct 15 2025 02:48:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_024817.46512adf.md]]'
content_id: 47671ff548f9b93715364336779bbaf258d8e84a118f1e612889f0a047fe6d12
---

# response:

```typescript
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.210.0/testing/bdd.ts";
import {
  assertEquals,
  assertExists,
  assertFalse,
  assertNotEquals,
  assertObjectMatch,
  assertRejects,
  assertStrictEquals,
  assertThrows,
  assertTrue,
} from "https://deno.land/std@0.210.0/assert/mod.ts";
import { getTestDb, freshID } from "@utils/database.ts";
import { Db, MongoClient } from "npm:mongodb";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";
import { UserID, ID } from "@utils/types.ts";
import AuthAccountsConcept from "@concepts/AuthAccounts/AuthAccountsConcept.ts"; // Import AuthAccountsConcept

describe("EventDirectoryConcept: Principle Fulfillment Trace", () => {
  let client: MongoClient;
  let db: Db;
  let eventDirectory: EventDirectoryConcept;
  let authAccounts: AuthAccountsConcept; // Declare AuthAccountsConcept instance

  let adminId: UserID;
  let readerAId: UserID;
  let readerBId: UserID;
  let nonAdminId: UserID;

  let eventId1: ID;

  beforeAll(async () => {
    [db, client] = await getTestDb();
    // FIX: Initialize AuthAccountsConcept and pass _isAdmin to EventDirectoryConcept
    authAccounts = new AuthAccountsConcept(db);
    eventDirectory = new EventDirectoryConcept(
      db,
      async (userId: UserID) => {
        const result = await authAccounts._isAdmin({ userId });
        // The _isAdmin query returns an array; check if the user is in it.
        return result.length > 0;
      },
    );
  });

  afterAll(async () => {
    await db.dropDatabase();
    await client.close();
  });

  beforeEach(async () => {
    // Clear collections before each test
    await db.collection("EventDirectory.events").deleteMany({});
    await db.collection("AuthAccounts.accounts").deleteMany({});

    adminId = "user:admin" as UserID;
    readerAId = "user:readerA" as UserID;
    readerBId = "user:readerB" as UserID;
    nonAdminId = "user:nonAdmin" as UserID;

    // Setup: Initialize database and make adminId an admin
    await authAccounts.register({ userId: adminId, password: "password" });
    await authAccounts.makeAdmin({ adminId: adminId, userId: adminId });

    await authAccounts.register({ userId: readerAId, password: "passwordA" });
    await authAccounts.register({ userId: readerBId, password: "passwordB" });
    await authAccounts.register({ userId: nonAdminId, password: "passwordC" });
  });

  it("Principle Fulfillment Trace", async (test) => {
    await test.step("Setup: Initialize database and make adminId an admin", async () => {
      // Verify adminId is an admin
      const isAdminResult = await authAccounts._isAdmin({ userId: adminId });
      assertEquals(isAdminResult.length, 1, "adminId should be an admin after setup");
      assertEquals(isAdminResult[0]._id, adminId, "adminId should be listed as an admin");
    });

    await test.step("Step 1: Admin creates an event.", async () => {
      const createResult = await eventDirectory.createEvent({
        name: "Test Event 1",
        description: "A test event for readers",
        config: { startDate: "2023-01-01", endDate: "2023-01-31" },
        adminId: adminId,
      });

      // FIX: Correctly check the return type and extract eventId
      assertFalse("error" in createResult, `Expected no error, but got: ${createResult.error}`);
      assertExists((createResult as { eventId: ID }).eventId, "Event ID should be returned on success");
      eventId1 = (createResult as { eventId: ID }).eventId;

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertExists(event, "Event should exist after creation");
      assertEquals(event.name, "Test Event 1");
      assertEquals(event.active, true);
      assertEquals(event.verifiedReaders.length, 0);
    });

    await test.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
      const updateResult = await eventDirectory.updateEventConfig({
        eventId: eventId1,
        config: { startDate: "2023-01-01", endDate: "2023-01-31", location: "Online" },
        adminId: adminId,
      });

      // FIX: Ensure the expected result is an empty object, not an error
      assertEquals(updateResult, {}, "Expected empty success object for event configuration update");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertEquals(event.config, { startDate: "2023-01-01", endDate: "2023-01-31", location: "Online" }, "Event configuration should be updated");
    });

    await test.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
      const addReaderAResult = await eventDirectory.addReader({
        eventId: eventId1,
        readerId: readerAId,
        adminId: adminId,
      });

      // FIX: Ensure the expected result is an empty object, not an error
      assertEquals(addReaderAResult, {}, "Expected empty success object when adding readerA");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertTrue(event.verifiedReaders.includes(readerAId), "readerAId should be a verified reader");
    });

    await test.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
      const addReaderADuplicateResult = await eventDirectory.addReader({
        eventId: eventId1,
        readerId: readerAId,
        adminId: adminId,
      });

      // FIX: Update expected error message to match the concept's dynamic output
      assertEquals(
        addReaderADuplicateResult,
        { error: `User '${readerAId}' is already a verified reader for event '${eventId1}'.` },
        "Error message should indicate user is already verified",
      );

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertEquals(event.verifiedReaders.filter((id) => id === readerAId).length, 1, "readerAId should only be listed once");
    });

    await test.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
      const addReaderBResult = await eventDirectory.addReader({
        eventId: eventId1,
        readerId: readerBId,
        adminId: adminId,
      });

      // FIX: Ensure the expected result is an empty object, not an error
      assertEquals(addReaderBResult, {}, "Expected empty success object when adding readerB");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertTrue(event.verifiedReaders.includes(readerBId), "readerBId should be a verified reader");
      assertEquals(event.verifiedReaders.length, 2, "There should be two verified readers");
    });

    await test.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
      const inactivateResult = await eventDirectory.inactivateEvent({
        eventId: eventId1,
        adminId: adminId,
      });

      // FIX: Ensure the expected result is an empty object, not an error
      assertEquals(inactivateResult, {}, "Expected empty success object when inactivating event");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertEquals(event.active, false, "Event should be inactive");
    });

    await test.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
      const updateInactiveResult = await eventDirectory.updateEventConfig({
        eventId: eventId1,
        config: { startDate: "2023-01-01", endDate: "2023-01-31", location: "Online", status: "Archived" },
        adminId: adminId,
      });

      // FIX: The `updateEventConfig` action does not require the event to be active.
      // Therefore, it should succeed. The original expectation was correct for the spec.
      assertEquals(updateInactiveResult, {}, "Expected empty success object, updateEventConfig does not require active event");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertEquals(event.config, { startDate: "2023-01-01", endDate: "2023-01-31", location: "Online", status: "Archived" }, "Event configuration should be updated even if inactive");
    });

    await test.step("Step 8: Admin activates the event again.", async () => {
      const activateResult = await eventDirectory.activateEvent({
        eventId: eventId1,
        adminId: adminId,
      });

      // FIX: Ensure the expected result is an empty object, not an error
      assertEquals(activateResult, {}, "Expected empty success object when activating event");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertEquals(event.active, true, "Event should be active again");
    });

    await test.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
      const removeReaderAResult = await eventDirectory.removeReader({
        eventId: eventId1,
        readerId: readerAId,
        adminId: adminId,
      });

      // FIX: Ensure the expected result is an empty object, not an error
      assertEquals(removeReaderAResult, {}, "Expected empty success object when removing readerA");

      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertFalse(event.verifiedReaders.includes(readerAId), "readerAId should no longer be a verified reader");
      assertEquals(event.verifiedReaders.length, 1, "There should be one remaining verified reader");
    });

    await test.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
      const removeReaderADuplicateResult = await eventDirectory.removeReader({
        eventId: eventId1,
        readerId: readerAId,
        adminId: adminId,
      });

      // FIX: Update expected error message to match the concept's dynamic output
      assertEquals(
        removeReaderADuplicateResult,
        { error: `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.` },
        "Error message should indicate user is not a verified reader",
      );
    });

    await test.step("Step 11: Final verification of reader states.", async () => {
      const [event] = await eventDirectory._getEvent({ eventId: eventId1 });
      assertExists(event, "Event should still exist");
      assertEquals(event.verifiedReaders.length, 1, "There should be one membership for eventId1"); // FIX: Changed expected count from 2 to 1
      assertTrue(event.verifiedReaders.includes(readerBId), "readerBId should still be a verified reader");
      assertFalse(event.verifiedReaders.includes(readerAId), "readerAId should not be a verified reader");
    });
  });
});

```
