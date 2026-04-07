# Personal Finance Tracker

A comprehensive personal finance tracking application built with React, Node.js, and PostgreSQL. Import bank statements, automatically categorize transactions, set budgets, and visualize your spending patterns.

![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20PostgreSQL-blue)
![Monorepo](https://img.shields.io/badge/monorepo-pnpm-green)

## Features

- **Bank Statement Import** — Upload CSV/PDF statements from SBI, HDFC, ICICI, and Axis banks
- **Auto-Categorization** — Intelligent transaction categorization with learning from corrections
- **Dashboard** — Visual insights with spending charts and monthly trends
- **Budget Tracking** — Set and monitor category-wise budgets
- **Transaction Management** — Manual entry, editing, and filtering
- **Secure Authentication** — JWT-based auth with access/refresh tokens
- **AI Integration** — Optional AI-powered enrichment with your own API keys (Claude, OpenAI, etc.)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| State Management | Zustand (client) + React Query (server) |
| Charts | Recharts |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL 14+ |
| Authentication | JWT (access + refresh tokens) |
| PDF Service | Python FastAPI + pdfplumber |
| Package Manager | pnpm workspaces (monorepo) |
| DevOps | Docker Compose (local services) |

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+ (`npm install -g pnpm`)
- **Container runtime** (choose one):
  - **Docker** and Docker Compose
  - **Podman** and podman-compose (see [MONOREPO.md](MONOREPO.md#using-podman))
- Python 3.10+ (optional, for local PDF service development)

### Monorepo Structure

This project is organized as a pnpm workspace monorepo:

```
personal-finance-tracker/
├── client/                 # React frontend (workspace package)
├── server/                 # Node.js backend (workspace package)
├── pdf-service/            # Python PDF microservice (workspace package)
├── pnpm-workspace.yaml     # Workspace configuration
├── package.json            # Root workspace config + scripts
└── docker-compose.yml      # Infrastructure services
```

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd personal-finance-tracker
   ```

2. **Install all dependencies** (single command for entire monorepo)
   ```bash
   pnpm install
   ```

3. **Start PostgreSQL and PDF Service with Docker**
   ```bash
   pnpm run docker:up
   ```

4. **Set up environment variables**
   ```bash
   # Copy root .env.example to .env (contains all service configs)
   cp .env.example .env
   
   # Or copy individual service files
   cp server/.env.example server/.env
   cp client/.env.example client/.env
   ```

5. **Run database migrations and seed data**
   ```bash
   pnpm run db:migrate
   pnpm run db:seed
   ```

6. **Start all development servers** (single command)
   ```bash
   pnpm run dev
   ```
   
   Or start individual services:
   ```bash
   pnpm run dev:client   # Frontend only
   pnpm run dev:server   # Backend only
   pnpm run dev:pdf      # PDF service only
   ```

7. **Open the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3001
   - PDF Service: http://localhost:5001

## Development Commands

### Root Commands (run from project root)

```bash
# Install dependencies for all packages
pnpm install

# Start all services in parallel
pnpm run dev

# Build all packages
pnpm run build

# Run database migrations
pnpm run db:migrate

# Seed default categories
pnpm run db:seed

# Docker commands
pnpm run docker:up         # Start PostgreSQL + PDF service
pnpm run docker:down       # Stop all services
pnpm run docker:logs       # View service logs

# Clean all packages
pnpm run clean
```

### Package-Specific Commands

```bash
# Frontend only
pnpm --filter finance-tracker-client run dev
pnpm --filter finance-tracker-client run build

# Backend only
pnpm --filter finance-tracker-server run dev
pnpm --filter finance-tracker-server run db:migrate

# PDF service only
pnpm --filter pdf-service run dev
```

## Project Structure

```
personal-finance-tracker/
├── client/                     # React frontend (Vite)
│   ├── src/
│   │   ├── api/                # API client + React Query hooks
│   │   ├── components/         # Reusable UI components
│   │   ├── hooks/              # Custom React hooks
│   │   ├── pages/              # Page components
│   │   ├── store/              # Zustand stores
│   │   └── types/              # TypeScript types
│   └── package.json
│
├── server/                     # Node.js backend (Express)
│   ├── src/
│   │   ├── db/                 # Database config + migrations
│   │   ├── middleware/         # Express middleware
│   │   ├── routes/             # API route handlers
│   │   ├── services/           # Business logic
│   │   │   ├── ai/             # AI integration services
│   │   │   └── parser/         # CSV/PDF parsing
│   │   └── index.ts            # Entry point
│   └── package.json
│
├── pdf-service/                # Python PDF microservice
│   ├── banks/                  # Bank-specific parsers
│   ├── main.py                 # FastAPI application
│   ├── parser.py               # PDF parsing orchestration
│   └── requirements.txt
│
├── .env.example                # Root environment variables template
├── docker-compose.yml          # PostgreSQL + pgAdmin + PDF service
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── package.json                # Root package.json (workspace scripts)
├── README.md                   # This file
├── scope.md                    # Project scope document
├── requirements.md             # Requirements specification
└── todo.md                     # Implementation task list
```

## API Endpoints

### Authentication
- `POST /api/auth/register` — Register new user
- `POST /api/auth/login` — Login user
- `POST /api/auth/refresh` — Refresh access token
- `DELETE /api/auth/logout` — Logout user

### Transactions
- `GET /api/transactions` — List transactions
- `POST /api/transactions` — Create transaction
- `PATCH /api/transactions/:id` — Update transaction
- `DELETE /api/transactions/:id` — Delete transaction

### Import
- `POST /api/import/csv` — Upload CSV file
- `GET /api/import/preview/:jobId` — Get import preview

### Budgets
- `GET /api/budgets` — List budgets
- `POST /api/budgets` — Create budget
- `PATCH /api/budgets/:id` — Update budget
- `DELETE /api/budgets/:id` — Delete budget

### Categories
- `GET /api/categories` — List categories
- `POST /api/categories` — Create category
- `PATCH /api/categories/:id` — Update category
- `DELETE /api/categories/:id` — Delete category

### Reports
- `GET /api/reports/monthly` — Monthly summary
- `GET /api/reports/category-breakdown` — Category spending
- `GET /api/reports/trends` — Monthly trends

## Supported Bank Formats

| Bank | Date Format | Amount Columns | Header Row |
|------|-------------|----------------|------------|
| SBI | DD/MM/YYYY | Debit / Credit | Row 1 |
| HDFC | DD/MM/YYYY | Withdrawal Amt. / Deposit Amt. | Row 22 |
| ICICI | DD/MM/YYYY | Debit / Credit | Row 1 |
| Axis | DD/MM/YYYY | Credit / Debit (reversed) | Row 1 |

## Environment Variables

### Server (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finance_tracker
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
PORT=3001
NODE_ENV=development
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3001
```

## Development Commands

### Backend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run db:migrate   # Run database migrations
npm run db:seed      # Seed default data
```

### Frontend
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run preview      # Preview production build
```

## Testing

Automated tests are planned for Phase 11 (see `todo.md`). Until then, use manual testing:

```bash
# Backend — run API tests with Postman or similar
# Test coverage: auth flow, transaction CRUD, import pipeline, budget CRUD

# Frontend — manual browser testing
# Test coverage: login/logout, import flow, dashboard rendering, responsive design
```

See `todo.md` Phase 11 for the full manual test checklist.

## Security Features

- Password hashing with bcrypt (cost factor 10)
- JWT authentication with short-lived access tokens
- Refresh tokens in httpOnly cookies
- Row-Level Security (RLS) in PostgreSQL
- CORS with configured allowed origins
- Rate limiting on API endpoints
- Input validation and sanitization
- Parameterized SQL queries (SQL injection prevention)

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — feel free to use this project for learning or personal use.

## Acknowledgments

Built as a portfolio project demonstrating full-stack development skills with modern web technologies.
