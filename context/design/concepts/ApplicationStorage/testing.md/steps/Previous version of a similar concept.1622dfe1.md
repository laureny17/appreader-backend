---
timestamp: 'Wed Oct 15 2025 04:25:26 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_042526.76b6b5fc.md]]'
content_id: 1622dfe17a71a0180e6243181813f157c4e76be9b7710d8917559fa6d3b6400e
---

# Previous version of a similar concept:

```
/**

* ReviewRecords Concept

*/

  

import { randomUUID } from "crypto";

import { GeminiLLM } from "./gemini-llm";

import { EventDirectory, Event, User, admin } from "./event-directory";

import { Score } from "./models";

  

interface AIComment {

category: "Strong" | "Weak" | "Attention";

quotedSnippet: string;

justification: string;

}

  

interface CurrentAssignment {

user: User;

application: Application;

startTime: Date;

}

  

interface Application {

applicantID: string;

applicantYear: string;

answers: string[];

readsCompleted: number;

readers: Set<User>;

aiComments: AIComment[];

}

  

export class ApplicationAssignments {

private eventToApplications: Map<Event, Application[]> = new Map();

private currentAssignments: CurrentAssignment[] = [];

private skippedApplications: Map<Event, string[]> = new Map();

  

async addApplication(

adder: User,

event: Event,

applicantID: string,

applicantYear: string,

questions: string[],

answers: string[],

rubric: string[],

eligibilityCriteria: string[],

llm?: GeminiLLM

) {

if (adder !== admin) {

console.log("Only Admin can add an application!");

return;

}

  

console.log(

`addApplication called for current event with applicantID: ${applicantID}, applicantYear: ${applicantYear}, number of answers: ${

answers.length

}, LLM used: ${llm ? "Yes" : "No"}`

);

  

const newApplication: Application = {

applicantID: applicantID,

applicantYear: applicantYear,

answers: [...answers],

readsCompleted: 0,

readers: new Set<User>(),

aiComments: [],

};

  

console.log(

`Created new application object for current event, applicantID: ${applicantID}, applicantYear: ${applicantYear}, initial readsCompleted: ${newApplication.readsCompleted}`

);

  

if (llm) {

await this.generateAIComments(

event,

newApplication,

questions,

rubric,

eligibilityCriteria,

llm

);

}

  

if (!this.eventToApplications.has(event)) {

this.eventToApplications.set(event, []);

}

this.eventToApplications.get(event)!.push(newApplication);

  

console.log(

`\nApplication for applicantID: ${applicantID} added successfully to current event. Total applications count for event is now: ${

this.eventToApplications.get(event)!.length

}`

);

}

  

private async generateAIComments(

event: Event,

application: Application,

questions: string[],

rubric: string[],

eligibilityCriteria: string[],

llm: GeminiLLM

): Promise<void> {

const prompt = `

You are an AI model that analyzes hackathon application answers and must output STRICT JSON ONLY.

  

Return a JSON array of comment objects, where each object has exactly these keys:

- "category": one of ["Strong", "Weak", "Attention"]

- "quotedSnippet": a short substring (<= 2 sentences) directly from the applicant's answers

- "justification": a one-sentence explanation for the chosen category, no longer than 150 characters.

  

IMPORTANT RULES:

- Output ONLY a valid JSON array.

- Do NOT include Markdown formatting, code fences (\`\`\`), or any text before or after the JSON.

- The first character in your response must be '[' and the last must be ']'.

- Classify snippets aligned with desirable traits in the rubric as "Strong"

- Classify snippets showing a lack of desirable traits in the rubric as "Weak"

- Classify snippets contradicting previous information written in the application as "Attention".

- Classify snippets demonstrating disrespect or as "Attention".

- Classify snippets that contradict or may contract eligibility requirements as "Attention".

  

Questions:

${questions.join("\n")}

  

Answers:

${application.answers.join("\n")}

  

Eligibility Criteria:

${eligibilityCriteria.join("\n")}

  

Rubric:

${rubric.join("\n")}

`;

  

console.log(

`Generating AI comments for application ${application.applicantID} in current event`

);

  

try {

const response = await llm.executeLLM(prompt);

  

let comments: AIComment[];

try {

comments = JSON.parse(response);

console.log(

`Parsed AI comments JSON for application ${application.applicantID} in current event: ${comments.length} comment(s) found.`

);

} catch (parseError) {

console.error(

`ERROR: error parsing AI comments JSON from raw response for application ${

application.applicantID

} in current event: ${

(parseError as Error).message

}. Raw response was: ${response}`

);

comments = [];

}

  

// Validation and filtering

const validCategories = new Set(["Strong", "Weak", "Attention"]);

const seenSnippets = new Set<string>();

const filteredComments: AIComment[] = [];

  

for (const comment of comments) {

let isValid = true;

if (!validCategories.has(comment.category)) {

console.warn(

`Warning: Invalid category "${comment.category}" in AI comment for application ${application.applicantID}. Comment will be skipped.`

);

isValid = false;

}

if (comment.justification.length > 150) {

console.warn(

`Warning: Justification too long (>150 chars) in AI comment for application ${application.applicantID}. It will be truncated.`

);

comment.justification = comment.justification.slice(0, 147) + "...";

}

if (seenSnippets.has(comment.quotedSnippet)) {

console.warn(

`Warning: Duplicate quotedSnippet found in AI comments for application ${application.applicantID}. Duplicate comment will be skipped.`

);

isValid = false;

}

if (isValid) {

seenSnippets.add(comment.quotedSnippet);

filteredComments.push(comment);

}

}

  

application.aiComments = filteredComments;

  

if (filteredComments.length === 0) {

console.log(

`ERROR: No valid AI comments generated or parsed for application ${application.applicantID} in current event.`

);

} else {

console.log(

`\nAI comments assigned to application ${application.applicantID} in current event:`

);

filteredComments.forEach((comment, idx) => {

console.log(

` ${idx + 1}. [${comment.category}] "${

comment.quotedSnippet

}" - Justification: ${comment.justification}`

);

});

}

} catch (error) {

console.error(

`ERROR: Failed to generate AI comments for application ${application.applicantID} in current event. Error:`,

error

);

application.aiComments = [];

}

}

  

async getNextAssignment(

user: User,

event: Event,

startTime: Date

): Promise<CurrentAssignment | undefined> {

const applications = this.eventToApplications.get(event) || [];

console.log(

`\ngetNextAssignment called for user ${user.name} in current event.

Total applications for event: ${applications.length}`

);

  

const skippedQueue = this.skippedApplications.get(event) || [];

for (let i = 0; i < skippedQueue.length; i++) {

const skippedAppID = skippedQueue[i];

const skippedApp = applications.find(

(app) => app.applicantID === skippedAppID

);

if (!skippedApp) {

// If application not found, remove its ID from skipped queue

skippedQueue.splice(i, 1);

i--;

continue;

}

if (!skippedApp.readers.has(user)) {

console.log(

`Assigning previously skipped application ${skippedApp.applicantID} to user ${user.name}.`

);

  

// Remove from skip queue

skippedQueue.splice(i, 1);

this.skippedApplications.set(event, skippedQueue);

  

// Add to front of main queue

applications.unshift(skippedApp);

  

// Create assignment

const assignment: CurrentAssignment = {

user,

application: skippedApp,

startTime,

};

  

// Update application state

skippedApp.readers.add(user);

skippedApp.readsCompleted += 1;

this.currentAssignments.push(assignment);

  

console.log(

`Assigned skipped application ${skippedApp.applicantID} to user ${user.name}. Updated readsCompleted: ${skippedApp.readsCompleted}`

);

  

// Move to end after assignment

this.moveToEnd(event, skippedApp);

return assignment;

} else {

console.log(

`User ${user.name} already read/skipped ${skippedApp.applicantID}, skipping it.`

);

}

}

  

// Scan from front and return first application user hasn't read yet

for (const application of applications) {

// Don't assign if user has already read this application

if (application.readers.has(user)) {

console.log(

`Skipping application ${application.applicantID} since user ${user.name} has already read it.`

);

continue;

}

  

// Create assignment

const assignment: CurrentAssignment = {

user,

application,

startTime,

};

  

// Update application state

application.readers.add(user);

application.readsCompleted += 1;

  

// Add to current assignments

this.currentAssignments.push(assignment);

console.log(

`Assigned application ${application.applicantID} to user ${

user.name

} at ${startTime.toISOString()}. Updated readsCompleted: ${

application.readsCompleted

}`

);

  

// Move the assigned application to the end of the list

this.moveToEnd(event, application);

return assignment;

}

  

// No unread applications found

console.log(

`No unread applications available for user ${user.name} in current event.`

);

return undefined;

}

  

moveToEnd(event: Event, application: Application): void {

const applications = this.eventToApplications.get(event);

if (!applications) return;

const index = applications.indexOf(application);

if (index > -1) {

applications.splice(index, 1);

applications.push(application);

const newIndex = applications.length - 1;

console.log(

`Moved application ${application.applicantID} to end of list at index ${newIndex} in current event.

Total applications: ${applications.length}`

);

}

}

  

moveToFront(event: Event, application: Application): void {

const applications = this.eventToApplications.get(event);

if (!applications) return;

const index = applications.indexOf(application);

if (index > -1) {

applications.splice(index, 1);

applications.unshift(application);

console.log(

`Moved application ${application.applicantID} to front of list at index 0 in current event.

Total applications: ${applications.length}`

);

}

}

  

incrementOnSubmit(user: User, event: Event, application: Application): void {

const applications = this.eventToApplications.get(event);

if (!applications) {

console.warn(`Event not found when incrementing reads.`);

return;

}

  

const target = applications.find(

(a) => a.applicantID === application.applicantID

);

if (!target) {

console.warn(

`Application ${application.applicantID} not found in event.`

);

return;

}

  

// Add user to readers and increment read count

target.readers.add(user);

target.readsCompleted += 1;

  

console.log(

`incrementOnSubmit: Application ${application.applicantID} now has ${target.readsCompleted} reads.`

);

console.log(

`Readers now: [${[...target.readers].map((u) => u.name).join(", ")}]`

);

}

  

markAsSkipped(user: User, event: Event, application: Application): void {

if (!this.skippedApplications.has(event)) {

this.skippedApplications.set(event, []);

}

  

const skipped = this.skippedApplications.get(event)!;

if (!skipped.includes(application.applicantID)) {

skipped.push(application.applicantID);

console.log(

`markAsSkipped: Application ${application.applicantID} added to skipped queue for event.`

);

} else {

console.log(

`Application ${application.applicantID} already in skipped queue for event.`

);

}

  

// Prevent reassigning to same user

application.readers.add(user);

EventDirectory.incrementUserSkipCount(user);

  

// Do NOT move application within main queue — it stays in place

console.log(

`Application ${application.applicantID} remains in main queue position.`

);

}

}
```
