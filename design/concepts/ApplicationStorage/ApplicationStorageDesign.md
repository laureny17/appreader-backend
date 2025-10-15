# ApplicationStorage Design

- New concept split from ApplicationAssignments for separation of concerns; ApplicationStorage only stores content of applications and the AI-generated comments associated with them, with no reference to readers
- Generic types [Application, Event]
- Modified state from what was in ApplicationAssignments
  - Applications now only { event, applicantID, applicantYear, answers } (no mention of readers, i.e. no readers set or readsCompleted)
  - AIComments { application, category, quotedSnippet, justification } also moved to be here since it is part of the application, not reader-based
- Separation of concerns: split addApplication() to only add the application to the system (is therefore not async anymore)
  - Added a new function generateAIComments() to do what addApplication() previously did along with adding application to the system
- Edited requires/effects to only refer to this concept’s state (e.g. doesn't check that event is active or that the adder of applications is an admin; leaving that to syncs)
