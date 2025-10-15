---
timestamp: 'Wed Oct 15 2025 05:39:02 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_053902.f014cde2.md]]'
content_id: e358da56de0649dfaf8d48301bcaa2fdaa2c26da63748f82b1bdd68c509d979f
---

# response:

```typescript
// file: src/ReviewRecords/ReviewRecordsConcept.ts
import { Collection, Db } from "npm:mongodb";
import { ID, Empty, Success } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * Declare collection prefix, use concept name
 */
const PREFIX = "ReviewRecords" + ".";

/**
 * Generic types of this concept
 */
type Application = ID;
type User = ID;
type Review = ID;
type Score = ID;
type RedFlag = ID;
type Comment = ID;

/**
 * a set of Reviews with
 *   an Application
 *   an author User
 *   a submittedAt DateTime
 */
interface ReviewDoc {
  _id: Review;
  application: Application;
  author: User;
  submittedAt: Date; // DateTime maps to JS Date
}

/**
 * a set of Scores with
 *   a review Review
 *   a criterion String
 *   a value Number
 */
interface ScoreDoc {
  _id: Score;
  review: Review;
  criterion: string; // String maps to JS string
  value: number; // Number maps to JS number
}

/**
 * a set of RedFlags with
 *   a review Review
 *   an author User
 */
interface RedFlagDoc {
  _id: RedFlag;
  review: Review;
  author: User;
}

/**
 * a set of Comments with
 *   a review Review
 *   an author User
 *   a text String
 *   a quotedSnippet String
 */
interface CommentDoc {
  _id: Comment;
  review: Review;
  author: User;
  text: string;
  quotedSnippet: string;
}

export default class ReviewRecordsConcept {
  /**
   * purpose Store reviews of applications, with editing, flagging, and comments.
   * principle A user can submit a review for an application, and overwrite their past reviews with edits. They can also
   * add a flag to a review, and write comments for other users to see.
   */
  reviews: Collection<ReviewDoc>;
  scores: Collection<ScoreDoc>;
  redFlags: Collection<RedFlagDoc>;
  comments: Collection<CommentDoc>;

  constructor(private readonly db: Db) {
    this.reviews = this.db.collection(PREFIX + "reviews");
    this.scores = this.db.collection(PREFIX + "scores");
    this.redFlags = this.db.collection(PREFIX + "redFlags");
    this.comments = this.db.collection(PREFIX + "comments");
  }

  /**
   * submitReview (author: User, application: Application, currentTime: DateTime): (review: Review)
   * requires: author must not have already submitted a review for the application
   * effects: create a Review with the provided details
   */
  async submitReview(
    { author, application, currentTime }: {
      author: User;
      application: Application;
      currentTime: Date;
    },
  ): Promise<{ review: Review } | { error: string }> {
    // requires: author must not have already submitted a review for the application
    const existingReview = await this.reviews.findOne({ author, application });
    if (existingReview) {
      return {
        error: "Author has already submitted a review for this application",
      };
    }

    // effects: create a Review with the provided details
    const newReviewId = freshID() as Review;
    await this.reviews.insertOne({
      _id: newReviewId,
      author,
      application,
      submittedAt: currentTime,
    });

    return { review: newReviewId };
  }

  /**
   * setScore (author: User, review: Review, criterion: String, value: Number): (application: Application)
   * requires: author is the author of the review
   * effects: update the score for the review for the specified criterion to be the specified value,
   *   and return the application that the review is for
   */
  async setScore(
    { author, review, criterion, value }: {
      author: User;
      review: Review;
      criterion: string;
      value: number;
    },
  ): Promise<{ application: Application } | { error: string }> {
    // requires: author is the author of the review
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found" };
    }
    if (targetReview.author !== author) {
      return { error: "Only the author of the review can set its scores" };
    }

    // effects: update the score for the review for the specified criterion to be the specified value,
    //   and return the application that the review is for
    // Use upsert: true to create the score if it doesn't exist, or update if it does.
    const scoreId = freshID() as Score; // Generate new ID if inserting, otherwise it will be ignored by updateOne with upsert
    const updateResult = await this.scores.updateOne(
      { review, criterion }, // Filter by review and criterion to find existing score
      {
        $set: { value }, // Update the value
        $setOnInsert: { _id: scoreId, review, criterion }, // Set _id and other immutable fields only on insert
      },
      { upsert: true }, // Create if not exists
    );

    // Check if the operation was acknowledged and successful
    if (!updateResult.acknowledged) {
      return { error: "Failed to set score" };
    }

    return { application: targetReview.application };
  }

  /**
   * editReview (editor: User, review: Review): Success
   * requires: editor is the author of the review
   * effects: does not change submittedAt; acts as an edit operation after which scores are updated via setScore
   */
  async editReview(
    { editor, review }: { editor: User; review: Review },
  ): Promise<Success | { error: string }> {
    // requires: editor is the author of the review
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found" };
    }
    if (targetReview.author !== editor) {
      return { error: "Only the author of the review can edit it" };
    }

    // effects: does not change submittedAt; acts as an edit operation after which scores are updated via setScore
    // This action itself has no direct state effects beyond validating access.
    // The "effect" here is conceptual: enabling subsequent setScore calls.
    return { success: true };
  }

  /**
   * addRedFlag (author: User, review: Review): (flag: RedFlag)
   * requires: author is the author of the review and has not already added a red flag to this review
   * effects: add a RedFlag for this review associated with the author
   */
  async addRedFlag(
    { author, review }: { author: User; review: Review },
  ): Promise<{ flag: RedFlag } | { error: string }> {
    // requires: author is the author of the review
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found" };
    }
    // As per the specification, this means the *reviewer* is flagging their *own* review.
    if (targetReview.author !== author) {
      return {
        error:
          "Only the author of the review can add a red flag to their own review",
      };
    }

    // requires: has not already added a red flag to this review
    const existingFlag = await this.redFlags.findOne({ review, author });
    if (existingFlag) {
      return {
        error: "Author has already added a red flag to this review",
      };
    }

    // effects: add a RedFlag for this review associated with the author
    const newFlagId = freshID() as RedFlag;
    await this.redFlags.insertOne({
      _id: newFlagId,
      review,
      author,
    });

    return { flag: newFlagId };
  }

  /**
   * removeRedFlag (author: User, review: Review): Success
   * requires: author is the author of the review and has previously added a red flag to this review
   * effects: remove the author’s RedFlag for this review
   */
  async removeRedFlag(
    { author, review }: { author: User; review: Review },
  ): Promise<Success | { error: string }> {
    // requires: author is the author of the review
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found" };
    }
    // As per the specification, this means the *reviewer* is removing a red flag from their *own* review.
    if (targetReview.author !== author) {
      return {
        error:
          "Only the author of the review can remove a red flag from their own review",
      };
    }

    // requires: has previously added a red flag to this review
    const existingFlag = await this.redFlags.findOne({ review, author });
    if (!existingFlag) {
      return {
        error: "Author has not added a red flag to this review",
      };
    }

    // effects: remove the author’s RedFlag for this review
    const deleteResult = await this.redFlags.deleteOne({ _id: existingFlag._id });
    if (deleteResult.deletedCount === 0) {
      // This case should ideally not happen if existingFlag was found, but good for robustness.
      return { error: "Failed to remove red flag" };
    }

    return { success: true };
  }

  /**
   * addComment (author: User, review: Review, text: String, quotedSnippet: String): (comment: Comment)
   * requires: text is not an empty string and quotedSnippet is not an empty string
   * effects: add comment with provided details to the set of comments, associated with this review
   */
  async addComment(
    { author, review, text, quotedSnippet }: {
      author: User;
      review: Review;
      text: string;
      quotedSnippet: string;
    },
  ): Promise<{ comment: Comment } | { error: string }> {
    // requires: text is not an empty string and quotedSnippet is not an empty string
    if (!text.trim()) { // .trim() handles strings with only whitespace
      return { error: "Comment text cannot be empty" };
    }
    if (!quotedSnippet.trim()) {
      return { error: "Quoted snippet cannot be empty" };
    }

    // Ensure the review exists before adding a comment to it
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found, cannot add comment" };
    }

    // effects: add comment with provided details to the set of comments, associated with this review
    const newCommentId = freshID() as Comment;
    await this.comments.insertOne({
      _id: newCommentId,
      review,
      author,
      text,
      quotedSnippet,
    });

    return { comment: newCommentId };
  }

  /**
   * editComment (author: User, comment: Comment, newText: String): Success
   * requires: author is the author of the comment
   * effects: update the comment’s text to the provided values
   */
  async editComment(
    { author, comment, newText }: {
      author: User;
      comment: Comment;
      newText: string;
    },
  ): Promise<Success | { error: string }> {
    // requires: author is the author of the comment
    const targetComment = await this.comments.findOne({ _id: comment });
    if (!targetComment) {
      return { error: "Comment not found" };
    }
    if (targetComment.author !== author) {
      return { error: "Only the author of the comment can edit it" };
    }
    if (!newText.trim()) { // New text also cannot be empty
      return { error: "New comment text cannot be empty" };
    }

    // effects: update the comment’s text to the provided values
    const updateResult = await this.comments.updateOne(
      { _id: comment },
      { $set: { text: newText } },
    );

    if (updateResult.modifiedCount === 0) {
      // If the text is identical to the existing one, modifiedCount might be 0.
      // However, the prompt implies this should be an error case.
      return { error: "Failed to update comment text" };
    }

    return { success: true };
  }

  /**
   * deleteComment(author: User, comment: Comment): Success
   * requires: author is the author of the comment
   * effects: delete the comment
   */
  async deleteComment(
    { author, comment }: { author: User; comment: Comment },
  ): Promise<Success | { error: string }> {
    // requires: author is the author of the comment
    const targetComment = await this.comments.findOne({ _id: comment });
    if (!targetComment) {
      return { error: "Comment not found" };
    }
    if (targetComment.author !== author) {
      return { error: "Only the author of the comment can delete it" };
    }

    // effects: delete the comment
    const deleteResult = await this.comments.deleteOne({ _id: comment });
    if (deleteResult.deletedCount === 0) {
      return { error: "Failed to delete comment" };
    }

    return { success: true };
  }
}
```
