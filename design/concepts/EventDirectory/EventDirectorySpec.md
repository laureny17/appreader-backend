# Event Directory Spec

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
        requires: caller is an admin, user is an unverified user for event, and user is not already a
            verified user in event
        effects: makes user a verified user for the specified event

    removeReader (caller: User, event: Event, user: User)
        requires: caller is an admin, user is a verified reader for the event, and user is not already an
            unverified user in event
        effects: makes user an unverified user for the specified event

    addAdmin (caller: User, user: User)
        requires: caller is an admin and user is not already an admin
        effects: make user an admin

    removeAdmin (caller: User, user: User)
        requires: caller and user are both admins
        effects: make user not an admin
```
