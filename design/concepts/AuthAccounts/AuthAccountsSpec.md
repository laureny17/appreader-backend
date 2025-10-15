# AuthAccounts Spec

```
concept AuthAccounts [User]
purpose Handle user registration and login.
principle Users can register and then log in with their credentials. Password is hashed for security.

state
    a set of Accounts with
        a userId User
        an email String
        a name String
        a passwordHash String

actions
    register (name: String, email: String, password: String) : (user: User)
        requires: no account exists with the same email
        effects: create an account (with password hashed) and return user

    login (email: String, password: String) : (user: User)
        requires: credentials match an existing account
        effects: successfully authenticate and return user
```
