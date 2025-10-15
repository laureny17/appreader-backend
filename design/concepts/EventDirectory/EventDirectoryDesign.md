# EventDirectory Design

- Generic types added: EventDirectory [Event, User]
- State modified
  - Removed the old Users set (and Admin) to move it to other concepts (ApplicationAssignments and AuthAccounts, depending on use) for separation of concerns
  - Instead, added Memberships { event, user, verified }, where verified is an editable Flag
  - Modified Events to move verifiedReaders and move the set of readers to a different concept
- Admin and reader management clarified with the addition of Memberships instead of keeping a Users set
  - Added a set of Admins
  - addReader now changes unverified reader to a verified reader
- Added new actions
  - New addAdmin / removeAdmin actions so multiple admins are supported
- Edited requires statements to ensure no cross-concept mentions
