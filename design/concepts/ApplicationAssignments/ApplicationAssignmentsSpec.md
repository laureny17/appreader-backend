# ApplicationAssignments Spec

```
concept ApplicationAssignments [User, Event, Application]
purpose Store user-to-application assignment data (including read-counts) and assign them one at a time to users
    to read, allowing skips.
principle Each reader is assigned one application to read at a time. Applications are assigned prioritizing those
    with the fewest reads so far, and a user cannot read an application they have already read. Applications can
    be skipped, and get prioritized if so.

state
    a set of CurrentAssignments with
        a User
        an Application
        a startTime DateTime
        an Event

    a set of AppStatus with
        an Application
        an Event
        a readsCompleted Number
        a readers set of Users

actions
    registerApplicationForAssignment (event: Event, application: Application)
        requires: none
        effects: create AppStatus for the specified application for the specified event with readsCompleted = 0
            and an empty readers set initialized

    getNextAssignment (user: User, event: Event, startTime: DateTime): (assignment: CurrentAssignments)
        requires: user is not currently assigned an assignment for this event
        effects: create a CurrentAssignment for this user with startTime, with an application that currently has
            the fewest readsCompleted and does not have user in readers set; if none eligible, return no assignment

    skipAssignment (user: User, assignment: CurrentAssignments)
        requires: user is currently assigned the provided assignment
        effects: add user to the application's readers set for that assignment; remove the CurrentAssignment
            so the application can be reassigned to other users but not to this user

    incrementOnSubmit (user: User, assignment: CurrentAssignments, endTime: DateTime)
        requires: user is currently assigned the provided assignment
        effects: increment readsCompleted for the application, add user to the readers set, and remove the CurrentAssignment
```
