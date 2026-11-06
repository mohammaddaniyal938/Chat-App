# Socket Chat

The application is split into independent frontend and backend processes.

## Requirements

- Node.js 18+
- MongoDB 6+ running locally or a MongoDB connection string

## Setup

1. Copy `.env.example` to `backend/.env`.
2. Set `MONGODB_URI` and `FRONTEND_ORIGIN` as needed.
3. Install dependencies:

   ```powershell
   npm install
   npm install --prefix backend
   ```

4. Start the backend:

   ```powershell
   npm start
   ```

5. In another terminal, start the frontend:

   ```powershell
   npm run start:frontend
   ```

Open `http://localhost:5173`.

The backend owns authentication, sessions, validation, authorization, MongoDB persistence, and Socket.IO events. The frontend is a static client and stores only its tab-scoped session token.

## Koyeb deployment (Socket.IO backend)

Deploy the backend as a Koyeb Web Service so Socket.IO can keep a persistent connection.

- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/api/health`
- Port: use the platform-provided `PORT` value; do not hard-code a production port.
- Required environment variable: `MONGODB_URI` set to a MongoDB Atlas free-tier connection string.
- Set `FRONTEND_ORIGINS` to the Vercel URL after the frontend is deployed.
- Optional: `SESSION_DAYS=30`

There are no cron jobs or cron definitions in this repository. Leave the hosting platform's cron configuration empty. A "Register crons" failure is platform metadata and is unrelated to the application.

After deployment, verify the Koyeb URL's `/api/health` endpoint returns `{"ok":true}`.

## Vercel deployment

This repository includes [vercel.json](./vercel.json) and a serverless API handler at [api/index.js](./api/index.js). They route `/api/*` to Express and serve the existing frontend from `frontend/`.

- Framework preset: Other
- Root directory: repository root
- Build command: `npm install`
- Output directory: leave blank
- Install command: `npm install`
- Cron jobs: none
- Environment variables:
  - `MONGODB_URI`: your MongoDB Atlas connection string
  - `FRONTEND_ORIGINS`: your deployed Vercel URL, or `*` while testing
  - `SESSION_DAYS`: `30`

Test locally with `npx vercel dev`. Visit `http://localhost:3000/` and `http://localhost:3000/api/health`.

Vercel Functions are request-based and do not provide a persistent server for Socket.IO rooms. The REST authentication, profiles, groups, and stored message APIs are routed by this configuration; deploy the Socket.IO backend on a long-running Node host if persistent real-time events are required.

  ## Koyeb + Vercel setup

  1. Deploy the repository to Koyeb as a Web Service using the Koyeb deployment settings above.
  2. Deploy the same repository to Vercel using the Vercel settings above.
  3. In `frontend/config.js`, set `CHAT_SOCKET_URL` to the Koyeb public URL:

     ```js
     window.CHAT_SOCKET_URL = window.CHAT_SOCKET_URL || "https://your-app-your-org.koyeb.app";
     ```

  4. Redeploy Vercel.
  5. Set Koyeb's `FRONTEND_ORIGINS` to the final Vercel URL and redeploy or restart Koyeb.

  The Vercel deployment serves the UI and REST API. The Koyeb deployment provides the persistent Socket.IO connection. Do not put `MONGODB_URI` in frontend files or commit it to the repository.
