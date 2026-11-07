# DuuniCheck

DuuniCheck keeps job applications, their events, reminders, CV versions and cover letter templates in one place. It also has an AI assistant for application-specific chat and for creating prefilled applications from job postings.

## Features

- Overview of applications, sent applications, interviews, rejections and response times
- Add, edit and delete applications, change their status and keep a dated event history
- Progress timeline and a calendar with reminders
- CV library, editing and printing of CV versions, and cover letter templates
- JPG, PNG or WebP photo on the CV; CV and application printouts are formatted for saving as PDF
- Application-specific notes and attached CV or cover letter files
- AI chat with conversation history stored on the server
- Prefilled application from a job posting: paste the posting text and link into the chat, review the draft and save it with the status "Kiinnostava"
- Clerk sign-in and MongoDB Atlas storage with per-user data isolation; sign-up is invite-only
- Three colour themes (default, dark and light); the choice is stored as a user setting in the database
- Responsive layout for mobile
- Self-hosted fonts: no requests to Google Fonts or other third parties

The AI assistant reads the selected application from DuuniCheck's own database. Database queries are not sent to OpenAI. For suggestions, the server sends only the user's message and the context items the user has selected. A suggestion does not change the application until the user accepts it. The OpenAI key is needed only for the AI features.

### Prefilled application from a job posting

The user copies the posting text (and optionally its link) from a job board or an employer's site and pastes it into the chat with the option "Tee hakemuspohja ilmoituksesta" selected in the context column. The backend (`POST /api/assistant/parse-posting`) sends only the pasted text to OpenAI, which extracts the company, role, location and application deadline. The link is never opened. Nothing is saved until the user reviews the draft and saves it; the deadline goes into the notes.

## Requirements

- Node.js and npm
- MongoDB Atlas or another MongoDB that supports transactions
- A Clerk application for sign-in
- An OpenAI API key, only for the AI features

## Local setup

Create local `.env` files for the frontend and the backend from the examples. Put secrets directly on your own machine or in the hosting service settings. Never copy real keys into the README, the source code or version control. `.env` files are excluded from Git.

### Backend

Copy `backend/.env.example` to `backend/.env` and fill in the settings:

- `PORT`: backend port, 5000 by default
- `TRUST_PROXY`: `0` locally; `1` only behind a single trusted proxy
- `MONGODB_URI`: MongoDB connection string
- `CLERK_SECRET_KEY` and `CLERK_PUBLISHABLE_KEY`: Clerk server key pair
- `ALLOWED_ORIGIN`: allowed frontend origin; separate several origins with commas
- `CLERK_WEBHOOK_SIGNING_SECRET`: signing secret of the webhook configured in Clerk
- `OPENAI_API_KEY`: optional key for the AI features
- `OPENAI_MODEL`: OpenAI model to use
- `CLERK_TELEMETRY_DISABLED`: compatibility variable for the telemetry setting
- `RATE_LIMIT_API`, `RATE_LIMIT_WEBHOOK`, `RATE_LIMIT_UPLOAD`, `RATE_LIMIT_AI`: optional, only for automated test runs. Leave them unset in production; the defaults are 120 / 120 / 30 / 20.

Start the backend:

```powershell
cd backend
npm install
npm run dev
```

The backend answers at `http://localhost:5000` by default. The health check is `GET /api/health`.

### Frontend

Copy `frontend/.env.example` to `frontend/.env` and set the Clerk publishable key. The frontend settings are:

- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key
- `VITE_CLERK_TELEMETRY_DISABLED`: Clerk telemetry setting
- `VITE_API_URL`: backend address, usually `http://localhost:5000` locally
- `VITE_CLERK_PRODUCTION_URL`: Clerk production URL when needed
- `VITE_SUPPORT_EMAIL`: support address shown in the user interface when needed
- `VITE_SITE_URL`: site root URL with a trailing slash, used for the social preview image URL
- `VITE_BASE_PATH`: base path for a subfolder deployment, e.g. `/duunicheck/` (empty means the site root)

`VITE_` settings are visible in the browser. Never put secret keys in them.

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local address on startup, usually `http://localhost:5173`.

## Clerk webhook and data deletion

Configure a webhook in Clerk pointing to the backend route `/api/webhooks/clerk` and subscribe to the `user.deleted` event. Put the webhook signing secret in the backend `CLERK_WEBHOOK_SIGNING_SECRET` variable. The signature is verified against the raw request body. A verified deletion event removes the user and all of their DuuniCheck data from the database in a transaction.

## Security principles

- Sign-in is verified in the backend from the Clerk session; the user id sent by the client is never trusted.
- Database queries are limited to data owned by the signed-in user.
- API, AI, file upload and webhook routes are rate limited per user (or per IP for webhooks).
- The webhook signature is verified before the event is processed.
- File types, sizes and inputs are validated on the server; request bodies have a size limit.
- Job postings are never fetched from links; the assistant only uses text the user pastes.
- `.env` files are not in version control. Production keys are set as secrets in the hosting environment.

## Checks

Frontend lint and production build:

```powershell
cd frontend
npm run lint
npm run build
```

The automated Robot Framework tests live in a separate repository, [duunicheck-tests](https://github.com/JariCode/duunicheck-tests). Its `run-tests.ps1` starts the backend and frontend, runs every suite and stops the servers.

## Project structure

```text
frontend/
  src/
    assets/        self-hosted fonts
    components/    reusable UI components
    legal/         terms of use and privacy policy settings
    pages/         application pages
    styles/        theme styles and font definitions
    App.jsx        page views and application state
    api.js         backend requests
    index.css      shared base styles
backend/
  middleware/      authentication and rate limits
  models/          MongoDB models
  routes/          API routes and the Clerk webhook
  utils/           input handling and shared helpers
  server.js        Express server and middleware setup
```

## Technologies

- React and Vite
- Express and MongoDB/Mongoose
- Clerk
- OpenAI API for the optional AI features
