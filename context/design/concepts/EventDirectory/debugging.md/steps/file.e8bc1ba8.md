---
timestamp: 'Wed Oct 15 2025 02:42:17 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_024217.f24eceb2.md]]'
content_id: e8bc1ba822d284c278567dbc8707f74f550411bea6f0c5c73e6e7985e40ba673
---

# file: src/concepts/EventDirectory/EventDirectoryConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { ID, UserID, Empty } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Declare collection prefix, use concept name
const PREFIX = "EventDirectory" + ".";

/**
 * EventID represents a unique identifier for an event.
 */
type EventID = ID;

/**
 * Event configuration options. This can include anything from scheduling details to specific rules.
 */
interface EventConfig extends Record<string, unknown> {}

/**
 * The state of an individual event.
 * a set of Events with
 *   a name String
 *   a description String?
 *   a configuration Dictionary<String, Any>?
 *   an active Boolean
 *   a set of verified Readers
 */
interface EventState {
  _id: EventID;
  name: string;
  description: string | null;
  config: EventConfig;
  active: boolean;
  verifiedReaders: UserID[]; // Array of UserIDs that are verified readers
  createdAt: Date;
  updatedAt: Date;
}

export default class EventDirectoryConcept {
  private events: Collection<EventState>;

  /**
   * purpose: Manages the lifecycle and configuration of events, including assigning verified readers.
   * principle: An admin can create, update, activate, inactivate, and manage readers for events.
   *            Only verified readers can access event-specific content.
   *            Events must have a name, and can optionally have a description and configuration.
   *            Readers can only be added or removed by an admin.
   */
  constructor(
    private readonly db: Db,
    // FIX: Add _isAdmin function to the constructor
    private readonly _isAdmin: (id: UserID) => Promise<boolean>,
  ) {
    this.events = this.db.collection<EventState>(PREFIX + "events");
  }

  /**
   * actions:
   * createEvent (name: String, description: String?, config: Dictionary<String, Any>?, adminId: UserID)
   * requires: adminId is an admin.
   *           name is unique.
   * effects: A new active event is created with the given name, description, and config.
   * returns: { eventId: EventID } on success, or { error: String } on failure.
   */
  async createEvent(
    { name, description, config, adminId }: {
      name: string;
      description?: string;
      config?: EventConfig;
      adminId: UserID;
    },
  ): Promise<{ eventId: EventID } | { error: string }> {
    // FIX: Add admin check
    if (!(await this._isAdmin(adminId))) {
      return { error: "Only admins can create events." };
    }

    const existingEvent = await this.events.findOne({ name: name });
    if (existingEvent) {
      return { error: `An event with name '${name}' already exists.` };
    }

    const newEvent: EventState = {
      _id: freshID(),
      name,
      description: description || null,
      config: config || {},
      active: true,
      verifiedReaders: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await this.events.insertOne(newEvent);
    // FIX: Return the eventId
    return { eventId: newEvent._id };
  }

  /**
   * actions:
   * updateEventConfig (eventId: EventID, config: Dictionary<String, Any>, adminId: UserID)
   * requires: adminId is an admin.
   *           eventId refers to an existing event.
   * effects: The configuration of the specified event is updated.
   * returns: Empty on success, or { error: String } on failure.
   */
  async updateEventConfig(
    { eventId, config, adminId }: {
      eventId: EventID;
      config: EventConfig;
      adminId: UserID;
    },
  ): Promise<Empty | { error: string }> {
    // FIX: Add admin check
    if (!(await this._isAdmin(adminId))) {
      return { error: "Only admins can update event configuration." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    await this.events.updateOne(
      { _id: eventId },
      { $set: { config: config, updatedAt: new Date() } },
    );

    return {};
  }

  /**
   * actions:
   * addReader (eventId: EventID, readerId: UserID, adminId: UserID)
   * requires: adminId is an admin.
   *           eventId refers to an existing event.
   *           readerId is not already a verified reader for this event.
   * effects: readerId is added to the event's set of verified readers.
   * returns: Empty on success, or { error: String } on failure.
   */
  async addReader(
    { eventId, readerId, adminId }: {
      eventId: EventID;
      readerId: UserID;
      adminId: UserID;
    },
  ): Promise<Empty | { error: string }> {
    // FIX: Add admin check
    if (!(await this._isAdmin(adminId))) {
      return { error: "Only admins can add readers." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    if (event.verifiedReaders.includes(readerId)) {
      // FIX: Ensure error message includes eventId
      return {
        error: `User '${readerId}' is already a verified reader for event '${eventId}'.`,
      };
    }

    await this.events.updateOne(
      { _id: eventId },
      { $addToSet: { verifiedReaders: readerId }, $set: { updatedAt: new Date() } },
    );

    return {};
  }

  /**
   * actions:
   * removeReader (eventId: EventID, readerId: UserID, adminId: UserID)
   * requires: adminId is an admin.
   *           eventId refers to an existing event.
   *           readerId is currently a verified reader for this event.
   * effects: readerId is removed from the event's set of verified readers.
   * returns: Empty on success, or { error: String } on failure.
   */
  async removeReader(
    { eventId, readerId, adminId }: {
      eventId: EventID;
      readerId: UserID;
      adminId: UserID;
    },
  ): Promise<Empty | { error: string }> {
    // FIX: Add admin check
    if (!(await this._isAdmin(adminId))) {
      return { error: "Only admins can remove readers." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }

    if (!event.verifiedReaders.includes(readerId)) {
      // FIX: Ensure error message includes eventId
      return {
        error: `User '${readerId}' is not currently a verified reader for event '${eventId}'.`,
      };
    }

    await this.events.updateOne(
      { _id: eventId },
      { $pull: { verifiedReaders: readerId }, $set: { updatedAt: new Date() } },
    );

    return {};
  }

  /**
   * actions:
   * inactivateEvent (eventId: EventID, adminId: UserID)
   * requires: adminId is an admin.
   *           eventId refers to an existing event.
   *           The event is currently active.
   * effects: The specified event is marked as inactive.
   * returns: Empty on success, or { error: String } on failure.
   */
  async inactivateEvent(
    { eventId, adminId }: { eventId: EventID; adminId: UserID },
  ): Promise<Empty | { error: string }> {
    // FIX: Add admin check
    if (!(await this._isAdmin(adminId))) {
      return { error: "Only admins can inactivate events." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }
    if (!event.active) {
      return { error: `Event with ID '${eventId}' is already inactive.` };
    }

    await this.events.updateOne(
      { _id: eventId },
      { $set: { active: false, updatedAt: new Date() } },
    );

    return {};
  }

  /**
   * actions:
   * activateEvent (eventId: EventID, adminId: UserID)
   * requires: adminId is an admin.
   *           eventId refers to an existing event.
   *           The event is currently inactive.
   * effects: The specified event is marked as active.
   * returns: Empty on success, or { error: String } on failure.
   */
  async activateEvent(
    { eventId, adminId }: { eventId: EventID; adminId: UserID },
  ): Promise<Empty | { error: string }> {
    // FIX: Add admin check
    if (!(await this._isAdmin(adminId))) {
      return { error: "Only admins can activate events." };
    }

    const event = await this.events.findOne({ _id: eventId });
    if (!event) {
      return { error: `Event with ID '${eventId}' not found.` };
    }
    if (event.active) {
      return { error: `Event with ID '${eventId}' is already active.` };
    }

    await this.events.updateOne(
      { _id: eventId },
      { $set: { active: true, updatedAt: new Date() } },
    );

    return {};
  }

  /**
   * queries:
   * _getEvent (eventId: EventID)
   * returns: EventState[] (containing one event or empty)
   */
  async _getEvent(
    { eventId }: { eventId: EventID },
  ): Promise<EventState[]> {
    const event = await this.events.findOne({ _id: eventId });
    return event ? [event] : [];
  }

  /**
   * queries:
   * _getEventsByReader (readerId: UserID)
   * returns: EventState[] (all events where readerId is a verified reader)
   */
  async _getEventsByReader(
    { readerId }: { readerId: UserID },
  ): Promise<EventState[]> {
    return await this.events.find({ verifiedReaders: readerId }).toArray();
  }
}

```
