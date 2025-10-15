---
timestamp: 'Wed Oct 15 2025 01:21:25 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_012125.881669c6.md]]'
content_id: 1d70fcd4a1d37d9d445115c41bcd508f75ccd6ac18738a1aaaf1b5f16920eacd
---

# file: src/eventdirectory/EventDirectoryConcept.test.ts

```typescript
import { assertEquals, assertRejects } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Helper types for test users and events
type User = ID;
type Event = ID;
type RubricDimension = { name: string; description: string; scaleMin: number; scaleMax: number };

// Test entities
const adminAlice = "user:Alice" as User;
const adminBob = "user:Bob" as User; // Will be promoted to admin
const userCarol = "user:Carol" as User; // Will be a reader

const eventName1 = "Annual Conference 2024";
const eventName2 = "Tech Showcase 2025"; // For individual action tests
const rubricDimension1: RubricDimension = { name: "Innovation", description: "How novel is the idea?", scaleMin: 1, scaleMax: 5 };
const rubricDimension2: RubricDimension = { name: "Feasibility", description: "Can it be implemented?", scaleMin: 1, scaleMax: 5 };

Deno.test("EventDirectoryConcept", async (t) => {
  let db: Db;
  let client: any;
  let concept: EventDirectoryConcept;

  Deno.test.beforeAll(async () => {
    [db, client] = await testDb();
    concept = new EventDirectoryConcept(db);
    // Ensure adminAlice is an admin for all tests
    await concept.admins.insertOne({ _id: adminAlice });
  });

  Deno.test.afterAll(async () => {
    await client.close();
  });

  // --- Concept Testing: Confirming action requirements and effects ---

  await t.step("1. Confirming action requirements and effects", async (t_inner) => {
    // --- createEvent ---
    await t_inner.step("createEvent: requires caller is an admin and no other event exists with the same name", async () => {
      // Test non-admin trying to create event
      const nonAdminCreateRes = await concept.createEvent({ caller: userCarol, name: eventName2, requiredReadsPerApp: 1, rubric: [] });
      assertEquals("error" in nonAdminCreateRes, true, "Non-admin should not be able to create event");
      assertEquals(nonAdminCreateRes.error, "Caller is not an admin.", "Error message should match");

      // Admin creates first event
      const createRes1 = await concept.createEvent({ caller: adminAlice, name: eventName2, requiredReadsPerApp: 3, rubric: [rubricDimension1] });
      assertEquals("event" in createRes1, true, "Admin should successfully create an event.");
      const eventId2 = (createRes1 as { event: Event }).event;

      // Admin tries to create another event with the same name
      const createRes2 = await concept.createEvent({ caller: adminAlice, name: eventName2, requiredReadsPerApp: 5, rubric: [] });
      assertEquals("error" in createRes2, true, "Should return an error for duplicate event name.");
      assertEquals(createRes2.error, "An event with this name already exists.", "Error message should match.");

      // Cleanup: Inactivate the created event to avoid conflicts in subsequent tests
      await concept.inactivateEvent({ caller: adminAlice, name: eventName2 });
    });

    await t_inner.step("createEvent: effects add a new Event and set its active flag to true", async () => {
      const uniqueEventName = "UniqueEventForEffects";
      const createRes = await concept.createEvent({ caller: adminAlice, name: uniqueEventName, requiredReadsPerApp: 5, rubric: [rubricDimension1, rubricDimension2] });
      assertEquals("event" in createRes, true, "Should return an event ID.");
      const eventId = (createRes as { event: Event }).event;

      const createdEvent = await concept._getEventByName({ name: uniqueEventName });
      assertEquals(createdEvent?.name, uniqueEventName, "Created event name should match.");
      assertEquals(createdEvent?.active, true, "New event should be active by default.");
      assertEquals(createdEvent?.requiredReadsPerApp, 5, "Required reads should be set.");
      assertEquals(createdEvent?.rubric.length, 2, "Rubric should be set.");
      assertEquals(createdEvent?.eligibilityCriteria.length, 0, "Eligibility criteria should be initially empty.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: uniqueEventName });
    });

    // --- activateEvent ---
    await t_inner.step("activateEvent: requires caller is an admin and event is inactive", async () => {
      const eventName = "EventToActivate";
      await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      await concept.inactivateEvent({ caller: adminAlice, name: eventName }); // Make it inactive

      // Non-admin trying to activate
      const nonAdminActivateRes = await concept.activateEvent({ caller: userCarol, name: eventName });
      assertEquals("error" in nonAdminActivateRes, true, "Non-admin should not be able to activate event.");
      assertEquals(nonAdminActivateRes.error, "Caller is not an admin.", "Error message should match.");

      // Admin trying to activate an already active event (should fail)
      await concept.activateEvent({ caller: adminAlice, name: eventName }); // First activation should succeed
      const alreadyActiveRes = await concept.activateEvent({ caller: adminAlice, name: eventName });
      assertEquals("error" in alreadyActiveRes, true, "Activating an already active event should fail.");
      assertEquals(alreadyActiveRes.error, "Event is already active.", "Error message should match.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    await t_inner.step("activateEvent: effects sets the event's active flag to true", async () => {
      const eventName = "EventToActivateEffects";
      await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      await concept.inactivateEvent({ caller: adminAlice, name: eventName }); // Make it inactive
      const initialEvent = await concept._getEventByName({ name: eventName });
      assertEquals(initialEvent?.active, false, "Event should initially be inactive.");

      await concept.activateEvent({ caller: adminAlice, name: eventName });
      const activatedEvent = await concept._getEventByName({ name: eventName });
      assertEquals(activatedEvent?.active, true, "Event should be active after activation.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    // --- inactivateEvent ---
    await t_inner.step("inactivateEvent: requires caller is an admin and event is active", async () => {
      const eventName = "EventToInactivate";
      await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] }); // Starts active

      // Non-admin trying to inactivate
      const nonAdminInactivateRes = await concept.inactivateEvent({ caller: userCarol, name: eventName });
      assertEquals("error" in nonAdminInactivateRes, true, "Non-admin should not be able to inactivate event.");
      assertEquals(nonAdminInactivateRes.error, "Caller is not an admin.", "Error message should match.");

      // Admin trying to inactivate an already inactive event (should fail)
      await concept.inactivateEvent({ caller: adminAlice, name: eventName }); // First inactivation should succeed
      const alreadyInactiveRes = await concept.inactivateEvent({ caller: adminAlice, name: eventName });
      assertEquals("error" in alreadyInactiveRes, true, "Inactivating an already inactive event should fail.");
      assertEquals(alreadyInactiveRes.error, "Event is already inactive.", "Error message should match.");

      // Cleanup (if it's still inactive, no need to inactivate again)
      await concept.activateEvent({ caller: adminAlice, name: eventName });
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    await t_inner.step("inactivateEvent: effects sets the event's active flag to false", async () => {
      const eventName = "EventToInactivateEffects";
      await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      const initialEvent = await concept._getEventByName({ name: eventName });
      assertEquals(initialEvent?.active, true, "Event should initially be active.");

      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
      const inactivatedEvent = await concept._getEventByName({ name: eventName });
      assertEquals(inactivatedEvent?.active, false, "Event should be inactive after inactivation.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName }); // Ensure it's inactive if not already
    });

    // --- updateEventConfig ---
    await t_inner.step("updateEventConfig: requires caller is an admin", async () => {
      const eventName = "EventToUpdateConfig";
      const createRes = await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      const eventId = (createRes as { event: Event }).event;

      const nonAdminUpdateRes = await concept.updateEventConfig({
        caller: userCarol, event: eventId, requiredReadsPerApp: 10, rubric: [rubricDimension1], eligibilityCriteria: []
      });
      assertEquals("error" in nonAdminUpdateRes, true, "Non-admin should not be able to update event config.");
      assertEquals(nonAdminUpdateRes.error, "Caller is not an admin.", "Error message should match.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    await t_inner.step("updateEventConfig: effects updates provided fields", async () => {
      const eventName = "EventToUpdateConfigEffects";
      const createRes = await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [], eligibilityCriteria: [] });
      const eventId = (createRes as { event: Event }).event;

      const updatedReads = 10;
      const updatedRubric = [rubricDimension1, rubricDimension2];
      const updatedCriteria = ["PhD required"];

      await concept.updateEventConfig({
        caller: adminAlice, event: eventId, requiredReadsPerApp: updatedReads, rubric: updatedRubric, eligibilityCriteria: updatedCriteria
      });

      const updatedEvent = await concept._getEventByName({ name: eventName });
      assertEquals(updatedEvent?.requiredReadsPerApp, updatedReads, "Required reads should be updated.");
      assertEquals(updatedEvent?.rubric.length, updatedRubric.length, "Rubric should be updated.");
      assertEquals(updatedEvent?.eligibilityCriteria, updatedCriteria, "Eligibility criteria should be updated.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    // --- addReader ---
    await t_inner.step("addReader: requires caller is an admin, user is an unverified user for event, and user is not already a verified user in event", async () => {
      const eventName = "EventForReaders";
      const createRes = await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      const eventId = (createRes as { event: Event }).event;

      // Non-admin trying to add reader
      const nonAdminAddReaderRes = await concept.addReader({ caller: userCarol, event: eventId, user: adminBob });
      assertEquals("error" in nonAdminAddReaderRes, true, "Non-admin should not be able to add reader.");
      assertEquals(nonAdminAddReaderRes.error, "Caller is not an admin.", "Error message should match.");

      // User has no membership (not unverified yet)
      const noMembershipAddReaderRes = await concept.addReader({ caller: adminAlice, event: eventId, user: userCarol });
      assertEquals("error" in noMembershipAddReaderRes, true, "Should fail if user has no membership (not unverified).");
      assertEquals(noMembershipAddReaderRes.error, `User '${userCarol}' is not an unverified reader for event '${eventId}'.`, "Error message should match.");

      // Create an unverified membership
      await concept.memberships.insertOne({ _id: freshID(), event: eventId, user: userCarol, verified: false });

      // Admin tries to add already verified user (after first successful addReader)
      await concept.addReader({ caller: adminAlice, event: eventId, user: userCarol }); // Should succeed
      const alreadyVerifiedAddReaderRes = await concept.addReader({ caller: adminAlice, event: eventId, user: userCarol });
      assertEquals("error" in alreadyVerifiedAddReaderRes, true, "Should fail if user is already a verified reader.");
      assertEquals(alreadyVerifiedAddReaderRes.error, `User '${userCarol}' is not an unverified reader for event '${eventId}'.`, "Error message should match.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    await t_inner.step("addReader: effects makes user a verified user for the specified event", async () => {
      const eventName = "EventForAddReaderEffects";
      const createRes = await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      const eventId = (createRes as { event: Event }).event;

      await concept.memberships.insertOne({ _id: freshID(), event: eventId, user: userCarol, verified: false });
      const initialMembership = await concept._getMembership({ event: eventId, user: userCarol });
      assertEquals(initialMembership?.verified, false, "Membership should initially be unverified.");

      await concept.addReader({ caller: adminAlice, event: eventId, user: userCarol });
      const updatedMembership = await concept._getMembership({ event: eventId, user: userCarol });
      assertEquals(updatedMembership?.verified, true, "Membership should be verified after addReader.");

      // Cleanup
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    // --- removeReader ---
    await t_inner.step("removeReader: requires caller is an admin, user is a verified reader for the event, and user is not already an unverified user in event", async () => {
      const eventName = "EventForRemoveReaders";
      const createRes = await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      const eventId = (createRes as { event: Event }).event;

      // Add userCarol as a verified reader first
      await concept.memberships.insertOne({ _id: freshID(), event: eventId, user: userCarol, verified: false });
      await concept.addReader({ caller: adminAlice, event: eventId, user: userCarol });

      // Non-admin trying to remove reader
      const nonAdminRemoveReaderRes = await concept.removeReader({ caller: adminBob, event: eventId, user: userCarol });
      assertEquals("error" in nonAdminRemoveReaderRes, true, "Non-admin should not be able to remove reader.");
      assertEquals(nonAdminRemoveReaderRes.error, "Caller is not an admin.", "Error message should match.");

      // Admin tries to remove a user who is not a reader at all
      const noMembershipRemoveRes = await concept.removeReader({ caller: adminAlice, event: eventId, user: adminBob });
      assertEquals("error" in noMembershipRemoveRes, true, "Should fail if user has no membership.");
      assertEquals(noMembershipRemoveRes.error, `User '${adminBob}' has no membership for event '${eventId}'.`, "Error message should match.");

      // After first successful remove, user becomes unverified. Try to remove again (should fail)
      await concept.removeReader({ caller: adminAlice, event: eventId, user: userCarol }); // Should succeed
      const alreadyUnverifiedRemoveRes = await concept.removeReader({ caller: adminAlice, event: eventId, user: userCarol });
      assertEquals("error" in alreadyUnverifiedRemoveRes, true, "Should fail if user is already an unverified reader.");
      assertEquals(alreadyUnverifiedRemoveRes.error, `User '${userCarol}' is already an unverified reader for event '${eventId}'.`, "Error message should match.");

      // Cleanup (if it's still unverified, no need to remove again)
      // Remove the membership completely to clean up
      await concept.memberships.deleteOne({ event: eventId, user: userCarol });
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    await t_inner.step("removeReader: effects makes user an unverified user for the specified event", async () => {
      const eventName = "EventForRemoveReaderEffects";
      const createRes = await concept.createEvent({ caller: adminAlice, name: eventName, requiredReadsPerApp: 1, rubric: [] });
      const eventId = (createRes as { event: Event }).event;

      // Make userCarol a verified reader first
      await concept.memberships.insertOne({ _id: freshID(), event: eventId, user: userCarol, verified: false });
      await concept.addReader({ caller: adminAlice, event: eventId, user: userCarol });
      const initialMembership = await concept._getMembership({ event: eventId, user: userCarol });
      assertEquals(initialMembership?.verified, true, "Membership should initially be verified.");

      await concept.removeReader({ caller: adminAlice, event: eventId, user: userCarol });
      const updatedMembership = await concept._getMembership({ event: eventId, user: userCarol });
      assertEquals(updatedMembership?.verified, false, "Membership should be unverified after removeReader.");

      // Cleanup
      await concept.memberships.deleteOne({ event: eventId, user: userCarol });
      await concept.inactivateEvent({ caller: adminAlice, name: eventName });
    });

    // --- addAdmin ---
    await t_inner.step("addAdmin: requires caller is an admin and user is not already an admin", async () => {
      // Non-admin trying to add admin
      const nonAdminAddAdminRes = await concept.addAdmin({ caller: userCarol, user: adminBob });
      assertEquals("error" in nonAdminAddAdminRes, true, "Non-admin should not be able to add admin.");
      assertEquals(nonAdminAddAdminRes.error, "Caller is not an admin.", "Error message should match.");

      // Admin trying to add an already existing admin
      const alreadyAdminRes = await concept.addAdmin({ caller: adminAlice, user: adminAlice });
      assertEquals("error" in alreadyAdminRes, true, "Adding self as admin should fail if already admin.");
      assertEquals(alreadyAdminRes.error, `User '${adminAlice}' is already an admin.`, "Error message should match.");

      // Admin promotes adminBob
      await concept.addAdmin({ caller: adminAlice, user: adminBob });
      // Try to promote adminBob again
      const addExistingAdminRes = await concept.addAdmin({ caller: adminAlice, user: adminBob });
      assertEquals("error" in addExistingAdminRes, true, "Should fail if user is already an admin.");
      assertEquals(addExistingAdminRes.error, `User '${adminBob}' is already an admin.`, "Error message should match.");

      // Cleanup
      await concept.removeAdmin({ caller: adminAlice, user: adminBob });
    });

    await t_inner.step("addAdmin: effects make user an admin", async () => {
      const initialAdminStatus = await concept._isAdmin({ user: adminBob });
      assertEquals(initialAdminStatus, false, "adminBob should initially not be an admin.");

      await concept.addAdmin({ caller: adminAlice, user: adminBob });
      const updatedAdminStatus = await concept._isAdmin({ user: adminBob });
      assertEquals(updatedAdminStatus, true, "adminBob should be an admin after addAdmin.");

      // Cleanup
      await concept.removeAdmin({ caller: adminAlice, user: adminBob });
    });

    // --- removeAdmin ---
    await t_inner.step("removeAdmin: requires caller and user are both admins", async () => {
      // Make adminBob an admin for this test
      await concept.addAdmin({ caller: adminAlice, user: adminBob });

      // Non-admin trying to remove admin
      const nonAdminRemoveAdminRes = await concept.removeAdmin({ caller: userCarol, user: adminBob });
      assertEquals("error" in nonAdminRemoveAdminRes, true, "Non-admin should not be able to remove admin.");
      assertEquals(nonAdminRemoveAdminRes.error, "Caller is not an admin.", "Error message should match.");

      // Admin tries to remove a non-admin
      const removeNonAdminRes = await concept.removeAdmin({ caller: adminAlice, user: userCarol });
      assertEquals("error" in removeNonAdminRes, true, "Should fail if target user is not an admin.");
      assertEquals(removeNonAdminRes.error, `User '${userCarol}' is not an admin.`, "Error message should match.");

      // Cleanup
      await concept.removeAdmin({ caller: adminAlice, user: adminBob });
    });

    await t_inner.step("removeAdmin: effects make user not an admin", async () => {
      // Make adminBob an admin first
      await concept.addAdmin({ caller: adminAlice, user: adminBob });
      const initialAdminStatus = await concept._isAdmin({ user: adminBob });
      assertEquals(initialAdminStatus, true, "adminBob should initially be an admin.");

      await concept.removeAdmin({ caller: adminAlice, user: adminBob });
      const updatedAdminStatus = await concept._isAdmin({ user: adminBob });
      assertEquals(updatedAdminStatus, false, "adminBob should not be an admin after removeAdmin.");
    });
  });

  // --- Principle Trace ---

  await t.step("2. Ensuring that the principle is fully modeled by the actions", async () => {

    // Helper functions for assertions within the trace
    const assertIsAdmin = async (user: User, expected: boolean) => {
      const isAdmin = await concept._isAdmin({ user });
      assertEquals(isAdmin, expected, `${user} admin status should be ${expected}`);
    };
    const assertEventActive = async (eventName: string, expected: boolean) => {
      const event = await concept._getEventByName({ name: eventName });
      assertEquals(event?.active, expected, `Event '${eventName}' active status should be ${expected}`);
    };
    const assertReaderStatus = async (event: Event, user: User, expectedVerified: boolean) => {
      const membership = await concept._getMembership({ event, user });
      // If expectedVerified is false and membership is null, it also implies not verified.
      if (!membership && !expectedVerified) return;
      assertEquals(membership?.verified, expectedVerified, `${user} reader status for event ${event} should be verified: ${expectedVerified}`);
    };
    const assertEventConfig = async (eventName: string, expectedReads: number, expectedRubricCount: number, expectedCriteria: string[]) => {
      const event = await concept._getEventByName({ name: eventName });
      assertEquals(event?.requiredReadsPerApp, expectedReads, `Event '${eventName}' requiredReadsPerApp should be ${expectedReads}`);
      assertEquals(event?.rubric.length, expectedRubricCount, `Event '${eventName}' rubric count should be ${expectedRubricCount}`);
      assertEquals(event?.eligibilityCriteria, expectedCriteria, `Event '${eventName}' eligibility criteria should be ${expectedCriteria}`);
    };

    let principleEventId: Event | undefined;
    const initialReads = 3;
    const initialRubric = [rubricDimension1];
    const updatedReads = 5;
    const updatedRubric = [rubricDimension1, rubricDimension2];
    const updatedCriteria = ["has relevant experience"];
    const principleEventName = "Principle Test Event";

    // Pre-condition: adminAlice is an admin (setup in beforeAll)
    await assertIsAdmin(adminAlice, true);
    await assertIsAdmin(adminBob, false);
    await assertIsAdmin(userCarol, false);
    console.log(`\nInitial state: ${adminAlice} is admin, ${adminBob} and ${userCarol} are not.`);


    // # trace: Demonstrating the EventDirectory concept's principle fulfillment.
    // The principle states: "Users can register for a chosen event and can become a reader if approved (automatically 'pending' for approval)
    // The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event."

    await t.step("1. Admin creates an event and sets initial configuration.", async () => {
      // Action: Admin creates a new event.
      const createRes = await concept.createEvent({ caller: adminAlice, name: principleEventName, requiredReadsPerApp: initialReads, rubric: initialRubric });
      assertEquals("event" in createRes, true, "Admin should successfully create an event.");
      principleEventId = (createRes as { event: Event }).event;

      // Effects verification: Event is created and active.
      await assertEventActive(principleEventName, true);
      await assertEventConfig(principleEventName, initialReads, initialRubric.length, []);
      console.log(`Trace: ${adminAlice} created event '${principleEventName}' (ID: ${principleEventId}).`);
    });

    await t.step("2. Admin updates the event configuration.", async () => {
      // Action: Admin updates the event's rubric, required reads, and eligibility criteria.
      const updateRes = await concept.updateEventConfig({
        caller: adminAlice, event: principleEventId!, requiredReadsPerApp: updatedReads, rubric: updatedRubric, eligibilityCriteria: updatedCriteria
      });
      assertEquals("error" in updateRes, false, "Admin should successfully update event config.");

      // Effects verification: Event config is updated.
      await assertEventConfig(principleEventName, updatedReads, updatedRubric.length, updatedCriteria);
      console.log(`Trace: ${adminAlice} updated event '${principleEventName}' configuration.`);
    });

    await t.step("3. Admin promotes another user to admin.", async () => {
      // Action: Admin adds adminBob as another admin.
      const addAdminRes = await concept.addAdmin({ caller: adminAlice, user: adminBob });
      assertEquals("error" in addAdminRes, false, "Admin should successfully promote adminBob.");

      // Effects verification: adminBob is now an admin.
      await assertIsAdmin(adminBob, true);
      console.log(`Trace: ${adminAlice} promoted ${adminBob} to admin.`);
    });

    await t.step("4. User 'registers' interest in being a reader (creating unverified membership).", async () => {
      // Note: The EventDirectory concept itself does not define a "user registers" action.
      // This step represents the logical state where a user desires to be a reader,
      // and their unverified membership for the event would be created by another concept
      // (e.g., an "Application" concept) or a direct submission process.
      // For this trace, we directly simulate the creation of an unverified membership to satisfy preconditions.
      await concept.memberships.insertOne({ _id: freshID(), event: principleEventId!, user: userCarol, verified: false });

      // Effects verification: userCarol has an unverified membership.
      await assertReaderStatus(principleEventId!, userCarol, false);
      console.log(`Trace: ${userCarol} conceptually 'registered' for event '${principleEventName}' and is pending approval as a reader.`);
    });

    await t.step("5. Admin (adminBob) approves the user as a verified reader.", async () => {
      // Action: A newly promoted admin (adminBob) approves userCarol.
      const addReaderRes = await concept.addReader({ caller: adminBob, event: principleEventId!, user: userCarol });
      assertEquals("error" in addReaderRes, false, "AdminBob should successfully add userCarol as a reader.");

      // Effects verification: userCarol is now a verified reader.
      await assertReaderStatus(principleEventId!, userCarol, true);
      console.log(`Trace: ${adminBob} approved ${userCarol} as a verified reader for event '${principleEventName}'.`);
    });

    await t.step("6. Admin (adminAlice) temporarily inactivates the event (archives it).", async () => {
      // Action: Admin archives the event.
      const inactivateRes = await concept.inactivateEvent({ caller: adminAlice, name: principleEventName });
      assertEquals("error" in inactivateRes, false, "Admin should successfully inactivate the event.");

      // Effects verification: Event is inactive.
      await assertEventActive(principleEventName, false);
      console.log(`Trace: ${adminAlice} inactivated (archived) event '${principleEventName}'.`);
    });

    await t.step("7. Admin (adminAlice) re-activates the event.", async () => {
      // Action: Admin reactivates the event.
      const activateRes = await concept.activateEvent({ caller: adminAlice, name: principleEventName });
      assertEquals("error" in activateRes, false, "Admin should successfully activate the event.");

      // Effects verification: Event is active again.
      await assertEventActive(principleEventName, true);
      console.log(`Trace: ${adminAlice} re-activated event '${principleEventName}'.`);
    });

    await t.step("8. Admin (adminBob) removes the user as a reader.", async () => {
      // Action: Admin un-approves userCarol as a reader.
      const removeReaderRes = await concept.removeReader({ caller: adminBob, event: principleEventId!, user: userCarol });
      assertEquals("error" in removeReaderRes, false, "AdminBob should successfully remove userCarol as a reader.");

      // Effects verification: userCarol's membership is now unverified.
      await assertReaderStatus(principleEventId!, userCarol, false);
      console.log(`Trace: ${adminBob} removed ${userCarol} as a reader for event '${principleEventName}'.`);
    });

    await t.step("9. Admin (adminAlice) removes adminBob as an admin.", async () => {
      // Action: Admin removes another admin.
      const removeAdminRes = await concept.removeAdmin({ caller: adminAlice, user: adminBob });
      assertEquals("error" in removeAdminRes, false, "AdminAlice should successfully remove adminBob as an admin.");

      // Effects verification: adminBob is no longer an admin.
      await assertIsAdmin(adminBob, false);
      console.log(`Trace: ${adminAlice} removed ${adminBob}'s admin privileges.`);
    });

    await t.step("10. Admin (adminAlice) permanently archives the event.", async () => {
      // Action: Admin inactivates the event again, completing its lifecycle.
      const inactivateRes = await concept.inactivateEvent({ caller: adminAlice, name: principleEventName });
      assertEquals("error" in inactivateRes, false, "Admin should successfully inactivate the event for final archiving.");

      // Effects verification: Event is inactive.
      await assertEventActive(principleEventName, false);
      console.log(`Trace: ${adminAlice} permanently archived event '${principleEventName}'.`);
    });

    console.log("\nPrinciple fulfillment demonstrated.");
  });
});
```
