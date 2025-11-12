@echo off
REM Database Setup Script for Flowbit API (Windows)
REM This script sets up the PostgreSQL database, runs migrations, and seeds data

echo 🚀 Starting database setup...

REM Check if .env file exists
if not exist .env (
    echo ❌ Error: .env file not found!
    echo Please create .env file from env.example:
    echo   copy env.example .env
    exit /b 1
)

echo 📦 Installing dependencies...
call npm install

echo 🔧 Generating Prisma client...
call npx prisma generate

echo 🗄️  Running database migrations...
call npx prisma migrate dev --name init

echo 🌱 Seeding database with test data...
call npm run db:seed

echo ✅ Database setup completed successfully!
echo.
echo You can now start the API server with:
echo   npm run dev

