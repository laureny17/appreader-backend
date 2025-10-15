# ApplicationAssignments Design

- Generic types added: ApplicationAssignments [User, Event, Application]
- Made changes to state due to moving application-related things to the new ApplicationStorage concept
  - CurrentAssignments { User, Application, startTime, Event } modified to add Event
  - Added AppStatus { Application, Event, readsCompleted Number, readers set of Users }; readsCompleted and readers were formerly in a set of Applications, but this was split between ApplicationAssignments and ApplicationStorage for separation of concerns
- Modified actions
  - Added registerApplicationForAssignment() now that addApplication is separate for the ApplicationStorage concept
- Edited required/effects
  - getNextAssignment() now only requires “user not currently assigned for this event” (no checking for if event is an active event; enforced via syncs and UI)
  - skipAssignment/incrementOnSubmit only checks only assignment ownership; again, these also don’t check for anything cross-concept
