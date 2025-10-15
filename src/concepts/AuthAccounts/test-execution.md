running 1 test from ./src/concepts/AuthAccounts/AuthAccountsConcept.test.ts
AuthAccountsConcept functionality ...
  Principle: Users can register and then log in with their credentials ...
------- post-test output -------
[AuthAccountsConcept functionality] Registering user: alice@example.com
[AuthAccountsConcept functionality] Logging in user: alice@example.com
[AuthAccountsConcept functionality] User 0199e6d9-8025-76c0-afc1-92f96e4b01b0 successfully registered and logged in.
----- post-test output end -----
  Principle: Users can register and then log in with their credentials ... ok (297ms)
  Should not allow registration with an already existing email ...
------- post-test output -------
[AuthAccountsConcept functionality] Attempting to register existing email: bob@example.com
[AuthAccountsConcept functionality] Correctly prevented duplicate registration for bob@example.com.
----- post-test output end -----
  Should not allow registration with an already existing email ... ok (157ms)
  Should not allow login with incorrect password ...
------- post-test output -------
[AuthAccountsConcept functionality] Attempting login for charlie@example.com with wrong password
[AuthAccountsConcept functionality] Correctly prevented login for charlie@example.com with wrong password.
----- post-test output end -----
  Should not allow login with incorrect password ... ok (192ms)
  Should not allow login with non-existent email ...
------- post-test output -------
[AuthAccountsConcept functionality] Attempting login with non-existent email: nonexistent@example.com
[AuthAccountsConcept functionality] Correctly prevented login for non-existent email nonexistent@example.com.
----- post-test output end -----
  Should not allow login with non-existent email ... ok (18ms)
  Multiple independent registrations and logins ...
------- post-test output -------
[AuthAccountsConcept functionality] Registered User A: usera@example.com
[AuthAccountsConcept functionality] Registered User B: userb@example.com
----- post-test output end -----
  Multiple independent registrations and logins ... ok (397ms)
------- post-test output -------
[AuthAccountsConcept functionality] Dropping test database
[AuthAccountsConcept functionality] Closing MongoDB client.
----- post-test output end -----
AuthAccountsConcept functionality ... ok (1s)

[... other tests ...]

ok | 7 passed (5 steps) | 0 failed (7s)
