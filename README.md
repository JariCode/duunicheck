# DuuniCheck

DuuniCheck keeps job applications, their events, reminders, CV versions and cover letter templates in one place. It also has an AI assistant for application-specific chat, for creating prefilled applications from job postings and for importing applications from a file.

## Features

- Overview of applications, sent applications, interviews, accepted offers, rejections and response times
- Add, edit and delete applications, change their status (Kiinnostava, Lähetetty, Haastattelu sovittu, Hyväksytty, Hylätty) and keep a dated event history
- Progress timeline and a calendar with reminders
- CV library, editing and printing of CV versions, and cover letter templates
- JPG, PNG or WebP photo on the CV; CV and application printouts are formatted for saving as PDF
- Printing in the iOS home screen app and in Safari or the Dock app on a Mac: the document is made into a PDF on the device; on iOS it opens in the share sheet (Print, Save to Files), on a Mac it opens with its print dialog
- Application-specific notes and attached CV or cover letter files
- AI chat with conversation history stored on the server; answers are shown with safe formatting (headings, bold text and lists)
- Prefilled application from a job posting: paste the posting text and link into the chat, review the draft and save it with the status "Kiinnostava"
- Import applications from an Excel, CSV, Word, PDF or text file: review the found applications in the chat and save the selected ones; an import can be undone until the page is reloaded
- Delete several applications at once through the assistant: describe which ones, review the matches and confirm
- Clerk sign-in and MongoDB Atlas storage with per-user data isolation; sign-up follows the Clerk access mode (invite-only in use)
- Keyboard-accessible dialogs: every dialog opens above the top bar, closes with Escape and keeps keyboard focus inside
- Three colour themes (default, dark and light); the choice is stored as a user setting in the database
- Responsive layout for mobile
- Self-hosted fonts: no requests to Google Fonts or other third parties

## AI assistant

The AI assistant reads the selected application from DuuniCheck's own database. Database queries are not sent to OpenAI. A suggestion does not change the application until the user accepts it. The OpenAI key is needed only for the AI features.

### Suggestions and the context the user selects

For suggestions (`POST /api/assistant/suggest`), the server sends OpenAI the user's message and only the context items the user selects in the context column. CV and cover letter are off by default, and an item is disabled when the application has nothing to send for it.

- **Job posting:** text the user pastes into the context column. Postings are never fetched from links.
- **CV:** the CV made in DuuniCheck (title, summary, skills, experience and education, never the photo) and/or the text of a CV file attached to the application.
- **Cover letter:** the cover letter template, the application's own text and the text of attached application files.
- **Notes:** the application's notes.

Attached PDF, DOCX and TXT files are read with the same isolated reader as the file import. At most 8,000 characters per file and 20,000 characters in total are sent, and the user is told when text was shortened or a file could not be read (for example a scanned PDF).

**Data minimisation:** before the request is sent, `backend/utils/redactContactDetails.js` replaces contact details in every document text with `[poistettu]`: email addresses, phone numbers, postal addresses, web addresses, the user's name and the contact details saved in the user's CVs and templates. The name is taken from the Clerk profile, the CVs and templates and the email address, and it is also detected at the start of a document and in a signature. Technology names such as ASP.NET and ordinary words are kept. The user's own message and the pasted job posting are sent as they are. The model is instructed not to write the user's name or contact details and to use `[Nimesi]` and `[Yhteystietosi]` instead. Detection is pattern based, so the privacy policy tells the user to check a file before selecting it.

Answers can be up to 4,000 tokens long; if an answer is cut short, a notice asks the user to request a continuation. Answers are rendered from Markdown into React elements without HTML, and only http(s) links become links.

### Prefilled application from a job posting

The user copies the posting text (and optionally its link) from a job board or an employer's site and pastes it into the chat with the option "Tee hakemuspohja ilmoituksesta" selected in the context column. The backend (`POST /api/assistant/parse-posting`) sends only the pasted text to OpenAI, which extracts the company, role, location and application deadline. The link is never opened. When a recruitment agency posts on behalf of an unnamed employer, the company becomes "<agency> (asiakasyritys)" and the notes say who the recruiter is; nothing is invented when no company is given. Nothing is saved until the user reviews the draft and saves it; the deadline goes into the notes.

### Import applications from a file

With the option "Tee hakemukset tiedostosta" selected in the context column, the user attaches an Excel (`.xlsx`), CSV, Word (`.docx`), PDF or text file to the chat (paperclip button or drag and drop, at most 5 MB). The backend (`POST /api/assistant/import-applications`) checks the extension and the file content, rejects `.xls`/`.xlsm` files and macros, and reads the file in a worker thread with a 10 second time limit and a memory limit. The file is never stored.

- **Spreadsheets (Excel and CSV):** the header row is detected (it does not have to be row 1), and empty rows, totals rows, hidden sheets and sheets with only formulas are skipped. Only stored cell values are read; formulas, macros, external links and embedded objects are ignored, and hyperlinks are accepted only as http(s) addresses. OpenAI receives only the column headers and at most five example rows and returns a column-to-field mapping. The backend converts every row with that mapping, so the AI never writes rows. Dates are read from Excel date cells and Finnish `d.m.yyyy` text; send, response and interview dates become events. The user can change the mapping in the chat; the list is rebuilt with `POST /api/assistant/import-applications/remap` without a new OpenAI request.
- **Free text (Word, PDF, TXT):** OpenAI extracts the applications from the text (at most 16,000 characters) with a JSON schema limited to the existing application fields.

Every draft is validated with the same schema as `POST /api/applications`; invalid fields are cleared instead of dropping the row. Duplicates (same link, or same company and role) and rows needing review start unselected. At most 50 applications are imported at a time, and the 500-application limit is taken into account. Nothing is saved until the user selects rows and clicks "Tallenna valitut", which saves them one by one through `POST /api/applications`. After saving, "Kumoa tuonti" deletes exactly the applications created by that import (after a confirmation) with `POST /api/applications/bulk-delete`; the ids are kept only in the page state, so undo is possible until the page is reloaded.

### Delete applications through the assistant

With the option "Etsi poistettavat hakemukset" selected, the user describes which applications to delete. The backend (`POST /api/assistant/find-applications`) sends OpenAI only the message and today's date, never any application data. The model returns search criteria only (statuses, company/role/location text, send date range, date added to DuuniCheck, whether a link exists). The criteria are validated with zod, and the server searches only the user's own applications, using escaped regular expressions for text. A request without any criteria returns nothing and the assistant asks for details. The matches are listed in the chat (all selected by default, at most 500); nothing is deleted until the user clicks "Poista valitut" and confirms the dialog.

`POST /api/applications/bulk-delete` takes 1–500 unique ids and deletes, in one transaction, only the signed-in user's applications and their conversations. Other ids are ignored without revealing whether they exist. The response is `{ deleted: N }`.

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
- `VITE_SITE_URL`: site root URL with a trailing slash, used for the canonical link and the social preview
- `VITE_BASE_PATH`: base path for a subfolder deployment, e.g. `/duunicheck/` (empty means the site root)

`VITE_` settings are visible in the browser. Never put secret keys in them.

Start the frontend in another terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite prints the local address on startup, usually `http://localhost:5173`.

## Clerk settings

- **Access mode:** sign-up follows the Clerk access mode. With *Invite-only*, the sign-in dialog shows only sign-in and an account can be created only through an invitation link; with *Open*, Clerk shows its own sign-up link.
- **Paths:** set the sign-in and sign-up pages to the application's own pages (`/sign-in` and `/sign-up` under the base path), so that invitation links open DuuniCheck's own form instead of Clerk's hosted page. In development, also set the fallback development host (e.g. `http://localhost:5173`).
- **Invitation sign-up:** the invitation link opens DuuniCheck's sign-up form, which asks for a password and the acceptance of the terms; the email address comes from the invitation.
- **Google sign-in:** the development instance uses Clerk's shared Google credentials. A production instance needs its own Google OAuth client (Client ID and Client Secret).

## Clerk webhook and data deletion

Configure a webhook in Clerk pointing to the backend route `/api/webhooks/clerk` and subscribe to the `user.deleted` event. Put the webhook signing secret in the backend `CLERK_WEBHOOK_SIGNING_SECRET` variable. The signature is verified against the raw request body. A verified deletion event removes the user and all of their DuuniCheck data from the database in a transaction.

## Security principles

- Sign-in is verified in the backend from the Clerk session; the user id sent by the client is never trusted. The Clerk middleware runs only on the signed-in `/api` routes, so public addresses such as `/api/health` are never redirected to Clerk.
- Database queries are limited to data owned by the signed-in user.
- API, AI, file upload and webhook routes are rate limited per user (or per IP for webhooks).
- The webhook signature is verified before the event is processed.
- File types, sizes and inputs are validated on the server; request bodies have a size limit.
- Deleting a file also removes its references from the user's applications.
- Job postings are never fetched from links; the assistant only uses text the user pastes.
- Contact details are removed from documents before they are sent to OpenAI.
- Print PDFs are made on the device with pdfmake. Nothing is sent to the server, pdfmake may not fetch any URL, and the fonts come from a bundled package.
- The AI never deletes anything: deletions run only after the user selects the applications and confirms.
- Imported and attached files are validated by extension and content, parsed in a worker thread with time and memory limits, and their content is never logged.
- Backend security headers: Helmet with a JSON API Content-Security-Policy (`default-src 'none'`), `X-Frame-Options: DENY`, `Permissions-Policy` and `Cache-Control: no-store` on every response.
- Frontend security headers (`frontend/public/.htaccess`): an enforced Content-Security-Policy, HSTS (`max-age=31536000`, without `includeSubDomains` because other applications share the domain), `X-Frame-Options: DENY`, `Permissions-Policy`, `Referrer-Policy` and no directory listing.
- `.env` files are not in version control. Production keys are set as secrets in the hosting environment.

## Deployment notes

- The CSP in `frontend/public/.htaccess` allows the production Clerk Frontend API domain `https://clerk.duunicheck.jaricode.fi`. When the CSP is used with Clerk development keys (for example in `vite preview`), add the development domain `*.clerk.accounts.dev` to it; otherwise sign-in is blocked.
- The application is deployed at the domain root (`https://duunicheck.jaricode.fi/`). The `mod_rewrite` rule in `.htaccess` routes every path without a matching file, including nested paths such as `/sign-in/sso-callback`, to `index.html`.
- In the production Clerk instance, set the access mode, the paths, the Google OAuth client and the webhook separately; they are not copied from the development instance.
- Behind Render, set `TRUST_PROXY=1` and set `ALLOWED_ORIGIN` to the production frontend origin.

## Checks

Frontend lint and production build:

```powershell
cd frontend
npm run lint
npm run build
```

Backend unit tests:

```powershell
cd backend
node --test
```

The automated Robot Framework tests live in a separate repository, [duunicheck-tests](https://github.com/JariCode/duunicheck-tests).

## Project structure

```text
frontend/
  src/
    assets/        self-hosted fonts
    components/    reusable UI components
    legal/         terms of use and privacy policy settings
    pages/         application pages
    styles/        theme styles and font definitions
    utils/         shared hooks and helpers (dialog behaviour, base path, print target, PDF printouts)
    App.jsx        page views and application state
    api.js         backend requests
    index.css      shared base styles
backend/
  middleware/      authentication and rate limits
  models/          MongoDB models
  routes/          API routes and the Clerk webhook
  services/        background job for account deletion
  utils/           input handling, file reading, contact detail removal and shared helpers
  server.js        Express server and middleware setup
```

## Technologies

- React and Vite
- Express and MongoDB/Mongoose
- Clerk
- OpenAI API for the optional AI features
- pdfmake for PDF printouts on iOS and in Safari on a Mac