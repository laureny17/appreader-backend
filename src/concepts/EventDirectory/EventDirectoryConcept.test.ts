// This test suite demonstrates that:
//    An admin can create a new event with an initial rubric and configuration
//    A user appears as an unverified member until an admin approves them
//    Admins can toggle an event’s active status
//    Admins can update the rubric, eligibility, and required reads
//    Reader verification status can be toggled
//    Admin roles can be toggled by admins

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
  questions: string[];
  endDate: Date;
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

  const sampleQuestions = [
    "What is your project idea?",
    "What technologies will you use?",
    "What problem does your project solve?",
  ];

  await db.collection("EventDirectory.events").deleteMany({});
  await db.collection("EventDirectory.memberships").deleteMany({});
  await db.collection("EventDirectory.admins").deleteMany({});
  await db.collection("AuthAccounts.accounts").deleteMany({});

  // Create mock AuthAccounts entries for names
  await db.collection("AuthAccounts.accounts").insertMany([
    { _id: adminUser as any, email: "admin@example.com", name: "Admin User", passwordHash: "hash" },
    { _id: readerUser as any, email: "reader@example.com", name: "Reader User", passwordHash: "hash" },
  ]);

  await db.collection("EventDirectory.admins").insertOne({
    _id: adminUser as any,
  });
  const adminCheck = await concept["_isAdmin"]({ user: adminUser });
  assert(
    adminCheck.isAdmin,
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
    questions: sampleQuestions,
    endDate: new Date("2024-12-31"),
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

  // Test _getVerifiedReadersForEvent (before removing reader)
  const verifiedReadersResult = await concept._getVerifiedReadersForEvent({ event: eventId });
  assert(Array.isArray(verifiedReadersResult), "Should return array");
  assertEquals(verifiedReadersResult.length, 1, "Should have 1 verified reader");
  assertEquals(verifiedReadersResult[0].user, readerUser);
  assertEquals(verifiedReadersResult[0].name, "Reader User");

  // Test _getAllMembersForEvent (before removing reader)
  const allMembersResult = await concept._getAllMembersForEvent({ event: eventId });
  assert(Array.isArray(allMembersResult), "Should return array");
  assertEquals(allMembersResult.length, 1, "Should have 1 member");
  assertEquals(allMembersResult[0].user, readerUser);
  assertEquals(allMembersResult[0].verified, true);
  assertEquals(allMembersResult[0].name, "Reader User");

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
  const adminCheck2 = await concept["_isAdmin"]({ user: anotherAdminUser });
  assert(adminCheck2.isAdmin);

  await concept.removeAdmin({ caller: adminUser, user: anotherAdminUser });
  const adminCheck3 = await concept["_isAdmin"]({ user: anotherAdminUser });
  assert(!adminCheck3.isAdmin);

  // Test questions functionality
  // Test _getQuestionsForEvent
  const questionsResult = await concept._getQuestionsForEvent({ event: eventId });
  assert("questions" in questionsResult, "Should return questions");
  assertEquals(questionsResult.questions, sampleQuestions);

  // Test updating questions
  const updatedQuestions = [
    "What is your project idea?",
    "What technologies will you use?",
    "What problem does your project solve?",
    "What is your team's experience?",
  ];
  await concept.updateEventConfig({
    caller: adminUser,
    event: eventId,
    questions: updatedQuestions,
  });

  const updatedQuestionsResult = await concept._getQuestionsForEvent({ event: eventId });
  assert("questions" in updatedQuestionsResult, "Should return questions");
  assertEquals(updatedQuestionsResult.questions, updatedQuestions);

  // Test questions in event document
  fetchedEvent = await db.collection<EventDocument>("EventDirectory.events")
    .findOne({ _id: eventId });
  assertEquals(fetchedEvent?.questions, updatedQuestions);

  // Test getAllEvents
  const allEventsResult = await concept.getAllEvents({ caller: adminUser });
  assert(Array.isArray(allEventsResult), "Should return array of events");
  assertEquals(allEventsResult.length, 1, "Should have 1 event");
  assertEquals(allEventsResult[0]._id, eventId);

  // Test getAllEvents requires admin
  const nonAdminResult = await concept.getAllEvents({ caller: normalUser });
  assert("error" in nonAdminResult, "Non-admin should get error");
  assertEquals(nonAdminResult.error, "Only admins can retrieve all events.");

  // Test error case for non-existent event
  const badEventId = createId("event:fake");
  const errorResult = await concept._getVerifiedReadersForEvent({ event: badEventId });
  assert("error" in errorResult, "Should return error for non-existent event");

  // ----- teardown -----
  await client.close();
});
