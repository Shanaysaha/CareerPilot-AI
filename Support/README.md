# Runtime and dependency setup

Install these runtime tools before following the root README setup instructions.

| Tool | Requirement | Purpose |
| --- | --- | --- |
| Node.js and npm | Node 20.19+ within version 20, or Node 22.12+ | Express API and Vite website tooling |
| Python | 3.10 or newer | FastAPI AI service |
| PostgreSQL | 13 or newer | Persistent application database |
| Git | Required for cloning and rebuilding submission archives | Source retrieval and tracked-file inventory |

Use the official installers from https://nodejs.org/, https://www.python.org/downloads/ and https://www.postgresql.org/download/. PostgreSQL can be managed using pgAdmin. Runtime installers are downloaded for the target operating system.

## Libraries used

The frontend uses React, React DOM, React Router, Vite, Tailwind CSS, their Vite plugins, and Lucide React. The Express API uses Express, pg, bcryptjs, jsonwebtoken, dotenv, and multer. The AI service uses FastAPI, Uvicorn, Pydantic, python-dotenv, pypdf, and their pinned dependencies.

Install JavaScript dependencies with npm ci from frontend and backend/api. Install Python dependencies inside a virtual environment using pip install -r requirements.txt from backend/ai-service. The package lockfiles and Python requirements record the library versions used by the project.

## Configuration

Copy each backend .env.example to .env. Configure DATABASE_URL and JWT_SECRET in the API. Set the same private AI_SERVICE_API_KEY of at least 32 characters in both backend services. Start with AI_PROVIDER=mock. The root README describes database migration, starter content, and administrator creation.

## Refresh submission archives

Run from the repository root after application edits have been added to Git's tracked files.

```powershell
npm ci --prefix frontend
npm run build --prefix frontend
python Support/package_submission.py
```

The script packages the current tracked source files and the compiled website. It also refreshes SHA256SUMS.txt for both archives. Rebuild the website before packaging to include current frontend changes.

## Common startup problems

- If the database health check fails, start PostgreSQL and verify DATABASE_URL and the database permissions.
- If the browser cannot reach the API, check port 4000 and use the same website address configured in CORS_ORIGINS.
- If AI requests fail, verify that both services use the same AI_SERVICE_API_KEY and that port 8001 responds.
- If a port is occupied, close the earlier project process or choose a different port and update the related configuration.
- If PowerShell prevents virtual environment activation, call `.\.venv\Scripts\python.exe` directly from the AI service folder.
