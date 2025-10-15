---
timestamp: 'Wed Oct 15 2025 00:43:08 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_004308.7f181eec.md]]'
content_id: ae5240b38401491c9e0ada4cbbc3fb206d115d1fba6cf679319be65ff354daf1
---

# response:

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "../../utils/types.ts"; // Assuming utils is at the same level as concepts
import { freshID } from "../../utils/database.ts"; // Assuming utils is at the same level as concepts

// Declare collection prefix, use concept name
const PREFIX = "EventDirectory" + ".";

// Generic types of this concept
type User = ID;
type Event = ID;

/**
 * concept EventDirectory [User, Event]
 * purpose enable users to create, discover, and manage public and private events.
 *         This should facilitate event organization and participation.
 * principle after a user creates an event with a name, date, and location,
 *           other users can discover it, view its details, and optionally register to attend.
 *           The creator can update the event details, and eventually, the event can be considered past.
 */

/**
 * State:
 *   a set of Events with
 *     an organizer (User)
 *     a name (String)
 *     a description (String)
 *     a location (String)
 *     a start_time (Date)
 *     an end_time (Date)
 *     a is_public (Boolean)
 */
interface EventDocument {
  _id: Event;
  organizer: User;
  name: string;
  description: string;
  location: string;
  start_time: Date;
  end_time: Date;
  is_public: boolean;
}

/**
 * State:
 *   a set of Registrations with
 *     an event (Event)
 *     a participant (User)
 *     a registered_at (Date)
 */
interface RegistrationDocument {
  _id: ID; // Unique ID for each registration record
  event: Event;
  participant: User;
  registered_at: Date;
}

// Interface for the detailed event result object
interface EventDetailsResult {
  event: Event;
  organizer: User;
  name: string;
  description: string;
  location: string;
  start_time: Date;
  end_time: Date;
  is_public: boolean;
}

export default class EventDirectoryConcept {
  events: Collection<EventDocument>;
  registrations: Collection<RegistrationDocument>;

  constructor(private readonly db: Db) {
    this.events = this.db.collection(PREFIX + "events");
    this.registrations = this.db.collection(PREFIX + "registrations");
  }

  /**
   * Action: createEvent
   * createEvent (organizer: User, name: String, description: String, location: String, start_time: Date, end_time: Date, is_public: Boolean): (event: Event)
   *
   * requires: name is not empty, start_time is before end_time.
   * effects: A new Event is created with the given details, organizer is set, and its is_public status is recorded.
   */
  async createEvent(
    {
      organizer,
      name,
      description,
      location,
      start_time,
      end_time,
      is_public,
    }: {
      organizer: User;
      name: string;
      description: string;
      location: string;
      start_time: Date;
      end_time: Date;
      is_public: boolean;
    },
  ): Promise<{ event: Event } | { error: string }> {
    if (!name || name.trim() === "") {
      return { error: "Event name cannot be empty." };
    }
    if (start_time >= end_time) {
      return { error: "Start time must be before end time." };
    }

    const newEventId = freshID();
    const newEvent: EventDocument = {
      _id: newEventId,
      organizer,
      name: name.trim(), // Trim name to avoid leading/trailing spaces
      description,
      location,
      start_time,
      end_time,
      is_public,
    };

    try {
      await this.events.insertOne(newEvent);
      return { event: newEventId };
    } catch (e) {
      console.error("Error creating event:", e);
      return { error: "Failed to create event due to a database error." };
    }
  }

  /**
   * Action: updateEvent
   * updateEvent (event: Event, name: String?, description: String?, location: String?, start_time: Date?, end_time: Date?, is_public: Boolean?): Empty
   *
   * requires: event exists, and if start_time and end_time are updated, start_time is before end_time.
   *           If name is updated, it must not be empty.
   * effects: The specified properties of the event are updated.
   */
  async updateEvent(
    {
      event,
      name,
      description,
      location,
      start_time,
      end_time,
      is_public,
    }: {
      event: Event;
      name?: string;
      description?: string;
      location?: string;
      start_time?: Date;
      end_time?: Date;
      is_public?: boolean;
    },
  ): Promise<Empty | { error: string }> {
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: "Event not found." };
    }

    const updateFields: Partial<EventDocument> = {};

    if (name !== undefined) {
      if (name.trim() === "") {
        return { error: "Event name cannot be empty." };
      }
      updateFields.name = name.trim();
    }
    if (description !== undefined) updateFields.description = description;
    if (location !== undefined) updateFields.location = location;
    if (is_public !== undefined) updateFields.is_public = is_public;

    // Determine effective start/end times for validation
    let currentStartTime = start_time !== undefined ? start_time : existingEvent.start_time;
    let currentEndTime = end_time !== undefined ? end_time : existingEvent.end_time;

    if (start_time !== undefined) updateFields.start_time = start_time;
    if (end_time !== undefined) updateFields.end_time = end_time;

    // Validate time constraints
    if (currentStartTime >= currentEndTime) {
        return { error: "Updated start time must be before updated end time." };
    }

    try {
      const result = await this.events.updateOne(
        { _id: event },
        { $set: updateFields },
      );

      // If no document was matched, it means the event ID was invalid
      if (result.matchedCount === 0) {
        return { error: "Event not found." };
      }
      return {};
    } catch (e) {
      console.error("Error updating event:", e);
      return { error: "Failed to update event due to a database error." };
    }
  }

  /**
   * Action: deleteEvent
   * deleteEvent (event: Event): Empty
   *
   * requires: event exists.
   * effects: The event and all associated Registrations are removed from the state.
   */
  async deleteEvent(
    { event }: { event: Event },
  ): Promise<Empty | { error: string }> {
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: "Event not found." };
    }

    try {
      await this.events.deleteOne({ _id: event });
      await this.registrations.deleteMany({ event: event }); // Cascade delete registrations
      return {};
    } catch (e) {
      console.error("Error deleting event:", e);
      return { error: "Failed to delete event and its registrations." };
    }
  }

  /**
   * Action: registerForEvent
   * registerForEvent (event: Event, participant: User): Empty
   *
   * requires: event exists, participant is not already registered for this event, event is not in the past.
   * effects: A Registration record is created associating participant with event.
   */
  async registerForEvent(
    { event, participant }: { event: Event; participant: User },
  ): Promise<Empty | { error: string }> {
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: "Event not found." };
    }

    if (existingEvent.end_time < new Date()) {
      return { error: "Cannot register for an event that has already ended." };
    }

    const existingRegistration = await this.registrations.findOne({
      event: event,
      participant: participant,
    });
    if (existingRegistration) {
      return { error: "Participant is already registered for this event." };
    }

    const newRegistration: RegistrationDocument = {
      _id: freshID(),
      event: event,
      participant: participant,
      registered_at: new Date(),
    };

    try {
      await this.registrations.insertOne(newRegistration);
      return {};
    } catch (e) {
      console.error("Error registering for event:", e);
      return { error: "Failed to register for event due to a database error." };
    }
  }

  /**
   * Action: unregisterFromEvent
   * unregisterFromEvent (event: Event, participant: User): Empty
   *
   * requires: event exists, participant is registered for this event.
   * effects: The Registration record associating participant with event is removed.
   */
  async unregisterFromEvent(
    { event, participant }: { event: Event; participant: User },
  ): Promise<Empty | { error: string }> {
    const existingEvent = await this.events.findOne({ _id: event });
    if (!existingEvent) {
      return { error: "Event not found." };
    }

    const result = await this.registrations.deleteOne({
      event: event,
      participant: participant,
    });

    if (result.deletedCount === 0) {
      return { error: "Participant was not registered for this event." };
    }

    return {};
  }

  // --- Queries ---

  /**
   * Query: _getEventDetails
   * _getEventDetails (event: Event): (details: EventDetailsResult)
   *
   * effects: Returns the name, description, location, times, and public status of the event.
   */
  async _getEventDetails(
    { event }: { event: Event },
  ): Promise<EventDetailsResult | { error: string }> {
    const foundEvent = await this.events.findOne({ _id: event });
    if (!foundEvent) {
      return { error: "Event not found." };
    }
    return {
      event: foundEvent._id,
      organizer: foundEvent.organizer,
      name: foundEvent.name,
      description: foundEvent.description,
      location: foundEvent.location,
      start_time: foundEvent.start_time,
      end_time: foundEvent.end_time,
      is_public: foundEvent.is_public,
    };
  }

  /**
   * Query: _listEventsByOrganizer
   * _listEventsByOrganizer (organizer: User): (events: Event[])
   *
   * effects: Returns a list of Event IDs organized by the given organizer.
   */
  async _listEventsByOrganizer(
    { organizer }: { organizer: User },
  ): Promise<{ events: Event[] }> {
    const events = await this.events.find({ organizer: organizer }).toArray();
    return { events: events.map((e) => e._id) };
  }

  /**
   * Query: _listUpcomingPublicEvents
   * _listUpcomingPublicEvents (limit: Number?, skip: Number?): (events: Event[])
   *
   * effects: Returns a list of public events whose end_time is in the future, optionally paginated.
   */
  async _listUpcomingPublicEvents(
    { limit = 10, skip = 0 }: { limit?: number; skip?: number },
  ): Promise<{ events: Event[] }> {
    const now = new Date();
    const events = await this.events
      .find({
        is_public: true,
        end_time: { $gt: now }, // end_time is greater than now
      })
      .sort({ start_time: 1 }) // Sort by start time ascending
      .skip(skip)
      .limit(limit)
      .toArray();
    return { events: events.map((e) => e._id) };
  }

  /**
   * Query: _listParticipants
   * _listParticipants (event: Event): (participants: User[])
   *
   * effects: Returns a list of User IDs registered for the given event.
   */
  async _listParticipants(
    { event }: { event: Event },
  ): Promise<{ participants: User[] }> {
    const registrations = await this.registrations
      .find({ event: event })
      .toArray();
    return { participants: registrations.map((r) => r.participant) };
  }

  /**
   * Query: _isRegistered
   * _isRegistered (event: Event, participant: User): (is_registered: Boolean)
   *
   * effects: Returns true if the participant is registered for the event, false otherwise.
   */
  async _isRegistered(
    { event, participant }: { event: Event; participant: User },
  ): Promise<{ is_registered: boolean }> {
    const registration = await this.registrations.findOne({
      event: event,
      participant: participant,
    });
    return { is_registered: !!registration };
  }
}
```
