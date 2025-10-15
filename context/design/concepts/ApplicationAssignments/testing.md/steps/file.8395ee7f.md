---
timestamp: 'Wed Oct 15 2025 04:44:12 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_044412.3535f8ff.md]]'
content_id: 8395ee7fb0de9c00dc25f1905d3e2b9220fffadcdb6a4fc4d1f913321cf474c4
---

# file: src/concepts/ApplicationAssignments/ApplicationAssignmentsConcept.test.ts

```typescript
import { assertEquals, assertExists, assertNotEquals, assertArrayIncludes } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { testDb } from "../../utils/testing.ts"; // Assuming testing.ts handles DB cleanup
import { ID } from "../../utils/types.ts";
import ApplicationAssignmentsConcept from "./ApplicationAssignmentsConcept.ts";

// Utility function to create a new ID for testing purposes
const makeID = (prefix: string): ID => `${prefix}:${crypto.randomUUID()}` as ID;

Deno.test("ApplicationAssignments Concept: Principle Fulfillment", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  try {
    const userA = makeID("user");
    const userB = makeID("user");
    const appName = "MyCoolApp";

    await t.step("User A creates an application and is automatically assigned as owner", async () => {
      const createResult = await applicationAssignments.createApplication({ owner: userA, name: appName });
      assertExists(createResult.application);
      assertNotEquals((createResult as { error?: string }).error, "Application with name \"MyCoolApp\" already exists.");

      const app = await applicationAssignments._getApplicationById({ application: createResult.application as ID });
      assertExists(app);
      assertEquals(app.name, appName);
      assertEquals(app.owner, userA);

      const ownerAssignment = await applicationAssignments._getAssignment({ application: createResult.application as ID, user: userA });
      assertExists(ownerAssignment);
      assertEquals(ownerAssignment.role, "owner");
    });

    let appA_id: ID;
    await t.step("Other users can then be invited and assigned to this application", async () => {
      // Re-fetch the app ID from previous step or create it if the steps were run independently
      const appResult = await applicationAssignments.createApplication({ owner: userA, name: "AnotherApp" }); // Use a new app name for this step for clarity
      appA_id = appResult.application as ID;

      const assignResult = await applicationAssignments.assignUser({ application: appA_id, user: userB, role: "member" });
      assertEquals(assignResult, {}); // Expect empty object for success

      const memberAssignment = await applicationAssignments._getAssignment({ application: appA_id, user: userB });
      assertExists(memberAssignment);
      assertEquals(memberAssignment.role, "member");

      const appAssignments = await applicationAssignments._getAssignmentsForApplication({ application: appA_id });
      assertEquals(appAssignments.length, 2);
      assertArrayIncludes(appAssignments.map(a => a.user), [userA, userB]);
      assertArrayIncludes(appAssignments.map(a => a.role), ["owner", "member"]);
    });

    await t.step("Enabling users to access its functionality (represented by their assignment records)", async () => {
      // Query for userB's applications to confirm they are listed as assigned
      const userBApps = await applicationAssignments._getApplicationsForUser({ user: userB });
      assertEquals(userBApps.length, 1); // userB was assigned to "AnotherApp"
      assertEquals(userBApps[0]._id, appA_id);
    });

  } finally {
    await client.close();
  }
});

Deno.test("ApplicationAssignments Concept: Action - createApplication", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  try {
    const owner = makeID("user");
    const appName = "TestApp";

    await t.step("should successfully create a new application", async () => {
      const result = await applicationAssignments.createApplication({ owner, name: appName });
      assertExists(result.application);
      assertNotEquals((result as { error?: string }).error, "Application with name \"TestApp\" already exists.");

      const app = await applicationAssignments._getApplicationById({ application: result.application as ID });
      assertExists(app);
      assertEquals(app.name, appName);
      assertEquals(app.owner, owner);

      const assignment = await applicationAssignments._getAssignment({ application: result.application as ID, user: owner });
      assertExists(assignment);
      assertEquals(assignment.role, "owner");
    });

    await t.step("should return an error if application name is not unique", async () => {
      const result = await applicationAssignments.createApplication({ owner, name: appName });
      assertEquals(result.error, `Application with name "${appName}" already exists.`);
      assertNotEquals((result as { application?: ID }).application, undefined);
    });

  } finally {
    await client.close();
  }
});

Deno.test("ApplicationAssignments Concept: Action - assignUser", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  try {
    const owner = makeID("user");
    const newUser = makeID("user");
    const appName = "AssignUserTestApp";
    const createResult = await applicationAssignments.createApplication({ owner, name: appName });
    const appId = createResult.application as ID;

    await t.step("should successfully assign a new user to an application", async () => {
      const result = await applicationAssignments.assignUser({ application: appId, user: newUser, role: "editor" });
      assertEquals(result, {});

      const assignment = await applicationAssignments._getAssignment({ application: appId, user: newUser });
      assertExists(assignment);
      assertEquals(assignment.role, "editor");
    });

    await t.step("should return an error if the application does not exist", async () => {
      const nonExistentApp = makeID("app");
      const result = await applicationAssignments.assignUser({ application: nonExistentApp, user: newUser, role: "viewer" });
      assertEquals(result.error, `Application with ID ${nonExistentApp} not found.`);
    });

    await t.step("should return an error if the user is already assigned to the application", async () => {
      const result = await applicationAssignments.assignUser({ application: appId, user: newUser, role: "contributor" }); // Attempt to assign existing user
      assertEquals(result.error, `User ${newUser} is already assigned to application ${appId}.`);
    });

  } finally {
    await client.close();
  }
});

Deno.test("ApplicationAssignments Concept: Action - unassignUser", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  try {
    const owner = makeID("user");
    const member = makeID("user");
    const appName = "UnassignUserTestApp";
    const createResult = await applicationAssignments.createApplication({ owner, name: appName });
    const appId = createResult.application as ID;
    await applicationAssignments.assignUser({ application: appId, user: member, role: "member" });

    await t.step("should successfully unassign an existing member from an application", async () => {
      const result = await applicationAssignments.unassignUser({ application: appId, user: member });
      assertEquals(result, {});

      const assignment = await applicationAssignments._getAssignment({ application: appId, user: member });
      assertEquals(assignment, null);
    });

    await t.step("should return an error if the user is not assigned to the application", async () => {
      const nonAssignedUser = makeID("user");
      const result = await applicationAssignments.unassignUser({ application: appId, user: nonAssignedUser });
      assertEquals(result.error, `User ${nonAssignedUser} is not assigned to application ${appId}.`);
    });

    await t.step("should return an error if attempting to unassign the application owner", async () => {
      const result = await applicationAssignments.unassignUser({ application: appId, user: owner });
      assertEquals(result.error, `Cannot unassign the owner (${owner}) from application ${appId}.`);
    });

  } finally {
    await client.close();
  }
});

Deno.test("ApplicationAssignments Concept: Action - updateRole", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  try {
    const owner = makeID("user");
    const member = makeID("user");
    const appName = "UpdateRoleTestApp";
    const createResult = await applicationAssignments.createApplication({ owner, name: appName });
    const appId = createResult.application as ID;
    await applicationAssignments.assignUser({ application: appId, user: member, role: "viewer" });

    await t.step("should successfully update the role of an existing member", async () => {
      const newRole = "admin";
      const result = await applicationAssignments.updateRole({ application: appId, user: member, newRole });
      assertEquals(result, {});

      const assignment = await applicationAssignments._getAssignment({ application: appId, user: member });
      assertExists(assignment);
      assertEquals(assignment.role, newRole);
    });

    await t.step("should return an error if the user is not assigned to the application", async () => {
      const nonAssignedUser = makeID("user");
      const result = await applicationAssignments.updateRole({ application: appId, user: nonAssignedUser, newRole: "guest" });
      assertEquals(result.error, `User ${nonAssignedUser} is not assigned to application ${appId}.`);
    });

    await t.step("should return an error if attempting to update the role of the application owner", async () => {
      const result = await applicationAssignments.updateRole({ application: appId, user: owner, newRole: "super_owner" });
      assertEquals(result.error, `Cannot update the role of the application owner (${owner}).`);
    });

  } finally {
    await client.close();
  }
});

Deno.test("ApplicationAssignments Concept: Queries", async (t) => {
  const [db, client] = await testDb();
  const applicationAssignments = new ApplicationAssignmentsConcept(db);

  try {
    const owner1 = makeID("user");
    const user1 = makeID("user");
    const user2 = makeID("user");

    const app1Result = await applicationAssignments.createApplication({ owner: owner1, name: "QueryApp1" });
    const app1Id = app1Result.application as ID;
    await applicationAssignments.assignUser({ application: app1Id, user: user1, role: "editor" });
    await applicationAssignments.assignUser({ application: app1Id, user: user2, role: "viewer" });

    const owner2 = makeID("user");
    const app2Result = await applicationAssignments.createApplication({ owner: owner2, name: "QueryApp2" });
    const app2Id = app2Result.application as ID;
    await applicationAssignments.assignUser({ application: app2Id, user: user1, role: "admin" });

    await t.step("_getAssignmentsForApplication should return all assignments for a given app", async () => {
      const assignments = await applicationAssignments._getAssignmentsForApplication({ application: app1Id });
      assertEquals(assignments.length, 3); // owner1, user1, user2
      assertArrayIncludes(assignments.map(a => a.user), [owner1, user1, user2]);
    });

    await t.step("_getApplicationsForUser should return all applications a user is assigned to", async () => {
      const user1Apps = await applicationAssignments._getApplicationsForUser({ user: user1 });
      assertEquals(user1Apps.length, 2); // app1, app2
      assertArrayIncludes(user1Apps.map(app => app._id), [app1Id, app2Id]);
    });

    await t.step("_getAssignment should return a specific assignment or null", async () => {
      const assignment = await applicationAssignments._getAssignment({ application: app1Id, user: user1 });
      assertExists(assignment);
      assertEquals(assignment.role, "editor");

      const nonExistentAssignment = await applicationAssignments._getAssignment({ application: app1Id, user: makeID("user") });
      assertEquals(nonExistentAssignment, null);
    });

    await t.step("_getApplicationById should return a specific application or null", async () => {
      const app = await applicationAssignments._getApplicationById({ application: app2Id });
      assertExists(app);
      assertEquals(app.name, "QueryApp2");

      const nonExistentApp = await applicationAssignments._getApplicationById({ application: makeID("app") });
      assertEquals(nonExistentApp, null);
    });

  } finally {
    await client.close();
  }
});
```
