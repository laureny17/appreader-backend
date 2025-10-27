import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { ID } from "@utils/types.ts";
import { freshID, testDb } from "@utils/database.ts";
import ReviewRecordsConcept from "./ReviewRecordsConcept.ts";

// Helper type for direct DB queries to ensure we're getting the right structure
interface ReviewDoc {
  _id: ID;
  application: ID;
  author: ID;
  submittedAt: Date;
}

interface ScoreDoc {
  _id: ID;
  review: ID;
  criterion: string;
  value: number;
}

interface RedFlagDoc {
  _id: ID;
  review: ID;
  author: ID;
}

interface CommentDoc {
  _id: ID;
  review: ID;
  author: ID;
  text: string;
  quotedSnippet: string;
}

Deno.test("ReviewRecords Concept", async (t) => {
  // Test Case: Fulfills principle: user can submit, edit, flag, and comment on reviews
  await t.step(
    "fulfills principle: user can submit, edit, flag, and comment on reviews",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      // --- Setup Test Data ---
      const userId = freshID() as ID;
      const appId = freshID() as ID;
      const initialDate = new Date("2023-01-15T10:00:00Z");
      const updatedDate = new Date("2023-01-15T11:00:00Z"); // submittedAt should not change on edit

      // --- Action 1: Submit a review ---
      // principle: "A user can submit a review for an application"
      const submitResult = await reviewRecords.submitReview({
        author: userId,
        application: appId,
        currentTime: initialDate,
      });

      // Assert submission was successful
      if ("error" in submitResult) {
        throw new Error(`submitReview failed: ${submitResult.error}`);
      }
      const reviewId = submitResult.review;
      assertExists(reviewId);

      // Verify the review exists in the database
      const storedReview = await db.collection<ReviewDoc>(
        "ReviewRecords.reviews",
      ).findOne({ _id: reviewId });
      assertExists(storedReview);
      assertEquals(storedReview.author, userId);
      assertEquals(storedReview.application, appId);
      assertEquals(
        storedReview.submittedAt.toISOString(),
        initialDate.toISOString(),
      );
      console.log("Submit Review: OK");

      // --- Action 2: Set an initial score for the review ---
      const setScoreResult1 = await reviewRecords.setScore({
        author: userId,
        review: reviewId,
        criterion: "easeOfUse",
        value: 4,
      });

      // Assert score setting was successful
      if ("error" in setScoreResult1) {
        throw new Error(`setScore failed: ${setScoreResult1.error}`);
      }
      assertEquals(setScoreResult1.application, appId);

      // Verify the score exists in the database
      const storedScore1 = await db.collection<ScoreDoc>(
        "ReviewRecords.scores",
      ).findOne({ review: reviewId, criterion: "easeOfUse" });
      assertExists(storedScore1);
      assertEquals(storedScore1.value, 4);
      console.log("Set Initial Score: OK");

      // --- Action 3: Edit the review (conceptual step, then update scores) ---
      // principle: "and overwrite their past reviews with edits."
      const editReviewResult = await reviewRecords.editReview({
        editor: userId,
        review: reviewId,
      });
      if ("error" in editReviewResult) {
        throw new Error(`editReview failed: ${editReviewResult.error}`);
      }
      assertEquals(editReviewResult.success, true);

      // Verify `submittedAt` was NOT changed by `editReview`
      const reviewAfterEdit = await db.collection<ReviewDoc>(
        "ReviewRecords.reviews",
      ).findOne({ _id: reviewId });
      assertExists(reviewAfterEdit);
      assertEquals(
        reviewAfterEdit.submittedAt.toISOString(),
        initialDate.toISOString(),
      );
      console.log("Edit Review (permission): OK");

      // --- Action 4: Update the existing score after an "edit" ---
      const setScoreResult2 = await reviewRecords.setScore({
        author: userId,
        review: reviewId,
        criterion: "easeOfUse",
        value: 5, // New value
      });
      if ("error" in setScoreResult2) {
        throw new Error(`setScore (update) failed: ${setScoreResult2.error}`);
      }
      assertEquals(setScoreResult2.application, appId);

      // Verify the score was updated in the database
      const updatedScore = await db.collection<ScoreDoc>(
        "ReviewRecords.scores",
      ).findOne({ review: reviewId, criterion: "easeOfUse" });
      assertExists(updatedScore);
      assertEquals(updatedScore.value, 5); // Should be 5 now
      console.log("Update Existing Score after Edit: OK");

      // --- Action 5: Add a new score after an "edit" ---
      const setScoreResult3 = await reviewRecords.setScore({
        author: userId,
        review: reviewId,
        criterion: "features",
        value: 3,
      });
      if ("error" in setScoreResult3) {
        throw new Error(
          `setScore (new criterion) failed: ${setScoreResult3.error}`,
        );
      }
      assertEquals(setScoreResult3.application, appId);

      // Verify the new score exists in the database
      const newScore = await db.collection<ScoreDoc>(
        "ReviewRecords.scores",
      ).findOne({ review: reviewId, criterion: "features" });
      assertExists(newScore);
      assertEquals(newScore.value, 3);
      console.log("Add New Score after Edit: OK");

      // --- Action 6: Add a red flag ---
      // principle: "They can also add a flag to a review"
      const addFlagResult = await reviewRecords.addRedFlag({
        author: userId, // The author of the review is flagging their own review
        review: reviewId,
      });

      // Assert flag addition was successful
      if ("error" in addFlagResult) {
        throw new Error(`addRedFlag failed: ${addFlagResult.error}`);
      }
      const flagId = addFlagResult.flag;
      assertExists(flagId);

      // Verify the red flag exists in the database
      const storedFlag = await db.collection<RedFlagDoc>(
        "ReviewRecords.redFlags",
      ).findOne({ _id: flagId });
      assertExists(storedFlag);
      assertEquals(storedFlag.review, reviewId);
      assertEquals(storedFlag.author, userId);
      console.log("Add Red Flag: OK");

      // --- Action 7: Add a comment ---
      // principle: "and write comments for other users to see."
      const commentText = "Great app overall!";
      const quotedSnippet = "Highly recommend.";
      const addCommentResult = await reviewRecords.addComment({
        author: freshID() as ID, // A different user comments
        review: reviewId,
        text: commentText,
        quotedSnippet: quotedSnippet,
      });

      // Assert comment addition was successful
      if ("error" in addCommentResult) {
        throw new Error(`addComment failed: ${addCommentResult.error}`);
      }
      const commentId = addCommentResult.comment;
      assertExists(commentId);
      const commenterId = addCommentResult.comment; // Store commenter ID for later edit/delete

      // Verify the comment exists in the database
      const storedComment = await db.collection<CommentDoc>(
        "ReviewRecords.comments",
      ).findOne({ _id: commentId });
      assertExists(storedComment);
      assertEquals(storedComment.review, reviewId);
      // NOTE: `addCommentResult.comment` returns the comment ID, not the author.
      // Need to fetch `storedComment` to get the author correctly.
      assertExists(storedComment.author); // Ensure author exists
      assertEquals(storedComment.text, commentText);
      assertEquals(storedComment.quotedSnippet, quotedSnippet);
      console.log("Add Comment: OK");

      // --- Action 8: Edit the comment ---
      const newCommentText = "Really great app, actually!";
      const editCommentResult = await reviewRecords.editComment({
        author: storedComment.author, // Use the actual commenter's ID
        comment: commentId,
        newText: newCommentText,
      });
      if ("error" in editCommentResult) {
        throw new Error(`editComment failed: ${editCommentResult.error}`);
      }
      assertEquals(editCommentResult.success, true);

      // Verify the comment text was updated
      const updatedComment = await db.collection<CommentDoc>(
        "ReviewRecords.comments",
      ).findOne({ _id: commentId });
      assertExists(updatedComment);
      assertEquals(updatedComment.text, newCommentText);
      assertEquals(updatedComment.quotedSnippet, quotedSnippet); // quotedSnippet remains unchanged
      console.log("Edit Comment: OK");

      // --- Action 9: Remove the red flag ---
      const removeFlagResult = await reviewRecords.removeRedFlag({
        author: userId,
        review: reviewId,
      });
      if ("error" in removeFlagResult) {
        throw new Error(`removeRedFlag failed: ${removeFlagResult.error}`);
      }
      assertEquals(removeFlagResult.success, true);

      // Verify the red flag is deleted
      const deletedFlag = await db.collection<RedFlagDoc>(
        "ReviewRecords.redFlags",
      ).findOne({ _id: flagId });
      assertEquals(deletedFlag, null);
      console.log("Remove Red Flag: OK");

      // --- Action 10: Delete the comment ---
      const deleteCommentResult = await reviewRecords.deleteComment({
        author: storedComment.author, // Use the actual commenter's ID
        comment: commentId,
      });
      if ("error" in deleteCommentResult) {
        throw new Error(`deleteComment failed: ${deleteCommentResult.error}`);
      }
      assertEquals(deleteCommentResult.success, true);

      // Verify the comment is deleted
      const deletedComment = await db.collection<CommentDoc>(
        "ReviewRecords.comments",
      ).findOne({ _id: commentId });
      assertEquals(deletedComment, null);
      console.log("Delete Comment: OK");

      await client.close();
    },
  );

  // --- Additional Error/Requirement-focused Tests ---

  await t.step(
    "submitReview prevents duplicate reviews by same author for same application",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const author = freshID() as ID;
      const app = freshID() as ID;
      const date = new Date();

      await reviewRecords.submitReview({
        author,
        application: app,
        currentTime: date,
      });
      const duplicateResult = await reviewRecords.submitReview({
        author,
        application: app,
        currentTime: date,
      });

      if (!("error" in duplicateResult)) {
        throw new Error("Duplicate submitReview should have failed");
      }
      assertExists(duplicateResult.error);
      assertEquals(
        duplicateResult.error,
        "Author has already submitted a review for this application",
      );

      await client.close();
    },
  );

  await t.step(
    "setScore requires author to be the review's author",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const author = freshID() as ID;
      const otherUser = freshID() as ID;
      const app = freshID() as ID;
      const review = (await reviewRecords.submitReview({
        author,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };

      const setScoreResult = await reviewRecords.setScore({
        author: otherUser,
        review: review.review,
        criterion: "criterion1",
        value: 3,
      });

      if (!("error" in setScoreResult)) {
        throw new Error("setScore by non-author should have failed");
      }
      assertExists(setScoreResult.error);
      assertEquals(
        setScoreResult.error,
        "Only the author of the review can set its scores",
      );

      await client.close();
    },
  );

  await t.step(
    "addRedFlag prevents duplicate flags by same author for same review",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const author = freshID() as ID;
      const app = freshID() as ID;
      const review = (await reviewRecords.submitReview({
        author,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };

      await reviewRecords.addRedFlag({ author, review: review.review });
      const duplicateResult = await reviewRecords.addRedFlag({
        author,
        review: review.review,
      });

      if (!("error" in duplicateResult)) {
        throw new Error("Duplicate addRedFlag should have failed");
      }
      assertExists(duplicateResult.error);
      assertEquals(
        duplicateResult.error,
        "Author has already added a red flag to this review",
      );

      await client.close();
    },
  );

  await t.step(
    "addRedFlag only allows review author to flag their own review (as per spec interpretation)",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const reviewAuthor = freshID() as ID;
      const anotherUser = freshID() as ID;
      const app = freshID() as ID;
      const review = (await reviewRecords.submitReview({
        author: reviewAuthor,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };

      const result = await reviewRecords.addRedFlag({
        author: anotherUser,
        review: review.review,
      });

      if (!("error" in result)) {
        throw new Error("Non-author adding red flag should have failed");
      }
      assertExists(result.error);
      assertEquals(
        result.error,
        "Only the author of the review can add a red flag to their own review",
      );

      await client.close();
    },
  );

  await t.step(
    "addComment requires non-empty text and quotedSnippet",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const author = freshID() as ID;
      const app = freshID() as ID;
      const review = (await reviewRecords.submitReview({
        author: author,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };

      const emptyTextResult = await reviewRecords.addComment({
        author: freshID() as ID,
        review: review.review,
        text: " ", // Empty string
        quotedSnippet: "snippet",
      });
      if (!("error" in emptyTextResult)) {
        throw new Error("addComment with empty text should have failed");
      }
      assertEquals(emptyTextResult.error, "Comment text cannot be empty");

      const emptySnippetResult = await reviewRecords.addComment({
        author: freshID() as ID,
        review: review.review,
        text: "text",
        quotedSnippet: " ", // Empty string
      });
      if (!("error" in emptySnippetResult)) {
        throw new Error("addComment with empty snippet should have failed");
      }
      assertEquals(emptySnippetResult.error, "Quoted snippet cannot be empty");

      await client.close();
    },
  );

  await t.step(
    "editComment requires author to be the comment's author",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const reviewAuthor = freshID() as ID;
      const commentAuthor = freshID() as ID;
      const otherUser = freshID() as ID;
      const app = freshID() as ID;
      const review = (await reviewRecords.submitReview({
        author: reviewAuthor,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };
      const comment = (await reviewRecords.addComment({
        author: commentAuthor,
        review: review.review,
        text: "initial",
        quotedSnippet: "q",
      })) as { comment: ID };

      const editResult = await reviewRecords.editComment({
        author: otherUser,
        comment: comment.comment,
        newText: "new text",
      });

      if (!("error" in editResult)) {
        throw new Error("editComment by non-author should have failed");
      }
      assertExists(editResult.error);
      assertEquals(
        editResult.error,
        "Only the author of the comment can edit it",
      );

      await client.close();
    },
  );

  await t.step(
    "deleteComment requires author to be the comment's author",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const reviewAuthor = freshID() as ID;
      const commentAuthor = freshID() as ID;
      const otherUser = freshID() as ID;
      const app = freshID() as ID;
      const review = (await reviewRecords.submitReview({
        author: reviewAuthor,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };
      const comment = (await reviewRecords.addComment({
        author: commentAuthor,
        review: review.review,
        text: "initial",
        quotedSnippet: "q",
      })) as { comment: ID };

      const deleteResult = await reviewRecords.deleteComment({
        author: otherUser,
        comment: comment.comment,
      });

      if (!("error" in deleteResult)) {
        throw new Error("deleteComment by non-author should have failed");
      }
      assertExists(deleteResult.error);
      assertEquals(
        deleteResult.error,
        "Only the author of the comment can delete it",
      );

      await client.close();
    },
  );

  await t.step(
    "_getReviewsWithScoresByApplication returns all reviews and scores for an application",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const author1 = freshID() as ID;
      const author2 = freshID() as ID;
      const app = freshID() as ID;

      // Create two reviews for the same application
      const review1 = (await reviewRecords.submitReview({
        author: author1,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };
      const review2 = (await reviewRecords.submitReview({
        author: author2,
        application: app,
        currentTime: new Date(),
      })) as { review: ID };

      // Add scores to both reviews
      await reviewRecords.setScore({
        author: author1,
        review: review1.review,
        criterion: "quality",
        value: 5,
      });
      await reviewRecords.setScore({
        author: author1,
        review: review1.review,
        criterion: "creativity",
        value: 4,
      });
      await reviewRecords.setScore({
        author: author2,
        review: review2.review,
        criterion: "quality",
        value: 3,
      });

      // Get reviews with scores
      const result = await reviewRecords._getReviewsWithScoresByApplication({ application: app });

      assert("error" in result ? false : true, "Should return reviews");
      if ("error" in result) {
        throw new Error(`Failed: ${result.error}`);
      }
      assertEquals(result.length, 2, "Should have 2 reviews");
      const r1 = result.find((r) => r.author === author1);
      const r2 = result.find((r) => r.author === author2);
      assertExists(r1);
      assertExists(r2);
      assertEquals(r1!.scores.length, 2, "First review should have 2 scores");
      assertEquals(r2!.scores.length, 1, "Second review should have 1 score");
      assertEquals(r1!.scores.find((s) => s.criterion === "quality")?.value, 5);
      assertEquals(r1!.scores.find((s) => s.criterion === "creativity")?.value, 4);
      assertEquals(r2!.scores.find((s) => s.criterion === "quality")?.value, 3);

      await client.close();
    },
  );

  await t.step(
    "_calculateWeightedAverages calculates weighted averages correctly",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const author1 = freshID() as ID;
      const author2 = freshID() as ID;
      const app1 = freshID() as ID;
      const app2 = freshID() as ID;

      // Review 1 for app1 with scores
      const review1 = (await reviewRecords.submitReview({
        author: author1,
        application: app1,
        currentTime: new Date(),
      })) as { review: ID };
      await reviewRecords.setScore({
        author: author1,
        review: review1.review,
        criterion: "quality",
        value: 5,
      });
      await reviewRecords.setScore({
        author: author1,
        review: review1.review,
        criterion: "creativity",
        value: 3,
      });

      // Review 2 for app1 with different scores
      const review2 = (await reviewRecords.submitReview({
        author: author2,
        application: app1,
        currentTime: new Date(),
      })) as { review: ID };
      await reviewRecords.setScore({
        author: author2,
        review: review2.review,
        criterion: "quality",
        value: 4,
      });
      await reviewRecords.setScore({
        author: author2,
        review: review2.review,
        criterion: "creativity",
        value: 2,
      });

      // Review for app2
      const review3 = (await reviewRecords.submitReview({
        author: author1,
        application: app2,
        currentTime: new Date(),
      })) as { review: ID };
      await reviewRecords.setScore({
        author: author1,
        review: review3.review,
        criterion: "quality",
        value: 5,
      });
      await reviewRecords.setScore({
        author: author1,
        review: review3.review,
        criterion: "creativity",
        value: 5,
      });

      // Calculate weighted averages with weights: quality=0.7, creativity=0.3
      const weights = { quality: 0.7, creativity: 0.3 };
      const result = await reviewRecords._calculateWeightedAverages({ weights });

      assert("error" in result ? false : true, "Should return weighted averages");
      if ("error" in result) {
        throw new Error(`Failed: ${result.error}`);
      }

      assertEquals(result.length, 2, "Should have 2 applications");

      const r1 = result.find((r) => r.application === app1);
      const r2 = result.find((r) => r.application === app2);

      assertExists(r1);
      assertExists(r2);
      assertEquals(r1!.numReviews, 2, "App1 should have 2 reviews");
      assertEquals(r2!.numReviews, 1, "App2 should have 1 review");

      // For app1: Review 1 weighted avg = (5*0.7 + 3*0.3) / (0.7+0.3) = 4.4
      //          Review 2 weighted avg = (4*0.7 + 2*0.3) / (0.7+0.3) = 3.4
      //          Final: (4.4 + 3.4) / 2 = 3.9
      const expectedApp1 = (4.4 + 3.4) / 2;
      assert(Math.abs(r1!.weightedAverage - expectedApp1) < 0.01, `App1 weighted average should be ~3.9, got ${r1!.weightedAverage}`);

      // For app2: weighted avg = (5*0.7 + 5*0.3) / (0.7+0.3) = 5.0
      assert(Math.abs(r2!.weightedAverage - 5.0) < 0.01, `App2 weighted average should be 5.0, got ${r2!.weightedAverage}`);

      await client.close();
    },
  );

  await t.step(
    "_calculateWeightedAverages returns error for zero total weight",
    async () => {
      const [db, client] = await testDb();
      const reviewRecords = new ReviewRecordsConcept(db);

      const weights = { quality: 0, creativity: 0 };
      const result = await reviewRecords._calculateWeightedAverages({ weights });

      if (!("error" in result)) {
        throw new Error("Should return error for zero total weight");
      }
      assertEquals(result.error, "Total weight must be greater than zero");

      await client.close();
    },
  );
});
