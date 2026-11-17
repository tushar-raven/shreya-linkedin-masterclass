# The LinkedIn Masterclass with Shreya Pattar

A static website (any free host) with a Google Sheet as its database and a private admin panel inside that Sheet.

```
Website (Netlify / Vercel / GitHub Pages)
   │  GET  ?action=config  → countdown, photos, open/closed
   │  POST registration    → saved row, confirmed back to the visitor
   ▼
Google Apps Script web app  ──►  Google Sheet
                                  ├─ Dashboard       live counts
                                  ├─ Registrations   one row per signup
                                  ├─ Settings        what the site reads
                                  └─ Masterclass menu → Open admin panel (editors only)
```

## 1. Create the Sheet and backend (about 5 minutes, once)

1. Create a Google Sheet called **Shreya Masterclass Registrations**. Keep it private.
2. **Extensions → Apps Script.** Replace the contents of `Code.gs` with `backend/Code.gs`.
3. Click **+ → HTML**, name the file `AdminPanel` (exactly), and paste in `backend/AdminPanel.html`. Save.
4. In the function dropdown pick `setup`, click **Run**, and approve the permissions. The Dashboard, Registrations and Settings tabs appear.
5. **Deploy → New deployment → Web app.** Execute as: **Me**. Who has access: **Anyone**. Deploy and copy the URL ending in `/exec`.
6. Paste that URL into `config.js` as `apiUrl`.

Check it works: open `YOUR_EXEC_URL?action=config` in a browser. You should see JSON with `"ok":true`.

## 2. Publish the site

**Netlify Drop (fastest):** go to https://app.netlify.com/drop and drag this whole folder (the one containing `index.html`, not the `backend` folder alone). You get a public URL straight away; add a custom domain under Domain settings.

**Vercel:** New Project → import the folder, framework "Other", no build command, output directory `.`.

**GitHub Pages:** push the folder to a repo, then Settings → Pages → deploy from the main branch, root.

The `backend/` folder is harmless to publish but does not need to be.

## 3. Run the site from the admin panel

Open the Sheet → **Masterclass → Open admin panel**. Only people with edit access to the Sheet can open it.

- **Countdown:** pick date, time and timezone, tick "Date is final" once it is announced. The site updates within about a minute, no redeploy.
- **Registrations open:** untick to close the form.
- **Photos:** a path such as `assets/shreya-hero.jpg` (upload the file into `assets/` and redeploy) or an https URL of an approved image. Until a photo loads, the site shows a styled placeholder.
- **Emails:** optional notification to you on each signup, and an optional confirmation email to each registrant.

## 4. Before you announce

- [ ] Replace both `ORGANISER_EMAIL` placeholders in `privacy.html` with a real contact address.
- [ ] Add Shreya-approved photos (`assets/shreya-hero.jpg`, `assets/shreya-about.jpg`).
- [ ] Set the real date in the admin panel and tick "Date is final".
- [ ] Have Shreya approve the curriculum, bio and FAQ answers (pricing and recording are still "not announced").
- [ ] Submit one test registration from the live site and from your phone; check the row appears and delete the test rows.

## Updating the backend later

After editing `Code.gs`, use **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**. This keeps the same `/exec` URL so the website needs no change.

## Optional: beehiiv

Only add people who ticked consent. Simplest route: Zapier or Make, trigger "New row in Google Sheets" on the Registrations tab, then beehiiv "Create subscriber". Keep any beehiiv API key inside the automation tool, never in this website.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Page content and registration form |
| `styles.css` | Design |
| `script.js` | Countdown, live settings, form submission |
| `config.js` | The `/exec` URL plus fallback event details |
| `privacy.html` | Privacy notice (fill in the contact email) |
| `backend/Code.gs` | Apps Script API, validation, duplicate check, emails |
| `backend/AdminPanel.html` | The admin sidebar inside the Sheet |
