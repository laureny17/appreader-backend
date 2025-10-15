# ReviewRecords Design

- Generic types added: ReviewRecords [Application, User]
- State modified
  - Reviews now stores Application, author User, submittedAt DateTime (not Scores directly)
  - Scores, RedFlags, Comments now link to a review Review (not directly to Application) so everything hangs off the review
- Modified some actions
  - Kept submitReview() but moved scores to setScore() so we don’t pass a non-primitive set of Scores as an argument
  - Also edited editReview() so actual edits happen via setScore
- Added some new actions to allow for flexibility
  - Added setScore() for above reasons (prevent passing in non-primitives to actions)
  - removeRedFlag() to undo flagging an application
  - editComment() to allow updating comment text
  - deleteComment() to allow for the deletion of a comment
- Some requires/effects modified
  - submitReview requires author hasn’t already reviewed that application
  - setScore/editReview/editComment check authorship, nothing cross-concept
  - addComment now requires non-empty text/snippet
- Naming consistency: renamed reader to author inside this concept for reviews/flags/comments
