---
timestamp: 'Wed Oct 15 2025 01:01:30 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_010130.7dc91799.md]]'
content_id: 947789ed5f994cc40a35429f463006120cf9c33a5d904394a3098149a5df13dc
---

# file: src/eventdirectory/EventDirectoryConcept.test.ts

```typescript
import { assertEquals, assertRejects, assertExists } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

Deno.test("EventDirectory Concept", async (test) => {
  const [db, client] = await testDb();
  const concept = new EventDirectoryConcept(db);

  // Define test IDs
  const adminId = "user:adminAlice" as ID;
  const applicantId = "user:applicantBob" as ID;
  const anotherApplicantId = "user:applicantCharlie" as ID;
  const nonAdminId = "user:nonAdminDavid" as ID;

  // Placeholder for event and question IDs
  let event1Id: ID;
  let event2Id: ID;
  let event1Name = "Annual Tech Conference 2024";
  let event2Name = "AI Ethics Workshop";

  // Sample rubric data
  const rubricData = [
    { name: "Clarity", description: "Is the content clear?", scaleMin: 1, scaleMax: 5 },
    { name: "Originality", description: "Is the idea novel?", scaleMin: 1, scaleMax: 5 },
  ];

  // Helper to ensure an admin exists for the tests
  Deno.test.beforeAll(async () => {
    // Manually add the adminId to the Admins collection for testing purposes
    // In a real system, this might be handled by an Admin concept or initial setup.
    await concept.admins.insertOne({ _id: adminId });
  });

  await test.step("1. Admin creates an active event", async () => {
    // Action: createEvent
    const result = await concept.createEvent({
      caller: adminId,
      name: event1Name,
      requiredReadsPerApp: 3,
      rubric: rubricData,
    });
    assertExists((result as { event: ID }).event);
    event1Id = (result as { event: ID }).event;

    // Verify effects
    const createdEvent = await concept.events.findOne({ _id: event1Id });
    assertExists(createdEvent);
    assertEquals(createdEvent.name, event1Name);
    assertEquals(createdEvent.active, true);
    assertEquals(createdEvent.requiredReadsPerApp, 3);
    assertEquals(createdEvent.rubric.length, rubricData.length);
    // Principle Fulfillment: "The admin can create events."
  });

  await test.step("2. Admin updates the event's configuration", async () => {
    // Action: updateEventConfig
    await concept.updateEventConfig({
      caller: adminId,
      event: event1Id,
      requiredReadsPerApp: 5,
      rubric: [...rubricData, { name: "Impact", description: "Potential impact", scaleMin: 1, scaleMax: 10 }],
      eligibilityCriteria: ["has a valid academic email"],
    });

    // Verify effects
    const updatedEvent = await concept.events.findOne({ _id: event1Id });
    assertExists(updatedEvent);
    assertEquals(updatedEvent.requiredReadsPerApp, 5);
    assertEquals(updatedEvent.rubric.length, 3);
    assertEquals(updatedEvent.eligibilityCriteria, ["has a valid academic email"]);
    // Principle Fulfillment: "manage rubric/scoring guidelines, number of required reads per application."
  });

  await test.step("3. Applicant expresses interest in EventE1 (Hypothetical Action)", async () => {
    // NOTE ON MISSING ACTION:
    // The `EventDirectory` concept specification currently lacks a direct action
    // for a non-admin user to "register" or "express interest" in an event,
    // which would create an initial `Membership` entry with `verified: false`.
    // The `addReader` action specifically requires the user to *already be an unverified user*.
    // For this trace to fully demonstrate the principle "Users can register for a chosen event
    // (automatically 'pending' for approval)", we *manually create* this initial state.
    // In a complete implementation, a user-facing action like
    // `concept.expressReaderInterest({ user: applicantId, event: event1Id })`
    // would be needed, and its effects would be:
    await concept.memberships.insertOne({
      _id: "membership:" + applicantId + ":" + event1Id as ID, // Unique ID for membership
      user: applicantId,
      event: event1Id,
      verified: false,
    });

    // Verify effects
    const pendingMembership = await concept.memberships.findOne({ user: applicantId, event: event1Id });
    assertExists(pendingMembership);
    assertEquals(pendingMembership.verified, false);
    // Principle Fulfillment: Models the initial 'pending' state.
  });

  await test.step("4. Admin approves the applicant to become a reader for EventE1", async () => {
    // Action: addReader
    await concept.addReader({ caller: adminId, event: event1Id, user: applicantId });

    // Verify effects
    const verifiedMembership = await concept.memberships.findOne({ user: applicantId, event: event1Id });
    assertExists(verifiedMembership);
    assertEquals(verifiedMembership.verified, true);
    // Principle Fulfillment: Models "can become a reader if approved" and contributes to "approved readers for the active event."
  });

  await test.step("5. Admin attempts to add anotherApplicantId as a reader without prior interest (should fail)", async () => {
    // Action: addReader
    const result = await concept.addReader({ caller: adminId, event: event1Id, user: anotherApplicantId });
    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `User ${anotherApplicantId} is not an unverified user for event ${event1Id}.`);

    // Verify no new membership was created or changed
    const noMembership = await concept.memberships.findOne({ user: anotherApplicantId, event: event1Id });
    assertEquals(noMembership, null);
    // Principle Test: Confirms `addReader`'s `requires` clause and the expected flow of user registration.
  });

  await test.step("6. Non-admin attempts to add an admin (should fail)", async () => {
    // Action: addAdmin
    const result = await concept.addAdmin({ caller: nonAdminId, user: anotherApplicantId });
    assertExists((result as { error: string }).error);
    assertEquals((result as { error: string }).error, `Caller ${nonAdminId} is not an admin.`);

    // Verify no new admin was added
    const noNewAdmin = await concept.admins.findOne({ _id: anotherApplicantId });
    assertEquals(noNewAdmin, null);
    // Principle Test: Confirms access control for admin-only actions.
  });

  await test.step("7. Admin inactivates EventE1 (archiving)", async () => {
    // Action: inactivateEvent
    await concept.inactivateEvent({ caller: adminId, name: event1Name });

    // Verify effects
    const inactiveEvent = await concept.events.findOne({ _id: event1Id });
    assertExists(inactiveEvent);
    assertEquals(inactiveEvent.active, false);
    // Principle Fulfillment: "The admin can ... archive events."
  });

  await test.step("8. Admin creates another event, EventE2", async () => {
    // Action: createEvent
    const result = await concept.createEvent({
      caller: adminId,
      name: event2Name,
      requiredReadsPerApp: 2,
      rubric: [],
    });
    assertExists((result as { event: ID }).event);
    event2Id = (result as { event: ID }).event;

    // Verify effects
    const createdEvent = await concept.events.findOne({ _id: event2Id });
    assertExists(createdEvent);
    assertEquals(createdEvent.name, event2Name);
    assertEquals(createdEvent.active, true);
    // Principle Fulfillment: Further demonstrates "The admin can create events."
  });

  await test.step("9. Admin removes applicantId as a reader from EventE1", async () => {
    // Action: removeReader
    await concept.removeReader({ caller: adminId, event: event1Id, user: applicantId });

    // Verify effects
    const unverifiedMembership = await concept.memberships.findOne({ user: applicantId, event: event1Id });
    assertExists(unverifiedMembership);
    assertEquals(unverifiedMembership.verified, false);
    // Principle Fulfillment: Demonstrates the admin's ability to manage "approved readers for the active event" (by changing their status).
  });

  await test.step("10. Admin removes adminId as an admin (self-removal)", async () => {
    // Action: removeAdmin
    await concept.removeAdmin({ caller: adminId, user: adminId });

    // Verify effects
    const removedAdmin = await concept.admins.findOne({ _id: adminId });
    assertEquals(removedAdmin, null);
    // Principle Test: Demonstrates self-removal from admin role, testing the `requires` conditions.
  });

  await client.close();
});
```
