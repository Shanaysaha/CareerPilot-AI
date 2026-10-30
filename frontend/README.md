# CareerPilot AI frontend

This folder contains the React website for CareerPilot AI. It is laid out for laptop and mobile screens and can be installed as a progressive web app in supported browsers.

## Start the application

1. Start the CareerPilot backend and its database using the instructions in the backend README.
2. Open a terminal in this `frontend` folder.
3. Run `npm install` the first time you set it up.
4. Run `npm run dev` and open the local address printed in the terminal (usually `http://localhost:5173`).

The website connects to `http://127.0.0.1:4000/api` by default. To use a different backend address, create a `.env` file in this folder with:

```text
VITE_API_BASE_URL=http://127.0.0.1:4000/api
```

## Create a production build

Run `npm run build`. The finished website files are placed in `dist`.

## Folder guide

- `src/pages/PublicPages.jsx` contains the landing, features, contact, and sign-in pages.
- `src/pages/StudentPages.jsx` contains student preparation pages.
- `src/pages/StaffPages.jsx` contains placement officer and administrator pages.
- `src/components.jsx` contains shared navigation, buttons, cards, and illustrations.
- `src/styles.css` contains the shared layout, colors, and mobile adjustments.
- `src/api.js` connects pages to the backend and includes the saved sign-in token.
- `public/` contains the installable app details and offline app-shell support.

The supplied screenshots guided the page layout and colors. Illustrations are built as simple scalable drawings in the frontend, so the screen arrangement follows the references while the original screenshots themselves are not used as page backgrounds.
