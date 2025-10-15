running 1 test from ./src/concepts/ApplicationStorage/ApplicationStorageConcept.test.ts
ApplicationStorageConcept: fulfills principle - adds application, generates, and re-generates AI comments ...
  addApplication: Successfully adds a new application ...
------- post-test output -------
Application 0199e701-77c3-730e-aef6-d2e16e17b9c7 added for event event:hackathon-2024.
----- post-test output end -----
  addApplication: Successfully adds a new application ... ok (69ms)
  addApplication: should return error for invalid inputs ... ok (0ms)
  generateAIComments: Successfully generates and stores AI comments ...
------- post-test output -------
Attempting to generate AI comments for application 0199e701-77c3-730e-aef6-d2e16e17b9c7 (applicant: applicant:alice-smith).
Parsed LLM response for application 0199e701-77c3-730e-aef6-d2e16e17b9c7: 2 raw comment(s) found.
2 valid AI comments processed for application 0199e701-77c3-730e-aef6-d2e16e17b9c7.
Successfully stored 2 AI comments for application 0199e701-77c3-730e-aef6-d2e16e17b9c7.
----- post-test output end -----
  generateAIComments: Successfully generates and stores AI comments ... ok (114ms)
  generateAIComments: Re-generates and replaces existing AI comments (robustness) ...
------- post-test output -------
Attempting to generate AI comments for application 0199e701-77c3-730e-aef6-d2e16e17b9c7 (applicant: applicant:alice-smith).
Parsed LLM response for application 0199e701-77c3-730e-aef6-d2e16e17b9c7: 1 raw comment(s) found.
1 valid AI comments processed for application 0199e701-77c3-730e-aef6-d2e16e17b9c7.
Successfully stored 1 AI comments for application 0199e701-77c3-730e-aef6-d2e16e17b9c7.
----- post-test output end -----
  generateAIComments: Re-generates and replaces existing AI comments (robustness) ... ok (83ms)
  generateAIComments: Handles non-existent application gracefully (simplicity/robustness) ... ok (31ms)
  generateAIComments: Filters invalid categories and truncates long justifications ...
------- post-test output -------
Attempting to generate AI comments for application 0199e701-77c3-730e-aef6-d2e16e17b9c7 (applicant: applicant:alice-smith).
Parsed LLM response for application 0199e701-77c3-730e-aef6-d2e16e17b9c7: 6 raw comment(s) found.
Warning: Invalid category "InvalidCategory" for application 0199e701-77c3-730e-aef6-d2e16e17b9c7. Comment will be skipped.
Warning: Justification too long (>150 chars) for application 0199e701-77c3-730e-aef6-d2e16e17b9c7. Truncating.
Warning: Empty or invalid quotedSnippet in AI comment for application 0199e701-77c3-730e-aef6-d2e16e17b9c7. Comment will be skipped.
Warning: Duplicate quotedSnippet found for application 0199e701-77c3-730e-aef6-d2e16e17b9c7. Duplicate comment will be skipped.
3 valid AI comments processed for application 0199e701-77c3-730e-aef6-d2e16e17b9c7.
Successfully stored 3 AI comments for application 0199e701-77c3-730e-aef6-d2e16e17b9c7.
----- post-test output end -----
  generateAIComments: Filters invalid categories and truncates long justifications ... ok (84ms)
ApplicationStorageConcept: fulfills principle - adds application, generates, and re-generates AI comments ... ok (976ms)

[... other tests ...]

ok | 8 passed (11 steps) | 0 failed (8s)
