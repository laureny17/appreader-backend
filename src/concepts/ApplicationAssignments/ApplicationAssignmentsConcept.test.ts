import { assert, assertEquals, assertObjectMatch } from "jsr:@std/assert";
import { Db } from "npm:mongodb";
import { freshID, testDb } from "../../utils/database.ts"; // testDb for isolated testing, freshID for manual ID creation
import { ID } from "../../utils/types.ts";
import ApplicationAssignmentsConcept from "./ApplicationAssignmentsConcept.ts";

// Define some generic IDs for testing
const USER_ALICE = "user:Alice" as ID;
const USER_BOB = "user:Bob" as ID;
const USER_CHARLIE = "user:Charlie" as ID;
const APP_ALPHA = "app:Alpha" as ID;
const APP_BETA = "app:Beta" as ID;
const APP_GAMMA = "app:Gamma" as ID;
const EVENT_SPRING_2024 = "event:Spring2024" as ID;
const EVENT_FALL_2024 = "event:Fall2024" as ID;

// Utility to clear collections before each test to ensure isolation
// This clears the collections specific to the ApplicationAssignments concept
async function clearCollections(db: Db) {
  await db.collection("ApplicationAssignments.currentAssignments").deleteMany(
    {},
  );
  await db.collection("ApplicationAssignments.appStatus").deleteMany({});
}

Deno.test("ApplicationAssignmentsConcept: Principle Fulfillment - Full User Assignment Flow", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  await t.step(
    "1. Initial setup: Register applications for an event",
    async () => {
      await clearCollections(db); // Ensure a clean state for this test block

      await applicationAssignments.registerApplicationForAssignment({
        application: APP_ALPHA,
        event: EVENT_SPRING_2024,
      });
      await applicationAssignments.registerApplicationForAssignment({
        application: APP_BETA,
        event: EVENT_SPRING_2024,
      });
      await applicationAssignments.registerApplicationForAssignment({
        application: APP_GAMMA,
        event: EVENT_SPRING_2024,
      });

      const appStatusCount = await db.collection(
        "ApplicationAssignments.appStatus",
      ).countDocuments();
      assertEquals(
        appStatusCount,
        3,
        "Expected 3 AppStatus entries after registration.",
      );

      // Verify initial state of an AppStatus
      const appStatusAlpha = await db.collection(
        "ApplicationAssignments.appStatus",
      ).findOne({ application: APP_ALPHA, event: EVENT_SPRING_2024 });
      assert(appStatusAlpha, "AppStatus for APP_ALPHA should exist.");
      assertEquals(
        appStatusAlpha.readsCompleted,
        0,
        "Initial readsCompleted should be 0.",
      );
      assertEquals(
        appStatusAlpha.readers.length,
        0,
        "Initial readers set should be empty.",
      );
    },
  );

  await t.step(
    "2. User Alice gets her first assignment (APP_ALPHA)",
    async () => {
      const startTime = new Date();
      const result = await applicationAssignments.getNextAssignment({
        user: USER_ALICE,
        event: EVENT_SPRING_2024,
        startTime: startTime,
      });

      assert(result.assignment, "Alice should receive an assignment.");
      assert(!result.error, "No error expected when getting an assignment.");
      assertEquals(
        result.assignment.user,
        USER_ALICE,
        "Assigned user should be Alice.",
      );
      assertEquals(
        result.assignment.event,
        EVENT_SPRING_2024,
        "Assigned event should match.",
      );
      // Assuming tie-breaking by default MongoDB find() order, APP_ALPHA should come first if all readsCompleted are 0.
      assertEquals(
        result.assignment.application,
        APP_ALPHA,
        "Alice should be assigned APP_ALPHA.",
      );
      assertObjectMatch(
        result.assignment,
        { startTime: startTime },
        "Assignment start time should match.",
      );

      const currentAssignmentsCount = await db.collection(
        "ApplicationAssignments.currentAssignments",
      ).countDocuments();
      assertEquals(
        currentAssignmentsCount,
        1,
        "Expected 1 active assignment after Alice gets one.",
      );
    },
  );

  await t.step(
    "3. User Alice gets the same assignment when requesting again (idempotent)",
    async () => {
      const startTime = new Date();
      const result = await applicationAssignments.getNextAssignment({
        user: USER_ALICE,
        event: EVENT_SPRING_2024,
        startTime: startTime,
      });

      // Should return the existing assignment, not create a new one
      assert(result.assignment, "Alice should receive her existing assignment.");
      assert(!result.error, "No error expected when getting existing assignment.");

      // Verify the assignment is the same one from step 2
      const currentResult = await applicationAssignments.getCurrentAssignment({
        user: USER_ALICE,
        event: EVENT_SPRING_2024,
      });
      assertEquals(
        result.assignment?._id,
        currentResult.assignment?._id,
        "Should return the same assignment."
      );
    },
  );

  await t.step("4. User Alice submits APP_ALPHA", async () => {
    const activeAssignment = await db.collection(
      "ApplicationAssignments.currentAssignments",
    ).findOne({ user: USER_ALICE, event: EVENT_SPRING_2024 });
    assert(
      activeAssignment,
      "Alice should have an active assignment to submit.",
    );

    const endTime = new Date();
    const result = await applicationAssignments.submitAndIncrement({
      user: USER_ALICE,
      assignment: activeAssignment as any, // Cast to any to align with MongoDB object with _id
      endTime: endTime,
    });

    assert(result.application, "Submission should return the application ID.");
    assert(!result.error, "No error expected during submission.");
    assertEquals(
      result.application,
      APP_ALPHA,
      "Submitted application should be APP_ALPHA.",
    );

    const appStatusAlpha = await db.collection(
      "ApplicationAssignments.appStatus",
    ).findOne({ application: APP_ALPHA, event: EVENT_SPRING_2024 });
    assert(appStatusAlpha, "AppStatus for APP_ALPHA should still exist.");
    assertEquals(
      appStatusAlpha.readsCompleted,
      1,
      "APP_ALPHA readsCompleted should be incremented to 1.",
    );
    assert(
      appStatusAlpha.readers.includes(USER_ALICE),
      "Alice should be added to APP_ALPHA's readers list.",
    );

    const currentAssignmentsCount = await db.collection(
      "ApplicationAssignments.currentAssignments",
    ).countDocuments({ user: USER_ALICE });
    assertEquals(
      currentAssignmentsCount,
      0,
      "Alice's active assignment should be removed.",
    );
  });

  await t.step(
    "5. User Bob gets an assignment (APP_BETA) - demonstrating prioritization for new users",
    async () => {
      // Current state: APP_ALPHA (1 read, Alice read), APP_BETA (0 reads), APP_GAMMA (0 reads).
      // Bob has not read any. He should be assigned one with 0 reads, likely APP_BETA.
      const startTime = new Date();
      const result = await applicationAssignments.getNextAssignment({
        user: USER_BOB,
        event: EVENT_SPRING_2024,
        startTime: startTime,
      });

      assert(result.assignment, "Bob should receive an assignment.");
      assert(!result.error, "No error expected.");
      assertEquals(
        result.assignment.user,
        USER_BOB,
        "Assigned user should be Bob.",
      );
      assertEquals(
        result.assignment.application,
        APP_BETA,
        "Bob should be assigned APP_BETA due to lowest readsCompleted among unread.",
      );
    },
  );

  await t.step(
    "6. User Alice gets her next assignment (APP_GAMMA) - previously read apps excluded",
    async () => {
      // Current state for Alice: APP_ALPHA (read), APP_BETA (assigned to Bob), APP_GAMMA (0 reads, not read by Alice).
      const startTime = new Date();
      const result = await applicationAssignments.getNextAssignment({
        user: USER_ALICE,
        event: EVENT_SPRING_2024,
        startTime: startTime,
      });

      assert(result.assignment, "Alice should receive a new assignment.");
      assert(!result.error, "No error expected.");
      assertEquals(
        result.assignment.user,
        USER_ALICE,
        "Assigned user should be Alice.",
      );
      assertEquals(
        result.assignment.application,
        APP_GAMMA,
        "Alice should be assigned APP_GAMMA (not APP_ALPHA she read, not APP_BETA assigned to Bob).",
      );
    },
  );

  await t.step("7. User Alice skips APP_GAMMA", async () => {
    const activeAssignment = await db.collection(
      "ApplicationAssignments.currentAssignments",
    ).findOne({ user: USER_ALICE, event: EVENT_SPRING_2024 });
    assert(
      activeAssignment,
      "Alice should have an active assignment (APP_GAMMA) to skip.",
    );

    const result = await applicationAssignments.skipAssignment({
      user: USER_ALICE,
      assignment: activeAssignment as any,
    });

    assert(!result.error, "No error expected when skipping an assignment.");

    const appStatusGamma = await db.collection(
      "ApplicationAssignments.appStatus",
    ).findOne({ application: APP_GAMMA, event: EVENT_SPRING_2024 });
    assert(appStatusGamma, "AppStatus for APP_GAMMA should exist.");
    assertEquals(
      appStatusGamma.readsCompleted,
      0,
      "APP_GAMMA readsCompleted should remain 0 after skip.",
    );
    assert(
      appStatusGamma.readers.includes(USER_ALICE),
      "Alice should be added to APP_GAMMA's readers list after skipping.",
    );

    const currentAssignmentsCount = await db.collection(
      "ApplicationAssignments.currentAssignments",
    ).countDocuments({ user: USER_ALICE });
    assertEquals(
      currentAssignmentsCount,
      0,
      "Alice's active assignment should be removed after skipping.",
    );
  });

  await t.step(
    "8. User Alice cannot get any more assignments (all eligible apps for her are read/skipped)",
    async () => {
      // Alice has read APP_ALPHA, and skipped APP_GAMMA. APP_BETA is still assigned to Bob.
      // So there are no more applications available for Alice for this event.
      const startTime = new Date();
      const result = await applicationAssignments.getNextAssignment({
        user: USER_ALICE,
        event: EVENT_SPRING_2024,
        startTime: startTime,
      });

      assert(
        !result.assignment,
        "Alice should not receive any more assignments.",
      );
      assert(
        result.error,
        "An error is expected as all applications are read/skipped by Alice.",
      );
      assertEquals(
        result.error,
        "No eligible applications available for assignment.",
        "Error message should reflect no eligible apps.",
      );
    },
  );

  // Ensure client is closed after the entire test suite completes
  client.close();
});

Deno.test("ApplicationAssignmentsConcept: Reassignment After Submission", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  // Clean slate
  await db.collection("ApplicationAssignments.currentAssignments").deleteMany(
    {},
  );
  await db.collection("ApplicationAssignments.appStatus").deleteMany({});

  const event = "event:ReassignTest" as ID;
  const app = "app:Reassignable" as ID;
  const alice = "user:Alice" as ID;
  const bob = "user:Bob" as ID;

  // Register one application for the event
  await applicationAssignments.registerApplicationForAssignment({
    application: app,
    event,
  });

  // Alice gets and submits the app
  const aliceAssign = await applicationAssignments.getNextAssignment({
    user: alice,
    event,
    startTime: new Date(),
  });
  assert(aliceAssign.assignment, "Alice should get the app initially.");
  await applicationAssignments.submitAndIncrement({
    user: alice,
    assignment: aliceAssign.assignment as any,
    endTime: new Date(),
  });

  // Verify readsCompleted incremented
  const appStatusAfterAlice = await db.collection(
    "ApplicationAssignments.appStatus",
  ).findOne({ application: app, event });
  assertEquals(
    appStatusAfterAlice?.readsCompleted,
    1,
    "Reads should be incremented after Alice’s submission.",
  );

  // Bob requests next assignment for the same event
  const bobAssign = await applicationAssignments.getNextAssignment({
    user: bob,
    event,
    startTime: new Date(),
  });
  assert(
    bobAssign.assignment,
    "Bob should get the app after Alice submitted it.",
  );
  assertEquals(
    bobAssign.assignment?.application,
    app,
    "The same app can be reassigned to another user after submission.",
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: registerApplicationForAssignment - Idempotency", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });
  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  }); // Registering again

  const appStatusCount = await db.collection("ApplicationAssignments.appStatus")
    .countDocuments({ application: APP_ALPHA, event: EVENT_SPRING_2024 });
  assertEquals(
    appStatusCount,
    1,
    "Only one AppStatus entry should exist for the same app/event pair due to idempotency.",
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: getNextAssignment - No eligible applications scenario", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });

  // User Alice gets and submits the only available application
  const assignResult1 = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  assert(assignResult1.assignment, "Alice should initially get an assignment.");
  await applicationAssignments.submitAndIncrement({
    user: USER_ALICE,
    assignment: assignResult1.assignment as any,
    endTime: new Date(),
  });

  // Now, Alice requests another assignment for the same event, but no applications are left for her
  const assignResult2 = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });

  assert(
    !assignResult2.assignment,
    "Should not receive an assignment when none are eligible.",
  );
  assert(
    assignResult2.error,
    "Should return an error indicating no eligible applications.",
  );
  assertEquals(
    assignResult2.error,
    "No eligible applications available for assignment.",
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: getNextAssignment - Prioritization by fewest reads completed", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });
  await applicationAssignments.registerApplicationForAssignment({
    application: APP_BETA,
    event: EVENT_SPRING_2024,
  });
  await applicationAssignments.registerApplicationForAssignment({
    application: APP_GAMMA,
    event: EVENT_SPRING_2024,
  });

  // Simulate reads to create different 'readsCompleted' counts
  // User Alice reads APP_ALPHA (Alpha readsCompleted: 1)
  let assignResult = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  assertEquals(
    assignResult.assignment?.application,
    APP_ALPHA,
    "Alice should get APP_ALPHA first.",
  );
  await applicationAssignments.submitAndIncrement({
    user: USER_ALICE,
    assignment: assignResult.assignment as any,
    endTime: new Date(),
  });

  // User Bob reads a different app with the fewest total reads (0 so far)
  assignResult = await applicationAssignments.getNextAssignment({
    user: USER_BOB,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  assert(
    [APP_BETA, APP_GAMMA].includes(assignResult.assignment?.application!),
    "Bob should get an app with 0 readsCompleted (APP_BETA or APP_GAMMA).",
  );
  await applicationAssignments.submitAndIncrement({
    user: USER_BOB,
    assignment: assignResult.assignment as any,
    endTime: new Date(),
  });

  // Now, APP_ALPHA has 2 reads. APP_BETA and APP_GAMMA still have 0 reads.
  // User Charlie requests an assignment. He has not read any.
  assignResult = await applicationAssignments.getNextAssignment({
    user: USER_CHARLIE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  // Charlie should get APP_BETA or APP_GAMMA, prioritizing the one with 0 reads.
  // If B and G have equal reads (0), their selection order depends on MongoDB's internal tie-breaking.
  assert(
    [APP_BETA, APP_GAMMA].includes(assignResult.assignment?.application!),
    `Charlie should get either APP_BETA or APP_GAMMA, since both have 0 readsCompleted and are unread.`,
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: skipAssignment - Handles invalid assignment or user mismatch", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });
  const assignResult = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  assert(assignResult.assignment, "Alice should get an assignment.");

  // Scenario 1: User Bob tries to skip Alice's assignment
  const skipResultBob = await applicationAssignments.skipAssignment({
    user: USER_BOB, // Different user
    assignment: assignResult.assignment as any,
  });
  assert(
    skipResultBob.error,
    "Bob should not be able to skip Alice's assignment.",
  );
  assertEquals(
    skipResultBob.error,
    "Provided assignment does not exist or does not belong to the user.",
    "Error message for mismatch.",
  );

  // Scenario 2: Alice tries to skip a non-existent assignment (faking an _id)
  const nonExistentAssignment = {
    ...assignResult.assignment,
    _id: freshID(),
  } as any;
  const skipResultNonExistent = await applicationAssignments.skipAssignment({
    user: USER_ALICE,
    assignment: nonExistentAssignment,
  });
  assert(
    skipResultNonExistent.error,
    "Alice should not be able to skip a non-existent assignment.",
  );
  assertEquals(
    skipResultNonExistent.error,
    "Provided assignment does not exist or does not belong to the user.",
    "Error message for non-existent assignment.",
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: submitAndIncrement - Handles invalid assignment or user mismatch", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });
  const assignResult = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  assert(assignResult.assignment, "Alice should get an assignment.");

  // Scenario 1: User Bob tries to submit Alice's assignment
  const submitResultBob = await applicationAssignments.submitAndIncrement({
    user: USER_BOB, // Different user
    assignment: assignResult.assignment as any,
    endTime: new Date(),
  });
  assert(
    submitResultBob.error,
    "Bob should not be able to submit Alice's assignment.",
  );
  assertEquals(
    submitResultBob.error,
    "Provided assignment does not exist or does not belong to the user.",
    "Error message for mismatch.",
  );

  // Scenario 2: Alice tries to submit a non-existent assignment
  const nonExistentAssignment = {
    ...assignResult.assignment,
    _id: freshID(),
  } as any;
  const submitResultNonExistent = await applicationAssignments
    .submitAndIncrement({
      user: USER_ALICE,
      assignment: nonExistentAssignment,
      endTime: new Date(),
    });
  assert(
    submitResultNonExistent.error,
    "Alice should not be able to submit a non-existent assignment.",
  );
  assertEquals(
    submitResultNonExistent.error,
    "Provided assignment does not exist or does not belong to the user.",
    "Error message for non-existent assignment.",
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: submitAndIncrement - Correctly updates AppStatus and removes assignment", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });
  const assignResult = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });
  assert(assignResult.assignment, "Alice should get an assignment.");

  await applicationAssignments.submitAndIncrement({
    user: USER_ALICE,
    assignment: assignResult.assignment as any,
    endTime: new Date(),
  });

  const appStatusAlpha = await db.collection("ApplicationAssignments.appStatus")
    .findOne({ application: APP_ALPHA, event: EVENT_SPRING_2024 });
  assert(appStatusAlpha, "AppStatus for APP_ALPHA should exist.");
  assertEquals(
    appStatusAlpha.readsCompleted,
    1,
    "readsCompleted should be 1 after submission.",
  );
  assert(
    appStatusAlpha.readers.includes(USER_ALICE),
    "Alice should be added to the readers set.",
  );

  const currentAssignmentsCount = await db.collection(
    "ApplicationAssignments.currentAssignments",
  ).countDocuments();
  assertEquals(
    currentAssignmentsCount,
    0,
    "Current assignment should be removed after submission.",
  );

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: abandonAssignment - deletes assignment without incrementing reads", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  // Register an application
  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });

  // Get an assignment
  const assignment = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });

  assert("assignment" in assignment, "Should return assignment");

  // Abandon the assignment
  const abandonResult = await applicationAssignments.abandonAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
  });

  assert(!("error" in abandonResult), "Should succeed");

  // Verify assignment was deleted
  const assignmentCount = await db.collection("ApplicationAssignments.currentAssignments").countDocuments();
  assertEquals(assignmentCount, 0, "Assignment should be deleted");

  // Verify reads were NOT incremented
  const appStatus = await db.collection("ApplicationAssignments.appStatus").findOne({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });
  assertEquals(appStatus?.readsCompleted, 0, "readsCompleted should be 0");
  assertEquals(appStatus?.readers, [], "readers should be empty");

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: getCurrentAssignment - returns active assignment", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  // Register an application and get an assignment
  await applicationAssignments.registerApplicationForAssignment({
    application: APP_ALPHA,
    event: EVENT_SPRING_2024,
  });

  const assignmentResult = await applicationAssignments.getNextAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
    startTime: new Date(),
  });

  assert("assignment" in assignmentResult, "Should return assignment");

  // Get the current assignment
  const currentResult = await applicationAssignments.getCurrentAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
  });

  assert(currentResult.assignment !== null, "Should return the assignment");
  assertEquals(currentResult.assignment?._id, assignmentResult.assignment?._id);

  client.close();
});

Deno.test("ApplicationAssignmentsConcept: getCurrentAssignment - returns null when no assignment exists", async () => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);
  await clearCollections(db);

  const currentResult = await applicationAssignments.getCurrentAssignment({
    user: USER_ALICE,
    event: EVENT_SPRING_2024,
  });

  assertEquals(currentResult.assignment, null, "Should return null");

  client.close();
});
