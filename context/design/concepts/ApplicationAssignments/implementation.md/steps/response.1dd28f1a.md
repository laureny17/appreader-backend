---
timestamp: 'Wed Oct 15 2025 04:41:45 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_044145.95baf2e4.md]]'
content_id: 1dd28f1af50332aeb3dc60509cd9a0ef88e72934c058ad84b59d838f3e7b08b2
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
   * A set of CurrentAssignments with
   *   a User
   *   an Application
   *   a startTime DateTime
   *   an Event
   *
   * Represents an active assignment for a user to read a specific application for a given event.
   */
  private currentAssignments: Collection<CurrentAssignments>;

  /**
   * A set of AppStatus with
   *   an Application
   *   an Event
   *   a readsCompleted Number
   *   a readers set of Users
   *
   * Stores the reading status of an application within a specific event context,
   * including how many times it has been read and by whom.
   */
  private appStatus: Collection<AppStatus>;

  constructor(private readonly db: Db) {
    this.currentAssignments = this.db.collection(PREFIX + "currentAssignments");
    this.appStatus = this.db.collection(PREFIX + "appStatus");
  }

  /**
   * registerApplicationForAssignment
   *
   * @param application The ID of the application to register.
   * @param event The ID of the event this application is associated with for assignment.
   * @returns An empty object on success, or an object with an `error` message if creation fails.
   *
   * @requires: none
   * @effects: Creates an AppStatus for the specified application for the specified event
   *           with `readsCompleted = 0` and an empty `readers` set initialized.
   *           If an AppStatus for this (application, event) already exists, it will not be re-created
   *           (ensuring idempotency) and the existing state is preserved.
   */
  async registerApplicationForAssignment(
    { application, event }: { application: Application; event: Event },
  ): Promise<Empty> {
    // Check if an AppStatus for this application and event already exists
    const existingStatus = await this.appStatus.findOne({ application, event });

    if (existingStatus) {
      // If it exists, we don't re-create it as per usual idempotent behavior for registration.
      // This means the action implicitly updates nothing if the state already exists.
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
   * @param user The ID of the user requesting an assignment.
   * @param event The ID of the event for which assignments are being made.
   * @param startTime The DateTime when the assignment is being made.
   * @returns An object containing the newly created `assignment` on success, or an `error` message
   *          if no eligible assignment can be found or the user already has an active assignment.
   *
   * @requires: The user is not currently assigned an assignment for this event.
   * @effects: Creates a `CurrentAssignment` for this user with the specified `startTime`. The assigned
   *           application will be one that currently has the fewest `readsCompleted` and for which
   *           the user is not in its `readers` set. If no such eligible application exists,
   *           no assignment is created, and an error is returned.
   */
  async getNextAssignment(
    { user, event, startTime }: { user: User; event: Event; startTime: DateTime },
  ): Promise<GetNextAssignmentResult> {
    // @requires: user is not currently assigned an assignment for this event
    const existingAssignment = await this.currentAssignments.findOne({ user, event });
    if (existingAssignment) {
      return { error: "User already has an active assignment for this event." };
    }

    // Find eligible applications:
    // 1. Belonging to the given event.
    // 2. The user is NOT in the `readers` set (meaning they haven't read/skipped it yet).
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
   * @param user The ID of the user skipping the assignment.
   * @param assignment The `CurrentAssignment` object to be skipped.
   * @returns An empty object on success, or an object with an `error` message if the assignment
   *          is not valid for the user or doesn't exist.
   *
   * @requires: The user is currently assigned the provided assignment.
   * @effects: Adds the user to the application's `readers` set for that assignment's application and event.
   *           Removes the `CurrentAssignment` so the application can be reassigned to other users,
   *           but not to this user (due to being added to `readers`).
   */
  async skipAssignment(
    { user, assignment }: { user: User; assignment: CurrentAssignments },
  ): Promise<Empty> {
    // @requires: user is currently assigned the provided assignment
    const foundAssignment = await this.currentAssignments.findOne({
      _id: assignment._id,
      user: user,
      application: assignment.application, // Ensure all fields match for robustness
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
   * @param user The ID of the user submitting the assignment.
   * @param assignment The `CurrentAssignment` object being submitted.
   * @param endTime The `DateTime` when the assignment was completed.
   * @returns An object containing the `application` ID associated with the assignment on success,
   *          or an `error` message if the assignment is not valid for the user or doesn't exist.
   *
   * @requires: The user is currently assigned the provided assignment.
   * @effects: Increments the number of completed reads (`readsCompleted`) for the application.
   *           Records that the user read the application by adding them to the `readers` set.
   *           Un-assigns the application from the reader by removing the `CurrentAssignment`.
   *           Returns the application ID associated with the assignment.
   */
  async submitAndIncrement(
    { user, assignment, endTime }: { user: User; assignment: CurrentAssignments; endTime: DateTime },
  ): Promise<SubmitAndIncrementResult> {
    // @requires: user is currently assigned the provided assignment
    const foundAssignment = await this.currentAssignments.findOne({
      _id: assignment._id,
      user: user,
      application: assignment.application, // Ensure all fields match for robustness
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

// --- Internal Interfaces for State Definitions ---
// These are outside the class to prevent TypeScript errors regarding circular references or complex types.

/**
 * Interface representing a CurrentAssignment state entry.
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
 * Can return an assignment or an error.
 */
interface GetNextAssignmentResult {
  assignment?: CurrentAssignments;
  error?: string;
}

/**
 * Result type for the submitAndIncrement action.
 * Can return the application ID or an error.
 */
interface SubmitAndIncrementResult {
  application?: Application;
  error?: string;
}
```
