---
timestamp: 'Wed Oct 15 2025 02:08:31 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_020831.36955cfa.md]]'
content_id: b3da90bea299ff140cae8f099af00a9023efae89cabf7046448385811a512d44
---

# current tests:

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Generic types of this concept, defined outside the class as per instructions.
// These types are used for IDs that reference external objects or other concept-managed entities.
type Event = ID;
type User = ID;

/**
 * Represents a single dimension within an event's rubric.
 * These are embedded within the `IEvent` interface, as they are not top-level entities in the state.
 *
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
 *
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
  active: boolean; // Flag to indicate if the event is currently active or archived
  requiredReadsPerApp: number;
  rubric: IRubricDimension[];
  eligibilityCriteria: string[]; // Criteria for applicants to be eligible for this event
}

/**
 * Represents a user's reader status for a specific event.
 * This implicitly covers "pending" or "unverified" status when `verified` is false,
 * and "approved" or "verified" when `verified` is true.
 *
 * state: a set of Memberships with
 *     an event Event
 *     a User
 *     an verified Flag
 */
interface IMembership {
  _id: ID; // Unique ID for the membership entry itself
  event: Event; // Reference to the Event ID
  user: User; // Reference to the User ID
  verified: boolean; // true if approved reader, false if pending/unverified
}

/**
 * Represents an administrative user within the EventDirectory concept.
 *
 * state: a set of Admins with
 *     a User
 */
interface IAdmin {
  _id: User; // The User ID directly serves as the document ID for simplicity
}

/**
 * concept EventDirectory [Event, User]
 * purpose Manage past and present events and their associated details.
 * principle Users can register for a chosen event and can become a reader if approved (automatically "pending" for approval)
 *     The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event.
 */
export default class EventDirectoryConcept {
  // Declare collection prefix, use concept name for modularity in the database
  private readonly PREFIX = "EventDirectory" + ".";

  // MongoDB collections corresponding to the state components
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
   * This is a private query method, indicated by the leading underscore.
   *
   * @param user The ID of the user to check.
   * @returns true if the user is an admin, false otherwise.
   */
  private async _isAdmin(user: User): Promise<boolean> {
    const admin = await this.admins.findOne({ _id: user });
    return !!admin;
  }

  /**
   * createEvent (caller: User, name: String, requiredReadsPerApp: Number, rubric: set of RubricDimensions): (event: Event)
   *     requires: caller is an admin and no other event exists with the same name
   *     effects: add a new Event and set its active flag to true
   */
  async createEvent(
    { caller, name, requiredReadsPerApp, rubric }: {
      caller: User;
      name: string;
      requiredReadsPerApp: number;
      rubric: IRubricDimension[];
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
    // Initialize eligibilityCriteria as an empty array as it's not provided in createEvent input
    const newEventId = freshID() as Event; // Cast to Event type for type safety
    const newEvent: IEvent = {
      _id: newEventId,
      name: name,
      active: true,
      requiredReadsPerApp: requiredReadsPerApp,
      rubric: rubric,
      eligibilityCriteria: [],
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

    // effects: makes user a verified user for the specified event.
    // If user was an unverified member, update their status.
    // If user was not a member, create a new verified membership.
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

  // --- Query methods (prefixed with underscore) ---

  /**
   * _getEventByName (name: String): (event: Event | null)
   * effects: Returns the event matching the given name, or null if not found.
   */
  async _getEventByName(
    { name }: { name: string },
  ): Promise<{ event: IEvent | null }> {
    const event = await this.events.findOne({ name: name });
    return { event };
  }

  /**
   * _getEventById (id: Event): (event: Event | null)
   * effects: Returns the event matching the given ID, or null if not found.
   */
  async _getEventById(
    { id }: { id: Event },
  ): Promise<{ event: IEvent | null }> {
    const event = await this.events.findOne({ _id: id });
    return { event };
  }

  /**
   * _listActiveEvents (): (events: set of Event)
   * effects: Returns a list of all currently active events.
   */
  async _listActiveEvents(): Promise<{ events: IEvent[] }> {
    const activeEvents = await this.events.find({ active: true }).toArray();
    return { events: activeEvents };
  }

  /**
   * _listAllEvents (): (events: set of Event)
   * effects: Returns a list of all events, active or inactive.
   */
  async _listAllEvents(): Promise<{ events: IEvent[] }> {
    const allEvents = await this.events.find({}).toArray();
    return { events: allEvents };
  }

  /**
   * _getReaderMembership (event: Event, user: User): (membership: Membership | null)
   * effects: Returns the membership status for a specific user in an event, or null if no membership exists.
   */
  async _getReaderMembership(
    { event: eventId, user }: { event: Event; user: User },
  ): Promise<{ membership: IMembership | null }> {
    const membership = await this.memberships.findOne({ event: eventId, user: user });
    return { membership };
  }

  /**
   * _getVerifiedReadersForEvent (event: Event): (users: set of User)
   * effects: Returns a list of all verified reader IDs for a specific event.
   */
  async _getVerifiedReadersForEvent(
    { event: eventId }: { event: Event },
  ): Promise<{ users: User[] }> {
    const verifiedMemberships = await this.memberships.find({
      event: eventId,
      verified: true,
    }).toArray();
    return { users: verifiedMemberships.map(m => m.user) };
  }

  /**
   * _listAdmins (): (users: set of User)
   * effects: Returns a list of all admin user IDs.
   */
  async _listAdmins(): Promise<{ users: User[] }> {
    const admins = await this.admins.find({}).toArray();
    return { users: admins.map(a => a._id) };
  }
}
```
