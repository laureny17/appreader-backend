/**
 * Syncs for ApplicationAssignments user actions
 * These syncs verify that the HTTP caller matches the user parameter in the action
 */

import { ApplicationAssignments, Requesting } from "@concepts";
import { actions, Sync, Frames } from "@engine";

/**
 * Helper: Verify that caller matches the user parameter
 * This ensures the HTTP caller is the same as the user performing the action
 */
const verifyCaller = async (frames: any, caller: symbol, user: symbol) => {
  try {
    const callerValue = frames[0]?.[caller as symbol];
    const userValue = frames[0]?.[user as symbol];

    // Filter frames where caller matches user
    const filtered = frames.filter(($) => {
      const callerVal = $[caller as symbol];
      const userVal = $[user as symbol];
      return callerVal === userVal;
    });

    return filtered;
  } catch (error) {
    console.error("[verifyCaller] Error verifying caller:", error);
    return new Frames();
  }
};

// ========== submitAndIncrement ==========
export const SubmitAndIncrementRequest: Sync = ({ request, caller, user, assignment, endTime, activeTime }) => ({
  when: actions([
    Requesting.request,
    { path: "/ApplicationAssignments/submitAndIncrement", caller, user, assignment, endTime, activeTime },
    { request },
  ]),
  where: async (frames) => {
    return await verifyCaller(frames, caller, user);
  },
  then: actions([ApplicationAssignments.submitAndIncrement, { user, assignment, endTime, activeTime }]),
});

export const SubmitAndIncrementResponseSuccess: Sync = ({ request, application }) => ({
  when: actions(
    [Requesting.request, { path: "/ApplicationAssignments/submitAndIncrement" }, { request }],
    [ApplicationAssignments.submitAndIncrement, {}, { application }],
  ),
  then: actions([Requesting.respond, { request, application }]),
});

export const SubmitAndIncrementResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/ApplicationAssignments/submitAndIncrement" }, { request }],
    [ApplicationAssignments.submitAndIncrement, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== flagAndSkip ==========
export const FlagAndSkipRequest: Sync = ({ request, caller, user, assignment, reason }) => ({
  when: actions([
    Requesting.request,
    { path: "/ApplicationAssignments/flagAndSkip", caller, user, assignment, reason },
    { request },
  ]),
  where: async (frames) => {
    return await verifyCaller(frames, caller, user);
  },
  then: actions([ApplicationAssignments.flagAndSkip, { user, assignment, reason }]),
});

export const FlagAndSkipResponseSuccess: Sync = ({ request }) => ({
  when: actions(
    [Requesting.request, { path: "/ApplicationAssignments/flagAndSkip" }, { request }],
    [ApplicationAssignments.flagAndSkip, {}, {}],
  ),
  then: actions([Requesting.respond, { request }]),
});

export const FlagAndSkipResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/ApplicationAssignments/flagAndSkip" }, { request }],
    [ApplicationAssignments.flagAndSkip, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});
