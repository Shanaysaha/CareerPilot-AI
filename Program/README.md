# Runnable local application

`CareerPilot_AI_Local_Application.zip` contains the compiled website, Express API, FastAPI service, database migrations, seed content, and dependency definitions. This browser application runs through Node.js, Python, and PostgreSQL.

1. Extract the archive to a new folder on your laptop.
2. Follow the included root README steps to install dependencies, configure both backend environment files, create the PostgreSQL database, run migrations and seed, and create your administrator account.
3. Start the AI service from backend/ai-service and the API from backend/api using the commands in the README.
4. In a third terminal, open the extracted frontend folder and run the following commands.

```powershell
npm ci
npm run preview -- --host 127.0.0.1 --port 5173 --strictPort
```

Open http://localhost:5173 in a browser. The compiled website uses http://127.0.0.1:4000/api. Keep the backend CORS origin set to http://localhost:5173. The preview command serves the compiled website included in the archive.

PostgreSQL and the configured backend services must be running for account and preparation features. The default AI provider is mock for local demonstrations. Start and configure the services on each laptop using its own environment files.

The [user manual](../Help/USER_MANUAL.md) describes student, placement officer, and administrator workflows.
