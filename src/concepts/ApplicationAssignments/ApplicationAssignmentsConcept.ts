import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "ApplicationAssignments" + ".";

// Generic types for this concept, as defined in the spec
type User = ID;
type Event = ID;
type Application = ID;
type DateTime = Date; // Mapping DateTime from spec to JavaScript's Date object

// --- Internal Interfaces for State Definitions ---
// These are outside the class to prevent TypeScript errors regarding circular references or complex types.

/**
 * Interface representing a CurrentAssignment state entry.
 * Corresponds to "a set of CurrentAssignments" in the concept state.
 */
interface CurrentAssignments {
  _id: ID; // Unique identifier for this specific assignment record
  user: User;
  application: Application;
  startTime: DateTime;
  event: Event;
}

/**
 * Interface representing an AppStatus state entry.
 * Corresponds to "a set of AppStatus" in the concept state.
 */
interface AppStatus {
  _id: ID; // Unique identifier for this status record (e.g., app-event pair status)
  application: Application;
  event: Event;
  readsCompleted: number; // Number of times this application has been read for this event
  readers: User[]; // Set of users who have read or skipped this application for this event
}

/**
 * Interface representing an ApplicationFlag.
 * Stores flags on applications without requiring a full review.
 */
interface ApplicationFlag {
  _id: ID;
  user: User;
  application: Application;
  event: Event;
  timestamp: DateTime;
  reason?: string;
}

/**
 * Interface representing a Skip record.
 * Tracks when users skip applications.
 */
interface SkipRecord {
  _id: ID;
  user: User;
  application: Application;
  event: Event;
  timestamp: DateTime;
}

/**
 * Result type for the getNextAssignment action.
 * Can return an assignment object on success or an error message on failure.
 */
interface GetNextAssignmentResult {
  assignment?: CurrentAssignments;
  error?: string;
}

/**
 * Result type for the submitAndIncrement action.
 * Can return the application ID on success or an error message on failure.
 */
interface SubmitAndIncrementResult {
  application?: Application;
  error?: string;
}

/**
 * @concept ApplicationAssignments
 * @purpose Store user-to-application assignment data (including read-counts) and assign them one at a time to users
 *     to read, allowing skips.
 * @principle Each reader is assigned one application to read at a time. Applications are assigned prioritizing those
 *     with the fewest reads so far, and a user cannot read an application they have already read. Applications can
 *     be skipped, and get prioritized if so.
 */
export default class ApplicationAssignmentsConcept {
  /**
   * Represents the "a set of CurrentAssignments" state from the concept specification.
   * Stores active assignments of applications to users for specific events.
   */
  private currentAssignments: Collection<CurrentAssignments>;

  /**
   * Represents the "a set of AppStatus" state from the concept specification.
   * Stores the aggregated status (read counts, readers) for applications within an event.
   */
  private appStatus: Collection<AppStatus>;

  /**
   * Stores flags on applications without requiring a full review.
   */
  private applicationFlags: Collection<ApplicationFlag>;

  /**
   * Stores skip records to track when users skip applications.
   */
  private skipRecords: Collection<SkipRecord>;

  constructor(private readonly db: Db) {
    this.currentAssignments = this.db.collection(PREFIX + "currentAssignments");
    this.appStatus = this.db.collection(PREFIX + "appStatus");
    this.applicationFlags = this.db.collection(PREFIX + "applicationFlags");
    this.skipRecords = this.db.collection(PREFIX + "skipRecords");
  }

  /**
   * registerApplicationForAssignment
   *
   * Registers a new application for assignment within a specific event context.
   * If an AppStatus for the given application and event already exists, this action is idempotent
   * and will not re-create or modify the existing entry.
   *
   * @param application The ID of the application to register.
   * @param event The ID of the event this application is associated with for assignment.
   * @returns An empty object (`{}`) on successful registration (or if already registered).
   *
   * @requires: none (always callable)
   * @effects: Creates an `AppStatus` entry for the specified `application` and `event`
   *           with `readsCompleted` initialized to `0` and an empty `readers` set.
   */
  async registerApplicationForAssignment(
    { application, event }: { application: Application; event: Event },
  ): Promise<Empty> {
    // Check if an AppStatus for this application and event already exists
    const existingStatus = await this.appStatus.findOne({ application, event });

    if (existingStatus) {
      // If it exists, the action is idempotent; we do not modify or re-create it.
      return {};
    }

    const newAppStatus: AppStatus = {
      _id: freshID(), // A unique ID for this AppStatus entry
      application: application,
      event: event,
      readsCompleted: 0,
      readers: [], // Initialize with an empty set of readers
    };
    await this.appStatus.insertOne(newAppStatus);
    return {};
  }

  /**
   * getNextAssignment
   *
   * Assigns the next eligible application to a user for a given event.
   * An eligible application is one that the user has not yet read/skipped and has the fewest
   * `readsCompleted` among available applications.
   *
   * @param user The ID of the user requesting an assignment.
   * @param event The ID of the event for which assignments are being made.
   * @param startTime The `DateTime` when the assignment is being made.
   * @returns A `GetNextAssignmentResult` object, containing the `assignment` on success
   *          or an `error` message if no eligible assignment can be found or the user
   *          already has an active assignment for this event.
   *
   * @requires: The `user` is not currently assigned an assignment for this `event`.
   * @effects: Creates a `CurrentAssignment` for this user with the specified `startTime`.
   *           The `application` selected for assignment is the one with the fewest `readsCompleted`
   *           among all applications for the `event` that the `user` has not yet read or skipped.
   *           If no eligible application is found, no assignment is created, and an error is returned.
   */
  async getNextAssignment(
    { user, event, startTime }: {
      user: User;
      event: Event;
      startTime: DateTime;
    },
  ): Promise<GetNextAssignmentResult> {
    // Check if user has an active assignment, and expire it if older than 12 hours
    const EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours
    const existingAssignment = await this.currentAssignments.findOne({
      user,
      event,
    });

    if (existingAssignment) {
      // Check if assignment is expired
      const assignmentAge = Date.now() - new Date(existingAssignment.startTime).getTime();

      if (assignmentAge > EXPIRATION_MS) {
        // Expire the old assignment
        await this.currentAssignments.deleteOne({ _id: existingAssignment._id });
        // Proceed with getting a new assignment
      } else {
        // Return the existing non-expired assignment
        return { assignment: existingAssignment };
      }
    }

    // Find apps currently assigned for this event and exclude them
    const assignedNow = await this.currentAssignments
      .find({ event })
      .project<{ application: Application }>({ application: 1, _id: 0 })
      .toArray();
    const assignedApps = new Set(assignedNow.map((a) => a.application));

    // Eligible = same event, user hasn't read/skipped, and not currently assigned to someone else
    // First get apps that user hasn't read (not in readers set)
    const candidateApps = await this.appStatus.find({
      event,
      readers: { $ne: user },
      ...(assignedApps.size > 0
        ? { application: { $nin: [...assignedApps] } }
        : {}),
    })
      .sort({ readsCompleted: 1, application: 1 }) // deterministic tie-break for fewest reads
      .toArray();

    // Additional filter: Also exclude applications where user already has a review
    // This handles data consistency issues where review exists but user not in readers set
    const ReviewRecordsConcept = (await import("../ReviewRecords/ReviewRecordsConcept.ts")).default;
    const reviewRecords = new ReviewRecordsConcept(this.db);

    const eligibleApps: typeof candidateApps = [];
    for (const appStatus of candidateApps) {
      // Check if user already has a review for this application
      const existingReview = await reviewRecords.reviews.findOne({
        author: user,
        application: appStatus.application,
      });

      // Only include if no review exists (even if not in readers set, we check reviews as secondary check)
      if (!existingReview) {
        eligibleApps.push(appStatus);
      }
    }

    if (eligibleApps.length === 0) {
      return { error: "No eligible applications available for assignment." };
    }

    // Select the first eligible application (which has the lowest readsCompleted)
    const selectedAppStatus = eligibleApps[0];

    // @effects: Create a CurrentAssignment
    const newAssignment: CurrentAssignments = {
      _id: freshID(), // A unique ID for this specific assignment instance
      user: user,
      application: selectedAppStatus.application,
      startTime: startTime,
      event: event,
    };

    await this.currentAssignments.insertOne(newAssignment);

    return { assignment: newAssignment };
  }

  /**
   * skipAssignment
   *
   * Allows a user to skip their currently assigned application.
   * The skipped application is then marked as "read" by the user (added to `readers` set)
   * so it won't be reassigned to them, and the `CurrentAssignment` is removed.
   *
   * @param user The ID of the user skipping the assignment.
   * @param assignment The `CurrentAssignment` object to be skipped.
   * @returns An empty object (`{}`) on success, or an object with an `error` message
   *          if the provided `assignment` is not active or does not belong to the `user`.
   *
   * @requires: The `user` is currently assigned the provided `assignment`.
   * @effects: Adds the `user` to the `readers` set of the `AppStatus` for the associated application and event.
   *           Removes the `CurrentAssignment` record.
   */
  async skipAssignment(
    { user, assignment }: { user: User; assignment: CurrentAssignments },
  ): Promise<Empty | { error: string }> {
    // @requires: user is currently assigned the provided assignment
    // Verify that the assignment exists and belongs to the specified user.
    const foundAssignment = await this.currentAssignments.findOne({
      _id: assignment._id,
      user: user,
      application: assignment.application,
      event: assignment.event,
    });
    if (!foundAssignment) {
      return {
        error:
          "Provided assignment does not exist or does not belong to the user.",
      };
    }

    try {
      // Handle existing review/flag records before creating skip record
      const ReviewRecordsConcept = (await import("../ReviewRecords/ReviewRecordsConcept.ts")).default;
      const reviewRecords = new ReviewRecordsConcept(this.db);

      // Check if user has an existing review for this application
      const existingReview = await reviewRecords.reviews.findOne({
        author: user,
        application: assignment.application,
      });

      if (existingReview) {
        // Delete any red flags associated with this review
        await reviewRecords.redFlags.deleteMany({
          author: user,
          review: existingReview._id,
        });

        // Delete the review record
        await reviewRecords.reviews.deleteOne({
          _id: existingReview._id,
        });

        // Delete any scores associated with this review
        await reviewRecords.scores.deleteMany({
          review: existingReview._id,
        });

        // Delete any comments associated with this review
        await reviewRecords.comments.deleteMany({
          review: existingReview._id,
        });
      }

      // @effects: Add user to the application's readers set for the associated AppStatus
      await this.appStatus.updateOne(
        { application: assignment.application, event: assignment.event },
        { $addToSet: { readers: user } }, // $addToSet ensures the user is added only once, maintaining set semantics
      );

      // Create a skip record
      const skipId = freshID();
      await this.skipRecords.insertOne({
        _id: skipId,
        user: user,
        application: assignment.application,
        event: assignment.event,
        timestamp: new Date(),
      });

      // @effects: Remove the CurrentAssignment
      await this.currentAssignments.deleteOne({ _id: assignment._id });

      return {};
    } catch (error) {
      console.error("Error in skipAssignment:", error);
      return { error: "Failed to skip assignment" };
    }
  }

  /**
   * submitAndIncrement
   *
   * Processes the submission of a completed assignment.
   * This action increments the read count for the application, records the user as having read it,
   * and removes the `CurrentAssignment` from the user.
   *
   * @param user The ID of the user submitting the assignment.
   * @param assignment The `CurrentAssignments` object being submitted.
   * @param endTime The `DateTime` when the assignment was completed.
   * @param activeTime Optional time in seconds that the user was actively reviewing.
   * @returns A `SubmitAndIncrementResult` object, containing the `application` ID on success,
   *          or an `error` message if the provided `assignment` is not active or does not belong to the `user`.
   *
   * @requires: The `user` is currently assigned the provided `assignment`.
   * @effects: Increments the `readsCompleted` count for the application's `AppStatus`.
   *           Adds the `user` to the `readers` set of the `AppStatus` for the associated application and event.
   *           Removes the `CurrentAssignment` record.
   *           Creates a review record with activeTime if provided.
   *           Returns the `application` ID associated with the submitted assignment.
   */
  async submitAndIncrement(
    { user, assignment, endTime, activeTime }: {
      user: User;
      assignment: CurrentAssignments;
      endTime: DateTime;
      activeTime?: number; // Time in seconds that the user was actively reviewing
    },
  ): Promise<SubmitAndIncrementResult> {
    // @requires: user is currently assigned the provided assignment
    // Verify that the assignment exists and belongs to the specified user.
    const foundAssignment = await this.currentAssignments.findOne({
      _id: assignment._id,
      user: user,
      application: assignment.application,
      event: assignment.event,
    });
    if (!foundAssignment) {
      return {
        error:
          "Provided assignment does not exist or does not belong to the user.",
      };
    }

    // @effects: Create a review record with activeTime if provided
    // Handle case where review already exists (e.g., from previous failed submission or setScore calls)
    if (activeTime !== undefined) {
      const reviewRecords = new (await import("../ReviewRecords/ReviewRecordsConcept.ts")).default(this.db);

      // Check if review already exists (handles case where review was created but assignment wasn't completed)
      const existingReview = await reviewRecords.reviews.findOne({
        author: user,
        application: assignment.application,
      });

      if (!existingReview) {
        // No review exists - create one
        const reviewResult = await reviewRecords.submitReview({
          author: user,
          application: assignment.application,
          currentTime: endTime,
          activeTime: activeTime,
        });

        if ("error" in reviewResult) {
          return { error: `Failed to create review: ${reviewResult.error}` };
        }
      }
      // If review already exists, we skip creation but still proceed to complete the assignment
      // This allows users to complete assignments even if review was created earlier
    }

    // @effects: Increment the number of completed reads for the application,
    //           and record that the user read the application.
    await this.appStatus.updateOne(
      { application: assignment.application, event: assignment.event },
      {
        $inc: { readsCompleted: 1 }, // Increment the read count
        $addToSet: { readers: user }, // Add user to the set of readers for this application/event
      },
    );

    // @effects: Un-assign the application from the reader
    await this.currentAssignments.deleteOne({ _id: assignment._id });

    // @effects: Return the application associated with the assignment
    return { application: assignment.application };
  }

  /**
   * abandonAssignment
   *
   * Allows a user to abandon their current assignment and mark it as incomplete.
   * Deletes the assignment without incrementing reads or adding to readers.
   *
   * @param user The ID of the user abandoning the assignment.
   * @param event The ID of the event for which to abandon the assignment.
   * @returns An empty object (`{}`) on success, or an object with an `error` message
   *          if no active assignment exists for this user and event.
   */
  async abandonAssignment(
    { user, event }: { user: User; event: Event },
  ): Promise<Empty | { error: string }> {
    const existingAssignment = await this.currentAssignments.findOne({
      user,
      event,
    });

    if (!existingAssignment) {
      return {
        error: "User does not have an active assignment for this event.",
      };
    }

    // Delete the assignment without affecting readsCompleted or readers
    await this.currentAssignments.deleteOne({ _id: existingAssignment._id });

    return {};
  }

  /**
   * getCurrentAssignment
   *
   * Returns the user's current active assignment for an event, if one exists.
   * Automatically expires assignments older than 12 hours.
   *
   * @param user The ID of the user.
   * @param event The ID of the event.
   * @returns The current assignment object if it exists and is not expired,
   *          or null if no assignment exists or the assignment has expired.
   */
  async getCurrentAssignment(
    { user, event }: { user: User; event: Event },
  ): Promise<{ assignment: CurrentAssignments | null }> {
    const existingAssignment = await this.currentAssignments.findOne({
      user,
      event,
    });

    if (!existingAssignment) {
      return { assignment: null };
    }

    // Check if assignment is expired (older than 12 hours)
    const assignmentAge =
      Date.now() - new Date(existingAssignment.startTime).getTime();
    const EXPIRATION_MS = 12 * 60 * 60 * 1000; // 12 hours

    if (assignmentAge > EXPIRATION_MS) {
      // Delete expired assignment
      await this.currentAssignments.deleteOne({ _id: existingAssignment._id });
      return { assignment: null };
    }

    return { assignment: existingAssignment };
  }

  /**
   * _getSkipStatsForEvent (event: Event)
   * purpose: Get skip statistics for all users who were assigned applications in an event
   * effects: Returns skip counts per user by counting assignments that were skipped
   */
  async _getSkipStatsForEvent(
    { event }: { event: Event },
  ): Promise<Array<{
    userId: string;
    skipCount: number;
  }>> {
    // Get all skip records for this event
    const skips = await this.skipRecords.find({ event }).toArray();

    // Group by user to count skips
    const skipCountByUser = new Map<string, number>();

    for (const skip of skips) {
      const userId = skip.user.toString();
      skipCountByUser.set(userId, (skipCountByUser.get(userId) || 0) + 1);
    }

    return Array.from(skipCountByUser.entries()).map(([userId, skipCount]) => ({
      userId,
      skipCount,
    }));
  }

  /**
   * flagAndSkip
   *
   * Flags an application and skips to the next one by creating a review record with a red flag.
   * This ensures flagged applications appear in history and can be properly managed.
   *
   * @param user The ID of the user flagging the application.
   * @param assignment The CurrentAssignment object being flagged.
   * @param reason Optional reason for the flag.
   * @returns An empty object on success, or an error message.
   *
   * @requires: The `user` is currently assigned the provided `assignment`.
   * @effects: Creates a review record with a red flag.
   *           Creates a skip record for proper skip counting.
   *           Removes the `CurrentAssignment` record.
   *           Does NOT add user to readers set (allows re-assignment if unflagged).
   */
  async flagAndSkip(
    {
      user,
      assignment,
      reason,
    }: {
      user: User;
      assignment: CurrentAssignments;
      reason?: string;
    },
  ): Promise<Empty | { error: string }> {
    // Verify that the assignment exists and belongs to the specified user.
    const foundAssignment = await this.currentAssignments.findOne({
      _id: assignment._id,
      user: user,
      application: assignment.application,
      event: assignment.event,
    });

    if (!foundAssignment) {
      return {
        error:
          "Provided assignment does not exist or does not belong to the user.",
      };
    }

    try {
      // Create a review record first (so it appears in history)
      const ReviewRecordsConcept = (await import("../ReviewRecords/ReviewRecordsConcept.ts")).default;
      const reviewRecords = new ReviewRecordsConcept(this.db);

      const reviewResult = await reviewRecords.submitReview({
        author: user,
        application: assignment.application,
        currentTime: new Date(), // Use actual current time when flagging
        activeTime: 0, // No time spent since it's just a flag
      });

      if ("error" in reviewResult) {
        return { error: `Failed to create review record: ${reviewResult.error}` };
      }

      // Add a red flag to the review
      const flagResult = await reviewRecords.addRedFlag({
        author: user,
        review: reviewResult.review,
      });

      if ("error" in flagResult) {
        return { error: `Failed to add red flag: ${flagResult.error}` };
      }

      // Do NOT create skip record (flagging should not increment skip count)
      // Add user to readers set (prevents random re-assignment, but accessible via dropdown)
      await this.appStatus.updateOne(
        { application: assignment.application, event: assignment.event },
        { $addToSet: { readers: user } },
      );

      // Remove the CurrentAssignment
      await this.currentAssignments.deleteOne({ _id: assignment._id });

      return {};
    } catch (error) {
      console.error("Error in flagAndSkip:", error);
      return { error: "Failed to flag application" };
    }
  }

  /**
   * _getUserFlaggedApplications
   *
   * Retrieves all applications a user has flagged (without reviewing).
   *
   * @param user The ID of the user.
   * @param event The ID of the event.
   * @returns An array of flagged applications with their details.
   */
  async _getUserFlaggedApplications(
    { user, event }: { user: User; event: Event },
  ): Promise<Array<{
    application: Application;
    timestamp: string;
    reason?: string;
    applicationDetails: {
      _id: string;
      applicantID: string;
      applicantYear: string;
    };
  }>> {
    // Get all flags by this user for this event
    const flags = await this.applicationFlags.find({ user, event })
      .sort({ timestamp: -1 })
      .toArray();

    if (flags.length === 0) {
      return [];
    }

    // Get application details
    const applicationIds = flags.map((f) => f.application);
    const applications = await this.db.collection("ApplicationStorage.applications")
      .find({
        _id: { $in: applicationIds as any },
      })
      .toArray();

    // Create a map of application details
    const appDetailsMap = new Map(applications.map((app: any) => [app._id.toString(), {
      _id: app._id.toString(),
      applicantID: app.applicantID,
      applicantYear: app.applicantYear,
    }]));

    // Return flags with application details
    return flags.map((flag) => {
      const appDetails = appDetailsMap.get(flag.application.toString());
      return {
        application: flag.application,
        timestamp: flag.timestamp instanceof Date
          ? flag.timestamp.toISOString()
          : new Date(flag.timestamp).toISOString(),
        reason: flag.reason,
        applicationDetails: appDetails || {
          _id: flag.application.toString(),
          applicantID: "Unknown",
          applicantYear: "Unknown",
        },
      };
    });
  }
}
