# Learning Hub version 5.2: go-live guide

Live site: https://eduhub27.netlify.app
Netlify project: https://app.netlify.com/projects/eduhub27/overview

Allow about an hour for Parts 1 to 5. Parts 6 and 7 can be done later.

## Part 1. Back up what is there now (5 minutes)

1. Go to https://eduhub27.netlify.app/admin/ and sign in.
2. Click **Bookings**, then **Export CSV**. Save the file somewhere safe, such as a Teams or SharePoint folder.
3. Click **Events** (or **EduHub**) and take a screenshot of the settings and food choices.

Your courses, bookings and settings are stored in Netlify itself, not in the code. Changing the code does not delete them. The backup is a precaution.

## Part 2. Put the new code on GitHub (15 minutes)

1. Unzip `LwLAT_Learning_Hub_v5.1_EduHub_Sessions.zip` on your computer. You will get a folder containing `docs`, `netlify`, `public`, `tests`, `netlify.toml`, `package.json`, `package-lock.json` and `README.md`.
2. Go to https://github.com/Learningwithoutlimits/eduhub27 and sign in.
3. The repository is empty, so you will see a "Quick setup" page. Click the link **uploading an existing file**.
4. Open the unzipped folder, select **everything inside it** (not the folder itself), and drag it onto the GitHub page. Use Chrome or Edge, which upload folders correctly.
5. Wait until every file is listed. Check that `netlify.toml` appears at the top level, not inside another folder.
6. Under **Commit changes**, type `Learning Hub version 5.1` and click **Commit changes**.

## Part 3. Connect Netlify to GitHub (10 minutes)

This tells Netlify to build the site from the GitHub repository. From then on, any change committed on GitHub goes live by itself.

1. Open https://app.netlify.com/projects/eduhub27/overview.
2. Go to **Project configuration**, then **Build & deploy**, then **Continuous deployment**.
3. Under **Repository**:
   - if it says no repository is linked, click **Link repository**.
   - if it shows another repository, click **Manage repository**, then **Link to a different repository**.
4. Choose **GitHub**. If asked, allow Netlify to access the **Learningwithoutlimits** organisation.
5. Pick **Learningwithoutlimits/eduhub27** and branch **main**.
6. For the build settings, use:
   - Base directory: leave empty
   - Build command: leave empty
   - Publish directory: `public`
   - Functions directory: `netlify/functions`
7. Save. Netlify will start a deploy. You can let it run, but finish Part 4 before testing.

Linking a repository does not affect your stored bookings. They belong to the Netlify project, not the repository.

## Part 4. Check the two secret settings (5 minutes)

1. In Netlify, go to **Project configuration**, then **Environment variables**.
2. Check there is a variable called `ADMIN_PASSWORD`. This is the admin password.
3. Check there is a variable called `SESSION_SECRET` and that its value is **at least 32 characters** long. If it is shorter or missing, edit it and paste in a long random string. A password manager's "generate password" feature, set to 40 characters, works well. Nobody needs to remember it.
4. Go to **Deploys**, click **Trigger deploy**, then **Clear cache and deploy site**.
5. Wait until the top deploy says **Published** (usually one or two minutes).

Never send either value by email or paste it into a chat.

## Part 5. Check the site works (10 minutes)

1. **https://eduhub27.netlify.app**: the EduHub card says **Bookings Open Soon**. Clicking it shows a pop-up.
2. **https://eduhub27.netlify.app/eduhub/**: the event page loads and says bookings open soon, with no form.
3. **https://eduhub27.netlify.app/admin/**: you can sign in. The menu shows Overview, Professional Learning, EduHub 2027, EduHub sessions and Bookings.
4. Your existing courses and bookings are all listed.

If any of these fails, see Troubleshooting at the end.

## Part 6. Set up EduHub 2027 (in your own time)

Leave the booking status on **Coming soon** throughout this part. Staff cannot book while it is set.

### Event details and food

1. In admin, click **EduHub 2027**.
2. Fill in the time, capacity, booking deadline and organiser contact email. Add the privacy notice link if the Trust has one online.
3. Under **Food choices and allergens**, click **Fill in from the allergen matrix**. Ten menu items appear.
4. Check each item with the caterer (see `BEFORE-OPENING-EDUHUB.md` for the questions to ask), correct anything that is wrong, and tick **Allergen details checked with the caterer**.
5. Click **Save EduHub settings**.

### Schools and sessions

1. Click **EduHub sessions**.
2. Open **Add several at once**. Paste in all your primary schools, one per line, choose **Primary** and click **Add to list**. Repeat for secondary schools and for central Trust teams.
3. Click **Add session** for each session. Fill in the title, start and finish times, room, speaker name, description and places, and tick who it is aimed at. Click **Choose photo** to add the speaker's photo.
4. Click **Save schools and sessions**.

### Check it

Click **Preview the staff booking page**. A yellow banner shows it is a preview. Try choosing different schools to check that the right sessions appear. Nothing you enter in the preview is sent.

## Part 7. Open bookings

Only do this when the Data Protection Officer has approved the form and the caterer has confirmed the menu. Record both in `BEFORE-OPENING-EDUHUB.md`.

1. In admin, click **EduHub 2027**.
2. Under **Booking status**, choose **Open** and click **Save EduHub settings**.
3. Read the reminder that appears and click **OK**.
4. Send staff the link: **https://eduhub27.netlify.app/eduhub/**

To stop bookings, choose **Closed** and save. Bookings also close by themselves after the booking deadline.

## Running the event

- **Bookings** shows everyone, with filters for event, status and search. Use **Edit**, **Cancel**, **Give place** (for the waiting list) and **Delete** as needed.
- **EduHub 2027 → Catering summary** gives totals for each food choice. **Download caterer's list** gives the caterer a spreadsheet without email addresses.
- **EduHub sessions → Session numbers** shows how full each session is. **Register (CSV)** gives a printable list for each room.
- After the event, export what you need to keep, then delete bookings in line with the retention period agreed with the DPO.

## Speaker lunches

1. In admin, open **EduHub 2027** and scroll to **Speaker lunch bookings**.
2. Tick **Speaker lunch bookings are open** and press **Save EduHub settings**.
3. Press **Copy link** and paste the link into your email to speakers.
4. If the link is ever shared too widely, press **Replace the link**. The old one stops working at once.

## Confirmation emails

Send `EMAIL-SETUP-FOR-IT.md` to your IT team. When they have finished, the admin Overview page says emails are switched on. Send yourself a test email from there.

## On the day: scanning people in

1. Each person at the registration desk signs in at https://eduhub27.netlify.app/admin/ on their phone before doors open. Sign-in lasts 12 hours.
2. Open the phone's normal camera and point it at a ticket's QR code. Tap the link that appears.
3. Green means checked in. Amber means already checked in (the time is shown). Red means the booking was cancelled or the person is only on the waiting list.
4. If someone has no ticket, find them under **Bookings** and press **Check in**.

## Troubleshooting

| Problem | What to do |
| --- | --- |
| Admin says "SESSION_SECRET must be set" | Part 4, step 3, then redeploy |
| Admin says "ADMIN_PASSWORD is not configured" | Add `ADMIN_PASSWORD` in Part 4, then redeploy |
| Admin says "Too many unsuccessful attempts" | Wait 15 minutes and try again |
| The site still looks like the old version | Part 4, step 4 (clear cache and deploy), then refresh the page while holding Shift |
| Deploy fails in Netlify | Open the failed deploy, copy the last 20 lines of the log and send them to Claude |
| Courses or bookings seem to be missing | Check you are on the eduhub27 project. Your CSV backup from Part 1 has every booking |
| Staff see "Please use your @lwlat.org.uk email address" | They must book with their Trust email |
| A booking shows "Email failed" | Hover over it to see why, fix the cause, then press **Resend email** |
| Scanning a code shows the ticket but no green screen | That phone is not signed in to admin. Sign in, then scan again |
