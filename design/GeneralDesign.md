# General Design Notes

- Explicit generics: Addressing assignment 2 feedback, each concept header now declares generic types from [User, Event, Application] as needed
- Separation of concerns fixed
  - Auth moved out of EventDirectory into AuthAccounts.
  - Application content vs. assignment split: ApplicationStorage holds application content + AI comments, while ApplicationAssignments handles read-counting and flow of assignment of applications
- No cross-concept state references inside actions
  - e.g. Actions don’t say “event is active” / “user is reader”; those checks belong in syncs/controllers that compose concepts. (Example sync: when ApplicationStorage.addApplication fires, call ApplicationAssignments.registerApplicationForAssignment.)
- Support for multiple admins
- Description of more syncs implied by changes:
  ```
  sync RegisterNewApplication
  when
      ApplicationStorage.addApplication (adder, event: Event, applicantID, applicantYear, answers): (application: Application)
      ApplicationStorage.generateAIComments (application, questions, rubric, eligibilityCriteria)
  then
      ApplicationAssignments.registerApplicationForAssignment (event, application)
  ```

  ```
  sync GetNextAssignmentForUser
  when
      Request.getNextAssignment (user: User, event: Event, startTime: DateTime)
  where
      in EventDirectory: Memberships contains (event, user, verified = true)
      in EventDirectory: Events contains (event) with active = true
  then
      ApplicationAssignments.getNextAssignment (user, event, startTime)
  ```

  ```
  sync GetNextAssignmentForUser
  when
      Request.getNextAssignment (user: User, event: Event, startTime: DateTime)
  where
      in EventDirectory: Memberships contains (event, user, verified = true)
      in EventDirectory: Events contains (event) with active = true
  then
      ApplicationAssignments.getNextAssignment (user, event, startTime)
  ```
