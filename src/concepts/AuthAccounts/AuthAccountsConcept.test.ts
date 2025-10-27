import { assert, assertEquals, assertExists } from "jsr:@std/assert";
import { freshID, testDb } from "../../utils/database.ts";
import AuthAccountsConcept from "./AuthAccountsConcept.ts";
import { ID } from "../../utils/types.ts";

Deno.test("AuthAccountsConcept functionality", async (testContext) => {
  const [db, client] = await testDb();
  const authAccounts = new AuthAccountsConcept(db);

  try {
    // --- Principle Fulfillment Test ---
    await testContext.step(
      "Principle: Users can register and then log in with their credentials",
      async () => {
        const name = "Alice Smith";
        const email = "alice@example.com";
        const password = "securePassword123";
        let registeredUserId: ID;

        // Action 1: Register a user
        console.log(`[${testContext.name}] Registering user: ${email}`);
        const registerResult = await authAccounts.register({
          name,
          email,
          password,
        });

        if ("error" in registerResult) {
          throw new Error(
            `Unexpected registration error: ${registerResult.error}`,
          );
        }

        assertExists(
          registerResult.user,
          "Registration should return a user ID",
        );
        registeredUserId = registerResult.user;

        // Verify internal state
        const registeredAccount = await authAccounts._getAccountByUserId(
          registeredUserId,
        );
        assertExists(
          registeredAccount,
          "Account should be found by user ID after registration",
        );
        assertEquals(registeredAccount?.email, email);
        assertEquals(registeredAccount?.name, name);
        assertExists(registeredAccount?.passwordHash);

        // Action 2: Log in with the registered credentials
        console.log(`[${testContext.name}] Logging in user: ${email}`);
        const loginResult = await authAccounts.login({ email, password });

        if ("error" in loginResult) {
          throw new Error(`Unexpected login error: ${loginResult.error}`);
        }

        assertExists(loginResult.user);
        assertEquals(loginResult.user, registeredUserId);

        // Verify another internal state query
        const fetchedAccountByEmail = await authAccounts._getAccountByEmail(
          email,
        );
        assertExists(fetchedAccountByEmail);
        assertEquals(fetchedAccountByEmail?._id, registeredUserId);

        console.log(
          `[${testContext.name}] User ${registeredUserId} successfully registered and logged in.`,
        );
      },
    );

    // --- Error Cases and Other Scenarios ---

    await testContext.step(
      "Should not allow registration with an already existing email",
      async () => {
        const name = "Bob Builder";
        const email = "bob@example.com";
        const password = "passwordBob";

        await authAccounts.register({ name, email, password });

        console.log(
          `[${testContext.name}] Attempting to register existing email: ${email}`,
        );
        const registerResult2 = await authAccounts.register({
          name: "Bob Jr.",
          email,
          password: "passwordJr",
        });

        assert("error" in registerResult2);
        assertEquals(registerResult2.error, "Email already registered.");
        console.log(
          `[${testContext.name}] Correctly prevented duplicate registration for ${email}.`,
        );
      },
    );

    await testContext.step(
      "Should not allow login with incorrect password",
      async () => {
        const name = "Charlie Chaplin";
        const email = "charlie@example.com";
        const password = "correctPassword";

        await authAccounts.register({ name, email, password });

        console.log(
          `[${testContext.name}] Attempting login for ${email} with wrong password`,
        );
        const loginResult = await authAccounts.login({
          email,
          password: "wrongPassword",
        });

        assert("error" in loginResult);
        assertEquals(loginResult.error, "Invalid credentials.");
        console.log(
          `[${testContext.name}] Correctly prevented login for ${email} with wrong password.`,
        );
      },
    );

    await testContext.step(
      "Should not allow login with non-existent email",
      async () => {
        const email = "nonexistent@example.com";
        const password = "anyPassword";

        console.log(
          `[${testContext.name}] Attempting login with non-existent email: ${email}`,
        );
        const loginResult = await authAccounts.login({ email, password });

        assert("error" in loginResult);
        assertEquals(loginResult.error, "Invalid credentials.");
        console.log(
          `[${testContext.name}] Correctly prevented login for non-existent email ${email}.`,
        );
      },
    );

    await testContext.step(
      "Multiple independent registrations and logins",
      async () => {
        const userA = {
          name: "User A",
          email: "usera@example.com",
          password: "passA",
        };
        const userB = {
          name: "User B",
          email: "userb@example.com",
          password: "passB",
        };

        // Register user A
        const regA = await authAccounts.register(userA);
        if ("error" in regA) {
          throw new Error(`User A registration failed: ${regA.error}`);
        }
        const idA = regA.user;
        console.log(`[${testContext.name}] Registered User A: ${userA.email}`);

        // Register user B
        const regB = await authAccounts.register(userB);
        if ("error" in regB) {
          throw new Error(`User B registration failed: ${regB.error}`);
        }
        const idB = regB.user;
        console.log(`[${testContext.name}] Registered User B: ${userB.email}`);

        // Login user A
        const loginA = await authAccounts.login({
          email: userA.email,
          password: userA.password,
        });
        if ("error" in loginA) {
          throw new Error(`User A login failed: ${loginA.error}`);
        }
        assertEquals(loginA.user, idA);

        // Login user B
        const loginB = await authAccounts.login({
          email: userB.email,
          password: userB.password,
        });
        if ("error" in loginB) {
          throw new Error(`User B login failed: ${loginB.error}`);
        }
        assertEquals(loginB.user, idB);
      },
    );

    await testContext.step(
      "_getNameByUserId retrieves name for existing user",
      async () => {
        const name = "Test User Name";
        const email = "testname@example.com";
        const password = "password123";

        const registerResult = await authAccounts.register({ name, email, password });
        assert("user" in registerResult);
        const userId = registerResult.user;

        const retrievedName = await authAccounts._getNameByUserId(userId);
        assertEquals(retrievedName, name);
      },
    );

    await testContext.step(
      "_getNameByUserId returns null for non-existent user",
      async () => {
        const nonExistentUserId = freshID();
        const result = await authAccounts._getNameByUserId(nonExistentUserId);
        assertEquals(result, null);
      },
    );

    await testContext.step(
      "_getAccountByIdSafe retrieves account details without password",
      async () => {
        const name = "Safe User";
        const email = "safe@example.com";
        const password = "password123";

        const registerResult = await authAccounts.register({ name, email, password });
        assert("user" in registerResult);
        const userId = registerResult.user;

        const accountSafe = await authAccounts._getAccountByIdSafe(userId);
        assert(accountSafe !== null);
        assertEquals(accountSafe!.name, name);
        assertEquals(accountSafe!.email, email);
        // Verify that passwordHash is NOT included
        assert(!("passwordHash" in accountSafe!));
      },
    );

    await testContext.step(
      "_getAccountByIdSafe returns null for non-existent user",
      async () => {
        const nonExistentUserId = freshID();
        const result = await authAccounts._getAccountByIdSafe(nonExistentUserId);
        assertEquals(result, null);
      },
    );

    await testContext.step(
      "_getAllUsers returns error for non-admin",
      async () => {
        const nonAdminUser = freshID() as ID;
        const result = await authAccounts._getAllUsers(nonAdminUser);
        assert("error" in result, "Should return error for non-admin");
        assertEquals(result.error, "Only admins can retrieve all users.");
      },
    );

    await testContext.step(
      "_getAllUsers returns all users for admin",
      async () => {
        // Create an admin user
        const adminUserId = freshID() as ID;
        await db.collection("EventDirectory.admins").insertOne({ _id: adminUserId as any });

        // Get all users
        const result = await authAccounts._getAllUsers(adminUserId);
        assert(Array.isArray(result), "Should return array");
        assert(result.length >= 3, "Should have at least the registered users");

        // Verify structure - should have _id, name, email but NOT passwordHash
        const firstUser = result[0];
        assert("_id" in firstUser, "Should have _id");
        assert("name" in firstUser, "Should have name");
        assert("email" in firstUser, "Should have email");
        assert(!("passwordHash" in firstUser), "Should NOT have passwordHash");
      },
    );
  } finally {
    console.log(`[${testContext.name}] Dropping test database`);
    await db.dropDatabase();
    console.log(`[${testContext.name}] Closing MongoDB client.`);
    await client.close();
  }
});
