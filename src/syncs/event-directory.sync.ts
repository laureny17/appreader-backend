/**
 * Syncs for EventDirectory admin actions
 * All these syncs verify that caller is an admin
 */

import { EventDirectory, Requesting } from "@concepts";
import { actions, Sync, Frames } from "@engine";

// Helper: Check if caller is admin
const verifyAdmin = async (frames: any, caller: symbol) => {
  try {
    console.log("[verifyAdmin] Starting admin check");
    const callerValue = frames[0]?.[caller as symbol];
    console.log("[verifyAdmin] Caller value:", callerValue);

    const isAdminSymbol = Symbol("isAdmin");
    frames = await frames.query(EventDirectory._isAdmin, { user: caller }, { isAdmin: isAdminSymbol });
    console.log("[verifyAdmin] Frames after query:", frames.length);

    const filtered = frames.filter(($) => {
      const isAdminValue = $[isAdminSymbol];
      console.log("[verifyAdmin] Checking frame, isAdmin:", isAdminValue);
      return isAdminValue === true;
    });

    console.log("[verifyAdmin] Filtered frames (admin only):", filtered.length);
    return filtered;
  } catch (error) {
    console.error("[verifyAdmin] Error checking admin status:", error);
    console.error("[verifyAdmin] Error stack:", (error as Error)?.stack);
    // Return empty frames if there's an error (will cause sync to not proceed)
    return new Frames();
  }
};

// ========== createEvent ==========
export const CreateEventRequest: Sync = ({ request, caller, name, requiredReadsPerApp, rubric, questions, endDate }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/createEvent", caller, name, requiredReadsPerApp, rubric, questions, endDate },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.createEvent, { caller, name, requiredReadsPerApp, rubric, questions, endDate }]),
});

export const CreateEventResponse: Sync = ({ request, event, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/createEvent" }, { request }],
    [EventDirectory.createEvent, {}, { event, error }],
  ),
  then: actions([Requesting.respond, { request, ...(event ? { event } : { error }) }]),
});

// ========== activateEvent ==========
export const ActivateEventRequest: Sync = ({ request, caller, name }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/activateEvent", caller, name },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.activateEvent, { caller, name }]),
});

export const ActivateEventResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/activateEvent" }, { request }],
    [EventDirectory.activateEvent, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const ActivateEventResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/activateEvent" }, { request }],
    [EventDirectory.activateEvent, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== inactivateEvent ==========
export const InactivateEventRequest: Sync = ({ request, caller, name }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/inactivateEvent", caller, name },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.inactivateEvent, { caller, name }]),
});

export const InactivateEventResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/inactivateEvent" }, { request }],
    [EventDirectory.inactivateEvent, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const InactivateEventResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/inactivateEvent" }, { request }],
    [EventDirectory.inactivateEvent, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== updateEventConfig ==========
// NOTE: Only match required parameters in 'when' to avoid pattern matching failures
// Extract optional parameters from Requesting.request's stored input in the database
// CRITICAL: Parameters NOT matched in 'when' are NOT symbols - we must create symbols for them
export const UpdateEventConfigRequest: Sync = ({ request, caller, event }) => {
  // Create symbols for optional parameters that will be extracted from the database
  const requiredReadsPerAppSym = Symbol("requiredReadsPerApp");
  const rubricSym = Symbol("rubric");
  const eligibilityCriteriaSym = Symbol("eligibilityCriteria");
  const questionsSym = Symbol("questions");
  const endDateSym = Symbol("endDate");

  return {
    when: actions([
      Requesting.request,
      { path: "/EventDirectory/updateEventConfig", caller, event },
      { request },
    ]),
    where: async (frames) => {
      console.log("[UpdateEventConfigRequest] WHERE clause started");
      console.log("[UpdateEventConfigRequest] Frames count:", frames.length);

      // CRITICAL: matchThen throws if symbol value is undefined (line 218 in sync.ts)
      // Solution: Initialize optional params to null (sentinel), then override if they exist in request
      // matchThen only checks for undefined, not null, so null will pass through
      // Concept action will ignore null values (checks both !== undefined and !== null)
      for (const frame of frames) {
        (frame as any)[requiredReadsPerAppSym] = null; // null = not provided (will be overridden if exists)
        (frame as any)[rubricSym] = null;
        (frame as any)[eligibilityCriteriaSym] = null;
        (frame as any)[questionsSym] = null;
        (frame as any)[endDateSym] = null;
      }

      // Extract optional parameters from the original Requesting.request action record
      // Access via database - Requesting.request stores the full input there
      const requestId = frames[0]?.[request as symbol] as any;
      console.log("[UpdateEventConfigRequest] Request ID:", requestId);

      if (requestId) {
        try {
          const concepts = await import("@concepts");
          const db = (concepts as any).db;
          if (db) {
            const requestDoc = await db.collection("Requesting.requests").findOne({ _id: requestId });
            console.log("[UpdateEventConfigRequest] Request document found:", !!requestDoc);
            if (requestDoc?.input) {
              const fullInput = requestDoc.input as any;
              console.log("[UpdateEventConfigRequest] Full input keys:", Object.keys(fullInput));
              console.log("[UpdateEventConfigRequest] Has rubric:", !!fullInput.rubric);

              // Bind optional parameters to their symbols in each frame
              for (const frame of frames) {
                if (fullInput.requiredReadsPerApp !== undefined) {
                  (frame as any)[requiredReadsPerAppSym] = fullInput.requiredReadsPerApp;
                }
                if (fullInput.rubric !== undefined) {
                  (frame as any)[rubricSym] = fullInput.rubric;
                }
                if (fullInput.eligibilityCriteria !== undefined) {
                  (frame as any)[eligibilityCriteriaSym] = fullInput.eligibilityCriteria;
                }
                if (fullInput.questions !== undefined) {
                  (frame as any)[questionsSym] = fullInput.questions;
                }
                if (fullInput.endDate !== undefined) {
                  (frame as any)[endDateSym] = fullInput.endDate;
                }
              }
            }
          }
        } catch (error) {
          console.error("[UpdateEventConfigRequest] Error accessing request input:", error);
          // Continue with admin check - optional params remain undefined (which is OK)
        }
      }

      // verifyAdmin creates new frames via frames.query(), which uses { ...frame } spread
      // Symbols are NOT enumerable, so they don't get copied by spread operator!
      // We must manually copy symbols into the new frames after verifyAdmin returns
      console.log("[UpdateEventConfigRequest] Calling verifyAdmin...");
      const adminFrames = await verifyAdmin(frames, caller);
      console.log("[UpdateEventConfigRequest] Admin frames count after verifyAdmin:", adminFrames.length);

      if (adminFrames.length === 0) {
        console.error("[UpdateEventConfigRequest] verifyAdmin returned empty frames - admin check failed!");
        return adminFrames; // Return empty - sync won't fire
      }

      // CRITICAL: frames.query() creates new frames with { ...frame } which doesn't copy symbols
      // Symbols are NOT enumerable, so spread operator doesn't copy them
      // We must explicitly copy our symbols into each returned frame
      const originalFrame = frames[0]; // Get the original frame with our symbols

      // Debug: Check if symbols exist in original frame
      console.log("[UpdateEventConfigRequest] Original frame has requiredReadsPerAppSym:", requiredReadsPerAppSym in originalFrame);
      console.log("[UpdateEventConfigRequest] Original frame has rubricSym:", rubricSym in originalFrame);
      console.log("[UpdateEventConfigRequest] Original frame rubricSym value:", (originalFrame as any)?.[rubricSym]);

      // Ensure symbols are present in admin frames (they won't be due to spread operator)
      for (const frame of adminFrames) {
        // Copy symbols from original frame - explicitly set even if undefined
        // This ensures matchThen can find them (it will get undefined, which is OK)
        const requiredReadsPerAppValue = (originalFrame as any)?.[requiredReadsPerAppSym];
        const rubricValue = (originalFrame as any)?.[rubricSym];
        const eligibilityCriteriaValue = (originalFrame as any)?.[eligibilityCriteriaSym];
        const questionsValue = (originalFrame as any)?.[questionsSym];
        const endDateValue = (originalFrame as any)?.[endDateSym];

        console.log("[UpdateEventConfigRequest] Copying symbols to admin frame:");
        console.log("  - requiredReadsPerAppSym:", requiredReadsPerAppValue);
        console.log("  - rubricSym:", !!rubricValue, rubricValue ? "has value" : "undefined");

        // Explicitly set symbols (even if undefined) - ensures they exist in frame
        (frame as any)[requiredReadsPerAppSym] = requiredReadsPerAppValue;
        (frame as any)[rubricSym] = rubricValue;
        (frame as any)[eligibilityCriteriaSym] = eligibilityCriteriaValue;
        (frame as any)[questionsSym] = questionsValue;
        (frame as any)[endDateSym] = endDateValue;

        // Verify symbols were set using multiple methods
        const hasRequiredReadsPerApp = requiredReadsPerAppSym in frame;
        const hasRubric = rubricSym in frame;
        const actualRequiredReadsPerApp = (frame as any)?.[requiredReadsPerAppSym];
        const actualRubric = (frame as any)?.[rubricSym];
        const frameSymbols = Object.getOwnPropertySymbols(frame);

        console.log("[UpdateEventConfigRequest] Admin frame verification:");
        console.log("  - requiredReadsPerAppSym in frame:", hasRequiredReadsPerApp);
        console.log("  - rubricSym in frame:", hasRubric);
        console.log("  - requiredReadsPerAppSym value:", actualRequiredReadsPerApp);
        console.log("  - rubricSym value:", actualRubric !== undefined ? "defined" : "undefined");
        console.log("  - Frame has", frameSymbols.length, "symbols");
        console.log("  - Looking for requiredReadsPerAppSym in frame symbols:", frameSymbols.includes(requiredReadsPerAppSym));
        console.log("  - Looking for rubricSym in frame symbols:", frameSymbols.includes(rubricSym));

        // Double-check: explicitly ensure symbols exist by accessing them
        if (!(requiredReadsPerAppSym in frame)) {
          console.error("[UpdateEventConfigRequest] WARNING: requiredReadsPerAppSym not in frame after setting!");
        }
        if (!(rubricSym in frame)) {
          console.error("[UpdateEventConfigRequest] WARNING: rubricSym not in frame after setting!");
        }
      }

      console.log("[UpdateEventConfigRequest] WHERE clause complete, returning", adminFrames.length, "frames");
      return adminFrames;
    },
    then: actions([EventDirectory.updateEventConfig, {
      caller,
      event,
      // Optional params: null if not provided, actual value if provided
      // Concept action ignores null values (checks !== undefined && !== null)
      requiredReadsPerApp: requiredReadsPerAppSym,
      rubric: rubricSym,
      eligibilityCriteria: eligibilityCriteriaSym,
      questions: questionsSym,
      endDate: endDateSym
    }]),
  };
};

export const UpdateEventConfigResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/updateEventConfig" }, { request }],
    [EventDirectory.updateEventConfig, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const UpdateEventConfigResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/updateEventConfig" }, { request }],
    [EventDirectory.updateEventConfig, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== addReader ==========
export const AddReaderRequest: Sync = ({ request, caller, event, user }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/addReader", caller, event, user },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.addReader, { caller, event, user }]),
});

export const AddReaderResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/addReader" }, { request }],
    [EventDirectory.addReader, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const AddReaderResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/addReader" }, { request }],
    [EventDirectory.addReader, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== removeReader ==========
export const RemoveReaderRequest: Sync = ({ request, caller, event, user }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/removeReader", caller, event, user },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.removeReader, { caller, event, user }]),
});

export const RemoveReaderResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/removeReader" }, { request }],
    [EventDirectory.removeReader, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const RemoveReaderResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/removeReader" }, { request }],
    [EventDirectory.removeReader, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== addAdmin ==========
export const AddAdminRequest: Sync = ({ request, caller, user }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/addAdmin", caller, user },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.addAdmin, { caller, user }]),
});

export const AddAdminResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/addAdmin" }, { request }],
    [EventDirectory.addAdmin, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const AddAdminResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/addAdmin" }, { request }],
    [EventDirectory.addAdmin, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== removeAdmin ==========
export const RemoveAdminRequest: Sync = ({ request, caller, user }) => ({
  when: actions([
    Requesting.request,
    { path: "/EventDirectory/removeAdmin", caller, user },
    { request },
  ]),
  where: async (frames) => {
    return await verifyAdmin(frames, caller);
  },
  then: actions([EventDirectory.removeAdmin, { caller, user }]),
});

export const RemoveAdminResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/removeAdmin" }, { request }],
    [EventDirectory.removeAdmin, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const RemoveAdminResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/EventDirectory/removeAdmin" }, { request }],
    [EventDirectory.removeAdmin, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// NOTE: getAllEvents is included (passthrough) and concept verifies admin status internally
// No sync needed for included routes
