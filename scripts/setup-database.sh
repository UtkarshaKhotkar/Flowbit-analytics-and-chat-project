#!/bin/bash

# Database Setup Script for Flowbit API
# This script sets up the PostgreSQL database, runs migrations, and seeds data

set -e

echo "🚀 Starting database setup..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create .env file from env.example:"
    echo "  cp env.example .env"
    exit 1
fi

# Load environment variables
source .env

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env file"
    exit 1
fi

echo "📦 Installing dependencies..."
npm install

echo "🔧 Generating Prisma client..."
npx prisma generate

echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo "🌱 Seeding database with test data..."
npm run db:seed

echo "✅ Database setup completed successfully!"
echo ""
echo "You can now start the API server with:"
echo "  npm run dev"

