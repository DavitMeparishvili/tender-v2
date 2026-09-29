# Manual Test Guide — Demo Site

This guide is for testing the live demo site using only a web browser. You do not
need any developer tools, console commands, or technical setup — everything here
is done by clicking around the site like a normal visitor would.

**Site address:** https://tender-market.online/

## Before you start

**Test accounts** — use these to log in. All three use the same password.

| Who                       | Email                       | Password           |
| ------------------------- | --------------------------- | ------------------ |
| Client (posts jobs)       | `demo.client@tender.test`   | `UuqTRrtvYj0bIMUO` |
| Provider (bids on jobs)   | `demo.provider@tender.test` | `UuqTRrtvYj0bIMUO` |
| Admin (moderates reviews) | `demo.admin@tender.test`    | `UuqTRrtvYj0bIMUO` |

**Language:** the site opens in Georgian by default. There's a language switch near
the top of the page (labelled "ქართული" / "English") — click it to switch to
English. It's fine to test in either language; just note which one you used if you
report a problem.

**A sample job already exists on the site:** "Demo apartment renovation in
Tbilisi", posted by the Client account, budget 4,500 GEL, located in Tbilisi. You
don't need to create it — it's already there for you to browse, unlock, and bid
on.

## Things you are NOT expected to test

A few parts of this demo don't work the way a finished product would, on purpose.
Please don't report these as bugs:

- **Signing up as a brand-new user cannot be fully completed.** After the sign-up
  form, the site normally sends a confirmation email with a link to click. In this
  demo, that email is not actually delivered anywhere you can see it. So you can
  fill out the sign-up form and see the "check your email" message, but you won't
  be able to finish creating a new account. Stick to the three test accounts above
  for anything that requires being logged in.
- **"What happens after a job's deadline passes" may not happen automatically in
  this demo.** Normally, once a posted job's deadline passes, the site
  automatically picks a winning bid and starts an agreement between the client and
  the winning provider. In this demo environment, that automatic step might not be
  switched on. If you get to that part of the guide and nothing happens on its
  own, that's expected — skip that section rather than treating it as a bug.
- **The admin account can only moderate reviews.** It cannot manage users, tenders,
  or payments — even though it sounds like an "admin" should be able to do more.
  That's the current, intentional scope of this demo.
- **A few buttons you might expect are not implemented yet:** "Report this
  tender", "Save tender", and "Share" on a job's detail page do not do anything
  functional in this demo. If you happen to notice text like this with no working
  button behind it, you don't need to report it — just don't spend time testing it.

## 1. First look at the site

**Steps:**

1. Open https://tender-market.online/ in your browser.
2. Look at the homepage.

**What you should see:** the page loads without errors, in Georgian by default,
showing a general overview of the marketplace (recently posted jobs, some
statistics or highlights). Try switching the language using the toggle near the
top — the page should reload in English, showing the same kind of content.

## 2. Browsing jobs without logging in

**Steps:**

1. Without logging in, find the section of the site where jobs/tenders can be
   browsed (a "Find work" or "Browse tenders" style link/page).
2. Open the "Demo apartment renovation in Tbilisi" job from the list.

**What you should see:** you can see a summary of the job — title, short
description, budget, and a rough/approximate location (shown as a general area,
not an exact address or pin on a map). You should **not** be able to see the full
description, exact address, any special conditions, or any attached files/photos.
There should be a message inviting you to sign in as a provider to see the full
details and bid.

**Also try:** open a provider's public profile page (you may find a link to one
from a review or from the browse list, once reviews exist later in this guide).
It should be viewable without logging in, showing that provider's rating and
reviews.

## 3. Logging in and out

**Steps:**

1. Find the "Log in" link/button (usually top-right of the page).
2. Log in as the Client using the credentials above.
3. Once logged in, find and use the "Log out" option.
4. Log back in, but type the wrong password on purpose.

**What you should see:**

- With correct credentials, you're logged in and taken to your dashboard.
- With the wrong password, you get a generic error message. (It intentionally
  does not tell you whether the email exists or just the password was wrong — that
  is a deliberate security choice, not a bug.)
- After logging out, if you try to revisit a page that requires being logged in,
  you should be sent back to the login page.

**Also try — forgot password:** on the login page, use "Forgot password", enter
the Client's email, and submit. You should see a confirmation message telling you
to check your email. (As noted above, you won't actually receive that email in
this demo, so you can't go further than this step — that's expected.)

**Also try — new sign-up:** click "Register"/"Sign up", choose either "Client" or
"Provider", and fill in the form with a made-up email address. You should be able
to get to a "check your email to verify" screen, but — as noted above — you won't
be able to complete verification or log in with this brand-new account.

## 4. Posting a job (as the Client)

Log in as `demo.client@tender.test` for this section.

**Steps:**

1. From your dashboard, find the option to post a new job.
2. Fill out the form. It's a multi-step form with sections roughly like:
   **Basics** (title, short description) → **Scope** (full description, what
   work is included, your budget, and a deadline date) → **Location** (city,
   address or a pin on a map, plus the option to attach files) → **Review**
   (double-check everything before publishing).
3. On the Basics step, try leaving the title or description empty and attempt to
   continue.
4. On the Location step, try attaching a photo or PDF file.
5. Also try attaching a file type that clearly isn't a photo or PDF (for example a
   plain text file), and try attaching a very large file (well over 15 MB, e.g. an
   uncompressed video file).
6. On the final Review step, check everything looks right, then publish the job.

**What you should see:**

- Leaving required fields empty should stop you from moving to the next step,
  with a clear message about what's missing.
- Attaching a normal-sized PDF or photo (JPEG/PNG/WEBP) should succeed and show up
  in your list of attached files.
- Attaching an unsupported file type should be rejected with a message saying the
  file type isn't allowed.
- Attaching an oversized file should be rejected with a message saying the file is
  too large.
- After publishing, the job should show up in your list of posted jobs with
  "Published" status, and it should now be visible to providers browsing the site
  (Section 2).

**Also try — closing the form partway through:** fill in part of the form, then
try to navigate away using a menu link instead of a "save" or "next" button. You
should get a browser pop-up warning you that you have unsaved changes before it
lets you leave.

**Also try — coming back to an unfinished job:** if you left a job partly filled
in (as a draft, not yet published), you should be able to find it again in your
list of jobs and continue editing it from where you left off.

## 5. Managing your posted jobs (as the Client)

Still logged in as the Client.

**Steps:**

1. Go to your list of posted jobs.
2. Open the sample "Demo apartment renovation in Tbilisi" job (or one you
   published in Section 4).
3. Look for a way to cancel the job, and try it — provide a short reason when
   asked (should require at least a handful of words, not just one character).
4. Separately, after a provider has placed a bid on one of your jobs (see Section
   6 below — come back to this step afterward), revisit that job's page and check
   whether you can still cancel it.

**What you should see:**

- You can see all the bids placed on a job (once any exist) in a comparison-style
  view.
- You can cancel a job that has no bids yet, after entering a reason — the job's
  status should then show as cancelled, and it should disappear from what
  providers can browse.
- Once a job has at least one active (non-withdrawn) bid on it, the option to
  cancel should either disappear or be blocked with an explanation — you should
  not be able to cancel a job that already has a live bid on it.
- A draft (unpublished) job should show an option to edit it or publish it; once
  published, those two options should go away and only "Cancel" should remain.

## 6. Finding and bidding on jobs (as the Provider)

Log out and log back in as `demo.provider@tender.test` for this section.

**Steps:**

1. From your dashboard, browse available jobs and open the "Demo apartment
   renovation in Tbilisi" job (or another one you can see).
2. Notice the "locked" panel describing how to unlock full details — it should
   offer three options: unlocking just this one job for a small one-time fee,
   unlocking a month of full access, or unlocking a full year.
3. Click the option to unlock just this one job.
4. After unlocking, review the now-visible full details: full description, exact
   address, any special conditions, and any attached files/photos.
5. Fill out and submit a bid: an amount, and a required "conditions" note (needs
   to be a real sentence or two, not just a couple of words).
6. After submitting, try changing your bid amount and resubmitting ("revise" your
   offer).
7. Finally, try withdrawing your bid entirely.
8. After withdrawing, try to submit a new bid on the same job again.

**What you should see:**

- Before unlocking, you should not be able to see the exact address, full
  description, conditions, or attached files.
- Clicking the unlock button should complete instantly with no payment form or
  card details asked for anywhere — there should be a clear note somewhere on the
  page saying payments are simulated and nothing is actually charged. After
  clicking, the panel should change to confirm the job is now fully unlocked, and
  all the previously hidden details should now be visible.
- Submitting a bid without the required conditions note (or with only a few
  characters in it) should be blocked with a message asking for more detail.
- A valid bid should submit successfully, and you should see a note explaining
  that the lowest bid wins automatically at the deadline and that no one can
  hand-pick a different winner.
- Revising your bid should succeed and update the amount shown.
- Withdrawing your bid should succeed, and afterward you should not be able to
  place a new bid on that same job again — the bidding option for that job should
  stay closed to you.

## 7. What happens after a job's deadline (Agreements)

As explained above, this part may not happen automatically in this demo — the
step where a winning bid is picked and an "agreement" is created between client
and provider might need to be switched on behind the scenes by the development
team. If nothing changes on its own after a deadline passes, treat that as a
known limitation and skip ahead to Section 9 (Notifications) and Section 8
(Reviews only if an agreement already exists to review).

If an agreement **does** appear (check "My agreements" while logged in as either
the Client or the Provider), here's how it should behave:

**Steps and expected behaviour, in order:**

1. Open the agreement. Both the client and the provider should each have a
   "Confirm agreement" action available. Once **both** sides have confirmed, the
   agreement's status should move forward (from "waiting for confirmation" to
   "agreed").
2. Next, both sides should see an "Acknowledge start" action. Once both have done
   this, the status should move to "in progress".
3. Next, both sides should see a "Confirm completion" action. Once both confirm,
   the status should move to "completed", and a review option should now appear
   (see Section 8).
4. At any point before completion, either side should be able to "Decline" or
   "Cancel" the agreement instead, which requires typing a short explanation.
   Doing so should end the agreement and clearly state that this doesn't
   determine who was at fault and doesn't resolve any payment dispute — it's just
   a record of what happened.

## 8. Leaving a review

This only works once an agreement has reached "completed" status (Section 7).

**Steps:**

1. From the completed agreement's page, find the option to leave a review.
2. Fill in the four rating categories (quality, meeting the deadline,
   communication, and sticking to the agreed price), and write a comment.
3. Try submitting a very short comment (just a couple of words).
4. Submit a proper review with a full comment.
5. Try to leave a second review on the same completed job.

**What you should see:**

- A short comment should be rejected, asking for more detail (roughly a couple of
  sentences' worth).
- A full-length review should submit successfully, and the page should note that
  published reviews are public and can't be edited afterward.
- The review should then be visible on the reviewed person's public profile page.
- Trying to leave a second review for the same job should be blocked with a
  message saying you've already reviewed it.

## 9. Notifications (Inbox)

**Steps:**

1. While logged in as either the Client or Provider account, find the "Inbox" or
   notifications page.
2. If you've done anything in Sections 4–8 that would generate a notification
   (e.g. an unlock, a bid, an agreement update, a review), check whether it
   appears here.
3. Click on an unread notification's "mark as read" option.
4. Click on a notification to open the related page (it should take you to the
   relevant job/agreement or profile).

**What you should see:**

- New activity relevant to you should show up as a notification with a clear
  "unread" label.
- Marking one as read should change its label to "read", and this should still be
  the case if you leave the page and come back.
- Clicking a notification should take you to the right related page.
- If you check this page on an account with no activity yet, it should show a
  simple "no notifications yet" message rather than an error or blank page.

## 10. Moderating reviews (as Admin)

Log in as `demo.admin@tender.test` for this section. This only makes sense once
at least one review exists from Section 8.

**Steps:**

1. Look for a "Moderation" menu item (this should only appear for this admin
   account, not for the Client or Provider accounts).
2. Open it and find the review you submitted earlier.
3. Try redacting it with a very short reason (just a couple of characters).
4. Try redacting it again with a proper reason (a full short sentence).

**What you should see:**

- The short reason should be rejected, asking for more detail.
- A proper reason should succeed, and the review should now show as "redacted"
  instead of its original text.
- The redacted review should no longer show up on the reviewed person's public
  profile page, even though it's not fully deleted behind the scenes.

**Also check:** while still logged in as admin, confirm you can also post a job
as a client would (this account can do both), but that there is no "provider"
section available to it — it should not be able to browse/bid on jobs like the
Provider account can.

## 11. A few things to double-check throughout testing

- **Switching language mid-task:** start filling in a form (like posting a job or
  submitting a bid), then click the language switch. You should get a warning
  pop-up about unsaved changes before it actually switches language and
  navigates.
- **Narrow/mobile view:** try resizing your browser window to a narrow, phone-like
  width (or open the site on a phone). You should see a simplified bottom menu bar
  with a few key shortcuts, including a clearly highlighted "Post a job" option
  for client-type accounts.

## Quick checklist

- [ ] Homepage loads, language switch works
- [ ] Can browse jobs and see a job's masked details while logged out
- [ ] Login works; wrong password shows a generic error; logout works
- [ ] Forgot-password and new sign-up get to the "check your email" step (no
      further, as expected)
- [ ] Posting a job: validation, file attachment (valid/invalid/too-large),
      draft resume, unsaved-changes warning, publish
- [ ] Managing jobs: view bids, cancel with no bids, cancel blocked once bid
      exists
- [ ] Provider: locked vs unlocked details, unlocking (no payment form,
      simulated), bidding, revising a bid, withdrawing a bid, can't re-bid after
      withdrawing
- [ ] Agreement steps, if enabled for your test session (confirm, start,
      complete, decline, cancel)
- [ ] Reviews: short comment rejected, valid review published, can't review
      twice
- [ ] Notifications: unread/read, mark as read, links work, empty state
- [ ] Admin: redact review (short reason rejected, valid reason works), admin
      can post jobs but has no provider section
- [ ] Language switch mid-form warns about unsaved changes
- [ ] Mobile/narrow view shows the simplified bottom menu
