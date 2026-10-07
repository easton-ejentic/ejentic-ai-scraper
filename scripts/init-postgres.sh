#!/bin/bash

# Initialize PostgreSQL database for Ejentic AI
# This script sets up the PostgreSQL database and optionally migrates data from JSON storage
#
# Prerequisites:
#   - PostgreSQL 17+ running and accessible via DATABASE_URL
#   - Node.js 20+ installed
#   - Prisma CLI: npm install -g @prisma/cli (or use npx)
#
# Environment variables:
#   DATABASE_URL=postgresql://user:password@localhost:5432/ejentic
#   REDIS_URL=redis://localhost:6379 (optional, for production queue)

set -e

echo "Ejentic AI PostgreSQL Initialization"
echo "======================================"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "ERROR: DATABASE_URL environment variable not set"
    echo "Example: export DATABASE_URL='postgresql://user:password@localhost:5432/ejentic'"
    exit 1
fi

echo "DATABASE_URL: $DATABASE_URL"
echo ""

# Run Prisma migrations
echo "Step 1: Running Prisma migrations..."
npx prisma migrate deploy

# Generate Prisma client
echo ""
echo "Step 2: Generating Prisma client..."
npx prisma generate

# Optional: Seed data from JSON if available
if [ -f ".data/scraper.json" ]; then
    echo ""
    echo "Step 3: Found existing .data/scraper.json - running seed script..."
    node scripts/seed-from-json.mjs
else
    echo ""
    echo "Step 3: No .data/scraper.json found - skipping data migration"
fi

echo ""
echo "✓ PostgreSQL initialization complete!"
echo ""
echo "Next steps:"
echo "  1. Update your API routes to import { getRepository } from '@/lib/production/repository'"
echo "  2. Set DATABASE_URL in your .env or deployment configuration"
echo "  3. Run the application with: npm run dev"
echo ""
echo "To connect to the database directly:"
echo "  psql \$DATABASE_URL"
