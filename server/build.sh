#!/usr/bin/env bash
# Exit on error
set -o errexit

# --- LOAD ENV FILE (Only if it exists) ---
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Step 1: Install all Python and Node.js dependencies.
echo "Installing Python and Node.js dependencies..."
pip install --no-cache-dir -r requirements.txt
npm install

# Step 2: Check for the one-time reset flag.
if [[ "$RUN_DB_RESET_ONCE" == "true" ]]; then
  # --- ONE-TIME SEEDING PATH ---
  echo "--- ONE-TIME DATABASE RESET & SEED INITIATED ---"
  
  # 1. Wipe the database and apply schema from migrations.
  echo "Resetting the database to apply the latest schema..."
  npx prisma migrate reset --force
  
  # 2. Execute the seed.sql file to populate the database.
  echo "Seeding the database from server/prisma/seed.sql..."
  psql $DATABASE_URL -f prisma/seed.sql
  
  echo "--- ONE-TIME SEEDING PROCESS COMPLETE. REMEMBER TO UNSET THE ENV VARIABLE. ---"
else
  # --- STANDARD DEPLOYMENT PATH ---
  echo "--- STANDARD DEPLOYMENT ---"
  
  # Safely apply any new database migrations without deleting data.
  echo "Applying database migrations..."
  npx prisma migrate deploy
  
  echo "--- STANDARD DEPLOYMENT COMPLETE ---"
fi

# Step 3: Explicitly generate the Prisma Client for Python.
# THIS IS THE FIX. It ensures the client code is always available.
echo "Generating Prisma Client for Python..."
npx prisma generate

echo "✅ Build finished successfully!"
