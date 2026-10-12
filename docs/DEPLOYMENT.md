# Deploying version 5.1

Version 5 changed the folder layout. The website files now live in a `public` folder, so Netlify no longer publishes the server code or these guides. The included `netlify.toml` tells Netlify about the change, so you do not need to alter any build settings.

## Before you start

1. **Back up the live data.** Sign in to the current admin, open Bookings and press **Export CSV**. Keep the file somewhere safe. This is your copy of every booking made so far.
2. Make a note of the EduHub settings and food choices currently shown in admin.

Version 5 reads your existing courses, bookings and EduHub settings as they are. Nothing is deleted or rewritten when you deploy. EduHub settings are only rewritten when an administrator next presses Save.

## Deploying

1. Open the GitHub repository that Netlify deploys from.
2. Delete the old files (`index.html`, `admin`, `assets`, `documents`, `_redirects` and the rest), but keep the hidden `.git` folder if you are working on your own computer.
3. Copy in the **contents** of the version 5 ZIP, so that `netlify.toml` and `package.json` sit at the top level.
4. Commit the change to the branch Netlify deploys.
5. In Netlify, open **Project configuration > Environment variables** and check that both of these exist:
   - `ADMIN_PASSWORD`, the admin password
   - `SESSION_SECRET`, a random value of **at least 32 characters**. Version 5 refuses to sign anyone in if it is shorter, because a short or missing secret would let someone fake an admin session.
6. In **Deploys**, choose **Trigger deploy > Clear cache and deploy site**, and wait until it says Published.

If you forget step 2, the site still works. Netlify only publishes the `public` folder, so leftover files are ignored.

## Checks after deploying

1. Visit the homepage. EduHub should still say **Bookings Open Soon**.
2. Visit `/eduhub/`. It should show the event details and say bookings open soon, with no form.
3. Sign in at `/admin/`. Your existing courses and bookings should all be there.
4. Open **EduHub 2027** in admin. The status will show **Coming soon**, even if version 4.9 had it set to "Open" behind the scenes (see the changelog).
5. Press **Preview the staff booking page** to see the finished form.

## Opening EduHub bookings

Work through `docs/BEFORE-OPENING-EDUHUB.md` first. Then, in admin, choose **Open** under Booking status and press **Save EduHub settings**.
