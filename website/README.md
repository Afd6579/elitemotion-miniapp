# ELITEMOTION — Digital Automotive Poster Store

A responsive storefront for digital automotive posters, with a product catalog, currency display, shopping bag UI, and a protected admin panel for managing product details.

## Project structure

```text
frontend/
  index.html
  style.css
  script.js
  products.json
  admin.html
  admin.css
  admin.js
backend/
  server.js
  package.json
  .env.example
```

The original root-level files are retained for compatibility; the organized `frontend/` and `backend/` copies are now available for local development.

## Run locally (Node.js 20+)

1. Open a terminal in the repository root.
2. Copy `backend/.env.example` to `backend/.env`.
3. Generate a random session secret:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```

4. Put the generated value in `SESSION_SECRET` in `backend/.env`. Keep this file private.
5. Install and run the server:

   ```powershell
   cd backend
   npm install
   npm start
   ```

6. Open `http://localhost:3000` for the store or `http://localhost:3000/admin` for the admin panel.

## Current limitations

- This is a local-development starter, not production-ready hosting.
- Admin setup is intended to create the first admin account; use a unique password of at least 12 characters.
- Product previews can use public image URLs. Secure original-file upload and customer-only digital delivery are not implemented.
- Online payments, TON Connect transactions, and automatic order fulfillment are intentionally not enabled.
- SQLite and the default in-memory session store need production-appropriate persistent storage and session configuration before public deployment.
- Do not commit `.env`, passwords, tokens, payment details, or private poster files.
- Only upload artwork you own or have permission to distribute.

For Persian setup instructions, see [README_FA.md](README_FA.md).
