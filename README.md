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
│   │   ├── controllers/        # Request handlers (business logic)
│   │   ├── models/             # Database models (CRUD operations)
│   │   ├── schemas/            # Zod validation schemas
│   │   ├── routes/             # API route definitions
│   │   ├── middleware/         # Express middleware (auth, error handling)
│   │   ├── db/                 # Database config, migrations, seed
│   │   │   ├── migrations/     # SQL migration files
│   │   │   ├── pool.ts         # PostgreSQL connection pool
│   │   │   ├── migrate.ts      # Migration runner
│   │   │   └── seed.ts         # Seed default data
│   │   └── services/           # Shared utilities
│   │       ├── ai/             # AI integration services
│   │       ├── parser/         # CSV parsing (PDF → pdf-service)
│   │       ├── categorizer.ts  # Keyword-based categorization
│   │       ├── dedup.ts        # SHA256 deduplication
│   │       ├── encryption.ts   # AES-256-GCM for API keys
│   │       ├── normalizer.ts   # Transaction normalization
│   │       └── snapshotBuilder.ts # Monthly aggregation
│   └── package.json
│
├── pdf-service/                # Python PDF microservice
│   ├── banks/                  # Bank-specific parsers
│   ├── main.py                 # FastAPI application
│   ├── parser.py               # PDF parsing orchestration
│   └── requirements.txt
│
├── db-migrations/              # Database migration service
│   ├── src/db/                 # Migration runner & seed script
│   ├── Dockerfile              # Container build
│   └── package.json
│
├── .env.example                # Root environment variables template
├── docker-compose.yml          # PostgreSQL + pgAdmin + PDF service + db-migrate
├── pnpm-workspace.yaml         # pnpm workspace configuration
├── package.json                # Root package.json (workspace scripts)
├── README.md                   # This file
├── scope.md                    # Project scope document
├── requirements.md             # Requirements specification
└── todo.md                     # Implementation task list
```

## Architecture

### Server Layering

The backend follows a clean layered architecture:

```
Request → Route → Controller → Model → Database
                    ↓
                 Schema (validation)
```

- **Routes** — Define HTTP endpoints and middleware, delegate to controllers
- **Controllers** — Handle request/response lifecycle, validate input with schemas
- **Models** — Encapsulate database operations and business logic
- **Schemas** — Zod validation schemas for all API inputs

### PDF Import Pipeline

```
User uploads PDF → importController → POST to pdf-service → ParsedRow[]
                       ↓
               normalizeRows() → filterDuplicates() → categorizeTransactions()
                       ↓
               storeJob() → return jobId → Client previews & confirms import
```

All PDF parsing (structured parsing, AI fallback, bank detection) is handled entirely by the **Python pdf-service**. The Node.js server acts as a lightweight proxy.

### Data Import Pipeline (CSV)

```
CSV Upload → Parser → Normalizer → Dedup (SHA256) → Categorizer → Bulk INSERT
                                                              ↓
                                                         AI Enrichment (optional)
```

### Auto-Categorization

1. **Pass 1**: User-defined rules (priority-based)
2. **Pass 2**: System default keywords
3. **Pass 3**: AI suggestions (if enabled)

Re-categorizing a transaction creates a new user rule for future imports.

### Monthly Snapshots

Pre-aggregated data for dashboard performance. Updated on transaction changes (insert/update/delete). Stores: `total_income`, `total_expense`, `by_category` (JSONB).

## API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login user |
| POST | `/api/auth/refresh` | Refresh access token |
| DELETE | `/api/auth/logout` | Logout user |

### Transactions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/transactions` | List transactions (filters: date, category, type, search) |
| POST | `/api/transactions` | Create transaction |
| PATCH | `/api/transactions/:id` | Update transaction |
| DELETE | `/api/transactions/:id` | Delete transaction |

### Import
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/import/csv` | Upload CSV file |
| POST | `/api/import/csv/confirm/:jobId` | Confirm import |
| POST | `/api/import/pdf` | Upload PDF file |
| POST | `/api/import/pdf/confirm/:jobId` | Confirm PDF import |
| POST | `/api/import/enrich/:jobId` | AI enrichment for pending import |

### Budgets
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/budgets` | List budgets |
| POST | `/api/budgets` | Create budget |
| PATCH | `/api/budgets/:id` | Update budget |
| DELETE | `/api/budgets/:id` | Delete budget |

### Categories
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/categories` | List categories |
| POST | `/api/categories` | Create category |
| PATCH | `/api/categories/:id` | Update category |
| DELETE | `/api/categories/:id` | Delete category |

### Reports
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/monthly` | Monthly summary |
| GET | `/api/reports/category-breakdown` | Category spending breakdown |
| GET | `/api/reports/trends` | Monthly trends |

### AI Settings
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/settings/ai` | Get AI config (key masked) |
| POST | `/api/settings/ai` | Save/update AI config |
| DELETE | `/api/settings/ai` | Clear AI config |
| POST | `/api/settings/ai/test` | Test connection |

## Supported Bank Formats

### CSV Import
| Bank | Date Format | Amount Columns | Header Row |
|------|-------------|----------------|------------|
| SBI | DD/MM/YYYY | Debit / Credit | Row 1 |
| HDFC | DD/MM/YYYY | Withdrawal Amt. / Deposit Amt. | Row 22 |
| ICICI | DD/MM/YYYY | Debit / Credit | Row 1 |
| Axis | DD/MM/YYYY | Credit / Debit (reversed) | Row 1 |

### PDF Import
Text-based PDFs are parsed by the Python pdf-service using `pdfplumber`. Scanned PDFs support optional OCR via PaddleOCR (opt-in via `ENABLE_OCR` environment variable).

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

## Security Features

- Password hashing with bcrypt (cost factor 10)
- JWT access tokens: 15 min expiry (stored in memory)
- Refresh tokens: 7 days expiry (httpOnly cookie)
- Row-Level Security (RLS) in PostgreSQL
- CORS with configured allowed origins
- Rate limiting: 100 requests per 15 minutes
- Input validation with Zod schemas
- Parameterized SQL queries (SQL injection prevention)
- AES-256-GCM encryption for stored AI API keys

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
