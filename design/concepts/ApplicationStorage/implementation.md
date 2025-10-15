[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

[@ApplicationStorageSpec](ApplicationStorageSpec.md)

# prompt: given the information about the ApplicationStorage concept and instructions on how to implement concepts and how concept specifications work, implement ApplicationStorage. Refer to the previously written version of a similar concept in which AI comments were generated, keeping the same exact prompt for the LLM. 

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

# implement: ApplicationStorage

# concept: ApplicationStorage 
[@ApplicationStorageSpec](ApplicationStorageSpec.md)

# response:

```typescript
// file: src/ApplicationStorage/ApplicationStorageConcept.ts
import { Collection, Db } from "npm:mongodb";
import { ID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import { GeminiLLM } from "@llm/gemini-llm.ts"; // Assuming this path exists and contains the GeminiLLM class

// Declare collection prefix, use concept name
const PREFIX = "ApplicationStorage" + ".";

// Generic types of this concept
type Application = ID;
type Event = ID;

/**
 * @concept ApplicationStorage [Application, Event]
 * @purpose Store application data (with applied-to event, applicant information, and answers) and AI-generated comments
 *    from that content.
 * @principle An admin can add applications to an active event. Applications include answers, and a set of comments
 *    generated by an LLM can be generated and re-generated using question and rubric sets of strings passed as parameters.
 *
 * @state
 *    a set of Applications with
 *        an event Event
 *        an applicantID String
 *        an applicantYear String
 *        an answers set of String
 */
interface ApplicationDoc {
  _id: Application;
  event: Event;
  applicantID: string;
  applicantYear: string;
  answers: string[];
}

/**
 * @state
 *    a set of AIComments with
 *        an application Application
 *        a category String
 *        a quotedSnippet String
 *        a justification String
 */
interface AICommentDoc {
  _id: ID; // Each AI comment gets its own unique ID
  application: Application; // Foreign key to ApplicationDoc
  category: "Strong" | "Weak" | "Attention";
  quotedSnippet: string;
  justification: string;
}

export default class ApplicationStorageConcept {
  applications: Collection<ApplicationDoc>;
  aiComments: Collection<AICommentDoc>;
  private llm: GeminiLLM; // An instance of the LLM client

  constructor(private readonly db: Db) {
    this.applications = this.db.collection(PREFIX + "applications");
    this.aiComments = this.db.collection(PREFIX + "aiComments");
    this.llm = new GeminiLLM(); // Instantiate the LLM client
  }

  /**
   * @action addApplication (adder: String, event: Event, applicantID: String, applicantYear: String, answers: set of String): (application: Application, event: Event)
   * @requires: applicantID and applicantYear are non-empty strings, answers is a non-empty set
   * @effects: create an application for the event for the applicantID, associated with the applicantYear
   *       and the set of answers; return the created application and event for which it was submitted
   */
  async addApplication(
    {
      adder, // The 'adder' is a string identifier; admin checks would be handled by syncs.
      event,
      applicantID,
      applicantYear,
      answers,
    }: {
      adder: string;
      event: Event;
      applicantID: string;
      applicantYear: string;
      answers: string[];
    },
  ): Promise<{ application: Application; event: Event } | { error: string }> {
    // Preconditions
    if (!applicantID || applicantID.trim() === "") {
      return { error: "Applicant ID cannot be empty." };
    }
    if (!applicantYear || applicantYear.trim() === "") {
      return { error: "Applicant Year cannot be empty." };
    }
    if (!answers || answers.length === 0) {
      return { error: "Answers cannot be empty." };
    }

    const newApplicationId = freshID();
    const newApplicationDoc: ApplicationDoc = {
      _id: newApplicationId,
      event: event,
      applicantID: applicantID,
      applicantYear: applicantYear,
      answers: answers,
    };

    try {
      await this.applications.insertOne(newApplicationDoc);
      console.log(`Application ${newApplicationId} added for event ${event}.`);
      return { application: newApplicationId, event: event };
    } catch (e) {
      console.error(
        `Failed to add application for applicant ${applicantID}:`,
        e,
      );
      return { error: "Failed to add application due to database error." };
    }
  }

  /**
   * @action async generateAIComments (application: Application, questions: set of String, rubric: set of String, eligibilityCriteria: set of String)
   * @requires: application exists
   * @effects: populate AIComments or replace existing AIComments using an analysis of the answers that incorporates
   *       the provided event questions and rubric, where the category is "Strong," "Weak," or "Attention," the
   *       quotedSnippet is a substring from answers, and the justification is a non-empty string
   */
  async generateAIComments(
    {
      application,
      questions,
      rubric,
      eligibilityCriteria,
    }: {
      application: Application;
      questions: string[];
      rubric: string[];
      eligibilityCriteria: string[];
    },
  ): Promise<Empty | { error: string }> {
    // Precondition: application exists
    const existingApplication = await this.applications.findOne({
      _id: application,
    });
    if (!existingApplication) {
      return { error: `Application with ID ${application} not found.` };
    }

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
${existingApplication.answers.join("\n")}

Eligibility Criteria:
${eligibilityCriteria.join("\n")}

Rubric:
${rubric.join("\n")}
`;

    console.log(
      `Attempting to generate AI comments for application ${application} (applicant: ${existingApplication.applicantID}).`,
    );

    let generatedComments: AICommentDoc[] = [];
    try {
      const response = await this.llm.executeLLM(prompt);

      try {
        // Parse the LLM response, allowing for `category` to be a string initially before validation
        const parsedComments: Omit<AICommentDoc, '_id' | 'application'>[] = JSON.parse(response);
        console.log(
          `Parsed LLM response for application ${application}: ${parsedComments.length} raw comment(s) found.`,
        );

        // Validation and filtering logic from previous version
        const validCategories = new Set(["Strong", "Weak", "Attention"]);
        const seenSnippets = new Set<string>();
        const filteredComments: AICommentDoc[] = [];

        for (const comment of parsedComments) {
          let isValid = true;

          // Validate category
          if (!validCategories.has(comment.category as any)) {
            console.warn(
              `Warning: Invalid category "${comment.category}" for application ${application}. Comment will be skipped.`,
            );
            isValid = false;
          }

          // Validate justification
          if (typeof comment.justification !== 'string' || comment.justification.trim() === '') {
            console.warn(
              `Warning: Empty or invalid justification in AI comment for application ${application}. Comment will be skipped.`,
            );
            isValid = false;
          } else if (comment.justification.length > 150) {
            console.warn(
              `Warning: Justification too long (>150 chars) for application ${application}. Truncating.`,
            );
            comment.justification = comment.justification.slice(0, 147) + "...";
          }
          
          // Validate quotedSnippet
          if (typeof comment.quotedSnippet !== 'string' || comment.quotedSnippet.trim() === '') {
             console.warn(
              `Warning: Empty or invalid quotedSnippet in AI comment for application ${application}. Comment will be skipped.`,
            );
            isValid = false;
          } else if (seenSnippets.has(comment.quotedSnippet)) {
            console.warn(
              `Warning: Duplicate quotedSnippet found for application ${application}. Duplicate comment will be skipped.`,
            );
            isValid = false;
          }
          
          if (isValid) {
            seenSnippets.add(comment.quotedSnippet);
            filteredComments.push({
              _id: freshID(), // Assign a fresh ID for each AI comment
              application: application, // Link to the parent application
              category: comment.category as AICommentDoc['category'], // Type assertion after validation
              quotedSnippet: comment.quotedSnippet,
              justification: comment.justification,
            });
          }
        }
        generatedComments = filteredComments;

        if (generatedComments.length === 0) {
          console.log(
            `No valid AI comments generated or parsed for application ${application}.`,
          );
        } else {
          console.log(
            `${generatedComments.length} valid AI comments processed for application ${application}.`,
          );
        }
      } catch (parseError) {
        console.error(
          `ERROR: Failed to parse AI comments JSON from LLM response for application ${application}: ${
            (parseError as Error).message
          }. Raw response: ${response}`,
        );
        return { error: "Failed to parse AI comments from LLM response." };
      }

      // Effects: populate AIComments or replace existing AIComments
      // First, delete any existing AI comments associated with this application
      await this.aiComments.deleteMany({ application: application });
      if (generatedComments.length > 0) {
        // Then, insert the newly generated and filtered comments
        await this.aiComments.insertMany(generatedComments);
        console.log(`Successfully stored ${generatedComments.length} AI comments for application ${application}.`);
      } else {
        console.log(`No valid AI comments to store for application ${application}.`);
      }
      return {};
    } catch (error) {
      console.error(
        `ERROR: Failed to generate AI comments for application ${application} due to LLM interaction error:`,
        error,
      );
      return { error: "Failed to generate AI comments due to LLM error." };
    }
  }

  // Example Query (not explicitly asked for, but useful for verifying effects)
  /**
   * @_getAICommentsByApplication (application: Application): (comments: set of AICommentDoc)
   * @effects: return all AI comments for a given application
   */
  async _getAICommentsByApplication(
    { application }: { application: Application },
  ): Promise<AICommentDoc[]> {
    return this.aiComments.find({ application: application }).toArray();
  }

  /**
   * @_getApplication (application: Application): (applicationDoc: ApplicationDoc)
   * @effects: return a specific application document by its ID
   */
  async _getApplication(
    { application }: { application: Application },
  ): Promise<ApplicationDoc | null> {
    return this.applications.findOne({ _id: application });
  }
}
```