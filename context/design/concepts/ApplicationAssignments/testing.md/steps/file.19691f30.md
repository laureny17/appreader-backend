---
timestamp: 'Wed Oct 15 2025 04:44:12 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_044412.3535f8ff.md]]'
content_id: 19691f309d8b7d933acf90d456bc690b4c0c327c58890b1efe7d73b005c8be25
---

# file: src/concepts/ApplicationAssignments/ApplicationAssignmentsConcept.ts

```typescript
import { Collection, Db } from "npm:mongodb";
import { Empty, ID } from "@utils/types.ts";
import { freshID } from "@utils/database.ts";

// Collection prefix to ensure namespace separation
const PREFIX = "ApplicationAssignments" + ".";

// Generic type for external users
type User = ID;

// Internal entity types, represented as IDs
type Application = ID;
type Assignment = ID;

/**
 * State: A set of Applications, each with an owner and a name.
 */
interface ApplicationDoc {
  _id: Application;
  owner: User;
  name: string;
}

/**
 * State: A set of Assignments, linking an application, a user, and their role.
 */
interface AssignmentDoc {
  _id: Assignment;
  application: Application;
  user: User;
  role: string;
}

/**
 * @concept ApplicationAssignments
 * @purpose To manage the assignment of users to specific applications within a multi-application environment, allowing for controlled access and membership.
 */
export default class ApplicationAssignmentsConcept {
  applications: Collection<ApplicationDoc>;
  assignments: Collection<AssignmentDoc>;

  constructor(private readonly db: Db) {
    this.applications = this.db.collection(PREFIX + "applications");
    this.assignments = this.db.collection(PREFIX + "assignments");
  }

  /**
   * Action: Creates a new application.
   * @requires The application name must be unique.
   * @effects A new application is created, the owner is set, and the owner is automatically assigned the "owner" role.
   */
  async createApplication({ owner, name }: { owner: User; name: string }): Promise<{ application: Application } | { error: string }> {
    const existingApp = await this.applications.findOne({ name });
    if (existingApp) {
      return { error: `Application with name "${name}" already exists.` };
    }

    const appId = freshID() as Application;
    await this.applications.insertOne({ _id: appId, owner, name });

    // Automatically assign the owner with "owner" role
    const assignmentId = freshID() as Assignment;
    await this.assignments.insertOne({ _id: assignmentId, application: appId, user: owner, role: "owner" });

    return { application: appId };
  }

  /**
   * Action: Assigns a user to an application with a specified role.
   * @requires The application must exist. The user must not already be assigned to this application.
   * @effects A new assignment record is created.
   */
  async assignUser({ application, user, role }: { application: Application; user: User; role: string }): Promise<Empty | { error: string }> {
    const existingApp = await this.applications.findOne({ _id: application });
    if (!existingApp) {
      return { error: `Application with ID ${application} not found.` };
    }

    const existingAssignment = await this.assignments.findOne({ application, user });
    if (existingAssignment) {
      return { error: `User ${user} is already assigned to application ${application}.` };
    }

    const assignmentId = freshID() as Assignment;
    await this.assignments.insertOne({ _id: assignmentId, application, user, role });

    return {};
  }

  /**
   * Action: Removes a user's assignment from an application.
   * @requires The application must exist. The user must be currently assigned to this application. The user being unassigned must not be the owner of the application.
   * @effects The user's assignment is removed from the application.
   */
  async unassignUser({ application, user }: { application: Application; user: User }): Promise<Empty | { error: string }> {
    const existingApp = await this.applications.findOne({ _id: application });
    if (!existingApp) {
      return { error: `Application with ID ${application} not found.` };
    }

    const assignment = await this.assignments.findOne({ application, user });
    if (!assignment) {
      return { error: `User ${user} is not assigned to application ${application}.` };
    }

    if (existingApp.owner === user) {
      return { error: `Cannot unassign the owner (${user}) from application ${application}.` };
    }

    await this.assignments.deleteOne({ _id: assignment._id });

    return {};
  }

  /**
   * Action: Changes the role of an assigned user within an application.
   * @requires The application must exist. The user must be currently assigned to this application. The user being updated must not be the owner.
   * @effects The user's role for the given application is updated.
   */
  async updateRole({ application, user, newRole }: { application: Application; user: User; newRole: string }): Promise<Empty | { error: string }> {
    const existingApp = await this.applications.findOne({ _id: application });
    if (!existingApp) {
      return { error: `Application with ID ${application} not found.` };
    }

    const assignment = await this.assignments.findOne({ application, user });
    if (!assignment) {
      return { error: `User ${user} is not assigned to application ${application}.` };
    }

    if (existingApp.owner === user) {
      return { error: `Cannot update the role of the application owner (${user}).` };
    }

    await this.assignments.updateOne({ _id: assignment._id }, { $set: { role: newRole } });

    return {};
  }

  /**
   * Query: Retrieves all assignments for a specific application.
   */
  async _getAssignmentsForApplication({ application }: { application: Application }): Promise<AssignmentDoc[]> {
    return await this.assignments.find({ application }).toArray();
  }

  /**
   * Query: Retrieves all applications a user is assigned to.
   */
  async _getApplicationsForUser({ user }: { user: User }): Promise<ApplicationDoc[]> {
    const userAssignments = await this.assignments.find({ user }).toArray();
    const appIds = userAssignments.map((a) => a.application);
    // Find applications where _id is in appIds list
    return await this.applications.find({ _id: { $in: appIds } }).toArray();
  }

  /**
   * Query: Retrieves a specific assignment.
   */
  async _getAssignment({ application, user }: { application: Application; user: User }): Promise<AssignmentDoc | null> {
    return await this.assignments.findOne({ application, user });
  }

  /**
   * Query: Retrieves a specific application by its ID.
   */
  async _getApplicationById({ application }: { application: Application }): Promise<ApplicationDoc | null> {
    return await this.applications.findOne({ _id: application });
  }
}
```

***
