---
timestamp: 'Wed Oct 15 2025 04:05:54 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_040554.a9f3dd75.md]]'
content_id: 6f52e251521a7db8f6b588c8eb3d1c0eda8aa08c0f509aeadd43727341aa9b97
---

# response:

Here's the implementation of the `ApplicationStorage` concept, following the guidelines provided in the concept design document.

First, we need to ensure the utility types and functions are available. Assuming `@utils/types.ts`, `@utils/database.ts`, and a new `@utils/llm.ts` (for the AI comment generation) are set up.

***

### `src/utils/types.ts` (as described in the prompt)

```typescript
// src/utils/types.ts

/**
 * A branded type for IDs to maintain type safety across concepts.
 * Internally, it's a string, but the branding helps prevent mixing different ID types.
 */
export type ID = string & { __brand: "ID" };

/**
 * Represents an empty object, used for actions that do not return specific data
 * but still need to return a dictionary object in TypeScript.
 */
export type Empty = Record<PropertyKey, never>;
```

### `src/utils/database.ts` (as described in the prompt)

```typescript
// src/utils/database.ts
import { MongoClient, Db } from "npm:mongodb";

// Placeholder for a function to generate unique IDs
export function freshID(): ID {
  // In a real application, you might use a UUID generator or MongoDB's ObjectId.
  // For this example, we'll use a simple timestamp-based ID.
  return `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}` as ID;
}

// Placeholder for a function to get a database client
export async function getDb(): Promise<[Db, MongoClient]> {
  // Replace with your actual MongoDB connection string from environment variables
  const mongoUri = Deno.env.get("MONGO_URI") || "mongodb://localhost:27017/concept_db";
  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(); // Default database or specify one
  console.log(`Connected to MongoDB: ${db.databaseName}`);
  return [db, client];
}
```

### `src/utils/llm.ts` (Mock for LLM Interaction)

We'll create a mock LLM utility that simulates the generation of AI comments. In a real application, this would involve API calls to a large language model service.

```typescript
// src/utils/llm.ts
import { ID } from "./types.ts";

/**
 * Defines the structure of an AI-generated comment.
 */
export type AICommentOutput = {
  category: "Strong" | "Weak" | "Attention";
  quotedSnippet: string;
  justification: string;
};

/**
 * A mock utility for interacting with a Large Language Model (LLM).
 * Simulates generating comments based on application answers and specific criteria.
 */
export const llm = {
  /**
   * Simulates generating AI comments based on application answers and criteria.
   * In a real scenario, this would call an external LLM API (e.g., OpenAI, Google Gemini).
   *
   * @param {string[]} answers - The applicant's answers.
   * @param {string[]} questions - The questions asked in the application.
   * @param {string[]} rubric - The evaluation rubric.
   * @param {string[]} eligibilityCriteria - Criteria for eligibility.
   * @returns {Promise<AICommentOutput[] | { error: string }>} An array of generated comments or an error.
   */
  async generateComments(
    answers: string[],
    questions: string[],
    rubric: string[],
    eligibilityCriteria: string[],
  ): Promise<AICommentOutput[] | { error: string }> {
    console.log("Simulating LLM comment generation...");
    // console.log("Answers:", answers.join("\n"));
    // console.log("Questions:", questions.join(", "));
    // console.log("Rubric:", rubric.join(", "));
    // console.log("Eligibility Criteria:", eligibilityCriteria.join(", "));

    if (!answers || answers.length === 0) {
      return { error: "No answers provided to generate comments." };
    }

    const mockComments: AICommentOutput[] = [];

    // Basic mock logic: create some comments based on simplistic patterns
    const combinedAnswers = answers.join(" ");

    if (combinedAnswers.includes("leadership") || combinedAnswers.includes("initiative")) {
      mockComments.push({
        category: "Strong",
        quotedSnippet:
          combinedAnswers.match(/(leadership|initiative)\S*/i)?.[0] ||
          answers[0]?.substring(0, Math.min(answers[0].length, 30)) + "...",
        justification: `Applicant demonstrated strong leadership potential regarding ${
          questions[0] || "relevant experience"
        }.`,
      });
    }

    if (combinedAnswers.includes("struggle") || combinedAnswers.includes("challenge")) {
      mockComments.push({
        category: "Attention",
        quotedSnippet:
          combinedAnswers.match(/(struggle|challenge)\S*/i)?.[0] ||
          answers[1]?.substring(0, Math.min(answers[1].length, 30)) + "...",
        justification: `Noted a potential area of difficulty that requires further review related to ${
          questions[1] || "a specific skill"
        }.`,
      });
    } else {
      // Add a general weak comment if no specific "attention" trigger
      mockComments.push({
        category: "Weak",
        quotedSnippet: answers[answers.length - 1]?.substring(0, Math.min(answers[answers.length - 1].length, 30)) +
          "...",
        justification: `Response to ${questions[questions.length - 1] || "the final question"} was somewhat generic.`,
      });
    }

    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    return mockComments;
  },
};
```

***

### `src/ApplicationStorage/ApplicationStorageConcept.ts`

```typescript
// src/ApplicationStorage/ApplicationStorageConcept.ts
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";
import { llm, AICommentOutput } from "@utils/llm.ts";

// Declare collection prefix, uses the concept name to avoid conflicts
const PREFIX = "ApplicationStorage" + ".";

/**
 * Generic type for an Application ID.
 * This concept treats `Application` IDs polymorphically, meaning it doesn't
 * assume any internal structure beyond being a unique identifier.
 */
type Application = ID;
/**
 * Generic type for an Event ID.
 * This concept treats `Event` IDs polymorphically.
 */
type Event = ID;

/**
 * Interface representing the structure of an 'Application' document
 * as stored in the MongoDB collection.
 *
 * @state a set of Applications with
 *   an event Event
 *   an applicantID String
 *   an applicantYear String
 *   an answers set of String
 */
interface ApplicationDocument {
  _id: Application; // The unique identifier for the application
  event: Event; // The event ID this application belongs to
  applicantID: string; // The ID of the applicant
  applicantYear: string; // The academic year of the applicant
  answers: string[]; // A list of answers provided by the applicant
}

/**
 * Interface representing the structure of an 'AIComment' document
 * as stored in the MongoDB collection.
 *
 * @state a set of AIComments with
 *   an application Application
 *   a category String ("Strong", "Weak", "Attention")
 *   a quotedSnippet String (a relevant part of the answers)
 *   a justification String (why the comment was made)
 */
interface AICommentDocument {
  _id: ID; // Unique identifier for each AI comment
  application: Application; // The application this comment refers to
  category: "Strong" | "Weak" | "Attention"; // The classification of the comment
  quotedSnippet: string; // A direct quote or paraphrase from the application's answers
  justification: string; // Explanation for the comment
}

/**
 * @concept ApplicationStorage
 * @purpose Store application data (with applied-to event, applicant information, and answers) and AI-generated comments
 *     from that content.
 * @principle An admin can add applications to an active event. Applications include answers, and a set of comments
 *     generated by an LLM can be generated and re-generated using question and rubric sets of strings passed as parameters.
 *
 * The ApplicationStorage concept manages the persistence and retrieval of application data
 * and associated AI-generated comments. It focuses purely on the storage and processing
 * of this specific type of data, separating concerns from user authentication, event management,
 * or other application functionalities.
 */
export default class ApplicationStorageConcept {
  // MongoDB collection for application documents
  applications: Collection<ApplicationDocument>;
  // MongoDB collection for AI-generated comments
  aiComments: Collection<AICommentDocument>;

  /**
   * Constructs an instance of the ApplicationStorageConcept.
   * @param {Db} db - The MongoDB database instance to use for collections.
   */
  constructor(private readonly db: Db) {
    this.applications = this.db.collection(PREFIX + "applications");
    this.aiComments = this.db.collection(PREFIX + "aiComments");
  }

  /**
   * @action addApplication
   * @requires applicantID and applicantYear are non-empty strings, answers is a non-empty set
   * @effects create an application for the event for the applicantID, associated with the applicantYear
   *     and the set of answers; return the created application and event for which it was submitted
   *
   * Adds a new application to the storage. This action validates the input parameters
   * and creates a new application record linked to an event and an applicant.
   *
   * @param {Object} params - The action parameters.
   * @param {string} params.adder - The identifier of the user (admin) who is adding the application.
   *                                 (Not stored in this concept's state, but relevant for syncs or auditing).
   * @param {Event} params.event - The ID of the event this application is submitted for.
   * @param {string} params.applicantID - The unique identifier of the applicant.
   * @param {string} params.applicantYear - The academic year or cohort of the applicant.
   * @param {string[]} params.answers - A list of strings representing the applicant's responses.
   * @returns {Promise<{application: Application, event: Event} | {error: string}>}
   *   Returns an object containing the new application's ID and the event ID on success,
   *   or an object with an `error` message if preconditions are not met or an error occurs.
   */
  async addApplication(
    { event, applicantID, applicantYear, answers }: {
      adder: string;
      event: Event;
      applicantID: string;
      applicantYear: string;
      answers: string[];
    },
  ): Promise<{ application: Application; event: Event } | { error: string }> {
    // Preconditions check
    if (!applicantID || applicantID.trim() === "") {
      return { error: "Applicant ID cannot be empty." };
    }
    if (!applicantYear || applicantYear.trim() === "") {
      return { error: "Applicant year cannot be empty." };
    }
    if (!answers || answers.length === 0) {
      return { error: "Answers set cannot be empty." };
    }

    const newApplicationId: Application = freshID() as Application;

    // Effects: Create and insert the new application document
    try {
      const result = await this.applications.insertOne({
        _id: newApplicationId,
        event: event,
        applicantID: applicantID.trim(),
        applicantYear: applicantYear.trim(),
        answers: answers,
      });

      if (result.acknowledged) {
        return { application: newApplicationId, event: event };
      } else {
        return { error: "Failed to acknowledge application insertion." };
      }
    } catch (e: any) {
      console.error("Error adding application:", e);
      return { error: `Failed to add application: ${e.message}` };
    }
  }

  /**
   * @action generateAIComments
   * @requires application exists
   * @effects populate AIComments or replace existing AIComments using an analysis of the answers that incorporates
   *     the provided event questions and rubric, where the category is "Strong," "Weak," or "Attention," the
   *     quotedSnippet is a substring from answers, and the justification is a non-empty string
   *
   * Generates or regenerates AI-powered comments for a specific application.
   * It first deletes any existing comments for that application before inserting new ones
   * generated by an external LLM based on the application's answers and provided criteria.
   *
   * @param {Object} params - The action parameters.
   * @param {Application} params.application - The ID of the application for which to generate comments.
   * @param {string[]} params.questions - A set of questions that were part of the application.
   * @param {string[]} params.rubric - A set of rubric items to guide the AI's evaluation.
   * @param {string[]} params.eligibilityCriteria - A set of criteria defining applicant eligibility.
   * @returns {Promise<Empty | {error: string}>}
   *   Returns an empty object on successful generation and storage of comments,
   *   or an object with an `error` message if the application is not found, LLM fails, or storage fails.
   */
  async generateAIComments(
    { application, questions, rubric, eligibilityCriteria }: {
      application: Application;
      questions: string[];
      rubric: string[];
      eligibilityCriteria: string[];
    },
  ): Promise<Empty | { error: string }> {
    // Preconditions check
    const existingApplication = await this.applications.findOne({
      _id: application,
    });
    if (!existingApplication) {
      return { error: `Application with ID '${application}' not found.` };
    }

    // Effects: Delete existing AIComments for this application first
    try {
      await this.aiComments.deleteMany({ application: application });
    } catch (e: any) {
      console.error("Error deleting existing AI comments:", e);
      return { error: `Failed to clear existing AI comments: ${e.message}` };
    }

    // Call LLM utility to generate new comments
    const llmResult = await llm.generateComments(
      existingApplication.answers,
      questions,
      rubric,
      eligibilityCriteria,
    );

    if ("error" in llmResult) {
      return { error: `LLM failed to generate comments: ${llmResult.error}` };
    }

    const newAIComments: AICommentDocument[] = llmResult.map((comment) => ({
      _id: freshID(), // Each comment needs its own unique ID
      application: application,
      category: comment.category,
      quotedSnippet: comment.quotedSnippet,
      justification: comment.justification,
    }));

    // Effects: Insert new AIComments
    if (newAIComments.length > 0) {
      try {
        await this.aiComments.insertMany(newAIComments);
      } catch (e: any) {
        console.error("Error inserting new AI comments:", e);
        return { error: `Failed to insert new AI comments: ${e.message}` };
      }
    }

    return {}; // Return empty object on success
  }

  /**
   * @query _getApplicationsByEvent
   *
   * Retrieves all application documents associated with a specific event.
   * This is a query method, indicated by the leading underscore.
   *
   * @param {Object} params - The query parameters.
   * @param {Event} params.event - The ID of the event to filter applications by.
   * @returns {Promise<ApplicationDocument[] | {error: string}>}
   *   Returns an array of `ApplicationDocument` objects on success,
   *   or an object with an `error` message if a database error occurs.
   */
  async _getApplicationsByEvent(
    { event }: { event: Event },
  ): Promise<ApplicationDocument[] | { error: string }> {
    try {
      const applications = await this.applications.find({ event }).toArray();
      return applications;
    } catch (e: any) {
      console.error("Error retrieving applications by event:", e);
      return { error: `Failed to retrieve applications: ${e.message}` };
    }
  }

  /**
   * @query _getAICommentsForApplication
   *
   * Retrieves all AI-generated comment documents for a specific application.
   *
   * @param {Object} params - The query parameters.
   * @param {Application} params.application - The ID of the application to retrieve comments for.
   * @returns {Promise<AICommentDocument[] | {error: string}>}
   *   Returns an array of `AICommentDocument` objects on success,
   *   or an object with an `error` message if a database error occurs.
   */
  async _getAICommentsForApplication(
    { application }: { application: Application },
  ): Promise<AICommentDocument[] | { error: string }> {
    try {
      const comments = await this.aiComments.find({ application }).toArray();
      return comments;
    } catch (e: any) {
      console.error("Error retrieving AI comments for application:", e);
      return { error: `Failed to retrieve AI comments: ${e.message}` };
    }
  }

  /**
   * @query _getApplication
   *
   * Retrieves a single application document by its ID.
   *
   * @param {Object} params - The query parameters.
   * @param {Application} params.application - The ID of the application to retrieve.
   * @returns {Promise<ApplicationDocument | null | {error: string}>}
   *   Returns the `ApplicationDocument` if found, `null` if not found,
   *   or an object with an `error` message if a database error occurs.
   */
  async _getApplication(
    { application }: { application: Application },
  ): Promise<ApplicationDocument | null | { error: string }> {
    try {
      const app = await this.applications.findOne({ _id: application });
      return app;
    } catch (e: any) {
      console.error("Error retrieving application:", e);
      return { error: `Failed to retrieve application: ${e.message}` };
    }
  }
}
```
