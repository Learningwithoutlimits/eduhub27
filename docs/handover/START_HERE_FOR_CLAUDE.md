# Learning Without Limits Learning Hub — Claude development handover

You are continuing development of an existing Netlify-hosted website for Learning Without Limits Academy Trust (LwLAT). **Use `website-source/` as the source of truth for code**, rather than rebuilding from the description. This is a handover snapshot from the latest packaged v4.9 build, not a verified production export. Do not claim the site is fully functional until tested.

## Product vision
The Learning Hub is a Trust-branded platform for two DISTINCT experiences: **Professional Learning**, which is available to school and education professionals including external delegates; and **EduHub 2027**, an annual LwLAT staff-only conference at Babington Academy on Tuesday 5 January 2027. EduHub booking is currently presented publicly as **Bookings Open Soon**. The Trust tagline is 'Winning hearts and inspiring minds to learn without limits.' Brand: teal `#009189`, Open Sans, LwLAT logo in assets.

## Current stack
Static HTML/CSS/vanilla JS; Netlify Functions (`netlify/functions/*.mjs`); Netlify Blobs (`lwlat-events-data`) for `courses`, `eduhub`, `bookings`; Netlify site deployment. No Decap CMS or Git Gateway needed. Admin uses password and signed session cookie, configured with `ADMIN_PASSWORD` and `SESSION_SECRET` Netlify environment variables. Never put real values in code or share them. See `netlify.toml`, `package.json`, and `README-FIRST.txt`.

## Current pages
- `/` public Learning Hub homepage, Professional Learning list, EduHub coming-soon section.
- `/admin/` password-protected admin, opportunity management, EduHub settings, bookings and CSV export.
- `/preview.html?type=course&id=...` admin-only preview for Professional Learning.
- `/preview.html?type=eduhub` admin-only EduHub preview.
- `/eduhub-preview.html` staff-facing **non-submitting** visual preview of the eventual EduHub booking experience. This is a publicly reachable URL in the current package; do not mistake it for protected admin preview.
- `/documents/EduHub-2027-Allergen-Matrix.pdf` supplied allergen matrix PDF. The link appears below food choice in the EduHub staff-facing preview.

## Requirements agreed with the user
1. Professional Learning opportunities are created by administrators; do not populate arbitrary preset courses. Title-led text-only cards (no images), chronological by nearest training date, live search for title/description/audience/facilitator/venue. Multi-date training is supported with individual session dates/times. Not all courses have food; per-course catering/dietary setting. Bookings, capacity, waiting list and export.
2. EduHub remains separate, staff only; `@lwlat.org.uk` email check; admin-defined food choices; optional dietary and accessibility needs; allergen PDF linked immediately below food choice. Public homepage should say **Bookings Open Soon**, with informational popup. The staff-facing preview should show the future booking form but MUST NOT submit bookings.
3. Admin should be able to preview what colleagues will see even while public registration is closed. Future desired features: proper publishing status, robust editing and course management, confirmation emails, admin notifications, QR check-in, badges, calendar invites, CPD records, attendance and certificates; these are future roadmap, not promises of current implementation.
4. Deployable to Netlify, responsive, easy to manage without editing code, Trust look and feel.

## Critical technical review before new development
- **Do not assume EduHub food selection is wired end-to-end.** In v4.9, the editable admin food choices and staff-facing preview exist, but the live booking UI is still closed and `prepareEduhubBookingFields()` in `assets/public.js` is not invoked in the live booking flow. Verify wiring, validation and data persistence before opening bookings.
- **Booking status:** `defaults.eduhub.bookingOpen` in `_utils.mjs` is `true`, while the public interface says 'Bookings Open Soon'. The `book.mjs` function permits EduHub bookings if `bookingOpen` is true. Fix server-side closure before exposing a booking endpoint, not just by hiding buttons. Do not change live settings without user approval.
- **Preview privacy:** `/eduhub-preview.html` uses public-data API, so it can be visited by anyone who has its URL. If preview is intended private, protect it appropriately. Do not expose attendee records or admin-only data.
- **Admin preview:** `/preview.html` relies on `/api/admin-data` and session authentication. Confirm admin preview links are present and functional.
- **Netlify Blobs:** code files do NOT include actual live `courses`, `bookings`, or `eduhub` settings. Export those separately from the live Netlify Blobs store before migration. Never replace live data with demo records.
- **Food safety:** the supplied PDF is a user-provided allergen matrix; verify the food options actually offered match the matrix, and ensure dietary/allergen information is accurate with the caterer before opening bookings.
- **Quality/security:** audit authentication, validation, spam/rate limits, concurrency and booking capacity, and whether exports include food choice. The latest package was iteratively edited and has not been end-to-end production tested here.

## Recommended next steps
1. Unzip, install dependencies (`npm install`), and run locally with Netlify CLI (`netlify dev`) after configuring safe development env vars.
2. Review all pages, functions, form fields, and preview links; fix regressions and inconsistent data fields.
3. Make a secure, explicit admin-controlled EduHub booking status (coming soon/open/closed) enforced both frontend and backend; make the finished booking form work when opened.
4. Wire EduHub food choices and allergen matrix into the **actual** booking flow, validate and persist food choice, include it in admin table and CSV export.
5. Back up Netlify Blobs data before deploying changes and test with representative multi-session and no-food Professional Learning opportunities.
6. Produce a new tested deployable ZIP and concise deployment instructions.

## Where things live
- Source code: `website-source/`
- Latest previous build ZIP: `LwLAT_Learning_Hub_v4.9_EduHub_Allergen_Matrix.zip`
- Additional requirements and known caveats: `PROJECT_HISTORY_AND_REQUIREMENTS.md`

**Ask the user for their live Netlify URL and whether to connect to/export live Netlify Blobs data before attempting a production migration.** Do not ask them to paste passwords or secrets into chat.
