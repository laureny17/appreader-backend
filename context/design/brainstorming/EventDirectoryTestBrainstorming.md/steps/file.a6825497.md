---
timestamp: 'Wed Oct 15 2025 01:22:38 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_012238.236aaf32.md]]'
content_id: a6825497928eb15e43c5d06bf7bbd0596d5bd2b90826a08ec7768982e6d1c8a9
---

# file: src/eventdirectory/EventDirectoryConcept.test.ts

```typescript
import { assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import EventDirectoryConcept from "@concepts/eventdirectory/EventDirectoryConcept.ts"; // Assuming this path

Deno.test("EventDirectory Concept Trace: Fulfilling the Principle", async (t) => {
  const [db, client] = await testDb();
  const concept = new EventDirectoryConcept(db);

  // Define some IDs for users and events
  const adminAlice = "user:adminAlice" as ID;
  const userBob = "user:userBob" as ID;
  const userCarla = "user:userCarla" as ID; // New admin

  // Define some RubricDimensions
  const rubricDim1 = { name: "Novelty", description: "How unique is the idea?", scaleMin: 1, scaleMax: 5 };
  const rubricDim2 = { name: "Feasibility", description: "Can it be implemented?", scaleMin: 1, scaleMax: 5 };
  const rubricDim3 = { name: "Impact", description: "Potential societal effect.", scaleMin: 1, scaleMax: 10 };
  const hackathonRubricDim = { name: "Completeness", description: "How finished is the project?", scaleMin: 1, scaleMax: 5 };

  let springTechEventId: ID;
  let summerHackathonEventId: ID;

  // Setup: Make adminAlice an admin for initial actions.
  // Note: addAdmin action requires a caller that is already an admin.
  // For the trace's first step, we assume 'adminAlice' is already an admin or manually set it.
  await concept.admins.insertOne({ _id: adminAlice });


  // # trace: Demonstrating the EventDirectory concept's principle through a sequence of actions.

  await t.step("1. Admin Alice creates a new event.", async () => {
    // Principle part: "The admin can create events"
    const createEventResult = await concept.createEvent({
      caller: adminAlice,
      name: "Spring Tech Conference",
      requiredReadsPerApp: 3,
      rubric: [rubricDim1, rubricDim2],
    });
    if ("error" in createEventResult) throw new Error(createEventResult.error);
    springTechEventId = createEventResult.event;

    const event = await concept.events.findOne({ _id: springTechEventId });
    assertEquals(event?.name, "Spring Tech Conference");
    assertEquals(event?.active, true); // Events are active by default upon creation
    assertEquals(event?.requiredReadsPerApp, 3);
    assertEquals(event?.rubric.length, 2);
  });

  await t.step("2. Admin Alice updates the event configuration, adding eligibility criteria and changing reads.", async () => {
    // Principle part: "The admin can ... manage rubric/scoring guidelines, number of required reads per application"
    const updateConfigResult = await concept.updateEventConfig({
      caller: adminAlice,
      event: springTechEventId,
      requiredReadsPerApp: 5,
      rubric: [rubricDim1, rubricDim2, rubricDim3],
      eligibilityCriteria: ["has portfolio", "attended info session"],
    });
    assertEquals(updateConfigResult, {});

    const event = await concept.events.findOne({ _id: springTechEventId });
    assertEquals(event?.requiredReadsPerApp, 5);
    assertEquals(event?.rubric.length, 3);
    assertEquals(event?.eligibilityCriteria, ["has portfolio", "attended info session"]);
  });

  await t.step("3. Admin Alice makes the event inactive, then active again.", async () => {
    // Principle part: "The admin can ... archive events" (inactivate)
    const inactivateResult = await concept.inactivateEvent({ caller: adminAlice, name: "Spring Tech Conference" });
    assertEquals(inactivateResult, {});
    let event = await concept.events.findOne({ _id: springTechEventId });
    assertEquals(event?.active, false);

    // Principle part: "The admin can ... create and archive events" (activate)
    const activateResult = await concept.activateEvent({ caller: adminAlice, name: "Spring Tech Conference" });
    assertEquals(activateResult, {});
    event = await concept.events.findOne({ _id: springTechEventId });
    assertEquals(event?.active, true);
  });

  await t.step("4. User Bob implicitly becomes an 'unverified' member for the event.", async () => {
    // Principle part: "Users can register for a chosen event and can become a reader if approved (automatically 'pending' for approval)"
    // The EventDirectory concept does not include a direct action for a non-admin user to "register" or for an admin
    // to explicitly add an "unverified" user. For the purpose of this trace demonstrating the principle,
    // we assume that a Membership entry for `springTechEvent`, `userBob`, with `verified: false` is
    // established (e.g., through an external "Application" concept syncing with EventDirectory, or an initial data setup).
    // This represents `userBob` being "pending" for approval as a reader.
    await concept.memberships.insertOne({ _id: userBob + ":" + springTechEventId as ID, event: springTechEventId, User: userBob, verified: false });

    const membership = await concept.memberships.findOne({ event: springTechEventId, User: userBob });
    assertEquals(membership?.verified, false);
  });

  await t.step("5. Admin Alice approves User Bob as a reader for the active event.", async () => {
    // Principle part: "can become a reader if approved ... The admin can ... manage approved readers for the active event."
    const addReaderResult = await concept.addReader({ caller: adminAlice, event: springTechEventId, user: userBob });
    assertEquals(addReaderResult, {});

    const membership = await concept.memberships.findOne({ event: springTechEventId, User: userBob });
    assertEquals(membership?.verified, true);
  });

  await t.step("6. Admin Alice updates event configuration again, changing required reads.", async () => {
    // Principle part: Further demonstration of admin managing event config
    const updateConfigResult = await concept.updateEventConfig({
      caller: adminAlice,
      event: springTechEventId,
      requiredReadsPerApp: 7,
      rubric: [rubricDim1, rubricDim2, rubricDim3],
      eligibilityCriteria: ["has portfolio", "attended info session", "submitted abstract"],
    });
    assertEquals(updateConfigResult, {});

    const event = await concept.events.findOne({ _id: springTechEventId });
    assertEquals(event?.requiredReadsPerApp, 7);
    assertEquals(event?.eligibilityCriteria.length, 3);
  });

  await t.step("7. Admin Alice removes User Bob as a reader.", async () => {
    // Principle part: Admin can manage approved readers (removing them).
    const removeReaderResult = await concept.removeReader({ caller: adminAlice, event: springTechEventId, user: userBob });
    assertEquals(removeReaderResult, {});

    const membership = await concept.memberships.findOne({ event: springTechEventId, User: userBob });
    assertEquals(membership?.verified, false); // User Bob is now unverified again
  });

  await t.step("8. Admin Alice adds User Carla as another admin.", async () => {
    // Principle part: "The admin can ... manage admins" (add admin)
    const addAdminResult = await concept.addAdmin({ caller: adminAlice, user: userCarla });
    assertEquals(addAdminResult, {});

    const newAdmin = await concept.admins.findOne({ _id: userCarla });
    assertEquals(newAdmin?._id, userCarla);
  });

  await t.step("9. Admin Alice inactivates the event.", async () => {
    // Principle part: Admin can archive events
    const inactivateResult = await concept.inactivateEvent({ caller: adminAlice, name: "Spring Tech Conference" });
    assertEquals(inactivateResult, {});

    const event = await concept.events.findOne({ _id: springTechEventId });
    assertEquals(event?.active, false);
  });

  await t.step("10. Admin Alice creates a second event.", async () => {
    // Principle part: Demonstrate the capability of managing multiple events.
    const createEventResult = await concept.createEvent({
      caller: adminAlice,
      name: "Summer Hackathon",
      requiredReadsPerApp: 1,
      rubric: [hackathonRubricDim],
    });
    if ("error" in createEventResult) throw new Error(createEventResult.error);
    summerHackathonEventId = createEventResult.event;

    const event = await concept.events.findOne({ _id: summerHackathonEventId });
    assertEquals(event?.name, "Summer Hackathon");
    assertEquals(event?.active, true);
    assertEquals(event?.rubric.length, 1);
  });

  await client.close();
});
```
