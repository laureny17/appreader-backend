/**
 * Syncs for ReviewRecords user actions
 * These syncs verify that the HTTP caller matches the user parameter in the action
 */

import { ReviewRecords, Requesting } from "@concepts";
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

// ========== submitReview ==========
export const SubmitReviewRequest: Sync = ({ request, caller, author, application, currentTime, activeTime }) => ({
  when: actions([
    Requesting.request,
    { path: "/ReviewRecords/submitReview", caller, author, application, currentTime, activeTime },
    { request },
  ]),
  where: async (frames) => {
    return await verifyCaller(frames, caller, author);
  },
  then: actions([ReviewRecords.submitReview, { author, application, currentTime, activeTime }]),
});

export const SubmitReviewResponseSuccess: Sync = ({ request, review }) => ({
  when: actions(
    [Requesting.request, { path: "/ReviewRecords/submitReview" }, { request }],
    [ReviewRecords.submitReview, {}, { review }],
  ),
  then: actions([Requesting.respond, { request, review }]),
});

export const SubmitReviewResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/ReviewRecords/submitReview" }, { request }],
    [ReviewRecords.submitReview, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== setScore ==========
export const SetScoreRequest: Sync = ({ request, caller, author, review, criterion, value }) => ({
  when: actions([
    Requesting.request,
    { path: "/ReviewRecords/setScore", caller, author, review, criterion, value },
    { request },
  ]),
  where: async (frames) => {
    return await verifyCaller(frames, caller, author);
  },
  then: actions([ReviewRecords.setScore, { author, review, criterion, value }]),
});

export const SetScoreResponseSuccess: Sync = ({ request, application }) => ({
  when: actions(
    [Requesting.request, { path: "/ReviewRecords/setScore" }, { request }],
    [ReviewRecords.setScore, {}, { application }],
  ),
  then: actions([Requesting.respond, { request, application }]),
});

export const SetScoreResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/ReviewRecords/setScore" }, { request }],
    [ReviewRecords.setScore, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});

// ========== deleteReview ==========
export const DeleteReviewRequest: Sync = ({ request, caller, reviewId, user }) => ({
  when: actions([
    Requesting.request,
    { path: "/ReviewRecords/deleteReview", caller, reviewId, user },
    { request },
  ]),
  where: async (frames) => {
    return await verifyCaller(frames, caller, user);
  },
  then: actions([ReviewRecords.deleteReview, { reviewId, user }]),
});

export const DeleteReviewResponseSuccess: Sync = ({ request, success, message }) => ({
  when: actions(
    [Requesting.request, { path: "/ReviewRecords/deleteReview" }, { request }],
    [ReviewRecords.deleteReview, {}, { success, message }],
  ),
  then: actions([Requesting.respond, { request, success, message }]),
});

export const DeleteReviewResponseError: Sync = ({ request, error }) => ({
  when: actions(
    [Requesting.request, { path: "/ReviewRecords/deleteReview" }, { request }],
    [ReviewRecords.deleteReview, {}, { error }],
  ),
  then: actions([Requesting.respond, { request, error }]),
});
