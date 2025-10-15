[@concept-design-overview](../../background/concept-design-overview.md)

[@concept-specifications](../../background/concept-specifications.md)

[@implementing-concepts](../../background/implementing-concepts.md)

[@EventDirectorySpec](EventDirectorySpec.md)
# implement: EventDirectory

# concept: EventDirectory
```
concept EventDirectory [Event, User]
purpose Manage past and present events and their associated details.
principle Users can register for a chosen event and can become a reader if approved (automatically "pending" for approval)
    The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event.

state
    a set of Events with
        a name String
        an active Flag
        a requiredReadsPerApp Number
        a rubric set of RubricDimensions
        an eligibilityCriteria set of String

    a set of RubricDimensions with
        a name String
        a description String
        a scaleMin Number
        a scaleMax Number

    a set of Memberships with
        an event Event
        a User
        an verified Flag

    a set of Admins with
        a User

actions
    createEvent (caller: User, name: String, requiredReadsPerApp: Number, rubric: set of RubricDimensions): (event: Event)
        requires: caller is an admin and no other event exists with the same name
        effects: add a new Event and set its active flag to true

    activateEvent (caller: User, name: String)
        requires: caller is an admin and event is inactive
        effects: sets the event's active flag to true

    inactivateEvent (caller: User, name: String)
        requires: caller is an admin and event is active
        effects: sets the event's active flag to false

    updateEventConfig (caller: User, event: Event, requiredReadsPerApp: Number, rubric: set of RubricDimensions, eligibilityCriteria: set of String)
        requires: caller is an admin
        effects: updates provided fields

    addReader (caller: User, event: Event, user: User)
        requires: caller is an admin, user is an unverified user for event, and user is not already a verified user in event
        effects: makes user a verified user for the specified event

    removeReader (caller: User, event: Event, user: User)
        requires: caller is an admin, user is a verified reader for the event, and user is not already an unverified user in event
        effects: makes user an unverified user for the specified event

    addAdmin (caller: User, user: User)
        requires: caller is an admin and user is not already an admin
        effects: make user an admin

    removeAdmin (caller: User, user: User)
        requires: caller and user are both admins
        effects: make user not an admin

```


# response:

```typescript
// file: src/EventDirectory/EventDirectoryConcept.ts
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * concept EventDirectory [Event, User]
 * purpose Manage past and present events and their associated details.
 * principle Users can register for a chosen event and can become a reader if approved (automatically "pending" for approval)
 *     The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event.
 */

// Declare collection prefix, use concept name
const PREFIX = "EventDirectory" + ".";

// Generic types of this concept
type Event = ID;
type User = ID;
type RubricDimensionID = ID; // Internal ID for rubric dimensions if needed, otherwise treat as value objects.
type MembershipID = ID; // Explicit ID for memberships

/**
 * A RubricDimension is an embedded type within an Event.
 * It's a value object, so no _id is strictly needed if embedded.
 */
interface RubricDimension {
  name: string;
  description: string;
  scaleMin: number;
  scaleMax: number;
}

/**
 * State: a set of Events
 * @property _id: Event - The unique identifier for the event.
 * @property name: string - The name of the event (should be unique).
 * @property active: boolean - Flag indicating if the event is currently active.
 * @property requiredReadsPerApp: number - Number of required reads per application.
 * @property rubric: RubricDimension[] - An array of rubric dimensions for scoring.
 * @property eligibilityCriteria: string[] - Criteria for event eligibility.
 */
interface EventDocument {
  _id: Event;
  name: string;
  active: boolean;
  requiredReadsPerApp: number;
  rubric: RubricDimension[];
  eligibilityCriteria: string[];
}

/**
 * State: a set of Memberships
 * Represents a user's involvement in an event.
 * @property _id: MembershipID - A unique identifier for this membership record.
 * @property event: Event - The ID of the event.
 * @property user: User - The ID of the user.
 * @property verified: boolean - True if the user is an approved reader for the event.
 */
interface MembershipDocument {
  _id: MembershipID;
  event: Event;
  user: User;
  verified: boolean; // True if the user is a verified reader, false if pending/unverified member
}

/**
 * State: a set of Admins
 * Simply stores the User IDs of administrators.
 * @property _id: User - The ID of the user who is an admin.
 */
interface AdminDocument {
  _id: User;
}

export default class EventDirectoryConcept {
  private events: Collection<EventDocument>;
  private memberships: Collection<MembershipDocument>;
  private admins: Collection<AdminDocument>;

  constructor(private readonly db: Db) {
    this.events = this.db.collection(PREFIX + "events");
    this.memberships = this.db.collection(PREFIX + "memberships");
    this.admins = this.db.collection(PREFIX + "admins");
    // Ensure unique index for event names
    this.events.createIndex({ name: 1 }, { unique: true });
    // Ensure unique index for user-event membership
    this.memberships.createIndex({ event: 1, user: 1 }, { unique: true });
  }

  /**
   * Helper method to check if a user is an admin.
   * @param user The ID of the user to check.
   * @returns True if the user is an admin, false otherwise.
   */
  private async _isAdmin(user: User): Promise<boolean> {
    const admin = await this.admins.findOne({ _id: user });
    return !!admin;
  }

  /**
   * Action: createEvent
   * purpose: Allows an admin to create a new event.
   * requires: caller is an admin and no other event exists with the same name.
   * effects: add a new Event and set its active flag to true.
   */
  async createEvent(
    {
      caller,
      name,
      requiredReadsPerApp,
      rubric,
    }: {
      caller: User;
      name: string;
      requiredReadsPerApp: number;
      rubric: RubricDimension[];
    },
  ): Promise<{ event: Event } | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can create events." };
    }

    const existingEvent = await this.events.findOne({ name });
    if (existingEvent) {
      return { error: `An event with the name '${name}' already exists.` };
    }

    const newEventId: Event = freshID();
    const newEvent: EventDocument = {
      _id: newEventId,
      name,
      active: true, // New events are active by default as per spec
      requiredReadsPerApp,
      rubric,
      eligibilityCriteria: [], // Initialize as empty array
    };

    await this.events.insertOne(newEvent);
    return { event: newEventId };
  }

  /**
   * Action: activateEvent
   * purpose: Activates an existing event.
   * requires: caller is an admin and event is inactive.
   * effects: sets the event's active flag to true.
   */
  async activateEvent(
    { caller, name }: { caller: User; name: string },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can activate events." };
    }

    const event = await this.events.findOne({ name });
    if (!event) {
      return { error: `Event '${name}' not found.` };
    }
    if (event.active) {
      return { error: `Event '${name}' is already active.` };
    }

    await this.events.updateOne({ _id: event._id }, { $set: { active: true } });
    return {};
  }

  /**
   * Action: inactivateEvent
   * purpose: Inactivates an existing event.
   * requires: caller is an admin and event is active.
   * effects: sets the event's active flag to false.
   */
  async inactivateEvent(
    { caller, name }: { caller: User; name: string },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can inactivate events." };
    }

    const event = await this.events.findOne({ name });
    if (!event) {
      return { error: `Event '${name}' not found.` };
    }
    if (!event.active) {
      return { error: `Event '${name}' is already inactive.` };
    }

    await this.events.updateOne({ _id: event._id }, { $set: { active: false } });
    return {};
  }

  /**
   * Action: updateEventConfig
   * purpose: Updates configuration details for an existing event.
   * requires: caller is an admin.
   * effects: updates provided fields (requiredReadsPerApp, rubric, eligibilityCriteria).
   */
  async updateEventConfig(
    {
      caller,
      event: eventId,
      requiredReadsPerApp,
      rubric,
      eligibilityCriteria,
    }: {
      caller: User;
      event: Event;
      requiredReadsPerApp?: number;
      rubric?: RubricDimension[];
      eligibilityCriteria?: string[];
    },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can update event configurations." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const updateFields: Partial<EventDocument> = {};
    if (requiredReadsPerApp !== undefined) {
      updateFields.requiredReadsPerApp = requiredReadsPerApp;
    }
    if (rubric !== undefined) {
      updateFields.rubric = rubric;
    }
    if (eligibilityCriteria !== undefined) {
      updateFields.eligibilityCriteria = eligibilityCriteria;
    }

    if (Object.keys(updateFields).length === 0) {
      return { error: "No fields provided for update." };
    }

    await this.events.updateOne({ _id: eventId }, { $set: updateFields });
    return {};
  }

  /**
   * Action: addReader
   * purpose: Approves a user to become a verified reader for an event.
   * requires: caller is an admin, event exists, user is not already a verified reader for the event.
   * effects: makes user a verified user for the specified event (creates or updates membership).
   */
  async addReader(
    { caller, event: eventId, user }: { caller: User; event: Event; user: User },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can add readers." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const membership = await this.memberships.findOne({ event: eventId, user });

    if (membership?.verified) {
      return { error: `User '${user}' is already a verified reader for event '${eventId}'.` };
    }

    if (membership) {
      // User is an unverified member, update to verified
      await this.memberships.updateOne(
        { _id: membership._id },
        { $set: { verified: true } },
      );
    } else {
      // No membership exists, create a new verified one
      const newMembershipId: MembershipID = freshID();
      await this.memberships.insertOne({
        _id: newMembershipId,
        event: eventId,
        user,
        verified: true,
      });
    }

    return {};
  }

  /**
   * Action: removeReader
   * purpose: Revokes a user's verified reader status for an event, making them unverified.
   * requires: caller is an admin, event exists, user is a verified reader for the event.
   * effects: makes user an unverified user for the specified event.
   */
  async removeReader(
    { caller, event: eventId, user }: { caller: User; event: Event; user: User },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can remove readers." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const membership = await this.memberships.findOne({ event: eventId, user });

    if (!membership || !membership.verified) {
      return { error: `User '${user}' is not a verified reader for event '${eventId}'.` };
    }

    // Update membership to unverified
    await this.memberships.updateOne(
      { _id: membership._id },
      { $set: { verified: false } },
    );

    return {};
  }

  /**
   * Action: addAdmin
   * purpose: Grants administrator privileges to a user.
   * requires: caller is an admin and user is not already an admin.
   * effects: make user an admin.
   */
  async addAdmin(
    { caller, user }: { caller: User; user: User },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only existing admins can add new admins." };
    }
    if (await this._isAdmin(user)) {
      return { error: `User '${user}' is already an admin.` };
    }

    await this.admins.insertOne({ _id: user });
    return {};
  }

  /**
   * Action: removeAdmin
   * purpose: Revokes administrator privileges from a user.
   * requires: caller and user are both admins.
   * effects: make user not an admin.
   */
  async removeAdmin(
    { caller, user }: { caller: User; user: User },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdmin(caller)) {
      return { error: "Only admins can remove other admins." };
    }
    if (!await this._isAdmin(user)) {
      return { error: `User '${user}' is not an admin.` };
    }
    if (caller === user) {
      // Optional: Prevent an admin from removing themselves if they are the last admin.
      // For simplicity, I'll allow it as per spec, but a real app might add more checks.
      const adminCount = await this.admins.countDocuments({});
      if (adminCount === 1) {
        return { error: "Cannot remove the last remaining admin." };
      }
    }

    await this.admins.deleteOne({ _id: user });
    return {};
  }

  // --- Queries (implicit but can be made explicit if complex) ---

  /**
   * Query: _getEventByName
   * purpose: Retrieves an event by its name.
   * effects: Returns the event document if found.
   */
  async _getEventByName(
    { name }: { name: string },
  ): Promise<EventDocument | null> {
    return this.events.findOne({ name });
  }

  /**
   * Query: _getEventById
   * purpose: Retrieves an event by its ID.
   * effects: Returns the event document if found.
   */
  async _getEventById(
    { event: eventId }: { event: Event },
  ): Promise<EventDocument | null> {
    return this.events.findOne({ _id: eventId });
  }

  /**
   * Query: _isReaderVerified
   * purpose: Checks if a user is a verified reader for a specific event.
   * effects: Returns true if the user is a verified reader, false otherwise.
   */
  async _isReaderVerified(
    { event: eventId, user }: { event: Event; user: User },
  ): Promise<boolean> {
    const membership = await this.memberships.findOne({ event: eventId, user });
    return !!membership?.verified;
  }

  /**
   * Query: _getUserMembership
   * purpose: Retrieves a user's membership details for a specific event.
   * effects: Returns the membership document if found, null otherwise.
   */
  async _getUserMembership(
    { event: eventId, user }: { event: Event; user: User },
  ): Promise<MembershipDocument | null> {
    return this.memberships.findOne({ event: eventId, user });
  }
}
```