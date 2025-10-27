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

      // Modularity check: The stored application should only contain its specified properties
      assertEquals(
        Object.keys(storedApplication).length,
        5,
        "Application document should have only 5 fields (_id, event, applicantID, applicantYear, answers)",
      );
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
