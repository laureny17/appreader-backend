---
timestamp: 'Wed Oct 15 2025 05:09:19 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_050919.1c28de21.md]]'
content_id: 36187035b447eeda7055bbd40e16586cce2ffb6edcf650028a84acebee34244f
---

# response:

```typescript
// src/ApplicationAssignments/ApplicationAssignmentsConcept.ts
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

  constructor(private readonly db: Db) {
    this.currentAssignments = this.db.collection(PREFIX + "currentAssignments");
    this.appStatus = this.db.collection(PREFIX + "appStatus");
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
    { user, event, startTime }: { user: User; event: Event; startTime: DateTime },
  ): Promise<GetNextAssignmentResult> {
    // @requires: user is not currently assigned an assignment for this event
    const existingAssignment = await this.currentAssignments.findOne({ user, event });
    if (existingAssignment) {
      return { error: "User already has an active assignment for this event." };
    }

    // Find eligible applications for this event that the user has not read/skipped yet,
    // prioritizing those with the fewest reads completed.
    const eligibleApps = await this.appStatus.find({
      event: event,
      readers: { $ne: user }, // User is not in the list of readers for this application
    })
      .sort({ readsCompleted: 1 }) // Prioritize applications with the fewest reads completed
      .toArray();

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
  ): Promise<Empty> {
    // @requires: user is currently assigned the provided assignment
    // Verify that the assignment exists and belongs to the specified user.
    const foundAssignment = await this.currentAssignments.findOne({
      _id: assignment._id,
      user: user,
      application: assignment.application,
      event: assignment.event,
    });
    if (!foundAssignment) {
      return { error: "Provided assignment does not exist or does not belong to the user." };
    }

    // @effects: Add user to the application's readers set for the associated AppStatus
    await this.appStatus.updateOne(
      { application: assignment.application, event: assignment.event },
      { $addToSet: { readers: user } }, // $addToSet ensures the user is added only once, maintaining set semantics
    );

    // @effects: Remove the CurrentAssignment
    await this.currentAssignments.deleteOne({ _id: assignment._id });

    return {};
  }

  /**
   * submitAndIncrement
   *
   * Processes the submission of a completed assignment.
   * This action increments the read count for the application, records the user as having read it,
   * and removes the `CurrentAssignment` from the user.
   *
   * @param user The ID of the user submitting the assignment.
   * @param assignment The `CurrentAssignment` object being submitted.
   * @param endTime The `DateTime` when the assignment was completed.
   * @returns A `SubmitAndIncrementResult` object, containing the `application` ID on success,
   *          or an `error` message if the provided `assignment` is not active or does not belong to the `user`.
   *
   * @requires: The `user` is currently assigned the provided `assignment`.
   * @effects: Increments the `readsCompleted` count for the application's `AppStatus`.
   *           Adds the `user` to the `readers` set of the `AppStatus` for the associated application and event.
   *           Removes the `CurrentAssignment` record.
   *           Returns the `application` ID associated with the submitted assignment.
   */
  async submitAndIncrement(
    { user, assignment, endTime }: { user: User; assignment: CurrentAssignments; endTime: DateTime },
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
      return { error: "Provided assignment does not exist or does not belong to the user." };
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
}
```
