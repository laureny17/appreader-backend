---
timestamp: 'Wed Oct 15 2025 01:46:12 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_014612.7b543164.md]]'
content_id: 03bc985f99f16b175e408ff7b13ba87a704e0d80ba57d3629926f0f09200db3d
---

# response:

```typescript
import {
  assert,
  assertEquals,
  assertFalse,
  assertNotEquals,
  assertObjectMatch,
  assertRejects,
  assertStrictEquals,
  assertThrows,
  fail,
} from "https://deno.land/std@0.214.0/assert/mod.ts";
import { MongoClient } from "npm:mongodb";
import { getDb, freshID } from "@utils/database.ts"; // Assuming @utils/database.ts exists
import { ID, Empty } from "@utils/types.ts"; // Assuming @utils/types.ts exists
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// --- Test Setup ---
let db: Db;
let client: MongoClient;
let eventDirectory: EventDirectoryConcept;

// Test data
const adminId = "user:adminAlice" as ID;
const nonAdminId = "user:bob" as ID;
const applicantId = "user:charlie" as ID;
const anotherApplicantId = "user:david" as ID;
const event1Name = "Annual Tech Conference 2024";
const event2Name = "AI Ethics Workshop";
const event3Name = "Web Development Summit";

const sampleRubric: EventDirectoryConcept['IRubricDimension'][] = [
  { name: "Clarity", description: "Is the content clear?", scaleMin: 1, scaleMax: 5 },
  { name: "Originality", description: "Is the idea novel?", scaleMin: 1, scaleMax: 5 },
];

const sampleEligibility = ["has a valid academic email", "has submitted prior work"];

Deno.test({
  name: "EventDirectoryConcept Tests",
  sanitizeResources: false,
  sanitizeOps: false,
  async fn(t) {
    // Setup for all tests
    [db, client] = await getDb();
    eventDirectory = new EventDirectoryConcept(db);

    // Ensure collections are empty and an initial admin exists before each test block
    t.beforeEach(async () => {
      await db.collection("EventDirectory.events").deleteMany({});
      await db.collection("EventDirectory.memberships").deleteMany({});
      await db.collection("EventDirectory.admins").deleteMany({});
      // Add the initial admin for testing purposes
      await eventDirectory["admins"].insertOne({ _id: adminId });
    });

    t.afterAll(async () => {
      // Cleanup after all tests are done
      await db.dropDatabase();
      await client.close();
    });

    await t.step("Admin Management", async (st) => {
      st.beforeEach(async () => {
        // Ensure only adminId is admin for admin management tests
        await eventDirectory["admins"].deleteMany({});
        await eventDirectory["admins"].insertOne({ _id: adminId });
      });

      await st.step("addAdmin: should allow an admin to add a new admin", async () => {
        const result = await eventDirectory.addAdmin({ caller: adminId, user: nonAdminId });
        assertObjectMatch(result, {});
        const newAdmin = await eventDirectory["_isAdmin"](nonAdminId);
        assert(newAdmin);
      });

      await st.step("addAdmin: should prevent non-admins from adding new admins", async () => {
        const result = await eventDirectory.addAdmin({ caller: nonAdminId, user: anotherApplicantId });
        assertObjectMatch(result, { error: "Only existing admins can add new admins." });
        const newAdmin = await eventDirectory["_isAdmin"](anotherApplicantId);
        assertFalse(newAdmin);
      });

      await st.step("addAdmin: should prevent adding an already existing admin", async () => {
        const result = await eventDirectory.addAdmin({ caller: adminId, user: adminId });
        assertObjectMatch(result, { error: `User '${adminId}' is already an admin.` });
      });

      await st.step("removeAdmin: should allow an admin to remove another admin", async () => {
        await eventDirectory.addAdmin({ caller: adminId, user: anotherApplicantId }); // Add a second admin
        const result = await eventDirectory.removeAdmin({ caller: adminId, user: anotherApplicantId });
        assertObjectMatch(result, {});
        const removedAdmin = await eventDirectory["_isAdmin"](anotherApplicantId);
        assertFalse(removedAdmin);
      });

      await st.step("removeAdmin: should prevent non-admins from removing admins", async () => {
        await eventDirectory.addAdmin({ caller: adminId, user: anotherApplicantId });
        const result = await eventDirectory.removeAdmin({ caller: nonAdminId, user: anotherApplicantId });
        assertObjectMatch(result, { error: "Only admins can remove other admins." });
        const stillAdmin = await eventDirectory["_isAdmin"](anotherApplicantId);
        assert(stillAdmin); // Should still be an admin
      });

      await st.step("removeAdmin: should prevent removing a user who is not an admin", async () => {
        const result = await eventDirectory.removeAdmin({ caller: adminId, user: nonAdminId });
        assertObjectMatch(result, { error: `User '${nonAdminId}' is not an admin.` });
      });

      await st.step("removeAdmin: should prevent removing the last remaining admin (self-removal)", async () => {
        // At this point, only adminId is an admin (due to beforeEach)
        const result = await eventDirectory.removeAdmin({ caller: adminId, user: adminId });
        assertObjectMatch(result, { error: "Cannot remove the last remaining admin, especially yourself." });
        const stillAdmin = await eventDirectory["_isAdmin"](adminId);
        assert(stillAdmin); // Should still be an admin
      });

      await st.step("removeAdmin: should allow the last admin to remove themselves if another admin exists", async () => {
        await eventDirectory.addAdmin({ caller: adminId, user: anotherApplicantId }); // Add a second admin
        const result = await eventDirectory.removeAdmin({ caller: adminId, user: adminId });
        assertObjectMatch(result, {});
        const selfRemoved = await eventDirectory["_isAdmin"](adminId);
        assertFalse(selfRemoved);
        const otherAdmin = await eventDirectory["_isAdmin"](anotherApplicantId);
        assert(otherAdmin); // The other admin should still exist
      });
    });

    await t.step("Event Creation and Management", async (st) => {
      let event1Id: ID;

      await st.step("createEvent: should allow an admin to create an event", async () => {
        const result = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in result, "Expected event ID in result");
        event1Id = result.event;
        assert(event1Id);

        const createdEvent = await eventDirectory["events"].findOne({ _id: event1Id });
        assert(createdEvent);
        assertEquals(createdEvent.name, event1Name);
        assert(createdEvent.active);
        assertEquals(createdEvent.requiredReadsPerApp, 3);
        assertObjectMatch(createdEvent.rubric[0], sampleRubric[0]);
        assertEquals(createdEvent.eligibilityCriteria.length, 0); // Default empty
      });

      await st.step("createEvent: should handle eligibilityCriteria correctly", async () => {
        const result = await eventDirectory.createEvent({
          caller: adminId,
          name: event3Name,
          requiredReadsPerApp: 1,
          rubric: [],
          eligibilityCriteria: ["only phd students"],
        });
        assert("event" in result);
        const createdEvent = await eventDirectory["events"].findOne({ _id: result.event });
        assert(createdEvent);
        assertEquals(createdEvent.eligibilityCriteria, ["only phd students"]);
      });

      await st.step("createEvent: should prevent non-admins from creating events", async () => {
        const result = await eventDirectory.createEvent({
          caller: nonAdminId,
          name: event2Name,
          requiredReadsPerApp: 2,
          rubric: [],
        });
        assertObjectMatch(result, { error: "Only admins can create events." });
        const createdEvent = await eventDirectory["events"].findOne({ name: event2Name });
        assertFalse(!!createdEvent);
      });

      await st.step("createEvent: should prevent creating events with duplicate names", async () => {
        // First create the event
        const res = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in res);

        // Attempt to create with the same name again
        const result = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 5,
          rubric: [],
        });
        assertObjectMatch(result, { error: `An event with the name '${event1Name}' already exists.` });
      });

      await st.step("activateEvent: should allow an admin to activate an inactive event", async () => {
        // First create an event and inactivate it
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event2Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);
        await eventDirectory.inactivateEvent({ caller: adminId, name: event2Name });

        const result = await eventDirectory.activateEvent({ caller: adminId, name: event2Name });
        assertObjectMatch(result, {});
        const activatedEvent = await eventDirectory["events"].findOne({ name: event2Name });
        assert(activatedEvent?.active);
      });

      await st.step("activateEvent: should prevent activating an already active event", async () => {
        // Create an event (it's active by default)
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event2Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);

        const result = await eventDirectory.activateEvent({ caller: adminId, name: event2Name });
        assertObjectMatch(result, { error: `Event '${event2Name}' is already active.` });
      });

      await st.step("inactivateEvent: should allow an admin to inactivate an active event", async () => {
        // Create an event (it's active by default)
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);
        event1Id = createRes.event; // Capture ID for later use in updateEventConfig

        const result = await eventDirectory.inactivateEvent({ caller: adminId, name: event1Name });
        assertObjectMatch(result, {});
        const inactivatedEvent = await eventDirectory["events"].findOne({ name: event1Name });
        assertFalse(inactivatedEvent?.active);
      });

      await st.step("inactivateEvent: should prevent inactivating an already inactive event", async () => {
        // Create an event, then inactivate it once
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);
        await eventDirectory.inactivateEvent({ caller: adminId, name: event1Name });

        // Attempt to inactivate again
        const result = await eventDirectory.inactivateEvent({ caller: adminId, name: event1Name });
        assertObjectMatch(result, { error: `Event '${event1Name}' is already inactive.` });
      });

      await st.step("updateEventConfig: should allow an admin to update event configuration", async () => {
        // Create an event first
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);
        event1Id = createRes.event;

        const updatedRubric = [...sampleRubric, { name: "Impact", description: "Potential impact", scaleMin: 1, scaleMax: 10 }];
        const updatedEligibility = ["only active students"];

        const result = await eventDirectory.updateEventConfig({
          caller: adminId,
          event: event1Id,
          requiredReadsPerApp: 5,
          rubric: updatedRubric,
          eligibilityCriteria: updatedEligibility,
        });
        assertObjectMatch(result, {});

        const updatedEvent = await eventDirectory["events"].findOne({ _id: event1Id });
        assert(updatedEvent);
        assertEquals(updatedEvent.requiredReadsPerApp, 5);
        assertEquals(updatedEvent.rubric.length, 3);
        assertObjectMatch(updatedEvent.rubric[2], updatedRubric[2]);
        assertEquals(updatedEvent.eligibilityCriteria, updatedEligibility);
      });

      await st.step("updateEventConfig: should prevent non-admins from updating event configuration", async () => {
        // Create an event first
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);
        event1Id = createRes.event;

        const result = await eventDirectory.updateEventConfig({
          caller: nonAdminId,
          event: event1Id,
          requiredReadsPerApp: 99,
          rubric: [],
          eligibilityCriteria: [],
        });
        assertObjectMatch(result, { error: "Only admins can update event configuration." });

        const originalEvent = await eventDirectory["events"].findOne({ _id: event1Id });
        assertEquals(originalEvent?.requiredReadsPerApp, 3); // Should remain unchanged
      });

      await st.step("updateEventConfig: should prevent updating a non-existent event", async () => {
        const nonExistentEventId = freshID() as ID;
        const result = await eventDirectory.updateEventConfig({
          caller: adminId,
          event: nonExistentEventId,
          requiredReadsPerApp: 10,
          rubric: [],
          eligibilityCriteria: [],
        });
        assertObjectMatch(result, { error: `Event with ID '${nonExistentEventId}' not found.` });
      });
    });

    await t.step("Reader Membership Management", async (st) => {
      let eventId: ID;
      let unverifiedMembershipId: ID;

      st.beforeEach(async () => {
        // Ensure a fresh event is created for membership tests
        await eventDirectory["events"].deleteMany({});
        const createRes = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createRes);
        eventId = createRes.event;

        // Simulate a user registering for an event, creating an unverified membership
        unverifiedMembershipId = freshID();
        await eventDirectory["memberships"].insertOne({
          _id: unverifiedMembershipId,
          event: eventId,
          user: applicantId,
          verified: false,
        });
      });

      await st.step("addReader: should allow admin to promote an unverified user to verified reader", async () => {
        const result = await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });
        assertObjectMatch(result, {});

        const updatedMembership = await eventDirectory["memberships"].findOne({ _id: unverifiedMembershipId });
        assert(updatedMembership?.verified);
      });

      await st.step("addReader: should prevent non-admins from adding readers", async () => {
        const result = await eventDirectory.addReader({ caller: nonAdminId, event: eventId, user: applicantId });
        assertObjectMatch(result, { error: "Only admins can add readers." });

        const membership = await eventDirectory["memberships"].findOne({ _id: unverifiedMembershipId });
        assertFalse(membership?.verified); // Should still be unverified
      });

      await st.step("addReader: should prevent promoting an already verified reader", async () => {
        // First promote to verified
        await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });
        const membership = await eventDirectory["memberships"].findOne({ _id: unverifiedMembershipId });
        assert(membership?.verified);

        // Then try to promote again
        const result = await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });
        assertObjectMatch(result, { error: `User '${applicantId}' is already a verified reader for event '${eventId}'.` });
      });

      await st.step("addReader: should prevent promoting a user who is not an unverified member", async () => {
        // No membership for anotherApplicantId
        const result = await eventDirectory.addReader({ caller: adminId, event: eventId, user: anotherApplicantId });
        assertObjectMatch(result, { error: `User '${anotherApplicantId}' is not an unverified member for event '${eventId}'. They must first be in a 'pending' state to be promoted.` });
      });

      await st.step("removeReader: should allow admin to demote a verified reader to unverified", async () => {
        // First promote to verified
        await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });
        const verifiedMembership = await eventDirectory["memberships"].findOne({ _id: unverifiedMembershipId });
        assert(verifiedMembership?.verified);

        const result = await eventDirectory.removeReader({ caller: adminId, event: eventId, user: applicantId });
        assertObjectMatch(result, {});

        const demotedMembership = await eventDirectory["memberships"].findOne({ _id: unverifiedMembershipId });
        assertFalse(demotedMembership?.verified);
      });

      await st.step("removeReader: should prevent non-admins from removing readers", async () => {
        // First promote to verified
        await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });

        const result = await eventDirectory.removeReader({ caller: nonAdminId, event: eventId, user: applicantId });
        assertObjectMatch(result, { error: "Only admins can remove readers." });

        const membership = await eventDirectory["memberships"].findOne({ _id: unverifiedMembershipId });
        assert(membership?.verified); // Should still be verified
      });

      await st.step("removeReader: should prevent removing a user who is not a verified reader", async () => {
        // applicantId is currently unverified (from beforeEach)
        const result = await eventDirectory.removeReader({ caller: adminId, event: eventId, user: applicantId });
        assertObjectMatch(result, { error: `User '${applicantId}' is not a verified reader for event '${eventId}'.` });
      });

      await st.step("removeReader: should prevent removing a user who has no membership", async () => {
        const result = await eventDirectory.removeReader({ caller: adminId, event: eventId, user: anotherApplicantId });
        assertObjectMatch(result, { error: `User '${anotherApplicantId}' is not a verified reader for event '${eventId}'.` });
      });
    });

    await t.step("Principle Fulfillment Checks", async (st) => {
      let eventId: ID;

      st.beforeEach(async () => {
        // Reset for principle checks
        await eventDirectory["events"].deleteMany({});
        await eventDirectory["memberships"].deleteMany({});
      });

      await st.step("Principle: Admin creates event and manages config", async () => {
        // Admin creates an active event
        const createResult = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createResult);
        eventId = createResult.event;
        let event = await eventDirectory["events"].findOne({ _id: eventId });
        assertEquals(event?.name, event1Name);
        assert(event?.active);
        assertEquals(event?.requiredReadsPerApp, 3);

        // Admin updates the event's configuration
        const updatedRubric = [...sampleRubric, { name: "Flexibility", description: "How adaptable is the idea?", scaleMin: 0, scaleMax: 10 }];
        const updatedEligibility = ["requires graduate degree"];
        const updateResult = await eventDirectory.updateEventConfig({
          caller: adminId,
          event: eventId,
          requiredReadsPerApp: 5,
          rubric: updatedRubric,
          eligibilityCriteria: updatedEligibility,
        });
        assertObjectMatch(updateResult, {});
        event = await eventDirectory["events"].findOne({ _id: eventId });
        assertEquals(event?.requiredReadsPerApp, 5);
        assertEquals(event?.rubric.length, 3);
        assertEquals(event?.eligibilityCriteria, updatedEligibility);
      });

      await st.step("Principle: Admin archives event", async () => {
        // Admin creates event
        const createResult = await eventDirectory.createEvent({
          caller: adminId,
          name: event2Name,
          requiredReadsPerApp: 2,
          rubric: [],
        });
        assert("event" in createResult);
        let event = await eventDirectory["events"].findOne({ _id: createResult.event });
        assert(event?.active);

        // Admin inactivates event
        const inactivateResult = await eventDirectory.inactivateEvent({ caller: adminId, name: event2Name });
        assertObjectMatch(inactivateResult, {});
        event = await eventDirectory["events"].findOne({ _id: createResult.event });
        assertFalse(event?.active);
      });

      await st.step("Principle: User becomes a reader if approved (pending -> verified)", async () => {
        // Admin creates event
        const createResult = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createResult);
        eventId = createResult.event;

        // Simulate user registering for event (creating pending/unverified membership)
        const pendingMembershipId = freshID();
        await eventDirectory["memberships"].insertOne({
          _id: pendingMembershipId,
          event: eventId,
          user: applicantId,
          verified: false,
        });
        let membership = await eventDirectory["memberships"].findOne({ _id: pendingMembershipId });
        assertFalse(membership?.verified); // Initially unverified (pending)

        // Admin approves the applicant
        const addReaderResult = await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });
        assertObjectMatch(addReaderResult, {});
        membership = await eventDirectory["memberships"].findOne({ _id: pendingMembershipId });
        assert(membership?.verified); // Now verified
      });

      await st.step("Principle: Admin manages approved readers (remove)", async () => {
        // Admin creates event
        const createResult = await eventDirectory.createEvent({
          caller: adminId,
          name: event1Name,
          requiredReadsPerApp: 3,
          rubric: sampleRubric,
        });
        assert("event" in createResult);
        eventId = createResult.event;

        // Simulate user registering and being approved
        const membershipId = freshID();
        await eventDirectory["memberships"].insertOne({
          _id: membershipId,
          event: eventId,
          user: applicantId,
          verified: false,
        });
        await eventDirectory.addReader({ caller: adminId, event: eventId, user: applicantId });
        let membership = await eventDirectory["memberships"].findOne({ _id: membershipId });
        assert(membership?.verified); // Verified

        // Admin removes the reader (demotes to unverified)
        const removeReaderResult = await eventDirectory.removeReader({ caller: adminId, event: eventId, user: applicantId });
        assertObjectMatch(removeReaderResult, {});
        membership = await eventDirectory["memberships"].findOne({ _id: membershipId });
        assertFalse(membership?.verified); // Now unverified again
      });
    });
  },
});
```
