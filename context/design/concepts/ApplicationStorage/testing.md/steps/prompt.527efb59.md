---
timestamp: 'Wed Oct 15 2025 04:25:26 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_042526.76b6b5fc.md]]'
content_id: 527efb59b3a144433983db0946a4f145ff2532e227d23f3eda61705b74784c8f
---

# prompt: Observe how tests were structured for one of our concepts AuthAccounts concept here ([@AuthAccounts-concept-tests](/src/concepts/AuthAccounts/AuthAccountsConcept.test.ts)) and for the sample LikertSurvey concept here ([@testing](../LikertSurvey/testing.md) and [@LikertSurvey-concept-tests](/src/concepts/LikertSurvey/LikertSurveyConcept.test.ts)) and create a test suite that works with the Deno testing framework and covers a full trace that  demonstrates how the principle of the concept is fulfilled by a sequence of actions. Ensure that no tests use or depend on ANY other concepts besides ApplicationStorage itself. Do not test any behavior that requires cross-concept interaction. Minimize imports to what is needed. When performing await testDb() (do NOT use getDb()), declare the results as const variables db and client on the first line of the test case, and set const ApplicationStorage = new ApplicationStorageConcept(db);. Refer to previously written test cases for a similar concept as a very rough guideline.
