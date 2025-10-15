import { assert, assertEquals } from "jsr:@std/assert";
import { freshID, testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import EventDirectoryConcept from "./EventDirectoryConcept.ts";

// Helper function to create test IDs
const createId = (prefix: string) =>
  `${prefix}:${Math.random().toString(36).substring(7)}` as ID;

interface EventDocument {
  _id: ID;
  name: string;
  active: boolean;
  requiredReadsPerApp: number;
  rubric: {
    name: string;
    description: string;
    scaleMin: number;
    scaleMax: number;
  }[];
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

// 👇 replace describe/it with plain Deno.test
Deno.test("EventDirectoryConcept: principle fulfilment and edge cases", async () => {
  // ----- setup -----
  const [db, client] = await testDb();
  const concept = new EventDirectoryConcept(db);

  // Test user IDs
  const adminUser = createId("user:admin");
  const normalUser = createId("user:normal");
  const readerUser = createId("user:reader");
  const anotherAdminUser = createId("user:secondAdmin");

  const sampleRubric = [
    {
      name: "Impact",
      description: "Overall impact of the application",
      scaleMin: 1,
      scaleMax: 5,
    },
    {
      name: "Innovation",
      description: "Novelty of the solution",
      scaleMin: 1,
      scaleMax: 5,
    },
  ];

  await db.collection("EventDirectory.events").deleteMany({});
  await db.collection("EventDirectory.memberships").deleteMany({});
  await db.collection("EventDirectory.admins").deleteMany({});

  await db.collection("EventDirectory.admins").insertOne({
    _id: adminUser as any,
  });
  assert(
    await concept["_isAdmin"](adminUser),
    "admin should exist after setup",
  );

  // ----- principle trace -----
  const eventName = "Hackathon 2024";
  const requiredReads = 3;

  const createResult = await concept.createEvent({
    caller: adminUser,
    name: eventName,
    requiredReadsPerApp: requiredReads,
    rubric: sampleRubric,
  });
  assert(
    "event" in createResult,
    `Failed to create event: ${
      ("error" in createResult && createResult.error) ?? ""
    }`,
  );
  const eventId = createResult.event;
  let fetchedEvent = await db.collection<EventDocument>("EventDirectory.events")
    .findOne({ _id: eventId });
  assertEquals(fetchedEvent?.name, eventName);

  // user registers (unverified)
  const unverifiedMembershipId = freshID();
  await db.collection<MembershipDocument>("EventDirectory.memberships")
    .insertOne({
      _id: unverifiedMembershipId,
      event: eventId,
      user: readerUser,
      verified: false,
    });

  // approve reader
  const addReaderResult = await concept.addReader({
    caller: adminUser,
    event: eventId,
    user: readerUser,
  });
  assertEquals(Object.keys(addReaderResult).length, 0);
  let membership = await db.collection<MembershipDocument>(
    "EventDirectory.memberships",
  ).findOne({ event: eventId, user: readerUser });
  assertEquals(membership?.verified, true);

  // inactivate / reactivate
  await concept.inactivateEvent({ caller: adminUser, name: eventName });
  fetchedEvent = await db.collection<EventDocument>("EventDirectory.events")
    .findOne({ _id: eventId });
  assertEquals(fetchedEvent?.active, false);

  await concept.activateEvent({ caller: adminUser, name: eventName });
  fetchedEvent = await db.collection<EventDocument>("EventDirectory.events")
    .findOne({ _id: eventId });
  assertEquals(fetchedEvent?.active, true);

  // update event config
  const updatedRequiredReads = 5;
  const updatedRubric = [...sampleRubric, {
    name: "Originality",
    description: "Uniqueness",
    scaleMin: 0,
    scaleMax: 10,
  }];
  const updatedEligibility = [
    "Must be university student",
    "Must submit by deadline",
  ];
  await concept.updateEventConfig({
    caller: adminUser,
    event: eventId,
    requiredReadsPerApp: updatedRequiredReads,
    rubric: updatedRubric,
    eligibilityCriteria: updatedEligibility,
  });

  fetchedEvent = await db.collection<EventDocument>("EventDirectory.events")
    .findOne({ _id: eventId });
  assertEquals(fetchedEvent?.requiredReadsPerApp, updatedRequiredReads);

  // remove reader
  await concept.removeReader({
    caller: adminUser,
    event: eventId,
    user: readerUser,
  });
  membership = await db.collection<MembershipDocument>(
    "EventDirectory.memberships",
  ).findOne({ event: eventId, user: readerUser });
  assertEquals(membership?.verified, false);

  // add + remove another admin
  await concept.addAdmin({ caller: adminUser, user: anotherAdminUser });
  assert(await concept["_isAdmin"](anotherAdminUser));

  await concept.removeAdmin({ caller: adminUser, user: anotherAdminUser });
  assert(!(await concept["_isAdmin"](anotherAdminUser)));

  // ----- teardown -----
  await client.close();
});
