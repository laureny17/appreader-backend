[@implementation](implementation.md)
[@testing-concepts](../../background/testing-concepts.md)
[@LikertSurvey-concept-tests](/src/concepts/LikertSurvey/LikertSurveyConcept.test.ts)
# prompt: Observe how tests were structured for the sample LikertSurvey concept here ([@LikertSurvey-concept-tests](/src/concepts/LikertSurvey/LikertSurveyConcept.test.ts)) and create a test suite that works with the Deno testing framework and covers a full trace that  demonstrates how the principle of the concept is fulfilled by a sequence of actions. Ensure that no tests use or depend on ANY other concepts besides EventDirectory itself. Do not test any behavior that requires cross-concept interaction.

# test: EventDirectory
# response:

To test the `EventDirectoryConcept` according to the provided instructions, we'll create a Deno test file (`src/EventDirectory/EventDirectoryConcept.test.ts`). This suite will:

1.  **Follow the Deno BDD style** using `describe`, `it`, `beforeEach`, `afterEach`.
2.  **Demonstrate the concept's principle** through a sequential "trace" test, ensuring admin capabilities and the lifecycle of a reader's verified status are covered.
3.  **Cover individual action functionalities** including success cases and error conditions (e.g., unauthorized access, duplicate names).
4.  **Strictly avoid dependencies on other concepts** and only use the `EventDirectoryConcept` itself.
5.  **Use MongoDB** for state persistence, clearing it between tests for isolation.

The principle outlines: "Users can register for a chosen event and can become a reader if approved (automatically 'pending' for approval) The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event."

Since the `EventDirectory` concept doesn't have an explicit `registerForEvent` action for users to create a 'pending' state, we will simulate this by directly inserting an unverified `MembershipDocument` into the database for our trace test. This allows us to demonstrate the full flow of an admin approving (making `verified: true`) and un-approving (making `verified: false`) a reader, without relying on external concept interactions.

```typescript
// src/EventDirectory/EventDirectoryConcept.test.ts
import {
  afterEach,
  beforeEach,
  describe,
  it,
} from "https://deno.land/std@0.208.0/testing/bdd.ts";
import { assert, assertEquals } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { Db, MongoClient } from "npm:mongodb"; // No need for Collection if only using Db
import { getDb, freshID } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Helper function to create test IDs, using type branding for clarity
const createId = (prefix: string) => `${prefix}:${Math.random().toString(36).substring(7)}` as ID;

// Define interfaces for direct database interaction in tests, matching concept's internal types
interface EventDocument {
  _id: ID;
  name: string;
  active: boolean;
  requiredReadsPerApp: number;
  rubric: { name: string; description: string; scaleMin: number; scaleMax: number }[];
  eligibilityCriteria: string[];
}

interface MembershipDocument {
  _id: ID;
  event: ID;
  user: ID;
  verified: boolean;
}

interface AdminDocument {
  _id: ID;
}

describe("EventDirectoryConcept", () => {
  let db: Db;
  let client: MongoClient;
  let concept: EventDirectoryConcept;

  // Test user IDs
  let adminUser: ID;
  let normalUser: ID;
  let readerUser: ID;
  let anotherAdminUser: ID;

  // Sample rubric for event creation
  const sampleRubric = [
    { name: "Impact", description: "Overall impact of the application", scaleMin: 1, scaleMax: 5 },
    { name: "Innovation", description: "Novelty of the solution", scaleMin: 1, scaleMax: 5 },
  ];

  beforeEach(async () => {
    // 1. Initialize database and concept instance
    [db, client] = await getDb();
    concept = new EventDirectoryConcept(db);

    // 2. Clear collections to ensure a clean state for each test
    await db.collection<EventDocument>("EventDirectory.events").deleteMany({});
    await db.collection<MembershipDocument>("EventDirectory.memberships").deleteMany({});
    await db.collection<AdminDocument>("EventDirectory.admins").deleteMany({});

    // 3. Generate unique IDs for test users
    adminUser = createId("user:admin");
    normalUser = createId("user:normal");
    readerUser = createId("user:reader");
    anotherAdminUser = createId("user:secondAdmin");

    // 4. Set up an initial admin user required for most actions
    const addAdminResult = await concept.addAdmin({ caller: adminUser, user: adminUser });
    assertEquals(Object.keys(addAdminResult).length, 0, `Initial admin setup failed: ${addAdminResult.error}`);
    // Verify using the private helper method (accessed via bracket notation for testing)
    assert(await concept["_isAdmin"](adminUser), "Admin user should be set up correctly.");
  });

  afterEach(async () => {
    // 5. Close the database client after each test
    await client.close();
  });

  describe("Principle Fulfilment Trace", () => {
    it("should demonstrate the admin's ability to create, manage events and readers, fulfilling the concept principle", async () => {
      // Principle Trace Step 1: Admin creates an event
      const eventName = "Hackathon 2024";
      const requiredReads = 3;

      const createResult = await concept.createEvent({
        caller: adminUser,
        name: eventName,
        requiredReadsPerApp: requiredReads,
        rubric: sampleRubric,
      });

      assert("event" in createResult, `Failed to create event: ${createResult.error}`);
      const eventId = createResult.event;
      assert(eventId, "Event ID should be returned.");

      let fetchedEvent = await db.collection<EventDocument>("EventDirectory.events").findOne({ _id: eventId });
      assertEquals(fetchedEvent?.name, eventName);
      assertEquals(fetchedEvent?.active, true);
      assertEquals(fetchedEvent?.requiredReadsPerApp, requiredReads);
      assertEquals(fetchedEvent?.rubric, sampleRubric);
      assertEquals(fetchedEvent?.eligibilityCriteria.length, 0);

      // Principle Trace Step 2: Simulate user 'registering' (creating an unverified membership - 'pending' status)
      // This is a direct DB insertion as EventDirectory has no user-facing 'register' action.
      const unverifiedMembershipId = freshID();
      await db.collection<MembershipDocument>("EventDirectory.memberships").insertOne({
        _id: unverifiedMembershipId,
        event: eventId,
        user: readerUser,
        verified: false,
      });
      let isReaderVerified = await concept._isReaderVerified({ event: eventId, user: readerUser });
      assert(!isReaderVerified, "User should initially be an unverified reader (pending).");

      // Principle Trace Step 3: Admin adds (approves) the user as a verified reader
      const addReaderResult = await concept.addReader({
        caller: adminUser,
        event: eventId,
        user: readerUser,
      });
      assertEquals(Object.keys(addReaderResult).length, 0, `Add reader failed: ${addReaderResult.error}`); // Expect empty object for success

      isReaderVerified = await concept._isReaderVerified({ event: eventId, user: readerUser });
      assert(isReaderVerified, "User should be a verified reader after admin approval.");

      let membership = await db.collection<MembershipDocument>("EventDirectory.memberships").findOne({ event: eventId, user: readerUser });
      assert(membership, "Membership document should exist.");
      assertEquals(membership?.event, eventId);
      assertEquals(membership?.user, readerUser);
      assertEquals(membership?.verified, true);

      // Principle Trace Step 4: Admin inactivates the event (simulating 'archive')
      const inactivateResult = await concept.inactivateEvent({ caller: adminUser, name: eventName });
      assertEquals(Object.keys(inactivateResult).length, 0, `Inactivate event failed: ${inactivateResult.error}`);

      fetchedEvent = await db.collection<EventDocument>("EventDirectory.events").findOne({ _id: eventId });
      assertEquals(fetchedEvent?.active, false, "Event should be inactive (archived).");

      // Principle Trace Step 5: Admin activates the event again
      const activateResult = await concept.activateEvent({ caller: adminUser, name: eventName });
      assertEquals(Object.keys(activateResult).length, 0, `Activate event failed: ${activateResult.error}`);

      fetchedEvent = await db.collection<EventDocument>("EventDirectory.events").findOne({ _id: eventId });
      assertEquals(fetchedEvent?.active, true, "Event should be active again.");

      // Principle Trace Step 6: Admin updates event configuration (rubric, required reads, eligibility)
      const updatedRequiredReads = 5;
      const updatedRubric = [...sampleRubric, { name: "Originality", description: "Uniqueness of idea", scaleMin: 0, scaleMax: 10 }];
      const updatedEligibility = ["Must be university student", "Must submit by deadline"];

      const updateConfigResult = await concept.updateEventConfig({
        caller: adminUser,
        event: eventId,
        requiredReadsPerApp: updatedRequiredReads,
        rubric: updatedRubric,
        eligibilityCriteria: updatedEligibility,
      });
      assertEquals(Object.keys(updateConfigResult).length, 0, `Update event config failed: ${updateConfigResult.error}`);

      fetchedEvent = await db.collection<EventDocument>("EventDirectory.events").findOne({ _id: eventId });
      assertEquals(fetchedEvent?.requiredReadsPerApp, updatedRequiredReads);
      assertEquals(fetchedEvent?.rubric, updatedRubric);
      assertEquals(fetchedEvent?.eligibilityCriteria, updatedEligibility);

      // Principle Trace Step 7: Admin removes reader (makes them unverified again, simulating un-approval/revocation)
      const removeReaderResult = await concept.removeReader({
        caller: adminUser,
        event: eventId,
        user: readerUser,
      });
      assertEquals(Object.keys(removeReaderResult).length, 0, `Remove reader failed: ${removeReaderResult.error}`);

      isReaderVerified = await concept._isReaderVerified({ event: eventId, user: readerUser });
      assert(!isReaderVerified, "User should no longer be a verified reader (unverified/pending again).");

      membership = await db.collection<MembershipDocument>("EventDirectory.memberships").findOne({ event: eventId, user: readerUser });
      assert(membership, "Membership document should still exist but be unverified.");
      assertEquals(membership?.verified, false);

      // Principle Trace Step 8: Admin adds another admin
      const addAnotherAdminResult = await concept.addAdmin({ caller: adminUser, user: anotherAdminUser });
      assertEquals(Object.keys(addAnotherAdminResult).length, 0, `Add another admin failed: ${addAnotherAdminResult.error}`);
      assert(await concept["_isAdmin"](anotherAdminUser), "Another user should now be an admin.");

      // Principle Trace Step 9: Admin removes the newly added admin
      const removeAnotherAdminResult = await concept.removeAdmin({ caller: adminUser, user: anotherAdminUser });
      assertEquals(Object.keys(removeAnotherAdminResult).length, 0, `Remove another admin failed: ${removeAnotherAdminResult.error}`);
      assert(!(await concept["_isAdmin"](anotherAdminUser)), "The other admin should no longer be an admin.");
    });
  });

  describe("Individual Action Tests (Edge Cases/Errors)", () => {
    let eventId: ID;
    const eventName = "Test Event";

    beforeEach(async () => {
      // Create a base event for many of these tests
      const createResult = await concept.createEvent({
        caller: adminUser,
        name: eventName,
        requiredReadsPerApp: 2,
        rubric: [],
      });
      assert("event" in createResult && createResult.event, "Pre-test event creation failed");
      eventId = createResult.event as ID; // Cast for type consistency
    });

    it("should prevent non-admins from creating events", async () => {
      const result = await concept.createEvent({
        caller: normalUser,
        name: "Forbidden Event",
        requiredReadsPerApp: 1,
        rubric: [],
      });
      assert("error" in result, "Non-admin should not be able to create an event.");
      assertEquals(result.error, "Only admins can create events.");
    });

    it("should prevent creating an event with a duplicate name", async () => {
      const result = await concept.createEvent({
        caller: adminUser,
        name: eventName, // Duplicate name
        requiredReadsPerApp: 1,
        rubric: [],
      });
      assert("error" in result, "Should not create event with a duplicate name.");
      assertEquals(result.error, `An event with the name '${eventName}' already exists.`);
    });

    it("should prevent non-admins from activating/inactivating events", async () => {
      const inactivateResult = await concept.inactivateEvent({ caller: normalUser, name: eventName });
      assert("error" in inactivateResult, "Non-admin should not be able to inactivate an event.");
      assertEquals(inactivateResult.error, "Only admins can inactivate events.");

      const activateResult = await concept.activateEvent({ caller: normalUser, name: eventName });
      assert("error" in activateResult, "Non-admin should not be able to activate an event.");
      assertEquals(activateResult.error, "Only admins can activate events.");
    });

    it("should prevent activating an already active event", async () => {
      // Event is active by default after beforeEach setup
      const result = await concept.activateEvent({ caller: adminUser, name: eventName });
      assert("error" in result, "Should prevent activating an already active event.");
      assertEquals(result.error, `Event '${eventName}' is already active.`);
    });

    it("should prevent inactivating an already inactive event", async () => {
      // First, inactivate the event
      await concept.inactivateEvent({ caller: adminUser, name: eventName });
      const result = await concept.inactivateEvent({ caller: adminUser, name: eventName });
      assert("error" in result, "Should prevent inactivating an already inactive event.");
      assertEquals(result.error, `Event '${eventName}' is already inactive.`);
    });

    it("should prevent non-admins from updating event config", async () => {
      const result = await concept.updateEventConfig({
        caller: normalUser,
        event: eventId,
        requiredReadsPerApp: 10,
      });
      assert("error" in result, "Non-admin should not be able to update event configuration.");
      assertEquals(result.error, "Only admins can update event configurations.");
    });

    it("should prevent updating a non-existent event's config", async () => {
      const nonExistentEventId = createId("event:nonexistent");
      const result = await concept.updateEventConfig({
        caller: adminUser,
        event: nonExistentEventId,
        requiredReadsPerApp: 10,
      });
      assert("error" in result, "Should not update config for a non-existent event.");
      assertEquals(result.error, `Event with ID '${nonExistentEventId}' not found.`);
    });

    it("should prevent non-admins from adding/removing readers", async () => {
      const addResult = await concept.addReader({ caller: normalUser, event: eventId, user: readerUser });
      assert("error" in addResult, "Non-admin should not be able to add a reader.");
      assertEquals(addResult.error, "Only admins can add readers.");

      // Add a reader with admin, then try to remove with a normal user
      await concept.addReader({ caller: adminUser, event: eventId, user: readerUser });
      const removeResult = await concept.removeReader({ caller: normalUser, event: eventId, user: readerUser });
      assert("error" in removeResult, "Non-admin should not be able to remove a reader.");
      assertEquals(removeResult.error, "Only admins can remove readers.");
    });

    it("should prevent adding an already verified reader", async () => {
      await concept.addReader({ caller: adminUser, event: eventId, user: readerUser }); // First add (verifies)
      const result = await concept.addReader({ caller: adminUser, event: eventId, user: readerUser }); // Second add (attempt to add again)
      assert("error" in result, "Should prevent adding an already verified reader.");
      assertEquals(result.error, `User '${readerUser}' is already a verified reader for event '${eventId}'.`);
    });

    it("should prevent removing a non-verified reader", async () => {
      const userWithoutMembership = createId("user:noMembership");
      const result = await concept.removeReader({ caller: adminUser, event: eventId, user: userWithoutMembership });
      assert("error" in result, "Should prevent removing a user who is not a reader.");
      assertEquals(result.error, `User '${userWithoutMembership}' is not a verified reader for event '${eventId}'.`);

      // Test with an existing but unverified membership
      await db.collection<MembershipDocument>("EventDirectory.memberships").insertOne({
        _id: freshID(),
        event: eventId,
        user: readerUser,
        verified: false,
      });
      const resultUnverified = await concept.removeReader({ caller: adminUser, event: eventId, user: readerUser });
      assert("error" in resultUnverified, "Should prevent removing an unverified reader.");
      assertEquals(resultUnverified.error, `User '${readerUser}' is not a verified reader for event '${eventId}'.`);
    });

    it("should prevent non-admins from adding/removing admins", async () => {
      const newAdminUser = createId("user:newAdmin");
      const addResult = await concept.addAdmin({ caller: normalUser, user: newAdminUser });
      assert("error" in addResult, "Non-admin should not be able to add another admin.");
      assertEquals(addResult.error, "Only existing admins can add new admins.");

      // Add a temporary admin with an existing admin, then try to remove with a normal user
      const tempAdmin = createId("user:tempAdmin");
      await concept.addAdmin({ caller: adminUser, user: tempAdmin });
      const removeResult = await concept.removeAdmin({ caller: normalUser, user: tempAdmin });
      assert("error" in removeResult, "Non-admin should not be able to remove an admin.");
      assertEquals(removeResult.error, "Only admins can remove other admins.");
    });

    it("should prevent adding an already existing admin", async () => {
      const result = await concept.addAdmin({ caller: adminUser, user: adminUser }); // Attempt to add self again
      assert("error" in result, "Should prevent adding an already existing admin.");
      assertEquals(result.error, `User '${adminUser}' is already an admin.`);
    });

    it("should prevent removing a non-admin", async () => {
      const result = await concept.removeAdmin({ caller: adminUser, user: normalUser });
      assert("error" in result, "Should prevent removing a non-admin user.");
      assertEquals(result.error, `User '${normalUser}' is not an admin.`);
    });

    it("should prevent removing the last admin", async () => {
      // Ensure only one admin exists (adminUser) by deleting any others if they somehow appeared
      await db.collection<AdminDocument>("EventDirectory.admins").deleteMany({ _id: { $ne: adminUser } });
      const adminCount = await db.collection<AdminDocument>("EventDirectory.admins").countDocuments({});
      assertEquals(adminCount, 1, "There should be exactly one admin for this test setup.");

      const result = await concept.removeAdmin({ caller: adminUser, user: adminUser });
      assert("error" in result, "Should prevent removing the last remaining admin.");
      assertEquals(result.error, "Cannot remove the last remaining admin.");
    });
  });
});
```