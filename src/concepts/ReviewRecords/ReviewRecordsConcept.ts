import { Collection, Db } from "npm:mongodb";
import { ID } from "@utils/types.ts";
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
type Score = ID; // Each Score document will have its own ID
type RedFlag = ID; // Each RedFlag document will have its own ID
type Comment = ID; // Each Comment document will have its own ID

/**
 * a set of Reviews with
 *   an Application
 *   an author User
 *   a submittedAt DateTime
 *   an activeTime Number (optional, in seconds)
 */
interface ReviewDoc {
  _id: Review;
  application: Application;
  author: User;
  submittedAt: Date;
  activeTime?: number; // Time in seconds that the user was actively reviewing
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
  criterion: string;
  value: number;
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
    { author, application, currentTime, activeTime }: {
      author: User;
      application: Application;
      currentTime: Date;
      activeTime?: number; // Time in seconds that the user was actively reviewing
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
    const reviewDoc: ReviewDoc = {
      _id: newReviewId,
      author,
      application,
      submittedAt: currentTime,
    };

    // Include activeTime if provided
    if (activeTime !== undefined) {
      reviewDoc.activeTime = activeTime;
    }

    await this.reviews.insertOne(reviewDoc);

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
    const updateResult = await this.scores.updateOne(
      { review, criterion }, // Filter by review and criterion to find existing score
      {
        $set: { value },
        $setOnInsert: { _id: freshID() as Score, review, criterion }, // Set _id and other immutable fields only on insert
      },
      { upsert: true }, // Create if not exists
    );

    if (!updateResult.acknowledged) {
      return { error: "Failed to set score" };
    }

    return { application: targetReview.application };
  }

  /**
   * editReview (editor: User, review: Review)
   * requires: editor is the author of the review
   * effects: does not change submittedAt; acts as an edit operation after which scores are updated via setScore
   */
  async editReview(
    { editor, review }: { editor: User; review: Review },
  ): Promise<{ success: true } | { error: string }> {
    // requires: editor is the author of the review
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found" };
    }
    if (targetReview.author !== editor) {
      return { error: "Only the author of the review can edit it" };
    }

    // effects: does not change submittedAt; acts as an edit operation after which scores are updated via setScore
    // This action itself has no direct state effects on the ReviewDoc other than validating access.
    // The "effect" here is conceptual: it represents the *permission* to edit,
    // after which concrete changes (like scores) are applied by other actions (e.g., setScore).
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
    // As per the specification, this implies the *reviewer* is flagging their *own* review.
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
   * removeRedFlag (author: User, review: Review)
   * requires: author is the author of the review and has previously added a red flag to this review
   * effects: remove the author’s RedFlag for this review
   */
  async removeRedFlag(
    { author, review }: { author: User; review: Review },
  ): Promise<{ success: true } | { error: string }> {
    // requires: author is the author of the review
    const targetReview = await this.reviews.findOne({ _id: review });
    if (!targetReview) {
      return { error: "Review not found" };
    }
    // As per the specification, this implies the *reviewer* is removing a red flag from their *own* review.
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
    const deleteResult = await this.redFlags.deleteOne({
      _id: existingFlag._id,
    });
    if (deleteResult.deletedCount === 0) {
      // This case should ideally not happen if `existingFlag` was found, but good for robustness.
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
    if (!text.trim()) {
      return { error: "Comment text cannot be empty" };
    }
    if (!quotedSnippet.trim()) {
      return { error: "Quoted snippet cannot be empty" };
    }

    // Ensure the review exists before adding a comment to it (implicit requirement for data integrity)
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
   * editComment (author: User, comment: Comment, newText: String)
   * requires: author is the author of the comment
   * effects: update the comment’s text to the provided values
   */
  async editComment(
    { author, comment, newText }: {
      author: User;
      comment: Comment;
      newText: string;
    },
  ): Promise<{ success: true } | { error: string }> {
    // requires: author is the author of the comment
    const targetComment = await this.comments.findOne({ _id: comment });
    if (!targetComment) {
      return { error: "Comment not found" };
    }
    if (targetComment.author !== author) {
      return { error: "Only the author of the comment can edit it" };
    }
    // Also add a check for newText not being empty, similar to addComment
    if (!newText.trim()) {
      return { error: "New comment text cannot be empty" };
    }

    // effects: update the comment’s text to the provided values
    const updateResult = await this.comments.updateOne(
      { _id: comment },
      { $set: { text: newText } },
    );

    if (updateResult.modifiedCount === 0) {
      // This could mean the comment was found but the text was the same, or the update failed.
      // For simplicity, we'll return an error here, but a more nuanced design might differentiate.
      return { error: "Failed to update comment text or no change detected" };
    }

    return { success: true };
  }

  /**
   * deleteComment(author: User, comment: Comment)
   * requires: author is the author of the comment
   * effects: delete the comment
   */
  async deleteComment(
    { author, comment }: { author: User; comment: Comment },
  ): Promise<{ success: true } | { error: string }> {
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
      // Should not happen if `targetComment` was found and then deleted, but good for safety.
      return { error: "Failed to delete comment" };
    }

    return { success: true };
  }

  /**
   * _getReviewsWithScoresByApplication (application: Application)
   * purpose: Retrieves all reviews with their scores for a specific application.
   * effects: Returns all reviews and their associated scores for the given application.
   */
  async _getReviewsWithScoresByApplication(
    { application }: { application: Application },
  ): Promise<Array<{
    review: Review;
    author: User;
    submittedAt: Date;
    activeTime: number;
    scores: Array<{ criterion: string; value: number }>;
  }> | { error: string }> {
    // Get all reviews for this application
    const reviews = await this.reviews.find({ application }).toArray();

    if (reviews.length === 0) {
      return [];
    }

    // Get all scores for these reviews
    const reviewIds = reviews.map((r) => r._id);
    const scores = await this.scores.find({
      review: { $in: reviewIds },
    }).toArray();

    // Organize scores by review
    const scoresByReview = new Map<Review, Array<{ criterion: string; value: number }>>();
    for (const score of scores) {
      if (!scoresByReview.has(score.review)) {
        scoresByReview.set(score.review, []);
      }
      scoresByReview.get(score.review)!.push({
        criterion: score.criterion,
        value: score.value,
      });
    }

    // Combine reviews with their scores
    return reviews.map((review) => ({
      review: review._id,
      author: review.author,
      submittedAt: review.submittedAt,
      activeTime: review.activeTime || 0, // Default to 0 if not provided
      scores: scoresByReview.get(review._id) || [],
    }));
  }

  /**
   * _calculateWeightedAverages (weights: Record<string, number>)
   * purpose: Calculates weighted averages for all applications based on provided criterion weights.
   * effects: Returns weighted averages for each application.
   */
  async _calculateWeightedAverages(
    { weights }: { weights: Record<string, number> },
  ): Promise<
    Array<{ application: Application; weightedAverage: number; numReviews: number }> |
    { error: string }
  > {
    // Validate weights
    const totalWeight = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (totalWeight === 0) {
      return { error: "Total weight must be greater than zero" };
    }

    // Get all reviews with scores
    const allReviews = await this.reviews.find({}).toArray();
    const reviewIds = allReviews.map((r) => r._id);

    if (reviewIds.length === 0) {
      return [];
    }

    const allScores = await this.scores.find({
      review: { $in: reviewIds },
    }).toArray();

    // Organize scores by review
    const scoresByReview = new Map<Review, Array<{ criterion: string; value: number }>>();
    for (const score of allScores) {
      if (!scoresByReview.has(score.review)) {
        scoresByReview.set(score.review, []);
      }
      scoresByReview.get(score.review)!.push({
        criterion: score.criterion,
        value: score.value,
      });
    }

    // Calculate weighted averages per application
    const appResults = new Map<
      Application,
      { weightedSum: number; totalWeightUsed: number; numReviews: number }
    >();

    for (const review of allReviews) {
      const scores = scoresByReview.get(review._id) || [];

      if (!appResults.has(review.application)) {
        appResults.set(review.application, {
          weightedSum: 0,
          totalWeightUsed: 0,
          numReviews: 0,
        });
      }

      const result = appResults.get(review.application)!;
      result.numReviews += 1;

      // Calculate weighted sum for this review
      let reviewWeightedSum = 0;
      let reviewTotalWeight = 0;

      for (const { criterion, value } of scores) {
        const weight = weights[criterion] || 0;
        reviewWeightedSum += weight * value;
        reviewTotalWeight += weight;
      }

      // Add to application totals
      if (reviewTotalWeight > 0) {
        const weightedAverage = reviewWeightedSum / reviewTotalWeight;
        result.weightedSum += weightedAverage;
        result.totalWeightUsed += 1;
      }
    }

    // Convert to array and calculate final weighted averages
    const results: Array<{ application: Application; weightedAverage: number; numReviews: number }> = [];
    for (const [application, data] of appResults) {
      if (data.numReviews > 0) {
        const weightedAverage = data.totalWeightUsed > 0
          ? data.weightedSum / data.totalWeightUsed
          : 0;
        results.push({
          application,
          weightedAverage,
          numReviews: data.numReviews,
        });
      }
    }

    return results;
  }
}
