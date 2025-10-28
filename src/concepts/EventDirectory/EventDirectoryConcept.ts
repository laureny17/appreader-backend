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
  guidelines?: string[]; // Optional array of scoring guidelines (one per score level)
}

/**
 * State: a set of Events
 * @property _id: Event - The unique identifier for the event.
 * @property name: string - The name of the event (should be unique).
 * @property active: boolean - Flag indicating if the event is currently active.
 * @property requiredReadsPerApp: number - Number of required reads per application.
 * @property rubric: RubricDimension[] - An array of rubric dimensions for scoring.
 * @property eligibilityCriteria: string[] - Criteria for event eligibility.
 * @property questions: string[] - Questions that applications must answer.
 * @property endDate: Date - when reading ends
 */
interface EventDocument {
  _id: Event;
  name: string;
  active: boolean;
  requiredReadsPerApp: number;
  rubric: RubricDimension[];
  eligibilityCriteria: string[];
  questions: string[];
  endDate: Date; // when reading ends
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
   * Helper method to check if a user is an admin. (private)
   * @param user The ID of the user to check.
   * @returns True if the user is an admin, false otherwise.
   */
  private async _isAdminInternal({ user }: { user: User }): Promise<boolean> {
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
      questions,
      endDate,
    }: {
      caller: User;
      name: string;
      requiredReadsPerApp: number;
      rubric: RubricDimension[];
      questions: string[];
      endDate: Date;
    },
  ): Promise<{ event: Event } | { error: string }> {
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only admins can create events." };
    }

    const existingEvent = await this.events.findOne({ name });
    if (existingEvent) {
      return { error: `An event with the name '${name}' already exists.` };
    }

    if (!endDate) {
      return { error: "endDate is required." };
    }

    const newEventId: Event = freshID();
    const newEvent: EventDocument = {
      _id: newEventId,
      name,
      active: true, // New events are active by default as per spec
      requiredReadsPerApp,
      rubric,
      eligibilityCriteria: [], // Initialize as empty array
      questions,
      endDate,
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
    if (!await this._isAdminInternal({ user: caller })) {
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
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only admins can inactivate events." };
    }

    const event = await this.events.findOne({ name });
    if (!event) {
      return { error: `Event '${name}' not found.` };
    }
    if (!event.active) {
      return { error: `Event '${name}' is already inactive.` };
    }

    await this.events.updateOne({ _id: event._id }, {
      $set: { active: false },
    });
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
      questions,
      endDate,
    }: {
      caller: User;
      event: Event;
      requiredReadsPerApp?: number;
      rubric?: RubricDimension[];
      eligibilityCriteria?: string[];
      questions?: string[];
      endDate?: Date;
    },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdminInternal({ user: caller })) {
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
    if (questions !== undefined) {
      updateFields.questions = questions;
    }
    if (endDate !== undefined) {
      updateFields.endDate = endDate;
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
    { caller, event: eventId, user }: {
      caller: User;
      event: Event;
      user: User;
    },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only admins can add readers." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const membership = await this.memberships.findOne({ event: eventId, user });

    if (membership?.verified) {
      return {
        error:
          `User '${user}' is already a verified reader for event '${eventId}'.`,
      };
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
    { caller, event: eventId, user }: {
      caller: User;
      event: Event;
      user: User;
    },
  ): Promise<Empty | { error: string }> {
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only admins can remove readers." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const membership = await this.memberships.findOne({ event: eventId, user });

    if (!membership || !membership.verified) {
      return {
        error:
          `User '${user}' is not a verified reader for event '${eventId}'.`,
      };
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
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only existing admins can add new admins." };
    }
    if (await this._isAdminInternal({ user })) {
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
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only admins can remove other admins." };
    }
    if (!await this._isAdminInternal({ user })) {
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
  _getEventByName(
    { name }: { name: string },
  ): Promise<EventDocument | null> {
    return this.events.findOne({ name });
  }

  /**
   * Query: _getEventById
   * purpose: Retrieves an event by its ID.
   * effects: Returns the event document if found.
   */
  _getEventById(
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

  /**
   * Query: _getVerifiedEventsForUser
   * purpose: Returns all events where the user is a verified reader.
   * effects: Returns an array of event summaries.
   */
  async _getVerifiedEventsForUser(
    { user }: { user: User },
  ): Promise<{ event: Event; name: string }[]> {
    // Find all memberships where user is verified
    const memberships = await this.memberships.find({ user, verified: true })
      .toArray();

    if (memberships.length === 0) return [];

    // Extract event IDs
    const eventIds = memberships.map((m) => m.event);

    // Fetch event names
    const events = await this.events.find({ _id: { $in: eventIds } }).toArray();

    // Return array of simplified objects
    return events.map((e) => ({ event: e._id, name: e.name }));
  }

  /**
   * Query: _getPendingReadersForEvent
   * purpose: Returns all unverified members for a given event.
   */
  async _getPendingReadersForEvent(
    { event: eventId }: { event: Event },
  ): Promise<{ user: User }[]> {
    const pending = await this.memberships.find({
      event: eventId,
      verified: false,
    }).toArray();
    return pending.map((m) => ({ user: m.user }));
  }

  /**
   * Query: _isAdmin (public version for API)
   * purpose: Checks if a user is an administrator.
   * effects: Returns true if the user is an admin, false otherwise.
   */
  async _isAdmin({ user }: { user: User }): Promise<{ isAdmin: boolean }> {
    const isAdmin = await this._isAdminInternal({ user });
    return { isAdmin };
  }

  /**
   * Query: _getQuestionsForEvent
   * purpose: Retrieves the questions for a specific event.
   * effects: Returns the questions array for the event.
   */
  async _getQuestionsForEvent(
    { event: eventId }: { event: Event },
  ): Promise<{ questions: string[] } | { error: string }> {
    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }
    return { questions: event.questions };
  }

  /**
   * Query: getAllEvents
   * purpose: Retrieves all events in the system (admin only).
   * effects: Returns all events with their full details.
   */
  async getAllEvents({ caller }: { caller: User }): Promise<EventDocument[] | { error: string }> {
    if (!await this._isAdminInternal({ user: caller })) {
      return { error: "Only admins can retrieve all events." };
    }

    const events = await this.events.find({}).toArray();
    return events;
  }

  /**
   * Query: _getVerifiedReadersForEvent
   * purpose: Returns all verified readers for a specific event with their names.
   * effects: Returns an array of verified members with their user IDs and names.
   */
  async _getVerifiedReadersForEvent(
    { event: eventId }: { event: Event },
  ): Promise<Array<{ user: User; name: string }> | { error: string }> {
    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const verifiedMemberships = await this.memberships.find({
      event: eventId,
      verified: true,
    }).toArray();

    // Look up user names from AuthAccounts
    const result: Array<{ user: User; name: string }> = [];
    for (const membership of verifiedMemberships) {
      const account = await this.db.collection("AuthAccounts.accounts")
        .findOne({ _id: membership.user });
      const name = account?.name || "Unknown User";
      result.push({ user: membership.user, name });
    }

    return result;
  }

  /**
   * Query: _getAllMembersForEvent
   * purpose: Returns all members (both verified and unverified) for a specific event with their names.
   * effects: Returns an array of all members with their user IDs, names, and verification status.
   */
  async _getAllMembersForEvent(
    { event: eventId }: { event: Event },
  ): Promise<Array<{ user: User; name: string; verified: boolean }> | { error: string }> {
    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    const allMemberships = await this.memberships.find({
      event: eventId,
    }).toArray();

    // Look up user names from AuthAccounts
    const result: Array<{ user: User; name: string; verified: boolean }> = [];
    for (const membership of allMemberships) {
      const account = await this.db.collection("AuthAccounts.accounts")
        .findOne({ _id: membership.user });
      const name = account?.name || "Unknown User";
      result.push({
        user: membership.user,
        name,
        verified: membership.verified,
      });
    }

    return result;
  }
}
