# Database Migration Service

Handles database migrations and seeding for the Personal Finance Tracker application.

## Usage

### Development

```bash
# Install dependencies
pnpm install

# Run migrations
pnpm run migrate

# Seed default data
pnpm run seed
```

### Docker

```bash
# Build the image
docker build -t db-migrate-service -f db-migrate-service/Dockerfile .

# Run migrations
docker run --env-file .env db-migrate-service
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/finance_tracker` |

## Migrations

Migrations are located in `server/src/db/migrations/` and run in alphabetical order.

Each migration is a SQL file that runs within a transaction. If any statement fails, the entire migration rolls back.

## Seeding

The seed script (`seed.ts`) inserts:
- System categories (Food, Transport, Shopping, etc.)
- Default categorization rules

The seed script is idempotent (safe to run multiple times) using `ON CONFLICT` clauses.
