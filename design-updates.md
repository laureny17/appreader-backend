# Backend Design Updates

## Major System Changes

### Authentication System Overhaul
- **Changed from username-based to email-based authentication** - Updated AuthAccounts to use email addresses instead of usernames for better uniqueness and user experience
- **Added password hashing** - Implemented secure password storage using bcrypt instead of plain text passwords

### Application Management Redesign
- **Added bulk import functionality** - Created CSV import system for admins to efficiently add multiple applications

### Assignment System Transformation
- **Adjusted flagging system** - Flags are more dynamic and changeable via user history

### Review System Enhancement
- **Application-level comments** - commenst are now on the Application-level for easier fetching of comments for everyone to see
- **User history** - Added timestamps for more explicit history and ordering of past reviews

## New Data Structures

### ApplicationAssignments Collections
- **`SkipRecords`** - Dedicated collection for tracking skipped applications (separate from flags)
- **`ApplicationFlags`** - Collection (replaced ReviewRecords red flags)

### ReviewRecords Collections
- **`reviews`** - Individual review documents with author, application, timestamps, and active time
- **`scores`** - Score documents linked to reviews for multiple criteria
- **`redFlags`** - Flag documents linked to reviews with reasons and timestamps
- **`comments`** - Application-level comments with quoted snippets and timestamps

### ApplicationStorage Extensions
- **Extended `ApplicationDoc`** - Added fields for flagging and disqualification:
  - `flagged`, `flaggedBy`, `flaggedAt`, `flagReason`
  - `disqualified`, `disqualificationReason`, `disqualifiedBy`, `disqualifiedAt`
  - `undisqualifiedAt`, `undisqualifiedBy`, `undisqualificationReason`

### EventDirectory Enhancements
- **Added admin management** - Separate admin collection for system-wide admin privileges

## New/Updated API Endpoints

### ApplicationAssignments
- **`flagAndSkip`** - Flag application and move to next (creates review + flag)
- **`_getSkipStatsForEvent`** - Get skip statistics for all users in event

### ApplicationStorage
- **`_getAICommentsByApplication`** - Retrieve AI comments for application
- **`_getApplication`** - Get application by ID
- **`_getApplicationsByEvent`** - Get all applications for event
- **`_bulkImportApplications`** - Bulk import from CSV data
- **`_getFlaggedApplications`** - Get flagged applications for admin dashboard
- **`_disqualifyApplication`** - Admin action to disqualify flagged application
- **`_undisqualifyApplication`** - Admin action to reverse disqualification
- **`_getDisqualifiedApplications`** - Get disqualified applications for export

### ReviewRecords
- **`_getReviewsWithScoresByApplication`** - Get all reviews with scores for application
- **`_calculateWeightedAverages`** - Calculate weighted average scores
- **`_getUserReviewProgress`** - Get user's review progress in event
- **`_getCommentsByApplication`** - Get all comments for application
- **`_getReaderStatsForEvent`** - Get reader statistics for event
- **`deleteReview`** - Delete review with cascade deletion
- **`_hasUserFlaggedApplication`** - Check if user flagged application
- **`_getUserScoresForApplication`** - Get user's scores for application
- **`_getUserReviewedApplications`** - Get user's reviewed applications with flag status

### EventDirectory
- **`_getEventByName`** / **`_getEventById`** - Event retrieval by name/ID
- **`_isReaderVerified`** - Check reader verification status
- **`_getUserMembership`** - Get user membership details
- **`_getVerifiedEventsForUser`** - Get events user is verified for
- **`_getPendingReadersForEvent`** - Get pending reader requests
- **`_getQuestionsForEvent`** - Get event questions
- **`_getVerifiedReadersForEvent`** - Get verified readers with names
- **`_getAllMembersForEvent`** - Get all members with verification status
- **`getAllEvents`** - Get all events (admin only)

### AuthAccounts
- **`_getAccountByUserId`** - Get account by user ID
- **`_getAccountByEmail`** - Get account by email
- **`_getNameByUserId`** - Get user name by ID
- **`_getAccountByIdSafe`** - Get account without password hash
- **`_getAllUsers`** - Get all users (admin only)

## Key Behavioral Changes

### Assignment Flow
- **Assignment expiration** - Assignments expire some time to prevent stale assignments
- **Skip tracking** - Dedicated skip records ensure accurate skip counting
- **Flag handling** - Flagging creates review records so flagged applications appear in user history

### Review Process
- **From simple to comprehensive** - Reviews now include timestamps, active time, multiple criteria scores, and application-level comments (easier for fetching comments for everyone)
- **Review cleanup** - Skipping previously reviewed applications now properly deletes existing reviews and flags
- **Flag integration** - Flags are properly integrated with review system rather than separate application-level flags

### Admin Features
- **Flagged application management** - Admins can view, disqualify (new), and manage flagged applications
- **Bulk operations** - Admins can bulk import applications and export (new)disqualified applications
- **Reader management** - Admins can verify and unverify readers

### Data Consistency
- **Cross-concept integration** - Applications are automatically registered for assignment when created
- **Cascade deletion** - Deleting reviews properly cleans up related scores, flags, and comments
- **Skip count accuracy** - Skip counts only reflect actual skips, not flags or reviews

## Technical Improvements

### Error Handling
- **Comprehensive error responses** - All endpoints return structured error responses
- **Validation** - Input validation for all parameters and data types
- **Graceful degradation** - Partial failures in bulk operations don't break entire process

### Performance
- **Batch operations** - Bulk import and export operations for efficiency

### Security
- **Password hashing** - Secure password storage

### Testing
- **Comprehensive test coverage** - Tests for all new functionality
- **Integration testing** - Tests for cross-concept interactions
- **Edge case handling** - Tests for error conditions and boundary cases
