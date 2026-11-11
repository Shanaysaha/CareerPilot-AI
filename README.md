# CareerPilot AI

CareerPilot AI is a student career and placement preparation platform built as a BCA major project. It brings career planning, practice, learning, and preparation progress into one responsive web application for students, placement officers, and administrators.

## What the project includes

- Student workspace with a dashboard, profile, resume tools, skill gap analysis, learning resources, interview practice, coding questions, aptitude tests, career recommendations, notifications, and readiness guidance.
- Placement officer workspace for assigned cohorts, student progress, reports, and cohort notifications.
- Administrator workspace for cohorts, staff accounts, learning and assessment content, readiness settings, reports, notifications, and audit history.
- A single sign-in page with separate **Login as user** and **Login as admin** choices. Account roles are checked by the backend.
- JWT-based authentication backed by revocable PostgreSQL sessions, password hashing, and role-based access controls.
- A responsive React website, an Express REST API, a PostgreSQL database, and a private FastAPI AI service. AI runs with a local mock provider by default; external AI providers are optional.

## Technology

- Frontend: React, Vite, and React Router
- Main backend: Node.js, Express, and PostgreSQL
- AI service: Python and FastAPI
- Authentication: JWT and bcrypt

## Run CareerPilot AI on your laptop

The instructions below use Windows PowerShell. Install **Node.js 20 or newer**, **Python 3.10 or newer**, and **PostgreSQL 13 or newer** first. The project does not include a shared hosted database: each developer runs the database on their own machine.

### 1. Get the project and create a database

```powershell
git clone https://github.com/Shanaysaha/CareerPilot-AI.git
cd CareerPilot-AI
```

Using pgAdmin, create an empty database named `careerpilot` and a PostgreSQL user that can create tables in it. Keep the database username and password for the next step.

### 2. Configure and prepare the API

Open a PowerShell window in the project folder and run:

```powershell
cd backend/api
Copy-Item .env.example .env
npm install
```

Edit `backend/api/.env` and set `DATABASE_URL` to your local PostgreSQL connection. Replace `JWT_SECRET` with a private random string of at least 32 characters. Set `AI_SERVICE_API_KEY` to a private random value; use that same value in the AI service configuration in the next step. You can generate a random value with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`. Do not commit `.env` or share these secrets.

### 3. Configure and prepare the AI service

Open a second PowerShell window in the project folder and run:

```powershell
cd backend/ai-service
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/ai-service/.env` and set `AI_SERVICE_API_KEY` to the exact same private value used by the API. `AI_PROVIDER=mock` works locally without an external provider account or API key.

### 4. Set up the database and initial administrator

In the first PowerShell window, return to the API folder if needed, then run:

```powershell
npm run db:migrate
npm run db:seed
$env:ADMIN_EMAIL = "admin@example.edu"
$env:ADMIN_NAME = "CareerPilot Administrator"
$env:ADMIN_PASSWORD = "choose-a-long-unique-password"
npm run admin:create
Remove-Item Env:ADMIN_EMAIL, Env:ADMIN_NAME, Env:ADMIN_PASSWORD
```

Use your own administrator email and a unique password. The seed command adds sample learning and practice content; it does not add real student information.

### 5. Start the services

Keep PostgreSQL running, then start the AI service and API in their own PowerShell windows:

```powershell
# AI service window: run from backend/ai-service with its virtual environment active
python -m uvicorn main:app --host 127.0.0.1 --port 8001
```

```powershell
# API window: run from backend/api
npm run dev
```

Start the website in a third PowerShell window:

```powershell
cd frontend
npm install
npm run dev
```

Open the local website address printed by Vite (usually `http://localhost:5173`). Sign in with the administrator account you created, choosing **Login as admin**. A student can create an account from the sign-up page and choose **Login as user**. Placement officer accounts are created by an administrator.

### Useful local addresses

- Website: `http://localhost:5173`
- API health (also checks PostgreSQL): `http://localhost:4000/api/health`
- AI service health: `http://127.0.0.1:8001/health`

For database setup details, environment variables, API routes, and integration testing, see [`backend/README.md`](backend/README.md). For frontend build and folder details, see [`frontend/README.md`](frontend/README.md).

## Run project checks

```powershell
# From backend/api
npm test
npm run test:integration

# From backend/ai-service with its virtual environment active
python -m unittest discover -s tests -v

# From frontend
npm run build
```

The database-backed integration check needs a running PostgreSQL database, migrated schema, seeded content, a running API, and `TEST_ADMIN_EMAIL` / `TEST_ADMIN_PASSWORD` environment variables for a local administrator account.

## Project layout

```text
frontend/       React website and installable web app
backend/api/    Express API, database migrations, and seed data
backend/ai-service/  FastAPI service for AI-assisted feedback
docs/           Project specifications and planning documents
```

## Scope and responsible use

CareerPilot is an academic preparation and guidance project. Readiness scores are based on recorded practice evidence and are not predictions of hiring outcomes. The default mock AI provider supports local demonstrations; using an external provider requires configuring its key and reviewing its privacy terms. Use synthetic data during development, and do not commit secrets, database files, uploaded resumes, or private student information.
