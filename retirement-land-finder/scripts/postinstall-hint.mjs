// Friendly hint after `npm install`. Never fails the install.
try {
  const msg = `
──────────────────────────────────────────────────────────────
  Retirement Land Finder installed.

  Start everything (API + web app):
      npm run dev

  Then open the URL Vite prints (default http://localhost:5173).

  Notes:
   • Government appraisal prices are LIVE from the Treasury Dept
     ArcGIS service — no key, no proxy needed.
   • Listing scrapers (DDproperty/Kaidee/Baania) are OFF by default.
     They need a residential proxy to work. See .env.example.
   • The app ships with realistic SAMPLE listings so it is fully
     usable out of the box.  Run  npm run seed  to regenerate them.
──────────────────────────────────────────────────────────────
`;
  console.log(msg);
} catch {
  /* ignore */
}
