# CareerPilot backend

Beginner-friendly first implementation of the CareerPilot server. The backend is split into two small services:

- `api/`: Node.js + Express REST API, JWT sessions, PostgreSQL storage, upload handling and role-based access.
- `ai-service/`: Python + FastAPI adapter for resume feedback, interview feedback and career suggestions. It works with a deterministic mock provider by default; OpenAI and Gemini are optional providers in the SRS.

No frontend files are included here. The API runs locally on port `4000`; the private AI service listens on `127.0.0.1:8001`.

## Requirements

- Node.js 20 or newer and npm.
- Python 3.10 or newer.
- PostgreSQL 13 or newer, with a database and a database user.
- Internet access only if you choose an external AI provider.

## First-time setup (Windows PowerShell)

1. Create an empty PostgreSQL database named `careerpilot` and a user/password with permission to create tables in it. Keep the database on your own machine during development.
2. Open a terminal in `D:\Major Project\backend\api` and run:

   ```powershell
   Copy-Item .env.example .env
   npm install
   ```

3. Edit `api\.env`. Set `DATABASE_URL` to your local database connection string, for example `postgresql://careerpilot_user:your_password@localhost:5432/careerpilot`. Replace `JWT_SECRET` with a long random secret (at least 32 characters). For example, create one in PowerShell with `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`. Generate another random value and set it as `AI_SERVICE_API_KEY`; copy the same value to the AI service's `.env`. Example: `[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))`. These example values are placeholders and services refuse to start with them unchanged.
4. Apply the database schema and insert safe starter content:

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

5. Create the first administrator from the same API folder. Set these variables only in the current terminal; do not commit a real password:

   ```powershell
   $env:ADMIN_EMAIL = "admin@example.edu"
   $env:ADMIN_NAME = "CareerPilot Administrator"
   $env:ADMIN_PASSWORD = "use-a-long-unique-password"
   npm run admin:create
   Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD
   ```

6. In a second terminal, prepare the Python AI service:

   ```powershell
   cd "D:\Major Project\backend\ai-service"
   py -m venv .venv
   .\.venv\Scripts\Activate.ps1
   pip install -r requirements.txt
   Copy-Item .env.example .env
   python -m unittest discover -s tests
   ```

   `AI_PROVIDER=mock` is the default and needs no provider key. Set `AI_SERVICE_API_KEY` in both `ai-service\.env` and `api\.env` to the same private random value. To use OpenAI or Gemini, select the provider, add that provider's key, and keep the API service key private. The API binds to localhost by default; set `HOST=0.0.0.0` only when deploying behind a firewall or reverse proxy.

7. Start each service in its own terminal:

   ```powershell
   # Terminal 1, from backend\ai-service
   .\.venv\Scripts\Activate.ps1
   python -m uvicorn main:app --host 127.0.0.1 --port 8001
   ```

   ```powershell
   # Terminal 2, from backend\api
   npm run dev
   ```

   API health endpoint: `http://localhost:4000/api/health`. AI health endpoint: `http://127.0.0.1:8001/health`.

## Authentication and account safety

- Create a student account with `POST /api/auth/register`, then sign in using `POST /api/auth/login`.
- Send the returned token on protected requests as `Authorization: Bearer <token>`.
- The API signs JWTs and also stores each session in PostgreSQL. Logout revokes the session; a disabled user cannot continue using a token.
- Registration always creates a student. It cannot set an officer or administrator role. Create staff using an administrator account.
- Passwords are hashed with bcrypt. Sign-in attempts are limited in memory. For a multi-instance production deployment, replace this simple limiter with a shared store.
- Resume uploads accept PDF/DOCX, validate file signatures, are limited by `MAX_RESUME_SIZE_MB`, and are stored outside public static folders. Students can download or delete only their own versions. Do not serve this folder as a public web directory.
- Account recovery is supported by one-time reset tokens. An administrator creates a token using `POST /api/officer/users/:id/password-reset` and must deliver it to the user through a verified private channel. The student submits it to `POST /api/auth/password-reset`; tokens expire after 30 minutes and can be used once.
- Profile setting `aiDataConsent` is explicit. OpenAI/Gemini calls require it; mock local feedback does not.
- Coding practice accepts short answers and multiple-choice style responses. It deliberately does not run code submitted by users.

## Main API areas

All paths are under `/api` unless shown otherwise. Protected routes require a Bearer token.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`, `POST /auth/password-reset`, `DELETE /auth/account` |
| Student profile | `GET /profile/me`, `PUT /profile/me` |
| Resume | `GET /resume/me`, `PUT /resume/me/builder`, `POST /resume/me/upload`, `POST /resume/me/analyze`, `GET /resume/me/versions`, `GET /resume/me/versions/:id/file`, `DELETE /resume/me/versions/:id` |
| Roles and skills | `GET /roles`, `GET /skills`, `GET/PUT /skills/me`, `GET /skills/gaps`, `GET /career/recommendations` |
| Learning | `GET /resources`, `PUT /resources/:id/progress` |
| Interview | `GET /interviews/questions`, `POST /interviews`, `POST /interviews/:id/responses`, `POST /interviews/:id/complete`, `GET /interviews/history` |
| Coding | `GET /coding/problems`, `POST /coding/problems/:id/submissions`, `GET /coding/submissions` |
| Aptitude | `GET /aptitude/tests`, `POST /aptitude/tests/:id/attempts`, `GET /aptitude/attempts/:id/questions`, `POST /aptitude/attempts/:id/submit`, `GET /aptitude/history` |
| Readiness/dashboard | `GET /readiness/me`, `GET /dashboard/student` |
| Notifications | `GET /notifications`, `PATCH /notifications/:id/read`; staff publish using `POST /officer/notifications` |
| Placement officer | `GET /officer/dashboard`, `GET /officer/cohorts`, `GET /officer/cohorts/:id/students`, `GET /officer/reports/summary`, `GET/POST/PATCH /officer/notifications` |
| Administrator | `GET/POST/PATCH /officer/cohorts`, `PATCH /officer/students/:id/cohort`, `POST /officer/officers/:id/cohorts`, `DELETE /officer/cohorts/:cohortId/officers/:officerId`, `POST /officer/users`, `POST /officer/users/:id/password-reset`, `PATCH /officer/users/:id/status`, `GET /admin/audit`, `/admin/catalog/*`, `/admin/readiness-formulas` |

The readiness formula is versioned and seeded as `v1`: resume 25%, skills 25%, interview 20%, coding 15%, aptitude 15%. A score is marked complete after three evidence categories are available. It is a guidance indicator, not a hiring prediction.

## Integration checks

With PostgreSQL, the API, and the AI service running, run the API unit tests with `npm test` from `backend\api`. To exercise the database-backed HTTP workflows, first create a temporary administrator using the `admin:create` steps above, set `TEST_ADMIN_EMAIL` and `TEST_ADMIN_PASSWORD` in that terminal, then run `npm run test:integration`. The integration check creates uniquely named test records and removes its students, placement officer, notices, cohorts, and coding question afterward.

On the original development laptop, PostgreSQL 16 is kept in the ignored `D:\Major Project\.local\postgresql` directory and listens on `127.0.0.1:5432`. Start it after a reboot with:

```powershell
& "D:\Major Project\.local\postgresql\pgsql\bin\pg_ctl.exe" -D "D:\Major Project\.local\postgresql\data2" -l "D:\Major Project\.local\postgresql\postgres.log" -o "-h 127.0.0.1 -p 5432" start
```

That local cluster is for development and testing on this laptop. It is excluded from Git and is not available to teammates cloning the repo; they should use their own PostgreSQL instance and follow the first-time setup above.

## Role and scope rules

- Students can only read and change their own profile, resume, skill list, assessments and progress.
- Placement officers can see students and summary metrics only in cohorts assigned by an administrator. They cannot read student resume files or edit accounts.
- Administrators can manage cohorts, staff, career/learning/assessment catalogs, readiness formulas, deactivate/reactivate accounts, assign officers, and inspect audit events. Content with assessment history is locked to preserve past results; deactivate it or create a replacement instead.
- Institution-wide notifications are administrator-only; officers can publish to their assigned cohort.

## First integration sequence

1. Start PostgreSQL and both backend services.
2. Register a student and sign in; save the access token in your API client.
3. Update their profile (`PUT /api/profile/me`) with `fullName`, and optionally `course`, `graduationYear`, `targetRoleId`, `preferences`, and `aiDataConsent`.
4. Use `/api/skills` to get IDs, then save known skills with `PUT /api/skills/me`.
5. Use resume, practice, dashboard and readiness routes. Integrate the frontend after these stable request/response shapes are agreed.

## Known development limits

- PostgreSQL is required; there is no in-memory database fallback.
- Seed content is educational starter data and should be reviewed before a real institution uses it.
- The simple in-memory login limiter is for a single local development process.
- The Python dependencies are pinned in `requirements.txt`; install them in the documented virtual environment on each machine. AI provider responses are schema-checked and bounded before being returned.
- The API unit tests cover readiness evidence weighting. The database migrations, idempotent seed, and database-backed integration smoke test have been run against the local PostgreSQL 16 instance.
- The AI service includes standard-library unit tests for provider response validation and mock analysis; they pass in the local virtual environment.
- Scanned image-only PDFs do not have OCR in the approved stack; use a text-based PDF or DOCX for resume analysis.
- Use HTTPS, secure secret storage, backups, access reviews, retention rules and deployment-specific CORS before hosting real student data.
- Do not commit `.env` files, database dumps, uploaded resumes, provider keys or real student information.
