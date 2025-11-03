# AppReader: Final Design Document

## Overview

AppReader is a tool to make reading applications for large events less painful or dull and more fair. It is now a full system that supports admins, readers, and multiple events, complete with authentication, analytics, and backend security features.

## Concepts

When I first designed AppReader, the early version had a few concepts—EventDirectory, ApplicationAssignments, ReviewRecords—and some basic syncs to update stats and handle skips.

At that point, authentication was still mixed into EventDirectory, and the frontend handled a lot of logic that really didn’t belong there. Readers were assigned applications in a straightforward way, but there were no checks or protections on who could call which actions. The focus was mostly on creating a smooth reading experience and adding “motivating” elements like scatter plots, leaderboards, and comments. The concepts were not divided up very well; I tried to hard to fit everything into 3 concepts.

---

## AI Integration

The next big milestone was adding AI. I augmented the ApplicationAssignments concept to include an AI commenting system powered by an LLM (Gemini). The idea was that when an admin added applications, the system would automatically generate comments for each one—short snippets labeled “Strong,” “Weak,” or “Attention,” with a quick justification.

This meant completely rethinking how applications were stored and generated. Each application now included an extra field for `AIComments`, and the prompt logic became part of the backend. I spent a lot of time iterating on the LLM prompts to get consistent JSON output, since the model kept adding stray text or Markdown fences.

By the third version, I finally had a clean prompt that returned valid JSON arrays, stayed under character limits, and properly used eligibility criteria when deciding which answers deserved “Attention.” The validator I added checked category values, justification lengths, and duplicate snippets to make sure the AI didn’t produce nonsense data.

## Implementation and Changes

After the AI features, I needed to clean up how everything fit together. Since I was dissatisfied with how I organized things, Assignment 4a and 4b focused on refactoring the architecture and getting the separation of concerns right.

AuthAccounts became its own concept instead of being buried inside EventDirectory. I also decided that it would be a good idea to switch from username-based login to email-based authentication. That came with proper password hashing using bcrypt, which fixed the big security hole of plain-text passwords. EventDirectory also got proper admin management—admins are stored separately now instead of being hardcoded.

I added explicit generics (`[User, Event, Application]`) to all concepts to fix some of the typing issues from before that were also addressed through feedback on Canvas. ApplicationStorage was split from ApplicationAssignments—now one handled the content itself (including AI comments), and the other handled who gets what and how often. This made a lot more sense to me, and it made implementation a lot easier to think about.

I also built a bulk import feature for admins so they could upload applications using CSVs instead of manually adding them one by one, a
s this was my original intention, but I forgot about it along the way.

The assignment system got a full rewrite during the implementation process, too. In the earlier stages, flags and skips were handled together, which made it easy to accidentally inflate skip counts and led to a lot of bus. I separated those into their own collections—`SkipRecords` and `ApplicationFlags`. Now, skips track only actual skips, and flags are recorded independently as part of the review system.

The ReviewRecords concept became more detailed as well. Reviews now store timestamps, scores for multiple rubric criteria, comments, and flags, all linked to the right application and user. I also made the decision to remove timing of application reading, as I felt it was too complicated and unreliable to time people's reading times, as people easily get distracted or keep tabs open while working on other things.

Additionally, I extended ApplicationStorage with fields like `flaggedAt`, `flagReason`, `disqualified`, and `undisqualifiedAt` so that admins could disqualify and later reverse disqualifications. This was because I implemented the flagging features, but realized afterwards that nothing actually happens to events that get flagged.

## Final Version: Synchronizations and Security

The last stage was about reliability and security. I added backend synchronizations to enforce authentication and permissions. Every important action—like creating events, submitting reviews, or flagging applications—now goes through a sync that checks the `caller` value before doing anything. This fixes one of the biggest problems from the earlier versions, where a malicious user could use the frontend to technically call any endpoint, as discussed during lecture.

There are three main categories of syncs:
1. Admin-level EventDirectory actions (like `createEvent`, `updateEventConfig`, `addReader`, `addAdmin`)
2. User-level ReviewRecords actions (like `submitReview`, `setScore`, `deleteReview`)
3. User-level ApplicationAssignments actions (like `submitAndIncrement` and `flagAndSkip`)

Each sync pattern is consistent: check that the caller matches who’s allowed to perform the action, then run the actual concept logic. The frontend was updated to automatically include `caller` on restricted requests.


## Design

I went with a warm, simple aesthetic: off-white/beige backgrounds, blue, orange/red-orangle, and green accents, and clean geometric fonts (Kufam for headings, Nunito for body text). Buttons and layouts are consistent across the app, and everything is responsive upon hover.

Admins can switch between “Admin View” and “Reader View,” and the interface updates automatically. The home page shows a scatter plot of reader stats (using Chart.js) and a leaderboard that motivates people to keep reading. The reading page has a progress bar and rubric tooltips, and AI comments show up as hoverable highlights.

For admin tools, I added panels for verifying readers, adding or removing admins, viewing flagged applications, disqualifying or undisqualifying apps, and importing CSVs. Lists are trimmed to 10 items with “Showing X of Y” counters and built-in search bars.

## Conclusion

Overall, the final version of AppReader is more secure, modular, fun to use, and doesn't do anything without purpose (e.g. we no longer have flagging features without a way to see and act upon flagged applications from the admin's end). The system also now cleanly separates admin and reader roles, enforces permissions through the backend, and keeps data consistent across concepts.
