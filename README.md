# Kovai Connect

A community-first Coimbatore bus guide with a searchable route directory and trip planner.

## Run locally

Requires Node.js 18 or newer. The app has no external package dependencies.

```sh
npm start
```

Open <http://localhost:4173>. In VS Code, open this folder and run **Terminal → Run Task → Start Kovai Connect**. Route edits made through the local server are saved in `db/routes.json` and copied to the static data snapshots. The optional SQLite schema is in `db/schema.sql`.

To enable the embedded Google Maps view in the Node server, copy `.env.example` values into your shell environment before starting it. On PowerShell:

```powershell
$env:GOOGLE_MAPS_API_KEY = "YOUR_RESTRICTED_KEY"
npm start
```

Restrict the key to Maps Embed API and the website referrers you use. The key is visible to site visitors. The app still provides a Google Maps link when no key is configured.

## Publish on GitHub Pages

This repository includes a GitHub Actions workflow that publishes the `public/` folder whenever a commit is pushed to `main`.

1. Create an empty GitHub repository and connect it as the `origin` remote (GitHub shows the exact URL).
2. Commit the project on `main` and push it to `origin`.
3. In the GitHub repository, open **Settings → Pages** and set the build and deployment source to **GitHub Actions**.
4. Open the **Actions** tab and wait for **Deploy static site to GitHub Pages** to finish. GitHub will show the site URL in the workflow run and Pages settings.

For this repository, the expected project site address is <https://ssjdextro.github.io/summit/>. It becomes available after a deployment run succeeds.

Pages hosting runs the browser-only version: route search works, and data-desk changes are saved in that visitor's browser only. It does not run `server.js`, provide the JSON API, or save visitor edits back into the GitHub repository. For a public service with shared, persistent edits, use a Node host plus a persistent database and protect the editing endpoints before making the data desk public. Do not deploy the current file-writing data desk as an open public API.

For Maps on Pages, configure the restricted browser key in `public/maps-config.js` before pushing. Since that file is public, never place an unrestricted key or other secret there.

## Git and VS Code

The `.gitignore` keeps local environment files, dependencies, and build output out of commits. VS Code workspace settings and a start task are included. To connect an existing GitHub repository, use **Source Control → … → Remote → Add Remote**, enter its URL, then use **Publish Branch** or **Push**. Review changes in Source Control before committing; the initial project files may already be staged.

Typical GitHub command-line setup, if preferred:

```sh
git remote add origin https://github.com/YOUR-ACCOUNT/YOUR-REPOSITORY.git
git push -u origin main
```

If `origin` is already configured, update it with `git remote set-url origin ...` instead of adding it again.

## Data notes

The route directory expands 257 grouped entries from the supplied route PDF into 273 searchable bus-code entries. Route endpoints are cross-checked against the [CCMC Bus Services directory](https://ccmc.gov.in/index.php/createpage/bus-services) and number variants and unclear spellings against the [Coimbatore Junction directory](https://coimbatorejunction.in/coimbatore-bus-routes/). These sources mostly provide endpoints, not complete stop sequences or reliable town-bus timetables. Timings and durations are left blank rather than guessed. Confirm service details with the operator.

## Included features

- Route search and planning across listed stops, including up to two transfers.
- Address and landmark handoff to Google Maps, with optional location assistance.
- Responsive route directory and local route data desk.
- JSON routes and planner API when running the Node server locally.
