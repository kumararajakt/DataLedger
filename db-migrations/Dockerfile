# Database Migration Service Dockerfile
# Runs migrations and seeds then exits

FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY db-migrations/package.json ./package.json

# Install dependencies (pg and dotenv only)
RUN npm install pg dotenv

# Copy migration files and source
COPY server/src/db ./src/db

# Copy tsconfig
COPY db-migrations/tsconfig.json ./tsconfig.json

# Build
RUN npx tsc && cp -r src/db/migrations dist/db/

# Default command runs migrations then exits
CMD ["node", "dist/db/migrate.js"]
