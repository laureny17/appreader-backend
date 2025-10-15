---
timestamp: 'Wed Oct 15 2025 04:25:26 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_042526.76b6b5fc.md]]'
content_id: 1cc73e07156bbd9159dc35c2f3f61ba84d72f4bfe90ce1f81ef1db2023029a4a
---

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
