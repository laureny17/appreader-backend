/**
 * Data Fix Script: Add users to readers set for applications they've reviewed
 *
 * This script fixes data consistency issues where:
 * - Users have reviews for applications
 * - But users are NOT in the readers set for those applications
 * - This causes users to be re-assigned to the same applications
 *
 * Run this with: deno run --allow-all src/utils/fix-readers-set.ts
 */

import { MongoClient } from "npm:mongodb@6.3.0";

const MONGO_URI = Deno.env.get("MONGO_URI") || "mongodb://localhost:27017";
const DB_NAME = Deno.env.get("DB_NAME") || "appreader";

interface Review {
  _id: string;
  author: string;
  application: string;
}

interface AppStatus {
  _id: string;
  application: string;
  event: string;
  readers: string[];
}

interface Application {
  _id: string;
  event: string;
}

async function fixReadersSet() {
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log("✅ Connected to database");

    const db = client.db(DB_NAME);
    const reviewsCollection = db.collection<Review>("ReviewRecords.reviews");
    const appStatusCollection = db.collection<AppStatus>("ApplicationAssignments.appStatus");
    const applicationsCollection = db.collection<Application>("ApplicationStorage.applications");

    // Get all reviews
    const reviews = await reviewsCollection.find({}).toArray();
    console.log(`\n📊 Found ${reviews.length} reviews to check`);

    let fixedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const review of reviews) {
      try {
        // Get the application to find its event
        const application = await applicationsCollection.findOne({ _id: review.application });
        if (!application) {
          console.warn(`⚠️  Application ${review.application} not found for review ${review._id}`);
          errorCount++;
          continue;
        }

        const event = application.event;

        // Find the AppStatus for this application/event
        const appStatus = await appStatusCollection.findOne({
          application: review.application,
          event: event,
        });

        if (!appStatus) {
          console.warn(`⚠️  AppStatus not found for application ${review.application}, event ${event}`);
          errorCount++;
          continue;
        }

        // Check if user is already in readers set
        if (appStatus.readers.includes(review.author)) {
          skippedCount++;
          continue; // Already fixed
        }

        // Add user to readers set
        await appStatusCollection.updateOne(
          { _id: appStatus._id },
          { $addToSet: { readers: review.author } }
        );

        fixedCount++;
        console.log(`✅ Fixed: Added user ${review.author} to readers set for application ${review.application}`);

      } catch (error) {
        console.error(`❌ Error processing review ${review._id}:`, error);
        errorCount++;
      }
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Fixed: ${fixedCount} users added to readers set`);
    console.log(`   ⏭️  Skipped: ${skippedCount} already in readers set`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`\n✅ Data fix complete!`);

  } catch (error) {
    console.error("❌ Database connection error:", error);
    Deno.exit(1);
  } finally {
    await client.close();
    console.log("\n👋 Disconnected from database");
  }
}

// Run the fix
if (import.meta.main) {
  console.log("🔧 Starting readers set fix...\n");
  await fixReadersSet();
}
