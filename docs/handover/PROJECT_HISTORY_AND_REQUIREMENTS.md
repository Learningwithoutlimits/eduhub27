# Project background and development history

## Brand and organisation
Learning Without Limits Academy Trust (LwLAT), Leicester. Trust values Ambition, Integrity, Inclusivity and Accountability. Prefer warm, inclusive language; say 'learners' rather than 'students'. Open Sans and Trust teal `#009189`. Other brand colours include red `#CD163F`, purple `#6F2789`, yellow `#FDB913`, green `#74A333`, grey `#636466`.

## Architectural history
Earlier site versions used Decap CMS / Netlify Identity / Git Gateway and encountered persistent Identity settings errors. The project pivoted to Netlify Functions and Netlify Blobs, with admin password sessions. The latest packaged release is v4.9. Version labels are conversational iterations, not verified semver release guarantees.

## Feature history
- v3: foundational public site, admin and Netlify Blobs bookings.
- v4.1: strong-consistency Blob reads to address apparent non-saving courses.
- v4.2: multi-session Professional Learning and optional catering/dietary question.
- v4.3: EduHub 'Bookings Open Soon' public label.
- v4.4: remove Professional Learning images, sort by date, live search, EduHub popup.
- v4.5: admin-editable EduHub food choices and dietary checkbox; intended booking/export integration.
- v4.6: admin preview pages.
- v4.7: fuller EduHub admin preview form.
- v4.8: standalone staff-facing preview `/eduhub-preview.html`.
- v4.9: allergen PDF bundled and linked below food selection on staff-facing preview.

## Professional Learning
Admin adds and edits opportunities with title, description, audience, facilitator, venue, dates, sessions, capacity, cost, booking deadline, status, booking availability, catering. No default list. Public cards should lead with title and display closest upcoming dates first. Live search is expected. Multi-date courses are one booking spanning all sessions. Food may be omitted entirely. Course images were explicitly removed.

## EduHub 2027
Annual LwLAT staff-only conference, Tuesday 5 January 2027 at Babington Academy, 'Better Together'. Public booking is not yet open, but administrators want to preview the complete member-of-staff registration experience. Admin manages title, date/time, venue, capacity, food choices and dietary question. The supplied `documents/EduHub-2027-Allergen-Matrix.pdf` should be accessible directly beneath food choice. Registration fields discussed include name, Trust email, school/organisation, job title, telephone, food choice, dietary needs, accessibility needs, additional notes. Public preview must not create bookings.

## User preferences
User wants deployable Netlify ZIPs, practical admin interface and concise step-by-step deployment guidance. They have repeatedly asked to see the actual finished public experience before opening registration. Avoid responding with only conceptual plans when they request a build.

## Roadmap (not necessarily implemented)
Featured opportunities, more filters, draft publishing, rich-text editor, automatic email confirmations/reminders, admin notifications, calendar invites, QR tickets/check-in, attendance, badges, certificates, CPD records, permissions and analytics.

## Data and deployment
Netlify Blobs is remote data and not contained in this bundle. Admin environment variables: `ADMIN_PASSWORD`, `SESSION_SECRET`. Never ship values. Confirm site/repo/deploy linkage and back up remote data. The user previously referenced `lwlat-events-training.netlify.app`, but confirm the current live deployment.
