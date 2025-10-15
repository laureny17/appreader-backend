running 1 test from ./src/concepts/ReviewRecords/ReviewRecordsConcept.test.ts
ReviewRecords Concept ...
  fulfills principle: user can submit, edit, flag, and comment on reviews ...
------- post-test output -------
Submit Review: OK
Set Initial Score: OK
Edit Review (permission): OK
Update Existing Score after Edit: OK
Add New Score after Edit: OK
Add Red Flag: OK
Add Comment: OK
Edit Comment: OK
Remove Red Flag: OK
Delete Comment: OK
----- post-test output end -----
  fulfills principle: user can submit, edit, flag, and comment on reviews ... ok (1s)
  submitReview prevents duplicate reviews by same author for same application ... ok (611ms)
  setScore requires author to be the review's author ... ok (601ms)
  addRedFlag prevents duplicate flags by same author for same review ... ok (584ms)
  addRedFlag only allows review author to flag their own review (as per spec interpretation) ... ok (590ms)
  addComment requires non-empty text and quotedSnippet ... ok (612ms)
  editComment requires author to be the comment's author ... ok (549ms)
  deleteComment requires author to be the comment's author ... ok (682ms)
ReviewRecords Concept ... ok (5s)
