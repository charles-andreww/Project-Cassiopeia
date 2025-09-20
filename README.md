# Project Cassiopeia

**Project Cassiopeia** is a modern AI assistant web application built with React, Vite, TypeScript, and TailwindCSS. It integrates with Google Generative AI and Supabase, providing a fast, extensible, and user-friendly experience.

## Table of Contents

- [Features](#features)
- [Tools](#tools)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Available Scripts](#available-scripts)
- [Project Structure](#project-structure)
- [Linting & Formatting](#linting--formatting)
- [License](#license)

---

## Features

- AI assistant powered by Google Generative AI (`@google/genai` and `@google/generative-ai`)
- Wide range of supporting tools
- User authentication (Google)
- Markdown support with GFM (`react-markdown`, `remark-gfm`)
- Real-time backend with Supabase
- Responsive modern UI with TailwindCSS and Lucide icons
- Routing with React Router
- Typescript-first development
- Realtime Audio I/O conversations with Cassie Vision mode

---

## Tools

- Connection with Google Services; `Gmail`, `Google Calendar`, `Google Sheets`, `Google Docs`, `Drive`, `Google Meet` and `Tasks`
- Search via `grounding with Google search`
- Directions with `TomTom`
- Memory integration with `Supabase`
  

---
## Tech Stack

- **Frontend:** [React](https://reactjs.org/) + [Vite](https://vitejs.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **UI:** [TailwindCSS](https://tailwindcss.com/), [Lucide React](https://lucide.dev/), [React Markdown](https://github.com/remarkjs/react-markdown)
- **AI:** [@google/genai](https://www.npmjs.com/package/@google/genai), [@google/generative-ai](https://www.npmjs.com/package/@google/generative-ai)
- **Backend:** [Supabase](https://supabase.com/)
- **Auth:** Google Identity Services
- **Tooling:** [ESLint](https://eslint.org/), [Typescript ESLint](https://typescript-eslint.io/)

---

## Getting Started

### Prerequisites

- Node.js (v20+ recommended)
- npm or yarn

### Installation

1. **Clone the repository:**
   ```sh
   git clone https://github.com/charles-andreww/Project-Cassiopeia.git
   cd Project-Cassiopeia/Project\ Cassiopeia
   ```

2. **Install dependencies:**
   ```sh
   npm install
   # or
   yarn install
   ```

3. **Environment Setup:**
   - Add your configuration in `.env` or as required by Supabase/Google APIs.

4. **Start the development server:**
   ```sh
   npm run dev
   # or
   yarn dev
   ```

5. **Open [http://localhost:5173](http://localhost:5173) (default) in your browser.**

---

## Available Scripts

- `dev`: Runs the Vite dev server.
- `build`: Builds the project for production.
- `preview`: Serves the production build.
- `lint`: Runs ESLint across the project.

---

## Project Structure

```
Project Cassiopeia/
├── public/                # Static assets, manifest, icons, etc.
├── src/
│   ├── auth/              # Authentication logic/components
│   ├── components/        # React UI components
│   └── ...                # Main app logic, routes, etc.
├── index.html             # Main HTML entry point
├── package.json           # Project metadata & scripts
├── eslint.config.js       # ESLint configuration
├── tailwind.config.js     # TailwindCSS configuration (if present)
├── tsconfig.json          # TypeScript configuration (if present)
└── ...                    # Other configs, lock files, etc.
```

---

## Linting & Formatting

- **ESLint** is configured for JS/TS and React, including React Hooks and Vite refresh plugin.
- Run `npm run lint` before committing for consistent code style.

---

## License

MIT License (or specify your license here)

---

## Acknowledgments

- [Vite](https://vitejs.dev/)
- [React](https://reactjs.org/)
- [TailwindCSS](https://tailwindcss.com/)
- [Supabase](https://supabase.com/)
- [Google Generative AI](https://ai.google.dev/)

---

> _Feel free to open issues or contribute!_
