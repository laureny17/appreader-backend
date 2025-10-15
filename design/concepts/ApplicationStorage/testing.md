[@implementation](implementation.md)
[@testing-concepts](../../background/testing-concepts.md)
[@LikertSurvey-concept-tests](/src/concepts/LikertSurvey/LikertSurveyConcept.test.ts)
# prompt: Observe how tests were structured for one of our concepts AuthAccounts concept here ([@AuthAccounts-concept-tests](/src/concepts/AuthAccounts/AuthAccountsConcept.test.ts)) and for the sample LikertSurvey concept here ([@testing](../LikertSurvey/testing.md) and [@LikertSurvey-concept-tests](/src/concepts/LikertSurvey/LikertSurveyConcept.test.ts)) and create a test suite that works with the Deno testing framework and covers a full trace that  demonstrates how the principle of the concept is fulfilled by a sequence of actions. Ensure that no tests use or depend on ANY other concepts besides ApplicationStorage itself. Do not test any behavior that requires cross-concept interaction. Minimize imports to what is needed. When performing await testDb() (do NOT use getDb()), declare the results as const variables db and client on the first line of the test case, and set const ApplicationStorage = new ApplicationStorageConcept(db);. Refer to previously written test cases for a similar concept as a very rough guideline. 
# Previous version of a test for a similar concept:
```
import * as assert from "assert";

import { ApplicationAssignments } from "../src/application-assignments";

import { GeminiLLM, Config } from "../src/gemini-llm";

import { Event, admin, User, RubricDimensions } from "../src/event-directory";

  

function loadConfig(): Config {

try {

const config = require("../config.json");

return config;

} catch (error) {

throw new Error(

"Error loading config.json. Please ensure it exists with your API key."

);

}

}

  

describe("Eligibility Requirements Tests", function () {

this.timeout(20000);

  

it("should correctly enforce eligibility criteria and flag in AI comments", async function () {

console.log("Starting Eligibility Requirements Test");

const config = loadConfig();

const llm = new GeminiLLM(config);

const assignments = new ApplicationAssignments();

  

const event: Event = {

name: "Eligibility Enforcement Event",

active: true,

requiredReadsPerApp: 1,

readers: new Set<User>(),

unverifiedUsers: new Set<User>(),

rubric: [

{

name: "Motivation",

description: "Applicant's motivation level",

scaleMin: 1,

scaleMax: 5,

},

],

questions: ["Are you currently enrolled in a college or university?"],

eligibilityCriteria: ["Must be a college student or higher"],

};

  

const questions = [

"Are you currently enrolled in a college or university?",

];

const rubric = ["Motivation"];

  

const answersIneligible = ["No, I am a high school student."];

  

await assignments.addApplication(

admin,

event,

"ELG001",

"Applicant",

questions,

answersIneligible,

rubric,

event.eligibilityCriteria,

llm

);

  

const dummyUser: User = {

email: "eligibilitytester@example.com",

name: "Eligibility Tester",

password: "testpass",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

  

const assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(assignment, "Assignment should be returned for eligibility test");

console.log(

"Assignment retrieved for eligibility test:",

assignment!.application.applicantID

);

  

if (assignment && assignment.application.aiComments) {

const categories = assignment.application.aiComments.map(

(c) => c.category

);

console.log("AI Comment Categories:", categories);

assert.ok(

categories.includes("Attention"),

"Eligibility violation should produce 'Attention' category in AI comments"

);

} else {

assert.fail("AI comments missing in eligibility assignment");

}

  

// Check readsCompleted increment after marking submission

const initialReads = assignment.application.readsCompleted;

console.log(`Initial readsCompleted: ${initialReads}`);

  

assignments.incrementOnSubmit(dummyUser, event, assignment.application);

const updatedReads = assignment.application.readsCompleted;

console.log(

`Updated readsCompleted after incrementOnSubmit: ${updatedReads}`

);

assert.strictEqual(

updatedReads,

initialReads + 1,

"readsCompleted should increment by 1 after incrementOnSubmit"

);

});

});

  

describe("Skipping Behavior Tests", function () {

this.timeout(20000);

  

it("should move skipped applications to the end of the queue and increment skipCount", async function () {

console.log("Starting Skipping Behavior Test");

const config = loadConfig();

const llm = new GeminiLLM(config);

const assignments = new ApplicationAssignments();

  

const event: Event = {

name: "Skipping Behavior Event",

active: true,

requiredReadsPerApp: 2,

readers: new Set<User>(),

unverifiedUsers: new Set<User>(),

rubric: [

{

name: "General Fit",

description: "Overall applicant suitability",

scaleMin: 1,

scaleMax: 5,

},

],

questions: ["Why do you want to join this hackathon?"],

eligibilityCriteria: ["Must be a college student or higher"],

};

  

const questions = ["Why do you want to join this hackathon?"];

const rubric = ["General Fit"];

  

// Add three applications to the event

await assignments.addApplication(

admin,

event,

"SKP001",

"Applicant1",

questions,

["I want to learn and network."],

rubric,

event.eligibilityCriteria,

llm

);

await assignments.addApplication(

admin,

event,

"SKP002",

"Applicant2",

questions,

["I am passionate about coding."],

rubric,

event.eligibilityCriteria,

llm

);

await assignments.addApplication(

admin,

event,

"SKP003",

"Applicant3",

questions,

["I want to contribute to open source."],

rubric,

event.eligibilityCriteria,

llm

);

  

const dummyUser: User = {

email: "skiptester@example.com",

name: "Skip Tester",

password: "testpass",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

  

// Get first assignment (should be SKP001)

let assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(assignment, "First assignment should be available");

assert.strictEqual(

assignment?.application.applicantID,

"SKP001",

"First assignment should be SKP001"

);

console.log(

"First assignment received:",

assignment?.application.applicantID

);

  

// Skip first assignment using markAsSkipped

assignments.markAsSkipped(dummyUser, event, assignment!.application);

console.log("Marked assignment SKP001 as skipped");

assert.strictEqual(

dummyUser.skipCount,

1,

"User's skipCount should increment after first skip"

);

  

// Next assignment should be SKP002

assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(assignment, "Second assignment should be available");

assert.strictEqual(

assignment?.application.applicantID,

"SKP002",

"Second assignment should be SKP002"

);

console.log(

"Second assignment received after first skip:",

assignment?.application.applicantID

);

  

// Skip second assignment using markAsSkipped

assignments.markAsSkipped(dummyUser, event, assignment!.application);

console.log("Marked assignment SKP002 as skipped");

assert.strictEqual(

dummyUser.skipCount,

2,

"User's skipCount should increment after second skip"

);

  

// Another user should get first skipped application SKP001

const otherUser: User = {

email: "otheruser@example.com",

name: "Other User",

password: "testpass",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

const otherAssignment = await assignments.getNextAssignment(

otherUser,

event,

new Date()

);

assert.ok(otherAssignment, "Other user should get an assignment");

assert.strictEqual(

otherAssignment?.application.applicantID,

"SKP001",

"Other user should receive first skipped application SKP001"

);

console.log(

"Other user assignment received:",

otherAssignment?.application.applicantID

);

  

// Next assignment should be SKP003

assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(assignment, "Third assignment should be available");

assert.strictEqual(

assignment?.application.applicantID,

"SKP003",

"Third assignment should be SKP003"

);

console.log(

"Third assignment received after second skip:",

assignment?.application.applicantID

);

});

  

it("should not assign a fourth application when none are left", async function () {

// This test assumes the setup from the previous test: three applications have been read/skipped.

// We'll repeat the setup to ensure independence.

const config = loadConfig();

const llm = new GeminiLLM(config);

const assignments = new ApplicationAssignments();

  

const event: Event = {

name: "Skipping Behavior Event",

active: true,

requiredReadsPerApp: 2,

readers: new Set<User>(),

unverifiedUsers: new Set<User>(),

rubric: [

{

name: "General Fit",

description: "Overall applicant suitability",

scaleMin: 1,

scaleMax: 5,

},

],

questions: ["Why do you want to join this hackathon?"],

eligibilityCriteria: ["Must be a college student or higher"],

};

  

const questions = ["Why do you want to join this hackathon?"];

const rubric = ["General Fit"];

  

// Add three applications to the event

await assignments.addApplication(

admin,

event,

"SKP001",

"Applicant1",

questions,

["I want to learn and network."],

rubric,

event.eligibilityCriteria,

llm

);

await assignments.addApplication(

admin,

event,

"SKP002",

"Applicant2",

questions,

["I am passionate about coding."],

rubric,

event.eligibilityCriteria,

llm

);

await assignments.addApplication(

admin,

event,

"SKP003",

"Applicant3",

questions,

["I want to contribute to open source."],

rubric,

event.eligibilityCriteria,

llm

);

  

const dummyUser: User = {

email: "skiptester@example.com",

name: "Skip Tester",

password: "testpass",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

  

// Get first assignment (SKP001), skip

let assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assignments.markAsSkipped(dummyUser, event, assignment!.application);

  

// Get second assignment (SKP002), skip

assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assignments.markAsSkipped(dummyUser, event, assignment!.application);

  

// Get third assignment (SKP003)

assignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(assignment, "Third assignment should be available");

assert.strictEqual(

assignment?.application.applicantID,

"SKP003",

"Should receive SKP003 as the third assignment"

);

  

// Try to get a fourth assignment; should be undefined

const fourthAssignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.strictEqual(

fourthAssignment,

undefined,

"No further assignments should be available after reading/skipping all apps"

);

});

  

it("should allow multiple users to read the same application sequentially without concurrency lock", async function () {

console.log("Starting concurrent user assignment test");

const config = loadConfig();

const llm = new GeminiLLM(config);

const assignments = new ApplicationAssignments();

  

const event: Event = {

name: "Concurrent Users Event",

active: true,

requiredReadsPerApp: 1,

readers: new Set<User>(),

unverifiedUsers: new Set<User>(),

rubric: [

{

name: "General Fit",

description: "Overall applicant suitability",

scaleMin: 1,

scaleMax: 5,

},

],

questions: ["Why do you want to join this hackathon?"],

eligibilityCriteria: ["Must be a college student or higher"],

};

  

const questions = ["Why do you want to join this hackathon?"];

const rubric = ["General Fit"];

  

await assignments.addApplication(

admin,

event,

"CONC001",

"ApplicantConcurrent",

questions,

["I want to build my skills."],

rubric,

event.eligibilityCriteria,

llm

);

  

const user1: User = {

email: "user1@example.com",

name: "User One",

password: "pass1",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

  

const user2: User = {

email: "user2@example.com",

name: "User Two",

password: "pass2",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

  

// User1 gets the assignment

const assignmentUser1 = await assignments.getNextAssignment(

user1,

event,

new Date()

);

assert.ok(assignmentUser1, "User1 should receive an assignment");

console.log(

"User1 assigned application:",

assignmentUser1?.application.applicantID

);

  

// User2 tries to get an assignment, should also get the same application because no locking

const assignmentUser2 = await assignments.getNextAssignment(

user2,

event,

new Date()

);

assert.ok(

assignmentUser2,

"User2 should also receive an assignment (no concurrency lock)"

);

assert.strictEqual(

assignmentUser2?.application.applicantID,

"CONC001",

"User2 should receive the same application as User1"

);

console.log(

"User2 assigned application:",

assignmentUser2?.application.applicantID

);

  

// User1 marks submission to increment readsCompleted

assignments.incrementOnSubmit(user1, event, assignmentUser1!.application);

console.log("User1 marked application as submitted");

  

// User2 marks submission as well

assignments.incrementOnSubmit(user2, event, assignmentUser2!.application);

console.log("User2 marked application as submitted");

  

// Now, after both submissions, no further assignments should be available (readsCompleted reached)

const assignmentUser1Next = await assignments.getNextAssignment(

user1,

event,

new Date()

);

assert.strictEqual(

assignmentUser1Next,

undefined,

"No further assignments should be available for User1"

);

const assignmentUser2Next = await assignments.getNextAssignment(

user2,

event,

new Date()

);

assert.strictEqual(

assignmentUser2Next,

undefined,

"No further assignments should be available for User2"

);

console.log("No further assignments available after reads completed");

});

});

  

describe("Strength & Weakness Classification Tests", function () {

this.timeout(20000);

  

it("should classify applications as 'Strong' or 'Weak' based on AI comments", async function () {

console.log("Starting Strength & Weakness Classification Test");

const config = loadConfig();

const llm = new GeminiLLM(config);

const assignments = new ApplicationAssignments();

  

const event: Event = {

name: "Strength Weakness Classification Event",

active: true,

requiredReadsPerApp: 1,

readers: new Set<User>(),

unverifiedUsers: new Set<User>(),

rubric: [

{

name: "Teamwork",

description: "Ability to collaborate effectively",

scaleMin: 1,

scaleMax: 5,

},

{

name: "Innovation",

description: "Creativity and problem solving",

scaleMin: 1,

scaleMax: 5,

},

],

questions: [

"Describe a time you worked in a team.",

"Give an example of an innovative solution you developed.",

],

eligibilityCriteria: ["Must be a college student or higher"],

};

  

const questions = [

"Describe a time you worked in a team.",

"Give an example of an innovative solution you developed.",

];

const rubric = ["Teamwork", "Innovation"];

  

// Strong applicant

const strongAnswers = [

"I led a team project that delivered results ahead of schedule.",

"I created an algorithm that reduced processing time by 40%.",

];

  

// Weak applicant

const weakAnswers = [

"I prefer to work alone and avoid team projects.",

"I have not developed any innovative solutions yet.",

];

  

await assignments.addApplication(

admin,

event,

"STR001",

"Strong Applicant",

questions,

strongAnswers,

rubric,

event.eligibilityCriteria,

llm

);

  

await assignments.addApplication(

admin,

event,

"WEAK001",

"Weak Applicant",

questions,

weakAnswers,

rubric,

event.eligibilityCriteria,

llm

);

  

const dummyUser: User = {

email: "classificationtester@example.com",

name: "Classification Tester",

password: "testpass",

event: event,

readCount: 0,

totalTime: 0,

skipCount: 0,

};

  

// Get strong applicant assignment

const strongAssignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(

strongAssignment,

"Strong applicant assignment should be returned"

);

console.log(

"Strong applicant assignment received:",

strongAssignment.application.applicantID

);

  

if (strongAssignment.application.aiComments) {

const categories = strongAssignment.application.aiComments.map(

(c) => c.category

);

console.log("Strong Applicant AI Comment Categories:", categories);

assert.ok(

categories.includes("Strong"),

"AI comments should include 'Strong' category for strong applicant"

);

} else {

assert.fail("AI comments missing for strong applicant assignment");

}

  

// Mark strong applicant submission to move to next

assignments.incrementOnSubmit(

dummyUser,

event,

strongAssignment.application

);

  

// Get weak applicant assignment

const weakAssignment = await assignments.getNextAssignment(

dummyUser,

event,

new Date()

);

assert.ok(weakAssignment, "Weak applicant assignment should be returned");

console.log(

"Weak applicant assignment received:",

weakAssignment.application.applicantID

);

  

if (weakAssignment.application.aiComments) {

const categories = weakAssignment.application.aiComments.map(

(c) => c.category

);

console.log("Weak Applicant AI Comment Categories:", categories);

assert.ok(

categories.includes("Weak"),

"AI comments should include 'Weak' category for weak applicant"

);

} else {

assert.fail("AI comments missing for weak applicant assignment");

}

});

});
```

# test: ApplicationStorage
# response:

```typescript
// file: src/ApplicationStorage/ApplicationStorageConcept.test.ts
import { assertEquals, assert, assertArrayIncludes } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { testDb, clearDb } from "@utils/database.ts";
import { ID, Empty } from "@utils/types.ts";
import ApplicationStorageConcept from "./ApplicationStorageConcept.ts";

// Mock implementation for GeminiLLM to avoid actual API calls during tests
class MockGeminiLLM {
  private mockResponse: string;

  constructor(initialResponse?: string) {
    // Default response simulating successful AI comment generation
    this.mockResponse = initialResponse || JSON.stringify([
      {
        category: "Strong",
        quotedSnippet: "I led a team project that delivered results ahead of schedule.",
        justification: "Demonstrates strong leadership and execution skills.",
      },
      {
        category: "Weak",
        quotedSnippet: "I prefer to work alone and avoid team projects.",
        justification: "Indicates a lack of teamwork and collaboration ability.",
      },
    ]);
  }

  async executeLLM(prompt: string): Promise<string> {
    // In a real scenario, you might want to assert properties of the prompt
    // console.log("Mock LLM called with prompt (first 500 chars):", prompt.substring(0, Math.min(prompt.length, 500)));
    return Promise.resolve(this.mockResponse);
  }

  // Helper to change the mock response for different test scenarios
  setMockResponse(response: string) {
    this.mockResponse = response;
  }
}

Deno.test("ApplicationStorageConcept: fulfills principle - adds application, generates, and re-generates AI comments", async (t) => {
  // 1. Setup: Initialize database and concept
  const [db, client] = await testDb();
  await clearDb(db); // Clear previous test data
  const mockLLM = new MockGeminiLLM();
  // We assume ApplicationStorageConcept constructor allows LLM injection for testing
  const applicationStorage = new ApplicationStorageConcept(db, mockLLM as any);

  // Define common test data
  const testEventId: ID = "event:hackathon-2024" as ID;
  const applicantID = "applicant:alice-smith";
  const applicantYear = "2024";
  const answers = [
    "I want to build an innovative project for social good.",
    "My previous experience includes leading a team to develop a mobile app.",
    "I am a student at Example University, currently in my third year."
  ];
  const questions = ["Why do you want to join?", "Tell us about your experience.", "What is your academic status?"];
  const rubric = ["Innovation", "Teamwork", "Academic Standing"];
  const eligibilityCriteria = ["Must be an enrolled university student"];
  const adder = "user:admin-id" as ID; // Adder is a string ID, actual admin checks are for syncs

  let createdApplicationId: ID; // To store the application ID for subsequent steps

  await t.step("addApplication: Successfully adds a new application", async () => {
    // Action: Call addApplication to add an application
    const addResult = await applicationStorage.addApplication({
      adder,
      event: testEventId,
      applicantID,
      applicantYear,
      answers,
    });

    // Verification: Check if application was added and returned correctly
    assert(addResult, "Add application result should not be undefined");
    if ("error" in addResult) {
      assert(false, `addApplication failed with error: ${addResult.error}`);
    }
    
    createdApplicationId = (addResult as { application: ID; event: ID }).application;
    const returnedEventId = (addResult as { application: ID; event: ID }).event;

    assertEquals(returnedEventId, testEventId, "Returned event ID should match input event ID");
    assert(createdApplicationId, "A new application ID should be returned");

    // Verify the application exists in the database
    const storedApplication = await applicationStorage._getApplication({ application: createdApplicationId });
    assert(storedApplication, "Application should be found in the database");
    assertEquals(storedApplication._id, createdApplicationId);
    assertEquals(storedApplication.applicantID, applicantID);
    assertArrayIncludes(storedApplication.answers, answers);
    assertEquals(storedApplication.event, testEventId);

    // Modularity check: The stored application should only contain its specified properties
    assertEquals(Object.keys(storedApplication).length, 5, "Application document should have only 5 fields (_id, event, applicantID, applicantYear, answers)");
  });

  await t.step("addApplication: should return error for invalid inputs", async () => {
    // Test with empty applicantID
    const errorResultID = await applicationStorage.addApplication({
      adder,
      event: testEventId,
      applicantID: "",
      applicantYear,
      answers,
    });
    assert("error" in errorResultID, "Should return an error for empty applicantID");
    assertEquals((errorResultID as { error: string }).error, "Applicant ID cannot be empty.");

    // Test with empty applicantYear
    const errorResultYear = await applicationStorage.addApplication({
      adder,
      event: testEventId,
      applicantID,
      applicantYear: " ", // Contains only whitespace
      answers,
    });
    assert("error" in errorResultYear, "Should return an error for empty applicantYear");
    assertEquals((errorResultYear as { error: string }).error, "Applicant Year cannot be empty.");

    // Test with empty answers array
    const errorResultAnswers = await applicationStorage.addApplication({
      adder,
      event: testEventId,
      applicantID,
      applicantYear,
      answers: [],
    });
    assert("error" in errorResultAnswers, "Should return an error for empty answers");
    assertEquals((errorResultAnswers as { error: string }).error, "Answers cannot be empty.");
  });

  await t.step("generateAIComments: Successfully generates and stores AI comments", async () => {
    // Action: Generate AI comments for the created application
    const generateResult = await applicationStorage.generateAIComments({
      application: createdApplicationId,
      questions,
      rubric,
      eligibilityCriteria,
    });

    // Verification: Check if comments were generated and stored
    assert(generateResult, "Generate AI comments result should not be undefined");
    if ("error" in generateResult) {
      assert(false, `generateAIComments failed with error: ${generateResult.error}`);
    }
    assertEquals(Object.keys(generateResult).length, 0, "Should return an empty object on success");

    // Retrieve comments using the query to confirm they are in the state
    const storedComments = await applicationStorage._getAICommentsByApplication({ application: createdApplicationId });
    assert(storedComments.length > 0, "AI comments should be found in the database");
    assertEquals(storedComments.length, 2, "Should have 2 comments from mock LLM's default response");

    // Verify content and structure of comments (separation of concerns, purpose focus)
    const comment1 = storedComments[0];
    assert(comment1._id, "Each AI comment should have its own ID");
    assertEquals(comment1.application, createdApplicationId);
    assertEquals(comment1.category, "Strong");
    assert(comment1.quotedSnippet.includes("led a team project"), "Snippet should match mock response content");
    assert(comment1.justification.includes("leadership and execution"), "Justification should match mock response content");

    const comment2 = storedComments[1];
    assertEquals(comment2.application, createdApplicationId);
    assertEquals(comment2.category, "Weak");
    assert(comment2.quotedSnippet.includes("prefer to work alone"), "Snippet should match mock response content");
    assert(comment2.justification.includes("lack of teamwork"), "Justification should match mock response content");

    // Modularity check: AI comments only contain properties related to their purpose
    assertEquals(Object.keys(comment1).length, 5, "AIComment document should have only 5 fields (_id, application, category, quotedSnippet, justification)");
  });

  await t.step("generateAIComments: Re-generates and replaces existing AI comments (robustness)", async () => {
    // Change the mock LLM response for re-generation to simulate an update
    mockLLM.setMockResponse(JSON.stringify([
      {
        category: "Attention",
        quotedSnippet: "My previous experience includes leading a team.",
        justification: "Highlights prior experience, which needs attention to detail.",
      },
    ]));

    // Action: Re-generate AI comments for the same application
    const regenerateResult = await applicationStorage.generateAIComments({
      application: createdApplicationId,
      questions,
      rubric: ["Experience", "Attention to Detail"], // Potentially different rubric for regeneration
      eligibilityCriteria,
    });

    assert(regenerateResult, "Regenerate AI comments result should not be undefined");
    if ("error" in regenerateResult) {
      assert(false, `regenerateAIComments failed with error: ${regenerateResult.error}`);
    }
    assertEquals(Object.keys(regenerateResult).length, 0, "Should return an empty object on success");

    // Verification: Check if old comments are replaced by new ones
    const updatedComments = await applicationStorage._getAICommentsByApplication({ application: createdApplicationId });
    assertEquals(updatedComments.length, 1, "There should be only 1 comment after re-generation, replacing old ones");

    const newComment = updatedComments[0];
    assertEquals(newComment.application, createdApplicationId);
    assertEquals(newComment.category, "Attention");
    assert(newComment.quotedSnippet.includes("previous experience"), "Snippet should match new mock response content");
    assert(newComment.justification.includes("attention to detail"), "Justification should match new mock response content");
  });

  await t.step("generateAIComments: Handles non-existent application gracefully (simplicity/robustness)", async () => {
    const nonExistentAppId: ID = "application:non-existent-123" as ID;
    const errorResult = await applicationStorage.generateAIComments({
      application: nonExistentAppId,
      questions,
      rubric,
      eligibilityCriteria,
    });

    assert("error" in errorResult, "Should return an error for non-existent application");
    assertEquals((errorResult as { error: string }).error, `Application with ID ${nonExistentAppId} not found.`);
  });

  await t.step("generateAIComments: Filters invalid categories and truncates long justifications", async () => {
    mockLLM.setMockResponse(JSON.stringify([
      {
        category: "InvalidCategory", // Invalid category
        quotedSnippet: "This is a snippet with an invalid category.",
        justification: "Short justification.",
      },
      {
        category: "Strong",
        quotedSnippet: "Another valid snippet, but long justification.",
        justification: "This justification is intentionally very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very much so that it is truncated.",
      },
      {
        category: "Strong",
        quotedSnippet: "", // Empty snippet
        justification: "This is a good justification.",
      },
      {
        category: "Strong",
        quotedSnippet: "Valid snippet.",
        justification: "Valid justification.",
      },
      {
        category: "Strong",
        quotedSnippet: "Duplicate snippet.", // Duplicate snippet from next entry
        justification: "Valid justification for first occurrence.",
      },
      {
        category: "Strong",
        quotedSnippet: "Duplicate snippet.", // Duplicate snippet
        justification: "Valid justification for second occurrence.",
      },
    ]));

    await applicationStorage.generateAIComments({
      application: createdApplicationId,
      questions,
      rubric,
      eligibilityCriteria,
    });

    const filteredComments = await applicationStorage._getAICommentsByApplication({ application: createdApplicationId });
    assertEquals(filteredComments.length, 2, "Only 2 comments should be stored after filtering (invalid category, empty snippet, duplicates excluded).");

    // Verify the truncated justification
    const longJustificationComment = filteredComments.find(c => c.quotedSnippet === "Another valid snippet, but long justification.");
    assert(longJustificationComment, "Comment with long justification should exist.");
    assertEquals(longJustificationComment.justification.length, 150, "Justification should be truncated to 150 characters.");
    assert(longJustificationComment.justification.endsWith("..."), "Truncated justification should end with '...'.");

    // Verify a valid comment is present
    const validComment = filteredComments.find(c => c.quotedSnippet === "Valid snippet.");
    assert(validComment, "Fully valid comment should be present.");

    // No comment with "InvalidCategory" should be present
    const invalidCategoryComment = filteredComments.find(c => c.quotedSnippet === "This is a snippet with an invalid category.");
    assertEquals(invalidCategoryComment, undefined, "Comment with invalid category should have been skipped.");
    
    // No comment with empty snippet should be present
    const emptySnippetComment = filteredComments.find(c => c.quotedSnippet === "");
    assertEquals(emptySnippetComment, undefined, "Comment with empty snippet should have been skipped.");

    // Only one instance of "Duplicate snippet." should be present
    const duplicateSnippetComments = filteredComments.filter(c => c.quotedSnippet === "Duplicate snippet.");
    assertEquals(duplicateSnippetComments.length, 0, "All comments with duplicate snippets should have been skipped (because the prompt says it should skip, and the original code skipped subsequent duplicates).");
  });


  // Cleanup
  await client.close();
});
```