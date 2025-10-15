---
timestamp: 'Wed Oct 15 2025 04:44:12 GMT-0400 (Eastern Daylight Time)'
parent: '[[../20251015_044412.3535f8ff.md]]'
content_id: 027b984ce3d3ddaab503c885311ce5e3bf4db1d8bfcff89b7de44f11c4e7e4bb
---

# concept: ApplicationAssignments

* **concept**: ApplicationAssignments \[User]
* **purpose**: To manage the assignment of users to specific applications within a multi-application environment, allowing for controlled access and membership.
* **principle**: If a user creates an application, they are automatically assigned as a member (owner). Other users can then be invited and assigned to this application with different roles, enabling them to access its functionality.
* **state**:
  * A set of `Applications` with
    * an `owner` of type `User`
    * a `name` of type `String`
  * A set of `Assignments` with
    * an `application` of type `Application`
    * a `user` of type `User`
    * a `role` of type `String` (e.g., "owner", "member", "admin")
* **actions**:
  * `createApplication (owner: User, name: String): (application: Application)`
    * **requires**: The application name must be unique.
    * **effects**: Creates a new application, sets the given user as its owner, and automatically assigns the owner to the "owner" role for this application.
  * `assignUser (application: Application, user: User, role: String)`
    * **requires**: The application must exist. The user must not already be assigned to this application.
    * **effects**: Assigns a user to an application with a specified role.
  * `unassignUser (application: Application, user: User)`
    * **requires**: The application must exist. The user must be currently assigned to this application. The user being unassigned must not be the owner of the application.
    * **effects**: Removes a user's assignment from an application.
  * `updateRole (application: Application, user: User, newRole: String)`
    * **requires**: The application must exist. The user must be currently assigned to this application. The user being updated must not be the owner (the owner's role cannot be changed directly via this action).
    * **effects**: Changes the role of an assigned user within an application to `newRole`.

***
