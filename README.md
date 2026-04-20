# Personal Finance Tracker

A comprehensive personal finance tracking application built with React, Node.js, and PostgreSQL. Import bank statements, automatically categorize transactions, set budgets, and visualize your spending patterns.

![Tech Stack](https://img.shields.io/badge/stack-React%20%7C%20Node.js%20%7C%20PostgreSQL-blue)
![Monorepo](https://img.shields.io/badge/monorepo-pnpm-green)

## Features

- **Bank Statement Import** — Upload CSV/PDF statements from SBI, HDFC, ICICI, and Axis banks
- **Auto-Categorization** — Intelligent transaction categorization with keyword-based rules
- **Dashboard** — Visual insights with spending charts and monthly trends
- **Budget Tracking** — Set and monitor category-wise budgets with progress indicators
- **Transaction Management** — Manual entry, editing, filtering, and search
- **Secure Authentication** — JWT-based auth with access/refresh token flow
- **AI Integration** — Optional AI-powered import enrichment with your own API keys (Claude, OpenAI, OpenRouter, Ollama)



## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+ (`npm install -g pnpm`)
- **Container runtime** (choose one):
  - **Docker** and Docker Compose
  - **Podman** and podman-compose (see [MONOREPO.md](MONOREPO.md#using-podman))

### Monorepo Structure

```
personal-finance-tracker/
├── client/                 # React frontend (workspace package)
├── server/                 # Node.js backend (workspace package)
├── pdf-service/            # Python PDF microservice (workspace package)
├── db-migrations/          # Database migration & seeding service (workspace package)
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
   pnpm run compose:up
   ```

4. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env and update secrets as needed
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
pnpm install              # Install all dependencies
pnpm run dev              # Start all services in parallel
pnpm run build            # Build all packages
pnpm run db:migrate       # Run database migrations
pnpm run db:seed          # Seed default categories
pnpm run compose:up       # Start infrastructure
pnpm run compose:down     # Stop all services
pnpm run compose:logs     # View service logs
pnpm run clean            # Clean all packages
```

### Package-Specific Commands

```bash
# Frontend only
pnpm --filter finance-tracker-client run dev
pnpm --filter finance-tracker-client run build

# Backend only
pnpm --filter finance-tracker-server run dev
pnpm --filter finance-tracker-server run build

# PDF service only
pnpm --filter pdf-service run dev

# Database migrations
pnpm --filter db-migrations run migrate
pnpm --filter db-migrations run seed
pnpm --filter db-migrations run build
```

## Environment Variables

### Server (.env)
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/finance_tracker
JWT_ACCESS_SECRET=change_this_access_secret_min_32_chars
JWT_REFRESH_SECRET=change_this_refresh_secret_min_32_chars
PORT=3001
NODE_ENV=development
CLIENT_URL=http://localhost:5173
AI_ENCRYPTION_KEY=change_this_to_a_64_char_hex_string
PDF_SERVICE_URL=http://localhost:5001
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3001
```

### PDF Service (.env)
```env
ENABLE_OCR=false
LOG_LEVEL=INFO
```

## Database Schema

### Tables
- **users**: `id`, `email`, `password_hash`, `created_at`
- **categories**: `id`, `user_id`, `name`, `color`, `icon`, `is_system`
- **transactions**: `id`, `user_id`, `category_id`, `date`, `description`, `amount`, `type`, `source`, `hash`, `raw_data`, `notes`, `created_at`
- **budgets**: `id`, `user_id`, `category_id`, `month`, `amount`
- **categorization_rules**: `id`, `user_id`, `keyword`, `category_id`, `priority`
- **monthly_snapshots**: `id`, `user_id`, `month`, `total_income`, `total_expense`, `by_category`
- **user_ai_settings**: `user_id`, `enabled`, `provider`, `base_url`, `api_key` (encrypted), `model`, `updated_at`

### Key Features
- Row-Level Security (RLS) enabled on transactions table
- UUID primary keys throughout
- ON DELETE CASCADE for user-dependent data
- Indexes on frequently queried columns (user_id, date, hash)

## Docker Compose

The `docker-compose.yml` defines the following services:

| Service | Description | Port |
|---------|-------------|------|
| `postgres` | PostgreSQL 14 database | 5432 |
| `pgadmin` | pgAdmin web interface | 5050 |
| `pdf-service` | Python PDF microservice | 5001 |
| `db-migrate` | Runs migrations then exits | — |
| `server` | Node.js backend API | 3001 |
| `client` | React frontend (nginx) | 8080 |

```bash
pnpm run compose:up              # Start all services
pnpm run compose:down            # Stop all services
pnpm run compose:logs            # View all logs
pnpm run compose:ps              # List running services
```


## Testing

Automated tests are planned for Phase 12 (see `todo.md`). Until then, use manual testing:

```bash
# Backend — test API endpoints with Postman or similar
# Frontend — manual browser testing
```

See `todo.md` for the full test checklist.

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — feel free to use this project for learning or personal use.
