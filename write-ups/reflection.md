# Reflection

## What was hard

Deciding on features and what concepts would allow them to happen was tough. Even with all the thought I put into them, once I started actually building, I realized my earlier design wouldn't work at all. Splitting concepts apart after the fact (like separating ApplicationStorage from ApplicationAssignments, and, to a lesser extent, moving AuthAccounts to be a separate concept outside of EventDirectory) took a lot of time because I had to basically undo some of my own earlier logic.

Keeping frontend state consistent with backend data was another challenge. I had a lot of api endpoints and queries, which was not only hard for me to keep track of, but also hard for Cursor to get right, since there was just so much going on.

## What went well

The AI integration was one of my favorite parts. Once I fixed the formatting and validation, it started to generate thoughtful comments that actually made the reading experience better. It was fun seeing it work the way I originally imagined.

I’m also pretty happy with how the design turned out. It feels clean and pleasant to use without being flashy, and it’s easy to navigate for both readers and admins. I considered adding more fun design elements, but since the purpose of this app is to help people productively complete their application-reading, I figured it shouldn't be too gamified or silly, and things like dark mode may not necessarily be something super helpful or necessary for users at this point.

## Mistakes and lessons

I overcomplicated things too early. I spent time on timing features and analytics before I had a stable foundation, which caused more bugs than progress—I actually ended up deciding to remove timing of reading applcations because it was buggy and overcomplicating things—there was too much to keep track of—and I also realized that logistically, with people switching tabs and leaving tabs open and all, it didn't really make sense to time application-reading if there could be huge outliers or innacurate times. If I did this again, I’d focus on correctness first and add complexity later.

I also didn’t plan my concept boundaries early enough. Figuring out where certain responsibilities belonged came late, and it made implementation messier than it needed to be.

There were also a several times where I added backend features like flagging but forgot to connect them to the larger project. I was so focused on creating the flagging feature itself and implementing it that I completely forgot to plan out what would even be done with flagged applications. I ended up having to create new features—in the admin dashboard, I added a way to view all flagged applications and either remove the flag or disqualify flagged applications, and export disqualified applications as needed. It was a good reminder that backend work only matters if the user can actually see or use it. It's important to think about the full "journey," i.e. how an action cascades and affects other components of the app so that it actually has meaning.

## Skills and growth

I got better at full-stack thinking instead of just writing isolated pieces of code. I started to understand how backend design choices affect frontend logic and vice versa, as well as thinking about how small features impact the overall app.

I think this project also helped deepen my understanding of concepts and how they can be important in system design.

I also learned to treat security and permissions as part of design, not an afterthought.

## Using Context and agentic tools

I used the Context tool mostly in the beginning of the assignment, for basic concept implementation and test cases.

For the rest of the assignment, I relied mostly on Cursor, as I found that Context generally was tough to work with, annoying to add files to, and did not produce satisfactory results. Cursor was a lot faster to work with, and one thing I did that helped a lot was having both the frontend and backend windows at once, and using Cursor with each for inter-communication. For instance, I would get Cursor in the frontend window to generate a detailed debugging prompt for changes to the backend, and then paste it in to the backend window. This back-and-forth was actually quite productive.

I think that using an agentic coding tool was helpful in working on a full-stack project much faster and focusing on design choices, but it was also easy to get frustrated because it wasn't code that I wrote myself and therefore was not something I fully understood. I think that because of how much code Cursor allowed me to produce in a relatively short amount of time, clearly using LLMs is unavoidable in modern software development, but it is quite a shame that it takes a lot of fun out of coding; I felt more like a product manager or something.
