# Learning Without Limits Learning Hub

The Trust's site for Professional Learning bookings and the EduHub 2027 staff conference.

- Public site: `public/` (plain HTML, CSS and JavaScript)
- Server code: `netlify/functions/` (Netlify Functions, data kept in Netlify Blobs)
- Guides: `docs/GO-LIVE-GUIDE.md` (start here), `docs/DEPLOYMENT.md`, `docs/BEFORE-OPENING-EDUHUB.md`, `docs/CHANGELOG.md`
- Tests: `tests/` (run locally, never deployed)

## Pages

| Address | What it is |
| --- | --- |
| `/` | Learning Hub homepage, Professional Learning list and EduHub card |
| `/eduhub/` | EduHub 2027 page. Shows the booking form only when an administrator sets bookings to Open |
| `/eduhub/?preview=1` | The finished EduHub booking form for checking. It never sends anything |
| `/admin/` | Password-protected administration, including EduHub sessions and schools |
| `/preview.html?type=course&id=…` | Admin-only preview of a Professional Learning opportunity |

## Running it on your own computer

You need Node.js 20 or later.

```
npm install
npm run dev        # http://localhost:8888, admin password: local-admin-password
npm test           # server tests and full browser tests
```

The local server keeps its data in memory and never connects to the live site.
