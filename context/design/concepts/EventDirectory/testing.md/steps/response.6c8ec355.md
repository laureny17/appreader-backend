---
timestamp: 'Wed Oct 15 2025 01:49:42 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_014942.f5be769d.md]]'
content_id: 6c8ec355598c55073009b75c3b1c2a090535ad71624b323bd9c4a3384052c651
---

# response:

To generate a full test suite for the `EventDirectoryConcept` based on the provided trace, we'll create a Deno test file. This test will use mock MongoDB `Collection` and `Db` implementations to avoid external database dependencies and ensure deterministic, fast test execution.

First, let's ensure the `EventDirectoryConcept.ts` file is correctly structured for the generic types and imports as previously discussed:

```typescript
// src/concepts/EventDirectory/EventDirectoryConcept.ts
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Generic types of this concept, defined outside the class as per instructions.
type Event = ID;
type User = ID;

/**
 * Represents a single dimension within an event's rubric.
 * These are embedded within the `IEvent` interface.
 * state: a set of RubricDimensions with
 *     a name String
 *     a description String
 *     a scaleMin Number
 *     a scaleMax Number
 */
interface IRubricDimension {
  name: string;
  description: string;
  scaleMin: number;
  scaleMax: number;
}

/**
 * Represents an event managed by the EventDirectory concept.
 * state: a set of Events with
 *     a name String
 *     an active Flag
 *     a requiredReadsPerApp Number
 *     a rubric set of RubricDimensions
 *     an eligibilityCriteria set of String
 */
interface IEvent {
  _id: Event;
  name: string;
  active: boolean;
  requiredReadsPerApp: number;
  rubric: IRubricDimension[];
  eligibilityCriteria: string[];
}

/**
 * Represents a user's reader status for a specific event.
 * state: a set of Memberships with
 *     an event Event
 *     a User
 *     an verified Flag
 */
interface IMembership {
  _id: ID; // Unique ID for the membership entry itself
  event: Event;
  user: User;
  verified: boolean; // true if approved reader, false if pending/unverified
}

/**
 * Represents an administrative user.
 * state: a set of Admins with
 *     a User
 */
interface IAdmin {
  _id: User; // The User ID directly serves as the document ID
}

/**
 * concept EventDirectory [Event, User]
 * purpose Manage past and present events and their associated details.
 * principle Users can register for a chosen event and can become a reader if approved (automatically "pending" for approval)
 *     The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event.
 */
export default class EventDirectoryConcept {
  // Declare collection prefix, use concept name
  private readonly PREFIX = "EventDirectory" + ".";

  private readonly events: Collection<IEvent>;
  private readonly memberships: Collection<IMembership>;
  private readonly admins: Collection<IAdmin>;

  constructor(private readonly db: Db) {
    this.events = this.db.collection(this.PREFIX + "events");
    this.memberships = this.db.collection(this.PREFIX + "memberships");
    this.admins = this.db.collection(this.PREFIX + "admins");
  }

  /**
   * Helper query to check if a user is an admin.
   * @param user The ID of the user to check.
   * @returns true if the user is an admin, false otherwise.
   */
  private async _isAdmin(user: User): Promise<boolean> {
    const admin = await this.admins.findOne({ _id: user });
    return !!admin;
  }

  /**
   * createEvent (caller: User, name: String, requiredReadsPerApp: Number, rubric: set of RubricDimensions, eligibilityCriteria: set of String): (event: Event)
   *     requires: caller is an admin and no other event exists with the same name
   *     effects: add a new Event and set its active flag to true
   */
  async createEvent(
    { caller, name, requiredReadsPerApp, rubric, eligibilityCriteria = [] }: { // eligibilityCriteria now optional in input, defaults to []
      caller: User;
      name: string;
      requiredReadsPerApp: number;
      rubric: IRubricDimension[];
      eligibilityCriteria?: string[]; // Made optional for action input
    },
  ): Promise<{ event: Event } | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can create events." };
    }

    // requires: no other event exists with the same name
    const existingEvent = await this.events.findOne({ name: name });
    if (existingEvent) {
      return { error: `An event with the name '${name}' already exists.` };
    }

    // effects: add a new Event and set its active flag to true
    const newEventId = freshID() as Event; // Cast to Event type
    const newEvent: IEvent = {
      _id: newEventId,
      name: name,
      active: true,
      requiredReadsPerApp: requiredReadsPerApp,
      rubric: rubric,
      eligibilityCriteria: eligibilityCriteria,
    };
    await this.events.insertOne(newEvent);

    return { event: newEventId };
  }

  /**
   * activateEvent (caller: User, name: String)
   *     requires: caller is an admin and event is inactive
   *     effects: sets the event's active flag to true
   */
  async activateEvent(
    { caller, name }: { caller: User; name: string },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can activate events." };
    }

    const eventToUpdate = await this.events.findOne({ name: name });
    if (!eventToUpdate) {
      return { error: `Event with name '${name}' not found.` };
    }

    // requires: event is inactive
    if (eventToUpdate.active) {
      return { error: `Event '${name}' is already active.` };
    }

    // effects: sets the event's active flag to true
    await this.events.updateOne({ _id: eventToUpdate._id }, { $set: { active: true } });

    return {};
  }

  /**
   * inactivateEvent (caller: User, name: String)
   *     requires: caller is an admin and event is active
   *     effects: sets the event's active flag to false
   */
  async inactivateEvent(
    { caller, name }: { caller: User; name: string },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can inactivate events." };
    }

    const eventToUpdate = await this.events.findOne({ name: name });
    if (!eventToUpdate) {
      return { error: `Event with name '${name}' not found.` };
    }

    // requires: event is active
    if (!eventToUpdate.active) {
      return { error: `Event '${name}' is already inactive.` };
    }

    // effects: sets the event's active flag to false
    await this.events.updateOne({ _id: eventToUpdate._id }, { $set: { active: false } });

    return {};
  }

  /**
   * updateEventConfig (caller: User, event: Event, requiredReadsPerApp: Number, rubric: set of RubricDimensions, eligibilityCriteria: set of String)
   *     requires: caller is an admin
   *     effects: updates provided fields
   */
  async updateEventConfig(
    { caller, event: eventId, requiredReadsPerApp, rubric, eligibilityCriteria }: {
      caller: User;
      event: Event;
      requiredReadsPerApp: number;
      rubric: IRubricDimension[];
      eligibilityCriteria: string[];
    },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can update event configuration." };
    }

    const eventToUpdate = await this.events.findOne({ _id: eventId });
    if (!eventToUpdate) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    // effects: updates provided fields
    await this.events.updateOne(
      { _id: eventId },
      {
        $set: {
          requiredReadsPerApp: requiredReadsPerApp,
          rubric: rubric,
          eligibilityCriteria: eligibilityCriteria,
        },
      },
    );

    return {};
  }

  /**
   * addReader (caller: User, event: Event, user: User)
   *     requires: caller is an admin, event exists. user is not already a verified user for event.
   *     effects: makes user a verified user for the specified event.
   *              If user was unverified, updates to verified. If user was not a member, creates a new verified membership.
   */
  async addReader(
    { caller, event: eventId, user }: { caller: User; event: Event; user: User },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can add readers." };
    }

    const existingEvent = await this.events.findOne({ _id: eventId });
    if (!existingEvent) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const existingMembership = await this.memberships.findOne({ event: eventId, user: user });

    // requires: user is not already a verified user for event
    if (existingMembership?.verified) {
      return { error: `User '${user}' is already a verified reader for event '${eventId}'.` };
    }

    // effects: makes user a verified user for the specified event
    // If user was unverified, updates to verified. If user was not a member, creates a new verified membership.
    if (existingMembership) {
      await this.memberships.updateOne(
        { _id: existingMembership._id },
        { $set: { verified: true } },
      );
    } else {
      await this.memberships.insertOne({
        _id: freshID(),
        event: eventId,
        user: user,
        verified: true,
      });
    }

    return {};
  }

  /**
   * removeReader (caller: User, event: Event, user: User)
   *     requires: caller is an admin, event exists. user is a verified reader for the event.
   *     effects: makes user an unverified user for the specified event (sets verified flag to false).
   */
  async removeReader(
    { caller, event: eventId, user }: { caller: User; event: Event; user: User },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can remove readers." };
    }

    const existingEvent = await this.events.findOne({ _id: eventId });
    if (!existingEvent) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const existingMembership = await this.memberships.findOne({ event: eventId, user: user });

    // requires: user is a verified reader for the event
    if (!existingMembership || !existingMembership.verified) {
      return { error: `User '${user}' is not currently a verified reader for event '${eventId}'.` };
    }

    // effects: makes user an unverified user for the specified event
    await this.memberships.updateOne(
      { _id: existingMembership._id },
      { $set: { verified: false } },
    );

    return {};
  }

  /**
   * addAdmin (caller: User, user: User)
   *     requires: caller is an admin and user is not already an admin
   *     effects: make user an admin
   */
  async addAdmin(
    { caller, user }: { caller: User; user: User },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only existing admins can add new admins." };
    }

    // requires: user is not already an admin
    if (await this._isAdmin(user)) {
      return { error: `User '${user}' is already an admin.` };
    }

    // effects: make user an admin
    await this.admins.insertOne({ _id: user });

    return {};
  }

  /**
   * removeAdmin (caller: User, user: User)
   *     requires: caller and user are both admins
   *     effects: make user not an admin
   */
  async removeAdmin(
    { caller, user }: { caller: User; user: User },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can remove other admins." };
    }

    // requires: user is an admin
    if (!(await this._isAdmin(user))) {
      return { error: `User '${user}' is not an admin.` };
    }

    // Safety check: Ensure the caller cannot remove themselves if they are the last admin,
    // to prevent accidental lockout of all administrative functionality.
    const adminCount = await this.admins.countDocuments();
    if (adminCount <= 1 && caller === user) {
      return { error: "Cannot remove the last remaining admin, especially yourself. Add another admin first." };
    }

    // effects: make user not an admin
    await this.admins.deleteOne({ _id: user });

    return {};
  }
}
```

Now, the test suite:

```typescript
// test/concepts/EventDirectory/EventDirectoryConcept.test.ts
import { Collection, Db, MongoClient } from "npm:mongodb";
import { assertEquals, assert } from "https://deno.land/std@0.210.0/assert/mod.ts";
import { ID } from "../../../utils/types.ts"; // Adjust path as needed
import { freshID } from "../../../utils/database.ts"; // Adjust path as needed
import EventDirectoryConcept from "./EventDirectoryConcept.ts"; // Adjust path as needed

// Mock Collection implementation to simulate MongoDB operations
class MockCollection<T extends { _id: ID }> implements Collection<T> {
  private data = new Map<ID, T>();
  public collectionName: string;

  constructor(name: string) {
    this.collectionName = name;
  }

  async insertOne(doc: T): Promise<any> {
    const id = doc._id || freshID();
    this.data.set(id, { ...doc, _id: id }); // Ensure _id is present and copy
    return { acknowledged: true, insertedId: id };
  }

  async findOne(filter: Partial<T>): Promise<T | null> {
    for (const item of this.data.values()) {
      let matches = true;
      for (const key in filter) {
        if (filter[key] !== item[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        return { ...item }; // Return a copy to prevent external modification of internal state
      }
    }
    return null;
  }

  async updateOne(filter: Partial<T>, update: any): Promise<any> {
    const itemToUpdate = await this.findOne(filter);
    if (itemToUpdate) {
      const updatedDoc = { ...itemToUpdate, ...update.$set };
      this.data.set(itemToUpdate._id, updatedDoc);
      return { acknowledged: true, modifiedCount: 1 };
    }
    return { acknowledged: true, modifiedCount: 0 };
  }

  async deleteOne(filter: Partial<T>): Promise<any> {
    const itemToDelete = await this.findOne(filter);
    if (itemToDelete) {
      this.data.delete(itemToDelete._id);
      return { acknowledged: true, deletedCount: 1 };
    }
    return { acknowledged: true, deletedCount: 0 };
  }

  async countDocuments(filter?: Partial<T>): Promise<number> {
    if (!filter || Object.keys(filter).length === 0) {
      return this.data.size;
    }
    let count = 0;
    for (const item of this.data.values()) {
      let matches = true;
      for (const key in filter) {
        if (filter[key] !== item[key]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        count++;
      }
    }
    return count;
  }

  async find(filter?: Partial<T>): Promise<any> { // Simplified for .toArray()
    let results: T[] = [];
    for (const item of this.data.values()) {
      let matches = true;
      if (filter) {
        for (const key in filter) {
          if (filter[key] !== item[key]) {
            matches = false;
            break;
          }
        }
      }
      if (matches) {
        results.push({ ...item }); // Deep copy
      }
    }
    return {
      toArray: () => Promise.resolve(results),
    };
  }

  clear() {
    this.data.clear();
  }

  // --- Minimal mocks for Collection interface methods not directly used by concept, to satisfy TypeScript ---
  bulkWrite(): any { throw new Error("Method not implemented."); }
  createIndexes(): any { throw new Error("Method not implemented."); }
  drop(): any { throw new Error("Method not implemented."); }
  estimatedDocumentCount(): any { throw new Error("Method not implemented."); }
  distinct(): any { throw new Error("Method not implemented."); }
  aggregate(): any { throw new Error("Method not implemented."); }
  mapReduce(): any { throw new Error("Method not implemented."); }
  stats(): any { throw new Error("Method not implemented."); }
  watch(): any { throw new Error("Method not implemented."); }
  rename(): any { throw new Error("Method not implemented."); }
  replaceOne(): any { throw new Error("Method not implemented."); }
  findOneAndUpdate(): any { throw new Error("Method not implemented."); }
  findOneAndDelete(): any { throw new Error("Method not implemented."); }
  findOneAndReplace(): any { throw new Error("Method not implemented."); }
  updateMany(): any { throw new Error("Method not implemented."); }
  deleteMany(): any { throw new Error("Method not implemented."); }
  insertMany(): any { throw new Error("Method not implemented."); }
  indexes(): any { throw new Error("Method not implemented."); }
  indexExists(): any { throw new Error("Method not implemented."); }
  indexInformation(): any { throw new Error("Method not implemented."); }
  dropIndex(): any { throw new Error("Method not implemented."); }
  dropIndexes(): any { throw new Error("Method not implemented."); }
  listIndexes(): any { throw new Error("Method not implemented."); }
  syncIndexes(): any { throw new Error("Method not implemented."); }
  mongoClient: MongoClient = {} as MongoClient;
  namespace: string = "";
  readConcern: any;
  readPreference: any;
  writeConcern: any;
  hint: any;
  withReadConcern(): any { throw new Error("Method not implemented."); }
  withReadPreference(): any { throw new Error("Method not implemented."); }
  withWriteConcern(): any { throw new Error("Method not implemented."); }
}

// Mock Db implementation
class MockDb implements Db {
  private collections = new Map<string, MockCollection<any>>();
  databaseName: string = "mockdb";

  collection<T extends { _id: ID }>(name: string): MockCollection<T> {
    if (!this.collections.has(name)) {
      this.collections.set(name, new MockCollection<T>(name));
    }
    return this.collections.get(name) as MockCollection<T>;
  }

  async clearAllCollections() {
    for (const collection of this.collections.values()) {
      collection.clear();
    }
  }

  // --- Minimal mocks for Db interface methods not directly used by concept, to satisfy TypeScript ---
  aggregate<T extends Record<string, unknown>>(pipeline?: Array<Record<string, unknown>> | undefined, options?: Record<string, unknown> | undefined): import("npm:mongodb").AggregationCursor<T> { throw new Error("Method not implemented."); }
  bufferMaxEntries: number = 0;
  command<T extends Record<string, unknown>>(command: Record<string, unknown>, options?: import("npm:mongodb").CommandOperationOptions | undefined): Promise<T> { throw new Error("Method not implemented."); }
  createCollection<T extends Record<string, unknown>>(name: string, options?: import("npm:mongodb").CreateCollectionOptions | undefined): Promise<import("npm:mongodb").Collection<T>> { throw new Error("Method not implemented."); }
  createIndex(name: string, key: import("npm:mongodb").IndexSpecification, options?: import("npm:mongodb").CreateIndexesOptions | undefined): Promise<string> { throw new Error("Method not implemented."); }
  dropCollection(name: string, options?: import("npm:mongodb").DropCollectionOptions | undefined): Promise<boolean> { throw new Error("Method not implemented."); }
  dropDatabase(options?: import("npm:mongodb").DropDatabaseOptions | undefined): Promise<boolean> { throw new Error("Method not implemented."); }
  indexInformation(options?: import("npm:mongodb").IndexInformationOptions | undefined): Promise<any> { throw new Error("Method not implemented."); }
  listCollections(filter?: Record<string, unknown> | undefined, options?: import("npm:mongodb").ListCollectionsOptions | undefined): import("npm:mongodb").ListCollectionsCursor { throw new Error("Method not implemented."); }
  listIndexes(collectionName: string, options?: import("npm:mongodb").ListIndexesOptions | undefined): import("npm:mongodb").ListIndexesCursor { throw new Error("Method not implemented."); }
  renameCollection(fromCollection: string, toCollection: string, options?: import("npm:mongodb").RenameOptions | undefined): Promise<import("npm:mongodb").Collection<any>> { throw new Error("Method not implemented."); }
  runCommand<T extends Record<string, unknown>>(command: Record<string, unknown>, options?: import("npm:mongodb").CommandOperationOptions | undefined): Promise<T> { throw new Error("Method not implemented."); }
  stats(options?: import("npm:mongodb").DbStatsOptions | undefined): Promise<import("npm:mongodb").DbStats> { throw new Error("Method not implemented."); }
  watch<T extends Record<string, unknown> = Record<string, unknown>, K extends Record<string, unknown> = Record<string, unknown>>(pipeline?: Array<Record<string, unknown>> | undefined, options?: import("npm:mongodb").ChangeStreamOptions | undefined): import("npm:mongodb").ChangeStream<T, K> { throw new Error("Method not implemented."); }
  withSession(options: import("npm:mongodb").ClientSessionOptions, fn: (session: import("npm:mongodb").ClientSession) => Promise<any>): Promise<any> { throw new Error("Method not implemented."); }
  getClient(): MongoClient { throw new Error("Method not implemented."); }
  startSession(options?: import("npm:mongodb").ClientSessionOptions | undefined): import("npm:mongodb").ClientSession { throw new Error("Method not implemented."); }
  get readConcern(): import("npm:mongodb").ReadConcern | undefined { return undefined; }
  get readPreference(): import("npm:mongodb").ReadPreference | undefined { return undefined; }
  get writeConcern(): import("npm:mongodb").WriteConcern | undefined { return undefined; }
  get namespace(): string { return this.databaseName; }
  get client(): MongoClient { throw new Error("Method not implemented."); }
}

// Global instances for tests
let mockDb: MockDb;
let concept: EventDirectoryConcept;
let adminId: ID;
let readerAId: ID;
let readerBId: ID;
let eventId1: ID; // To be set after createEvent

// Helper to get collection for direct assertion by name
const getCollection = <T extends { _id: ID }>(collectionName: string) => mockDb.collection<T>(`EventDirectory.${collectionName}`);

Deno.test({
  name: "EventDirectory Principle Fulfillment",
  async fn(t) {
    mockDb = new MockDb();
    concept = new EventDirectoryConcept(mockDb);

    // Initialize test user IDs
    adminId = "user:admin_001" as ID;
    readerAId = "user:reader_A" as ID;
    readerBId = "user:reader_B" as ID;

    // --- Initial Setup (as per trace assumptions: adminId is already an admin) ---
    await getCollection<EventDirectoryConcept["IAdmin"]>("admins").insertOne({ _id: adminId });
    console.log(`Initial Setup: Admin ${adminId} seeded.`);

    await t.step("Step 1: Admin creates an event.", async () => {
      const rubricDimensions = [{
        name: "Innovation",
        description: "Originality of idea",
        scaleMin: 1,
        scaleMax: 5,
      }];
      const result = await concept.createEvent({
        caller: adminId,
        name: "Annual Hackathon",
        requiredReadsPerApp: 2,
        rubric: rubricDimensions,
        eligibilityCriteria: [], // Explicitly empty as per concept default for optional param
      });

      if ("error" in result) {
        throw new Error(`Step 1 failed: ${result.error}`);
      }
      eventId1 = result.event; // Store for subsequent steps
      console.log(`Step 1: Created event with ID: ${eventId1}`);

      // Verify effect
      const event = await getCollection<EventDirectoryConcept["IEvent"]>("events").findOne({ _id: eventId1 });
      assert(event !== null, "Event should exist after creation.");
      assertEquals(event?.name, "Annual Hackathon");
      assertEquals(event?.active, true);
      assertEquals(event?.requiredReadsPerApp, 2);
      assertEquals(event?.rubric.length, 1);
      assertEquals(event?.rubric[0].name, "Innovation");
      assertEquals(event?.eligibilityCriteria.length, 0);
    });

    await t.step("Step 2: Admin updates the event configuration, adding more detail.", async () => {
      const updatedRubricDimensions = [
        { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
        { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
      ];
      const eligibilityCriteria = ["Must be enrolled in a university program"];

      const result = await concept.updateEventConfig({
        caller: adminId,
        event: eventId1,
        requiredReadsPerApp: 3,
        rubric: updatedRubricDimensions,
        eligibilityCriteria: eligibilityCriteria,
      });

      if ("error" in result) {
        throw new Error(`Step 2 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 2: Updated event config for event ID: ${eventId1}`);

      // Verify effect
      const event = await getCollection<EventDirectoryConcept["IEvent"]>("events").findOne({ _id: eventId1 });
      assert(event !== null, "Event should still exist after update.");
      assertEquals(event?.requiredReadsPerApp, 3);
      assertEquals(event?.rubric.length, 2);
      assertEquals(event?.rubric[1].name, "Execution");
      assertEquals(event?.eligibilityCriteria, eligibilityCriteria);
    });

    await t.step("Step 3: Admin adds a user (readerAId) as a verified reader for the event.", async () => {
      const result = await concept.addReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      if ("error" in result) {
        throw new Error(`Step 3 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 3: Added reader A: ${readerAId} for event: ${eventId1}`);

      // Verify effect
      const membership = await getCollection<EventDirectoryConcept["IMembership"]>("memberships").findOne({ event: eventId1, user: readerAId });
      assert(membership !== null, "Membership for reader A should exist.");
      assertEquals(membership?.verified, true);
    });

    await t.step("Step 4: Admin attempts to add the same user (readerAId) as a reader again (testing 'requires').", async () => {
      const result = await concept.addReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      assert("error" in result, "Expected an error when adding the same verified reader.");
      assertEquals(result.error, `User '${readerAId}' is already a verified reader for event '${eventId1}'.`);
      console.log(`Step 4: Attempted to re-add reader A (expected error): ${result.error}`);

      // Verify no change to state
      const membership = await getCollection<EventDirectoryConcept["IMembership"]>("memberships").findOne({ event: eventId1, user: readerAId });
      assert(membership !== null, "Membership for reader A should still exist.");
      assertEquals(membership?.verified, true);
    });

    await t.step("Step 5: Admin adds another user (readerBId) as a verified reader.", async () => {
      const result = await concept.addReader({
        caller: adminId,
        event: eventId1,
        user: readerBId,
      });

      if ("error" in result) {
        throw new Error(`Step 5 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 5: Added reader B: ${readerBId} for event: ${eventId1}`);

      // Verify effect
      const membership = await getCollection<EventDirectoryConcept["IMembership"]>("memberships").findOne({ event: eventId1, user: readerBId });
      assert(membership !== null, "Membership for reader B should exist.");
      assertEquals(membership?.verified, true);
    });

    await t.step("Step 6: Admin inactivates the event ('archives' it).", async () => {
      const result = await concept.inactivateEvent({
        caller: adminId,
        name: "Annual Hackathon",
      });

      if ("error" in result) {
        throw new Error(`Step 6 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 6: Inactivated event: ${eventId1}`);

      // Verify effect
      const event = await getCollection<EventDirectoryConcept["IEvent"]>("events").findOne({ _id: eventId1 });
      assert(event !== null, "Event should still exist.");
      assertEquals(event?.active, false);
    });

    await t.step("Step 7: Admin attempts to update the configuration of the now inactive event.", async () => {
      const currentRubric = [
        { name: "Innovation", description: "Originality of idea", scaleMin: 1, scaleMax: 5 },
        { name: "Execution", description: "Quality of implementation", scaleMin: 1, scaleMax: 5 },
      ];
      const newEligibilityCriteria = ["Must be enrolled in a university program", "Attended info session"];

      const result = await concept.updateEventConfig({
        caller: adminId,
        event: eventId1,
        requiredReadsPerApp: 4,
        rubric: currentRubric,
        eligibilityCriteria: newEligibilityCriteria,
      });

      if ("error" in result) {
        throw new Error(`Step 7 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 7: Updated config of inactive event: ${eventId1}`);

      // Verify effect
      const event = await getCollection<EventDirectoryConcept["IEvent"]>("events").findOne({ _id: eventId1 });
      assert(event !== null, "Event should exist.");
      assertEquals(event?.requiredReadsPerApp, 4);
      assertEquals(event?.eligibilityCriteria, newEligibilityCriteria);
      assertEquals(event?.active, false, "Event should remain inactive as updateEventConfig doesn't change active status.");
    });

    await t.step("Step 8: Admin activates the event again.", async () => {
      const result = await concept.activateEvent({
        caller: adminId,
        name: "Annual Hackathon",
      });

      if ("error" in result) {
        throw new Error(`Step 8 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 8: Activated event: ${eventId1}`);

      // Verify effect
      const event = await getCollection<EventDirectoryConcept["IEvent"]>("events").findOne({ _id: eventId1 });
      assert(event !== null, "Event should exist.");
      assertEquals(event?.active, true);
    });

    await t.step("Step 9: Admin removes a reader (readerAId) from the event.", async () => {
      const result = await concept.removeReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      if ("error" in result) {
        throw new Error(`Step 9 failed: ${result.error}`);
      }
      assertEquals(result, {}, "Expected empty success result.");
      console.log(`Step 9: Removed reader A: ${readerAId} from event: ${eventId1}`);

      // Verify effect
      const membership = await getCollection<EventDirectoryConcept["IMembership"]>("memberships").findOne({ event: eventId1, user: readerAId });
      assert(membership !== null, "Membership for reader A should still exist.");
      assertEquals(membership?.verified, false);
    });

    await t.step("Step 10: Admin attempts to remove the same user (readerAId) again (negative test for 'requires').", async () => {
      const result = await concept.removeReader({
        caller: adminId,
        event: eventId1,
        user: readerAId,
      });

      assert("error" in result, "Expected an error when removing an already unverified reader.");
      assertEquals(result.error, `User '${readerAId}' is not currently a verified reader for event '${eventId1}'.`);
      console.log(`Step 10: Attempted to re-remove reader A (expected error): ${result.error}`);

      // Verify no change to state
      const membership = await getCollection<EventDirectoryConcept["IMembership"]>("memberships").findOne({ event: eventId1, user: readerAId });
      assert(membership !== null, "Membership for reader A should still exist.");
      assertEquals(membership?.verified, false);
    });

    await t.step("Step 11: Final verification of reader states.", async () => {
      // Direct query to the mock database for memberships related to the event
      const eventMemberships = await getCollection<EventDirectoryConcept["IMembership"]>("memberships").find({ event: eventId1 }).toArray();

      const readerAMembership = eventMemberships.find(m => m.user === readerAId);
      const readerBMembership = eventMemberships.find(m => m.user === readerBId);

      assert(readerAMembership !== undefined, "Reader A membership should be found.");
      assert(readerBMembership !== undefined, "Reader B membership should be found.");

      assertEquals(readerAMembership?.verified, false, "Reader A should be unverified.");
      assertEquals(readerBMembership?.verified, true, "Reader B should be verified.");
      console.log(`Step 11: Final verification of reader states confirmed.`);
    });
  },
  // Disable sanitization as we manage shared state (mockDb) across nested steps within this test function.
  sanitizeResources: false,
  sanitizeOps: false,
});
```
