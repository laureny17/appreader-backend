---
timestamp: 'Wed Oct 15 2025 01:06:43 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_010643.0bc765fd.md]]'
content_id: bcdafbcd233b769db43e5f37ef17bda6ffae4d19f75535f3437210993129b583
---

# response:

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

/**
 * concept EventDirectory [Event, User]
 * purpose Manage past and present events and their associated details.
 * principle Users can register for a chosen event and can become a reader if approved (automatically "pending" for approval)
 *     The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event.
 */
export default class EventDirectoryConcept {
  // Declare collection prefix, use concept name
  private readonly PREFIX = "EventDirectory" + ".";

  // Generic types of this concept
  // Using `this['Event']` and `this['User']` to refer to the inner types for clarity within the class.
  type Event = ID;
  type User = ID;

  /**
   * a set of RubricDimensions with
   *     a name String
   *     a description String
   *     a scaleMin Number
   *     a scaleMax Number
   *
   * Note: RubricDimensions are embedded within Events, so they don't have their own top-level collection or ID.
   */
  interface IRubricDimension {
    name: string;
    description: string;
    scaleMin: number;
    scaleMax: number;
  }

  /**
   * a set of Events with
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
   * a set of Memberships with
   *     an event Event
   *     a User
   *     an verified Flag
   *
   * Represents a user's reader status for a specific event.
   */
  interface IMembership {
    _id: ID; // Unique ID for the membership entry itself
    event: Event;
    user: User;
    verified: boolean; // true if approved reader, false if pending/unverified
  }

  /**
   * a set of Admins with
   *     a User
   *
   * Stores the IDs of users who have admin privileges.
   */
  interface IAdmin {
    _id: User; // The User ID directly serves as the document ID
  }

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
  private async _isAdmin(user: this['User']): Promise<boolean> {
    const admin = await this.admins.findOne({ _id: user });
    return !!admin;
  }

  /**
   * actions
   * createEvent (caller: User, name: String, requiredReadsPerApp: Number, rubric: set of RubricDimensions, eligibilityCriteria: set of String): (event: Event)
   *     requires: caller is an admin and no other event exists with the same name
   *     effects: add a new Event and set its active flag to true
   */
  async createEvent(
    { caller, name, requiredReadsPerApp, rubric, eligibilityCriteria = [] }: {
      caller: this['User'];
      name: string;
      requiredReadsPerApp: number;
      rubric: this['IRubricDimension'][];
      eligibilityCriteria?: string[]; // Optional, defaults to empty array
    },
  ): Promise<{ event: this['Event'] } | { error: string }> {
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
    const newEventId = freshID();
    const newEvent: this['IEvent'] = {
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
    { caller, name }: { caller: this['User']; name: string },
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
    { caller, name }: { caller: this['User']; name: string },
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
    { caller, event: eventId, requiredReadsPerApp, rubric, eligibilityCriteria = [] }: {
      caller: this['User'];
      event: this['Event'];
      requiredReadsPerApp: number;
      rubric: this['IRubricDimension'][];
      eligibilityCriteria?: string[];
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
   *     requires: caller is an admin, user is an unverified user for event, and user is not already a verified user in event
   *     effects: makes user a verified user for the specified event
   *
   * IMPORTANT: This action only *promotes* an existing unverified membership to verified.
   * It does NOT create a new membership if one doesn't exist, as per the `requires` clause.
   */
  async addReader(
    { caller, event: eventId, user }: { caller: this['User']; event: this['Event']; user: this['User'] },
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

    // requires: user is an unverified user for event, AND user is not already a verified user in event
    if (!existingMembership || existingMembership.verified) {
      return { error: `User '${user}' is not an unverified member for event '${eventId}'. They must first be in a 'pending' state to be promoted.` };
    }

    // effects: makes user a verified user for the specified event
    await this.memberships.updateOne(
      { _id: existingMembership._id },
      { $set: { verified: true } },
    );

    return {};
  }

  /**
   * removeReader (caller: User, event: Event, user: User)
   *     requires: caller is an admin, user is a verified reader for the event
   *     effects: makes user an unverified user for the specified event
   *
   * Note: The original spec had a potentially contradictory `and user is not already an unverified user in event`
   * in the requires. This implementation simplifies to just checking `user is a verified reader`
   * as the precondition for being able to revoke that status.
   */
  async removeReader(
    { caller, event: eventId, user }: { caller: this['User']; event: this['Event']; user: this['User'] },
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
      return { error: `User '${user}' is not a verified reader for event '${eventId}'.` };
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
    { caller, user }: { caller: this['User']; user: this['User'] },
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
    { caller, user }: { caller: this['User']; user: this['User'] },
  ): Promise<Empty | { error: string }> {
    // requires: caller is an admin
    if (!(await this._isAdmin(caller))) {
      return { error: "Only admins can remove other admins." };
    }

    // requires: user is an admin
    if (!(await this._isAdmin(user))) {
      return { error: `User '${user}' is not an admin.` };
    }

    // Safety check: Ensure the caller cannot remove themselves if they are the last admin
    // This is a common safety check, although not explicitly in the spec, it prevents locking out all admin functionality.
    const adminCount = await this.admins.countDocuments();
    if (adminCount <= 1 && caller === user) {
      return { error: "Cannot remove the last remaining admin, especially yourself." };
    }

    // effects: make user not an admin
    await this.admins.deleteOne({ _id: user });

    return {};
  }
}
```
