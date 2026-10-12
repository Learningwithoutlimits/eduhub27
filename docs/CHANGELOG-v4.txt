VERSION 4.9 — EDUHUB ALLERGEN MATRIX

NEW
- The supplied EduHub Conference Allergen Matrix PDF is included in the deployed site.
- A 'View the EduHub 2027 Food Allergen Matrix (PDF)' link appears directly beneath the food choice field on the staff-facing EduHub preview.
- The admin EduHub preview also links to the matrix.
- The matrix opens in a new tab so staff do not lose their booking form.

VERSION 4.8 — FINISHED EDUHUB STAFF BOOKING SITE PREVIEW

NEW
- A dedicated /eduhub-preview.html page shows the finished staff-facing EduHub booking experience.
- It looks like the eventual live booking site rather than an admin preview panel.
- It loads the current EduHub date, time, venue, food choices and dietary settings.
- Sample staff details are shown so the form can be reviewed visually.
- The preview cannot submit a booking.
- Admin now has a button labelled Preview finished staff booking site.
- The real public Learning Hub still shows EduHub as Bookings Open Soon.

VERSION 4.7 — FULL EDUHUB BOOKING PREVIEW

CHANGE
- EduHub preview now shows the full booking form even while live bookings are set to Bookings Open Soon.
- Food choices and dietary questions appear in the preview exactly as configured in admin.
- Preview form fields use sample data and cannot submit.
- The live public site remains closed to EduHub bookings.

VERSION 4.6 — ADMIN PUBLIC PREVIEW

NEW
- Every Professional Learning opportunity now has a Preview button in the admin dashboard.
- EduHub 2027 has its own Preview public view button.
- Draft Professional Learning opportunities can be previewed before they are published.
- Preview pages are only available while signed into the admin session.
- A yellow Admin Preview banner makes it clear that the preview is not the live public page.

VERSION 4.5 — EDUHUB FOOD CHOICES

Admin can now add/edit EduHub food choices and choose whether dietary requirements are requested. Food choices are stored with bookings and included in CSV exports. EduHub remains Bookings Open Soon.

VERSION 4.4 — PROFESSIONAL LEARNING LISTING FIX

FIXED
- Professional Learning opportunity images have been removed from the public cards.
- The image URL field has been removed from the admin form.
- Opportunities are automatically sorted by their nearest session date.
- A live search box has been added to the Professional Learning page.
- Clicking EduHub “Bookings Open Soon” now opens a clear pop-up message.

VERSION 4.3 — EDUHUB BOOKING STATUS

CHANGE
- EduHub now displays “Bookings Open Soon”.
- The button is disabled and does not open the registration form.
- Professional Learning bookings remain available as before.

VERSION 4.2 — MULTI-SESSION & CATERING UPDATE

NEW
- A Professional Learning opportunity can contain one or several dated sessions.
- Each session has its own label, date and time.
- The public course card displays the full programme schedule.
- Catering can be set to none, refreshments, lunch or other.
- Dietary requirements are only shown on the booking form when the administrator chooses to ask for them.
- Existing single-date opportunities remain compatible and appear as Session 1.

VERSION 4.1 SAVE FIX

This release fixes Professional Learning opportunities appearing not to save by using strongly consistent Netlify Blobs reads and disabling stale API caching.

LEARNING WITHOUT LIMITS LEARNING HUB — VERSION 4.0

WHAT THE LEARNING HUB DOES
- Separate EduHub 2027 and Professional Learning areas.
- EduHub registration only accepts @lwlat.org.uk addresses.
- Working password-protected administration dashboard at /admin/
- Add, edit, duplicate, publish, archive and delete professional learning opportunities.
- Edit EduHub details separately.
- Store courses and bookings in Netlify Blobs.
- Capacity tracking and automatic waiting-list status.
- View all bookings in the dashboard.
- Export bookings as a CSV file for Excel.
- No Decap CMS, Git Gateway or day-to-day GitHub editing.

DEPLOYMENT
1. Replace the files in the connected repository with the CONTENTS of this ZIP.
2. Commit to the branch Netlify deploys.
3. In Netlify, open Project configuration > Environment variables.
4. Add:
   ADMIN_PASSWORD = the password you want to use
   SESSION_SECRET = a long random value of at least 32 characters
5. In Deploys, choose Trigger deploy > Clear cache and deploy site.
6. Wait until the deployment is Published.
7. Learning Hub: https://YOUR-SITE.netlify.app/
8. Learning Hub admin: https://YOUR-SITE.netlify.app/admin/

IMPORTANT
- The first admin login will work only after both environment variables are set and the site is redeployed.
- Courses and bookings are persisted in a Netlify Blobs store named lwlat-events-data.
- No professional learning courses are preloaded. Add only the courses you choose.
- Email sending is not enabled in this release. Booking records are stored and exportable; email notifications can be added once the chosen sending account/provider is confirmed.

BRANDING UPDATE
- The platform is now named Learning Without Limits Learning Hub.
- Suggested permanent address: learninghub.lwlat.org.uk
