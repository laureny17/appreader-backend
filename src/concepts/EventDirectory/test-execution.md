Check file:///Users/lauren/Desktop/classes/6.1040/app-reader/src/concepts/ApplicationAssignments/ApplicationAssignmentsConcept.test.ts
Check file:///Users/lauren/Desktop/classes/6.1040/app-reader/src/concepts/ApplicationStorage/ApplicationStorageConcept.test.ts
Check file:///Users/lauren/Desktop/classes/6.1040/app-reader/src/concepts/AuthAccounts/AuthAccountsConcept.test.ts
Check file:///Users/lauren/Desktop/classes/6.1040/app-reader/src/concepts/EventDirectory/EventDirectoryConcept.test.ts
Check file:///Users/lauren/Desktop/classes/6.1040/app-reader/src/concepts/LikertSurvey/LikertSurveyConcept.test.ts
Check file:///Users/lauren/Desktop/classes/6.1040/app-reader/src/concepts/ReviewRecords/ReviewRecordsConcept.test.ts
running 0 tests from ./src/concepts/ApplicationAssignments/ApplicationAssignmentsConcept.test.ts
running 0 tests from ./src/concepts/ApplicationStorage/ApplicationStorageConcept.test.ts
running 0 tests from ./src/concepts/AuthAccounts/AuthAccountsConcept.test.ts
running 1 test from ./src/concepts/EventDirectory/EventDirectoryConcept.test.ts
EventDirectoryConcept: principle fulfilment and edge cases ... ok (1s)
running 5 tests from ./src/concepts/LikertSurvey/LikertSurveyConcept.test.ts
Principle: Author creates survey, respondent answers, author views results ... ok (883ms)
Action: createSurvey requires scaleMin < scaleMax ... ok (536ms)
Action: addQuestion requires an existing survey ... ok (493ms)
Action: submitResponse requirements are enforced ... ok (831ms)
Action: updateResponse successfully updates a response and enforces requirements ... ok (899ms)
running 0 tests from ./src/concepts/ReviewRecords/ReviewRecordsConcept.test.ts

ok | 6 passed | 0 failed (5s)
