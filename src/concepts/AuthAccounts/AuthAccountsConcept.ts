import { Collection, Db } from "npm:mongodb";
import { ID } from "../../utils/types.ts";
import { freshID } from "../../utils/database.ts";
import * as bcrypt from "npm:bcrypt-ts";

// Declare collection prefix, use concept name
const PREFIX = "AuthAccounts" + ".";

/**
 * @concept AuthAccounts [User]
 * @purpose Handle user registration and login.
 * @principle Users can register and then log in with their credentials. Password is hashed for security.
 */

// Generic types of this concept
type User = ID;

/**
 * @state
 * a set of Accounts with
 *     a userId User
 *     an email String
 *     an name String
 *     a passwordHash String
 */
interface Account {
  _id: User; // The userId, also serving as the document's _id in MongoDB
  email: string;
  name: string;
  passwordHash: string;
}

export default class AuthAccountsConcept {
  accounts: Collection<Account>;

  constructor(private readonly db: Db) {
    this.accounts = this.db.collection(PREFIX + "accounts");
  }

  /**
   * @action register
   * @description Creates a new user account.
   * @param {string} name - The user's chosen name.
   * @param {string} email - The user's email, which must be unique.
   * @param {string} password - The user's password, which will be hashed.
   * @returns {{ user: User } | { error: string }} The ID of the newly registered user, or an error message.
   * @requires no account exists with the same email
   * @effects create an account (with password hashed) and return user
   */
  async register({
    name,
    email,
    password,
  }: {
    name: string;
    email: string;
    password: string;
  }): Promise<{ user: User } | { error: string }> {
    if (!name || !email || !password) {
      return { error: "Missing required fields." };
    }
    // Check if an account with the given email already exists
    const existingAccount = await this.accounts.findOne({ email });
    if (existingAccount) {
      return { error: "Email already registered." };
    }

    // Hash the password for security
    const passwordHash = await bcrypt.hash(password, 10); // 10 is the salt rounds

    // Generate a new unique ID for the user
    const userId: User = freshID();

    // Create the new account document
    const newAccount: Account = {
      _id: userId,
      name,
      email,
      passwordHash,
    };

    // Insert the new account into the database
    await this.accounts.insertOne(newAccount);

    return { user: userId };
  }

  /**
   * @action login
   * @description Authenticates a user with their email and password.
   * @param {string} email - The user's email.
   * @param {string} password - The user's password.
   * @returns {{ user: User } | { error: string }} The ID of the authenticated user, or an error message.
   * @requires credentials match an existing account
   * @effects successfully authenticate and return user
   */
  async login({
    email,
    password,
  }: {
    email: string;
    password: string;
  }): Promise<{ user: User } | { error: string }> {
    // Find the account by email
    const account = await this.accounts.findOne({ email });

    // If no account found, or if password doesn't match
    if (!account || !(await bcrypt.compare(password, account.passwordHash))) {
      return { error: "Invalid credentials." };
    }

    // Authentication successful
    return { user: account._id };
  }

  // --- Queries (beginning with underscore) ---

  /**
   * @query _getAccountByUserId
   * @description Retrieves an account by its user ID.
   * @param {User} userId - The ID of the user.
   * @returns {Account | null} The account object if found, otherwise null.
   */
  async _getAccountByUserId({ userId }: { userId: User }): Promise<Account | null> {
    return await this.accounts.findOne({ _id: userId });
  }

  /**
   * @query _getAccountByEmail
   * @description Retrieves an account by its email address.
   * @param {string} email - The email of the account.
   * @returns {Account | null} The account object if found, otherwise null.
   */
  async _getAccountByEmail({ email }: { email: string }): Promise<Account | null> {
    return await this.accounts.findOne({ email });
  }

  /**
   * @query _getNameByUserId
   * @description Retrieves the name for a given user ID (without sensitive data).
   * @param {User} userId - The ID of the user.
   * @returns {string | null} The name of the user if found, otherwise null.
   */
  async _getNameByUserId({ userId }: { userId: User }): Promise<string | null> {
    const account = await this.accounts.findOne({ _id: userId });
    return account ? account.name : null;
  }

  /**
   * @query _getAccountByIdSafe
   * @description Retrieves account details without password hash for a given user ID.
   * @param {User} userId - The ID of the user.
   * @returns {{name: string, email: string} | null} The account details without password hash if found, otherwise null.
   */
  async _getAccountByIdSafe({ userId }: { userId: User }): Promise<{name: string; email: string} | null> {
    const account = await this.accounts.findOne({ _id: userId });
    if (!account) return null;
    return {
      name: account.name,
      email: account.email,
    };
  }

  /**
   * @query _getAllUsers
   * @description Retrieves all users in the system (for admin use).
   * @param {User} caller - The ID of the user requesting the list.
   * @returns {Array<{_id: User, name: string, email: string}> | {error: string}} All users without password hashes, or an error if not an admin.
   */
  async _getAllUsers({ caller }: { caller: User }): Promise<Array<{_id: User; name: string; email: string}> | { error: string }> {

    // Check if caller is an admin by querying EventDirectory.admins
    const adminDoc = await this.db.collection("EventDirectory.admins").findOne({ _id: caller });

    if (!adminDoc) {
      return { error: "Only admins can retrieve all users." };
    }

    // Get all accounts
    const allAccounts = await this.accounts.find({}).toArray();

    // Return only the safe fields
    return allAccounts.map((account) => ({
      _id: account._id,
      name: account.name,
      email: account.email,
    }));
  }
}
