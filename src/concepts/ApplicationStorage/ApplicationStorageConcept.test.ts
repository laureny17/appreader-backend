import { assert, assertArrayIncludes, assertEquals } from "jsr:@std/assert";
import { testDb } from "@utils/database.ts";
import { ID } from "@utils/types.ts";
import ApplicationStorageConcept from "./ApplicationStorageConcept.ts";

// Mock implementation for GeminiLLM to avoid actual API calls during tests
class MockGeminiLLM {
  private mockResponse: string;

  constructor(initialResponse?: string) {
    // Default response simulating successful AI comment generation
    this.mockResponse = initialResponse || JSON.stringify([
      {
        category: "Strong",
        quotedSnippet:
          "I led a team project that delivered results ahead of schedule.",
        justification: "Demonstrates strong leadership and execution skills.",
      },
      {
        category: "Weak",
        quotedSnippet: "I prefer to work alone and avoid team projects.",
        justification:
          "Indicates a lack of teamwork and collaboration ability.",
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
    "I am a student at Example University, currently in my third year.",
  ];
  const questions = [
    "Why do you want to join?",
    "Tell us about your experience.",
    "What is your academic status?",
  ];
  const rubric = ["Innovation", "Teamwork", "Academic Standing"];
  const eligibilityCriteria = ["Must be an enrolled university student"];
  const adder = "user:admin-id" as ID; // Adder is a string ID, actual admin checks are for syncs

  let createdApplicationId: ID; // To store the application ID for subsequent steps

  await t.step(
    "addApplication: Successfully adds a new application",
    async () => {
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

      createdApplicationId =
        (addResult as { application: ID; event: ID }).application;
      const returnedEventId =
        (addResult as { application: ID; event: ID }).event;

      assertEquals(
        returnedEventId,
        testEventId,
        "Returned event ID should match input event ID",
      );
      assert(createdApplicationId, "A new application ID should be returned");

      // Verify the application exists in the database
      const storedApplication = await applicationStorage._getApplication({
        application: createdApplicationId,
      });
      assert(storedApplication, "Application should be found in the database");
      assertEquals(storedApplication._id, createdApplicationId);
      assertEquals(storedApplication.applicantID, applicantID);
      assertArrayIncludes(storedApplication.answers, answers);
      assertEquals(storedApplication.event, testEventId);

      // Modularity check: The stored application should contain the expected properties
      const expectedFields = [
        "_id", "event", "applicantID", "applicantYear", "answers",
        "flagged", "flaggedBy", "flaggedAt", "flagReason",
        "disqualified", "disqualificationReason", "disqualifiedBy", "disqualifiedAt",
        "undisqualifiedAt", "undisqualifiedBy", "undisqualificationReason"
      ];
      const actualFields = Object.keys(storedApplication);

      // Check that all expected fields are present
      for (const field of expectedFields) {
        assert(actualFields.includes(field), `Application should have field: ${field}`);
      }

      // Check that flagged fields are initialized correctly
      assertEquals(storedApplication.flagged, false);
      assertEquals(storedApplication.disqualified, false);
    },
  );

  await t.step(
    "addApplication: should return error for invalid inputs",
    async () => {
      // Test with empty applicantID
      const errorResultID = await applicationStorage.addApplication({
        adder,
        event: testEventId,
        applicantID: "",
        applicantYear,
        answers,
      });
      assert(
        "error" in errorResultID,
        "Should return an error for empty applicantID",
      );
      assertEquals(
        (errorResultID as { error: string }).error,
        "Applicant ID cannot be empty.",
      );

      // Test with empty applicantYear
      const errorResultYear = await applicationStorage.addApplication({
        adder,
        event: testEventId,
        applicantID,
        applicantYear: " ", // Contains only whitespace
        answers,
      });
      assert(
        "error" in errorResultYear,
        "Should return an error for empty applicantYear",
      );
      assertEquals(
        (errorResultYear as { error: string }).error,
        "Applicant Year cannot be empty.",
      );

      // Test with empty answers array
      const errorResultAnswers = await applicationStorage.addApplication({
        adder,
        event: testEventId,
        applicantID,
        applicantYear,
        answers: [],
      });
      assert(
        "error" in errorResultAnswers,
        "Should return an error for empty answers",
      );
      assertEquals(
        (errorResultAnswers as { error: string }).error,
        "Answers cannot be empty.",
      );
    },
  );

  await t.step(
    "generateAIComments: Successfully generates and stores AI comments",
    async () => {
      // Action: Generate AI comments for the created application
      const generateResult = await applicationStorage.generateAIComments({
        application: createdApplicationId,
        questions,
        rubric,
        eligibilityCriteria,
      });

      // Verification: Check if comments were generated and stored
      assert(
        generateResult,
        "Generate AI comments result should not be undefined",
      );
      if ("error" in generateResult) {
        assert(
          false,
          `generateAIComments failed with error: ${generateResult.error}`,
        );
      }
      assertEquals(
        Object.keys(generateResult).length,
        0,
        "Should return an empty object on success",
      );

      // Retrieve comments using the query to confirm they are in the state
      const storedComments = await applicationStorage
        ._getAICommentsByApplication({ application: createdApplicationId });
      assert(
        storedComments.length > 0,
        "AI comments should be found in the database",
      );
      assertEquals(
        storedComments.length,
        2,
        "Should have 2 comments from mock LLM's default response",
      );

      // Verify content and structure of comments (separation of concerns, purpose focus)
      const comment1 = storedComments[0];
      assert(comment1._id, "Each AI comment should have its own ID");
      assertEquals(comment1.application, createdApplicationId);
      assertEquals(comment1.category, "Strong");
      assert(
        comment1.quotedSnippet.includes("led a team project"),
        "Snippet should match mock response content",
      );
      assert(
        comment1.justification.includes("leadership and execution"),
        "Justification should match mock response content",
      );

      const comment2 = storedComments[1];
      assertEquals(comment2.application, createdApplicationId);
      assertEquals(comment2.category, "Weak");
      assert(
        comment2.quotedSnippet.includes("prefer to work alone"),
        "Snippet should match mock response content",
      );
      assert(
        comment2.justification.includes("lack of teamwork"),
        "Justification should match mock response content",
      );

      // Modularity check: AI comments only contain properties related to their purpose
      assertEquals(
        Object.keys(comment1).length,
        5,
        "AIComment document should have only 5 fields (_id, application, category, quotedSnippet, justification)",
      );
    },
  );

  await t.step(
    "generateAIComments: Re-generates and replaces existing AI comments (robustness)",
    async () => {
      // Change the mock LLM response for re-generation to simulate an update
      mockLLM.setMockResponse(JSON.stringify([
        {
          category: "Attention",
          quotedSnippet: "My previous experience includes leading a team.",
          justification:
            "Highlights prior experience, which needs attention to detail.",
        },
      ]));

      // Action: Re-generate AI comments for the same application
      const regenerateResult = await applicationStorage.generateAIComments({
        application: createdApplicationId,
        questions,
        rubric: ["Experience", "Attention to Detail"], // Potentially different rubric for regeneration
        eligibilityCriteria,
      });

      assert(
        regenerateResult,
        "Regenerate AI comments result should not be undefined",
      );
      if ("error" in regenerateResult) {
        assert(
          false,
          `regenerateAIComments failed with error: ${regenerateResult.error}`,
        );
      }
      assertEquals(
        Object.keys(regenerateResult).length,
        0,
        "Should return an empty object on success",
      );

      // Verification: Check if old comments are replaced by new ones
      const updatedComments = await applicationStorage
        ._getAICommentsByApplication({ application: createdApplicationId });
      assertEquals(
        updatedComments.length,
        1,
        "There should be only 1 comment after re-generation, replacing old ones",
      );

      const newComment = updatedComments[0];
      assertEquals(newComment.application, createdApplicationId);
      assertEquals(newComment.category, "Attention");
      assert(
        newComment.quotedSnippet.includes("previous experience"),
        "Snippet should match new mock response content",
      );
      assert(
        newComment.justification.includes("attention to detail"),
        "Justification should match new mock response content",
      );
    },
  );

  await t.step(
    "generateAIComments: Handles non-existent application gracefully (simplicity/robustness)",
    async () => {
      const nonExistentAppId: ID = "application:non-existent-123" as ID;
      const errorResult = await applicationStorage.generateAIComments({
        application: nonExistentAppId,
        questions,
        rubric,
        eligibilityCriteria,
      });

      assert(
        "error" in errorResult,
        "Should return an error for non-existent application",
      );
      assertEquals(
        (errorResult as { error: string }).error,
        `Application with ID ${nonExistentAppId} not found.`,
      );
    },
  );

  await t.step(
    "generateAIComments: Filters invalid categories and truncates long justifications",
    async () => {
      mockLLM.setMockResponse(JSON.stringify([
        {
          category: "InvalidCategory", // Invalid category
          quotedSnippet: "This is a snippet with an invalid category.",
          justification: "Short justification.",
        },
        {
          category: "Strong",
          quotedSnippet: "Another valid snippet, but long justification.",
          justification:
            "This justification is intentionally very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very very much so that it is truncated.",
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

      const filteredComments = await applicationStorage
        ._getAICommentsByApplication({ application: createdApplicationId });
      assertEquals(
        filteredComments.length,
        3,
        "Only 3 comments should be stored after filtering (invalid category, empty snippet, duplicates excluded).",
      );

      // Verify the truncated justification
      const longJustificationComment = filteredComments.find((c) =>
        c.quotedSnippet === "Another valid snippet, but long justification."
      );
      assert(
        longJustificationComment,
        "Comment with long justification should exist.",
      );
      assertEquals(
        longJustificationComment.justification.length,
        150,
        "Justification should be truncated to 150 characters.",
      );
      assert(
        longJustificationComment.justification.endsWith("..."),
        "Truncated justification should end with '...'.",
      );

      // Verify a valid comment is present
      const validComment = filteredComments.find((c) =>
        c.quotedSnippet === "Valid snippet."
      );
      assert(validComment, "Fully valid comment should be present.");

      // No comment with "InvalidCategory" should be present
      const invalidCategoryComment = filteredComments.find((c) =>
        c.quotedSnippet === "This is a snippet with an invalid category."
      );
      assertEquals(
        invalidCategoryComment,
        undefined,
        "Comment with invalid category should have been skipped.",
      );

      // No comment with empty snippet should be present
      const emptySnippetComment = filteredComments.find((c) =>
        c.quotedSnippet === ""
      );
      assertEquals(
        emptySnippetComment,
        undefined,
        "Comment with empty snippet should have been skipped.",
      );

      // Only one instance of "Duplicate snippet." should be present
      const duplicateSnippetComments = filteredComments.filter((c) =>
        c.quotedSnippet === "Duplicate snippet."
      );
      assertEquals(
        duplicateSnippetComments.length,
        1,
        "Only one instance of each duplicate snippet should remain.",
      );
    },
  );

  await t.step(
    "_getApplicationsByEvent returns all applications for an event",
    async () => {
      // Add another application for the same event
      const application2Result = await applicationStorage.addApplication({
        adder,
        event: testEventId,
        applicantID: "applicant:john-doe",
        applicantYear: "2025",
        answers: ["Answer 1", "Answer 2"],
      });

      assert("application" in application2Result, "Should return application");
      const application2Id = application2Result.application;

      // Get all applications for the event
      const applications = await applicationStorage._getApplicationsByEvent({
        event: testEventId,
      });

      assertEquals(applications.length, 2, "Should have 2 applications");

      // Verify the applications exist
      const applicationIds = applications.map((app) => app._id);
      assert(applicationIds.includes(createdApplicationId), "Should include first application");
      assert(applicationIds.includes(application2Id), "Should include second application");
    },
  );

  // Cleanup
  await client.close();
});

Deno.test("ApplicationStorageConcept: _bulkImportApplications", async (t) => {
  const [db, client] = await testDb();
  const mockLLM = new MockGeminiLLM();
  const applicationStorage = new ApplicationStorageConcept(db, mockLLM as any);

  // Setup test data
  const adminUser = "admin:user" as ID;
  const normalUser = "normal:user" as ID;
  const eventId = "event:test" as ID;
  const questions = ["Question 1", "Question 2", "Question 3"];

  // Clear collections
  await db.collection("ApplicationStorage.applications").deleteMany({});
  await db.collection("EventDirectory.events").deleteMany({});
  await db.collection("EventDirectory.admins").deleteMany({});

  // Create event and admin
  await db.collection("EventDirectory.events").insertOne({
    _id: eventId as any,
    name: "Test Event",
    questions: questions,
    rubric: ["Rubric 1", "Rubric 2"],
    eligibilityCriteria: ["Criteria 1"],
    active: true,
  });

  await db.collection("EventDirectory.admins").insertOne({
    _id: adminUser as any,
  });

  await t.step(
    "successfully imports valid applications",
    async () => {
      const applications = [
        {
          applicantID: "APP001",
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
        {
          applicantID: "APP002",
          applicantYear: "2025",
          answers: ["Answer A", "Answer B", "Answer C"],
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: eventId,
        applications,
        importedBy: adminUser,
      });

      assert("success" in result, "Should return success");
      assertEquals(result.importedCount, 2, "Should import 2 applications");
      assertEquals(result.errors.length, 0, "Should have no errors");

      // Verify applications were created
      const createdApps = await applicationStorage._getApplicationsByEvent({ event: eventId });
      assertEquals(createdApps.length, 2, "Should have 2 applications in database");
    },
  );

  await t.step(
    "handles partial failures gracefully",
    async () => {
      const applications = [
        {
          applicantID: "APP003",
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
        {
          applicantID: "APP001", // Duplicate - should fail
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
        {
          applicantID: "APP004",
          applicantYear: "2025",
          answers: ["Answer A", "Answer B", "Answer C"],
        },
        {
          applicantID: "", // Invalid - should fail
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: eventId,
        applications,
        importedBy: adminUser,
      });

      assert("success" in result, "Should return success");
      assertEquals(result.importedCount, 2, "Should import 2 valid applications");
      assertEquals(result.errors.length, 2, "Should have 2 errors");

      // Check specific errors
      const duplicateError = result.errors.find(e => e.applicantID === "APP001");
      assert(duplicateError, "Should have duplicate error");
      assertEquals(duplicateError.error, "ApplicantID already exists in this event");

      const missingError = result.errors.find(e => e.applicantID === "unknown");
      assert(missingError, "Should have missing applicantID error");
      assertEquals(missingError.error, "Missing applicantID");
    },
  );

  await t.step(
    "validates answers count matches questions count",
    async () => {
      const applications = [
        {
          applicantID: "APP_COUNT_005",
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2"], // Wrong count - should fail
        },
        {
          applicantID: "APP_COUNT_006",
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3", "Answer 4"], // Wrong count - should fail
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: eventId,
        applications,
        importedBy: adminUser,
      });

      assert("success" in result, "Should return success");
      assertEquals(result.importedCount, 0, "Should import 0 applications");
      assertEquals(result.errors.length, 2, "Should have 2 errors");

      // Check specific errors
      const error1 = result.errors.find(e => e.applicantID === "APP_COUNT_005");
      assert(error1, "Should have answers count error for APP_COUNT_005");
      assert(error1.error.includes("Answers count (2) doesn't match questions count (3)"), "Should mention count mismatch");

      const error2 = result.errors.find(e => e.applicantID === "APP_COUNT_006");
      assert(error2, "Should have answers count error for APP_COUNT_006");
      assert(error2.error.includes("Answers count (4) doesn't match questions count (3)"), "Should mention count mismatch");
    },
  );

  await t.step(
    "rejects non-admin users",
    async () => {
      const applications = [
        {
          applicantID: "APP007",
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: eventId,
        applications,
        importedBy: normalUser,
      });

      assert("error" in result, "Should return error");
      assertEquals(result.error, "User is not admin");
    },
  );

  await t.step(
    "rejects non-existent events",
    async () => {
      const nonExistentEvent = "event:nonexistent" as ID;
      const applications = [
        {
          applicantID: "APP008",
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: nonExistentEvent,
        applications,
        importedBy: adminUser,
      });

      assert("error" in result, "Should return error");
      assertEquals(result.error, "Event not found");
    },
  );

  await t.step(
    "rejects events with no questions",
    async () => {
      const eventWithoutQuestions = "event:noquestions" as ID;

      await db.collection("EventDirectory.events").insertOne({
        _id: eventWithoutQuestions as any,
        name: "Event Without Questions",
        questions: [], // No questions
        rubric: [],
        eligibilityCriteria: [],
        active: true,
      });

      const applications = [
        {
          applicantID: "APP009",
          applicantYear: "2024",
          answers: ["Answer 1"],
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: eventWithoutQuestions,
        applications,
        importedBy: adminUser,
      });

      assert("error" in result, "Should return error");
      assertEquals(result.error, "Event has no questions configured");
    },
  );

  await t.step(
    "returns error when no valid applications",
    async () => {
      const applications = [
        {
          applicantID: "", // Invalid
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
        {
          applicantID: "APP001", // Duplicate
          applicantYear: "2024",
          answers: ["Answer 1", "Answer 2", "Answer 3"],
        },
      ];

      const result = await applicationStorage._bulkImportApplications({
        event: eventId,
        applications,
        importedBy: adminUser,
      });

      assert("success" in result, "Should return success");
      assertEquals(result.importedCount, 0, "Should import 0 applications");
      assertEquals(result.errors.length, 2, "Should have 2 errors");
    },
  );

  await client.close();
});

Deno.test("ApplicationStorageConcept: Admin Flagged Applications Management", async (t) => {
  const [db, client] = await testDb();
  const mockLLM = new MockGeminiLLM();
  const applicationStorage = new ApplicationStorageConcept(db, mockLLM as any);

  // Setup test data
  const adminUser = "admin:user" as ID;
  const normalUser = "normal:user" as ID;
  const flaggerUser = "flagger:user" as ID;
  const eventId = "event:test" as ID;
  const questions = ["Question 1", "Question 2"];

  // Clear collections
  await db.collection("ApplicationStorage.applications").deleteMany({});
  await db.collection("EventDirectory.events").deleteMany({});
  await db.collection("EventDirectory.admins").deleteMany({});

  // Create event and admin
  await db.collection("EventDirectory.events").insertOne({
    _id: eventId as any,
    name: "Test Event",
    questions: questions,
    rubric: ["Rubric 1"],
    eligibilityCriteria: ["Criteria 1"],
    active: true,
  });

  await db.collection("EventDirectory.admins").insertOne({
    _id: adminUser as any,
  });

  // Create test applications
  const app1Result = await applicationStorage.addApplication({
    adder: adminUser,
    event: eventId,
    applicantID: "APP001",
    applicantYear: "2024",
    answers: ["Answer 1", "Answer 2"],
  });

  const app2Result = await applicationStorage.addApplication({
    adder: adminUser,
    event: eventId,
    applicantID: "APP002",
    applicantYear: "2025",
    answers: ["Answer A", "Answer B"],
  });

  assert("application" in app1Result);
  assert("application" in app2Result);
  const app1Id = app1Result.application;
  const app2Id = app2Result.application;

  // Create reviews for the applications (needed for red flags)
  const review1Id = "review:1" as ID;
  const review2Id = "review:2" as ID;

  await db.collection("ReviewRecords.reviews").insertMany([
    {
      _id: review1Id as any,
      application: app1Id,
      author: flaggerUser,
      submittedAt: new Date("2024-01-01T10:00:00Z"),
    },
    {
      _id: review2Id as any,
      application: app2Id,
      author: flaggerUser,
      submittedAt: new Date("2024-01-02T10:00:00Z"),
    },
  ]);

  // Create red flags for the reviews
  const flag1Id = "flag:1" as ID;
  const flag2Id = "flag:2" as ID;

  await db.collection("ReviewRecords.redFlags").insertMany([
    {
      _id: flag1Id as any,
      review: review1Id,
      author: flaggerUser,
    },
    {
      _id: flag2Id as any,
      review: review2Id,
      author: flaggerUser,
    },
  ]);

  await t.step(
    "_getFlaggedApplications returns all flagged applications",
    async () => {
      const result = await applicationStorage._getFlaggedApplications({ event: eventId });

      assert(Array.isArray(result), "Should return array");
      assertEquals(result.length, 2, "Should have 2 flagged applications");

      // Check sorting (newest first)
      assertEquals(result[0].applicantID, "APP002", "Should be sorted by flaggedAt desc");
      assertEquals(result[1].applicantID, "APP001", "Should be sorted by flaggedAt desc");

      // Check flagging details
      const app1 = result.find(r => r.applicantID === "APP001");
      assert(app1, "Should find APP001");
      assertEquals(app1.flaggedBy, flaggerUser);
      assertEquals(app1.flagReason, "Flagged by reader");
      assertEquals(app1.disqualified, false, "Should not be disqualified initially");
    },
  );

  await t.step(
    "_disqualifyApplication successfully disqualifies flagged application",
    async () => {
      const disqualifyDate = new Date("2024-01-03T10:00:00Z");
      const result = await applicationStorage._disqualifyApplication({
        application: app1Id,
        reason: "Confirmed inappropriate content",
        disqualifiedBy: adminUser,
        disqualifiedAt: disqualifyDate,
      });

      assert("success" in result, "Should return success");

      // Verify application was updated
      const updatedApp = await db.collection("ApplicationStorage.applications").findOne({ _id: app1Id });
      assert(updatedApp, "Application should exist");
      assertEquals(updatedApp.disqualified, true);
      assertEquals(updatedApp.disqualificationReason, "Confirmed inappropriate content");
      assertEquals(updatedApp.disqualifiedBy, adminUser);
      assertEquals(updatedApp.disqualifiedAt?.toISOString(), disqualifyDate.toISOString());
    },
  );

  await t.step(
    "_removeFlag successfully removes flag from flagged application",
    async () => {
      const removeDate = new Date("2024-01-04T10:00:00Z");
      const result = await applicationStorage._removeFlag({
        application: app2Id,
        removedBy: adminUser,
        removedAt: removeDate,
      });

      assert("success" in result, "Should return success");

      // Verify flags were removed from ReviewRecords
      const remainingFlags = await db.collection("ReviewRecords.redFlags").find({
        review: review2Id,
      }).toArray();
      assertEquals(remainingFlags.length, 0, "Flags should be removed from ReviewRecords");
    },
  );

  await t.step(
    "_getDisqualifiedApplications returns disqualified applications",
    async () => {
      const result = await applicationStorage._getDisqualifiedApplications({ event: eventId });

      assert(Array.isArray(result), "Should return array");
      assertEquals(result.length, 1, "Should have 1 disqualified application");

      const disqualifiedApp = result[0];
      assertEquals(disqualifiedApp.applicantID, "APP001");
      assertEquals(disqualifiedApp.disqualificationReason, "Confirmed inappropriate content");
      assertEquals(disqualifiedApp.disqualifiedBy, adminUser);
    },
  );

  await t.step(
    "_undisqualifyApplication successfully un-disqualifies application",
    async () => {
      const undisqualifyDate = new Date("2024-01-05T10:00:00Z");
      const result = await applicationStorage._undisqualifyApplication({
        application: app1Id,
        undisqualifiedBy: adminUser,
        reason: "Mistaken disqualification",
      });

      assert("success" in result, "Should return success");
      assertEquals(result.message, "Application un-disqualified successfully");

      // Verify application was updated
      const updatedApp = await db.collection("ApplicationStorage.applications").findOne({ _id: app1Id });
      assert(updatedApp, "Application should exist");
      assertEquals(updatedApp.disqualified, false, "Should no longer be disqualified");
      assertEquals(updatedApp.disqualificationReason, null, "Disqualification reason should be cleared");
      assertEquals(updatedApp.disqualifiedAt, null, "DisqualifiedAt should be cleared");
      assertEquals(updatedApp.disqualifiedBy, null, "DisqualifiedBy should be cleared");
      assertEquals(updatedApp.undisqualifiedBy, adminUser, "Should record who un-disqualified");
      assertEquals(updatedApp.undisqualificationReason, "Mistaken disqualification", "Should record reason");
      assert(updatedApp.undisqualifiedAt instanceof Date, "Should record when it was un-disqualified");
    },
  );

  await t.step(
    "_undisqualifyApplication rejects non-disqualified application",
    async () => {
      const result = await applicationStorage._undisqualifyApplication({
        application: app2Id, // Not disqualified
        undisqualifiedBy: adminUser,
        reason: "Test reason",
      });

      assert("error" in result, "Should return error");
      assertEquals(result.error, "Application is not currently disqualified");
    },
  );

  await t.step(
    "_undisqualifyApplication rejects non-admin user",
    async () => {
      // First disqualify app2 for this test
      await db.collection("ApplicationStorage.applications").updateOne(
        { _id: app2Id },
        {
          $set: {
            disqualified: true,
            disqualificationReason: "Test disqualification",
            disqualifiedBy: adminUser,
            disqualifiedAt: new Date(),
          },
        },
      );

      const result = await applicationStorage._undisqualifyApplication({
        application: app2Id,
        undisqualifiedBy: normalUser,
        reason: "Test reason",
      });

      assert("error" in result, "Should return error");
      assertEquals(result.error, "Admin authorization required");
    },
  );

  await t.step(
    "_undisqualifyApplication uses default reason when none provided",
    async () => {
      const result = await applicationStorage._undisqualifyApplication({
        application: app2Id,
        undisqualifiedBy: adminUser,
        // No reason provided
      });

      assert("success" in result, "Should return success");

      // Verify default reason was used
      const updatedApp = await db.collection("ApplicationStorage.applications").findOne({ _id: app2Id });
      assert(updatedApp, "Application should exist");
      assertEquals(updatedApp.undisqualificationReason, "Un-disqualified by admin", "Should use default reason");
    },
  );

  await t.step(
    "_undisqualifyApplication preserves flagging status",
    async () => {
      // Verify that flagging status is preserved after un-disqualification
      const updatedApp = await db.collection("ApplicationStorage.applications").findOne({ _id: app1Id });
      assert(updatedApp, "Application should exist");

      // The application should still be flagged (flags are in ReviewRecords)
      const reviews = await db.collection("ReviewRecords.reviews").find({
        application: app1Id,
      }).toArray();
      const reviewIds = reviews.map(review => review._id);
      const redFlags = await db.collection("ReviewRecords.redFlags").find({
        review: { $in: reviewIds },
      }).toArray();

      assert(redFlags.length > 0, "Application should still be flagged after un-disqualification");
    },
  );

  await client.close();
});
