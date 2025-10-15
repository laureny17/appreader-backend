---
timestamp: 'Wed Oct 15 2025 01:21:25 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_012125.881669c6.md]]'
content_id: 48b82e5d471a6bb0b9dbb78ef82813c873c1cb490576fa73ed6e0fc043bf3426
---

# file: src/eventdirectory/EventDirectoryConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Collection prefix to ensure namespace separation for this concept's data
const PREFIX = "EventDirectory" + ".";

// Generic types for the concept's external dependencies (polymorphic IDs)
type User = ID;
type Event = ID;

/**
 * State: a set of RubricDimensions, a sub-structure within an Event.
 */
interface RubricDimension {
  name: string;
  description: string;
  scaleMin: number;
  scaleMax: number;
}

/**
 * State: a set of Events with name, active flag, requiredReadsPerApp, rubric, eligibilityCriteria.
 * The `_id` field is the unique identifier for an Event document.
 */
interface EventDoc {
  _id: Event;
  name: string;
  active: boolean; // Flag to indicate if the event is currently active or archived
  requiredReadsPerApp: number;
  rubric: RubricDimension[]; // Set of RubricDimensions
  eligibilityCriteria: string[]; // Set of String
}

/**
 * State: a set of Memberships, linking a User to an Event with a verification status.
 * The `_id` field is a unique identifier for each Membership document.
 */
interface MembershipDoc {
  _id: ID; // Unique ID for the membership document
  event: Event;
  user: User;
  verified: boolean; // Flag to indicate if the user is an approved reader for the event
}

/**
 * State: a set of Admins, indicating which Users have administrative privileges.
 * The `_id` field directly uses the User's ID for uniqueness and easy lookup.
 */
interface AdminDoc {
  _id: User; // The User ID directly represents the admin's identity
}

/**
 * @concept EventDirectory
 * @purpose Manage past and present events and their associated details.
 * @principle Users can register for a chosen event and can become a reader if approved (automatically "pending" for approval)
 * The admin can create and archive events and manage rubric/scoring guidelines, number of required reads per application, and approved readers for the active event.
 */
export default class EventDirectoryConcept {
  events: Collection<EventDoc>;
  memberships: Collection<MembershipDoc>;
  admins: Collection<AdminDoc>;

  constructor(private readonly db: Db) {
    this.events = this.db.collection(PREFIX + "events");
    this.memberships = this.db.collection(PREFIX + "memberships");
    this.admins = this.db.collection(PREFIX + "admins");
  }

  // --- Queries ---

  /**
   * Query: Checks if a given user is an admin.
   * @param user The ID of the user to check.
   * @returns True if the user is an admin, false otherwise.
   */
  async _isAdmin({ user }: { user: User }): Promise<boolean> {
    const admin = await this.admins.findOne({ _id: user });
    return !!admin;
  }

  /**
   * Query: Retrieves an event document by its name.
   * @param name The name of the event to retrieve.
   * @returns The EventDoc if found, otherwise null.
   */
  async _getEventByName({ name }: { name: string }): Promise<EventDoc | null> {
    return await this.events.findOne({ name });
  }

  /**
   * Query: Retrieves a specific membership document for a given event and user.
   * @param event The ID of the event.
   * @param user The ID of the user.
   * @returns The MembershipDoc if found, otherwise null.
   */
  async _getMembership({ event, user }: { event: Event; user: User }): Promise<MembershipDoc | null> {
    return await this.memberships.findOne({ event, user });
  }

  /**
   * Query: Retrieves all events currently stored in the directory.
   * @returns An array of all EventDoc documents.
   */
  async _getAllEvents(): Promise<EventDoc[]> {
    return await this.events.find({}).toArray();
  }

  /**
   * Query: Retrieves all users who are currently admins.
   * @returns An array of all AdminDoc documents.
   */
  async _getAllAdmins(): Promise<AdminDoc[]> {
    return await this.admins.find({}).toArray();
  }

  /**
   * Query: Retrieves all verified reader memberships for a specific event.
   * @param event The ID of the event.
   * @returns An array of MembershipDoc documents for verified readers.
   */
  async _getVerifiedReaders({ event }: { event: Event }): Promise<MembershipDoc[]> {
    return await this.memberships.find({ event, verified: true }).toArray();
  }

  // --- Actions ---

  /**
   * Action: Creates a new event.
   * @param caller The user performing the action.
   * @param name The unique name of the new event.
   * @param requiredReadsPerApp The default number of required reads for applications to this event.
   * @param rubric The initial set of rubric dimensions for scoring.
   * @returns An object containing the new event's ID or an error message.
   * @requires caller is an admin and no other event exists with the same name
   * @effects add a new Event and set its active flag to true
   */
  async createEvent({ caller, name, requiredReadsPerApp, rubric }: { caller: User; name: string; requiredReadsPerApp: number; rubric: RubricDimension[] }): Promise<{ event: Event } | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    const existingEvent = await this._getEventByName({ name });
    if (existingEvent) {
      return { error: "An event with this name already exists." };
    }

    const eventId = freshID() as Event;
    await this.events.insertOne({
      _id: eventId,
      name,
      active: true, // New events are active by default
      requiredReadsPerApp,
      rubric,
      eligibilityCriteria: [], // Initialize empty
    });
    return { event: eventId };
  }

  /**
   * Action: Activates an existing event.
   * @param caller The user performing the action.
   * @param name The name of the event to activate.
   * @returns An empty object on success or an error message.
   * @requires caller is an admin and event is inactive
   * @effects sets the event's active flag to true
   */
  async activateEvent({ caller, name }: { caller: User; name: string }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    const event = await this._getEventByName({ name });
    if (!event) {
      return { error: `Event with name '${name}' not found.` };
    }
    if (event.active) {
      return { error: "Event is already active." };
    }

    await this.events.updateOne({ _id: event._id }, { $set: { active: true } });
    return {};
  }

  /**
   * Action: Inactivates (archives) an existing event.
   * @param caller The user performing the action.
   * @param name The name of the event to inactivate.
   * @returns An empty object on success or an error message.
   * @requires caller is an admin and event is active
   * @effects sets the event's active flag to false
   */
  async inactivateEvent({ caller, name }: { caller: User; name: string }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    const event = await this._getEventByName({ name });
    if (!event) {
      return { error: `Event with name '${name}' not found.` };
    }
    if (!event.active) {
      return { error: "Event is already inactive." };
    }

    await this.events.updateOne({ _id: event._id }, { $set: { active: false } });
    return {};
  }

  /**
   * Action: Updates the configuration details of an existing event.
   * @param caller The user performing the action.
   * @param event The ID of the event to update.
   * @param requiredReadsPerApp The new number of required reads.
   * @param rubric The new set of rubric dimensions.
   * @param eligibilityCriteria The new set of eligibility criteria.
   * @returns An empty object on success or an error message.
   * @requires caller is an admin
   * @effects updates provided fields
   */
  async updateEventConfig({ caller, event, requiredReadsPerApp, rubric, eligibilityCriteria }: { caller: User; event: Event; requiredReadsPerApp: number; rubric: RubricDimension[]; eligibilityCriteria: string[] }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: `Event with ID '${event}' not found.` };
    }

    await this.events.updateOne(
      { _id: event },
      { $set: { requiredReadsPerApp, rubric, eligibilityCriteria } },
    );
    return {};
  }

  /**
   * Action: Promotes an unverified user to a verified reader for a specific event.
   * This action requires the user to already have an *unverified* membership.
   * @param caller The user performing the action.
   * @param event The ID of the event.
   * @param user The user to be made a verified reader.
   * @returns An empty object on success or an error message.
   * @requires caller is an admin, user is an unverified user for event, and user is not already a verified user in event
   * @effects makes user a verified user for the specified event
   */
  async addReader({ caller, event, user }: { caller: User; event: Event; user: User }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: `Event with ID '${event}' not found.` };
    }

    const membership = await this._getMembership({ event, user });

    // Precondition check: user must have an existing, unverified membership.
    if (!membership || membership.verified) {
      return { error: `User '${user}' is not an unverified reader for event '${event}'.` };
    }

    // User is an unverified reader for event, proceed to set to verified.
    await this.memberships.updateOne({ event, user }, { $set: { verified: true } });
    return {};
  }

  /**
   * Action: Demotes a verified reader to an unverified user for a specific event.
   * This action requires the user to already be a *verified* reader.
   * @param caller The user performing the action.
   * @param event The ID of the event.
   * @param user The user to be demoted from verified reader status.
   * @returns An empty object on success or an error message.
   * @requires caller is an admin, user is a verified reader for the event, and user is not already an unverified user in event
   * @effects makes user an unverified user for the specified event
   */
  async removeReader({ caller, event, user }: { caller: User; event: Event; user: User }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: `Event with ID '${event}' not found.` };
    }

    const membership = await this._getMembership({ event, user });

    // Precondition check: user must have an existing, verified membership.
    if (!membership) {
      return { error: `User '${user}' has no membership for event '${event}'.` };
    }
    if (!membership.verified) {
      return { error: `User '${user}' is already an unverified reader for event '${event}'.` };
    }

    // User is a verified reader for the event, proceed to set to unverified.
    await this.memberships.updateOne({ event, user }, { $set: { verified: false } });
    return {};
  }

  /**
   * Action: Promotes a user to an administrator.
   * @param caller The user performing the action.
   * @param user The user to be promoted to admin.
   * @returns An empty object on success or an error message.
   * @requires caller is an admin and user is not already an admin
   * @effects make user an admin
   */
  async addAdmin({ caller, user }: { caller: User; user: User }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    if (await this._isAdmin({ user })) {
      return { error: `User '${user}' is already an admin.` };
    }

    await this.admins.insertOne({ _id: user }); // Use user ID as _id for admin document
    return {};
  }

  /**
   * Action: Demotes a user from administrator status.
   * @param caller The user performing the action.
   * @param user The user to be demoted from admin.
   * @returns An empty object on success or an error message.
   * @requires caller and user are both admins
   * @effects make user not an admin
   */
  async removeAdmin({ caller, user }: { caller: User; user: User }): Promise<Empty | { error: string }> {
    if (!(await this._isAdmin({ user: caller }))) {
      return { error: "Caller is not an admin." };
    }
    // "user is both an admin" - meaning the target user must currently be an admin.
    if (!(await this._isAdmin({ user }))) {
      return { error: `User '${user}' is not an admin.` };
    }

    await this.admins.deleteOne({ _id: user });
    return {};
  }
}
```
