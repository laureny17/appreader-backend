# AuthAccounts Design

- New concept for separation of concerns as mentioned in assignment 2 feedback; previously in EventDirectory
- Has generic type [User]; created to deal with registration and login
- State: Accounts { userId, email, name, passwordHash } (hashing noted in effects)
- Actions: register(), login()
