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
