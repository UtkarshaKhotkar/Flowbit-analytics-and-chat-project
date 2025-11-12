# Database Setup Guide

This guide will help you set up the PostgreSQL database for the Flowbit API.

## Prerequisites

1. **PostgreSQL Database**: You need a PostgreSQL database running (version 14 or higher)
   - Option A: Use Docker Compose (recommended for development)
   - Option B: Use a local PostgreSQL installation
   - Option C: Use a cloud PostgreSQL service (for production)

2. **Node.js**: Node.js 18+ and npm/pnpm installed

3. **Environment Variables**: Create a `.env` file from `env.example`

## Setup Steps

### 1. Start PostgreSQL Database

#### Option A: Using Docker Compose (Recommended)

From the project root:

```bash
docker-compose up -d
```

This will start PostgreSQL with:
- Host: `localhost`
- Port: `5432`
- Database: `flowbit_db`
- User: `flowbit_user`
- Password: `flowbit_password`

Connection string: `postgresql://flowbit_user:flowbit_password@localhost:5432/flowbit_db?schema=public`

#### Option B: Local PostgreSQL

Create a database:

```bash
createdb flowbit_db
# or using psql
psql -c "CREATE DATABASE flowbit_db;"
```

Update the `DATABASE_URL` in `.env` with your PostgreSQL credentials.

#### Option C: Cloud PostgreSQL (Production)

Use a managed PostgreSQL service (e.g., Vercel Postgres, Supabase, AWS RDS) and update the `DATABASE_URL` in `.env`.

### 2. Configure Environment Variables

Create a `.env` file in `apps/api`:

```bash
cp env.example .env
```

Update the `DATABASE_URL` if needed:

```env
DATABASE_URL="postgresql://flowbit_user:flowbit_password@localhost:5432/flowbit_db?schema=public"
PORT=3001
VANNA_API_BASE_URL=http://localhost:8000
VANNA_API_KEY=
```

### 3. Install Dependencies

```bash
cd apps/api
npm install
```

### 4. Generate Prisma Client

```bash
npm run db:generate
```

This generates the Prisma Client based on the schema.

### 5. Run Database Migrations

```bash
npm run db:migrate
```

This creates the database tables based on the Prisma schema:
- `vendors` - Vendor information
- `customers` - Customer information
- `invoices` - Invoice records
- `line_items` - Invoice line items
- `payments` - Payment records

### 6. Seed Database with Test Data

```bash
npm run db:seed
```

This reads data from `data/Analytics_Test_Data.json` and populates the database with:
- Vendors
- Customers
- Invoices
- Line items
- Payments

### 7. Verify Setup

Start the API server:

```bash
npm run dev
```

The API should start on `http://localhost:3001`.

Test the API endpoints:

```bash
# Health check
curl http://localhost:3001/health

# Get stats
curl http://localhost:3001/api/stats

# Get invoices
curl http://localhost:3001/api/invoices
```

## Database Schema

### Tables

1. **vendors**
   - `id` (UUID, Primary Key)
   - `vendor_id` (String, Unique)
   - `name` (String)
   - `category` (String)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

2. **customers**
   - `id` (UUID, Primary Key)
   - `customer_id` (String, Unique)
   - `name` (String)
   - `email` (String)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

3. **invoices**
   - `id` (UUID, Primary Key)
   - `invoice_id` (String, Unique)
   - `vendor_id` (String, Foreign Key → vendors.vendor_id)
   - `customer_id` (String, Foreign Key → customers.customer_id)
   - `invoice_date` (Date)
   - `due_date` (Date)
   - `total_amount` (Decimal)
   - `status` (String: paid, pending, overdue)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

4. **line_items**
   - `id` (UUID, Primary Key)
   - `item_id` (String, Unique)
   - `invoice_id` (UUID, Foreign Key → invoices.id)
   - `description` (String)
   - `quantity` (Integer)
   - `unit_price` (Decimal)
   - `total` (Decimal)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

5. **payments**
   - `id` (UUID, Primary Key)
   - `payment_id` (String, Unique)
   - `invoice_id` (UUID, Foreign Key → invoices.id)
   - `payment_date` (Date)
   - `amount` (Decimal)
   - `method` (String: bank_transfer, credit_card, etc.)
   - `created_at` (Timestamp)
   - `updated_at` (Timestamp)

### Relationships

- **vendors** → **invoices** (One-to-Many)
  - One vendor can have many invoices
  - Foreign key: `invoices.vendor_id` → `vendors.vendor_id`

- **customers** → **invoices** (One-to-Many)
  - One customer can have many invoices
  - Foreign key: `invoices.customer_id` → `customers.customer_id`

- **invoices** → **line_items** (One-to-Many)
  - One invoice can have many line items
  - Foreign key: `line_items.invoice_id` → `invoices.id`

- **invoices** → **payments** (One-to-Many)
  - One invoice can have many payments
  - Foreign key: `payments.invoice_id` → `invoices.id`

### Constraints

- All foreign keys have `ON DELETE CASCADE` to maintain referential integrity
- Unique constraints on `vendor_id`, `customer_id`, `invoice_id`, `item_id`, and `payment_id`
- Decimal fields use `DECIMAL(12, 2)` for precise currency storage
- Indexes on foreign keys and frequently queried fields

## Quick Setup Script

You can use the setup script to automate the setup process:

### Linux/macOS:

```bash
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

### Windows:

```bash
scripts\setup-database.bat
```

## Troubleshooting

### Database Connection Issues

1. **Check if PostgreSQL is running:**
   ```bash
   docker-compose ps
   # or
   pg_isready
   ```

2. **Verify DATABASE_URL in .env:**
   ```bash
   echo $DATABASE_URL
   ```

3. **Test database connection:**
   ```bash
   psql $DATABASE_URL
   ```

### Migration Issues

1. **Reset database (WARNING: This will delete all data):**
   ```bash
   npx prisma migrate reset
   ```

2. **Create a new migration:**
   ```bash
   npx prisma migrate dev --name your_migration_name
   ```

### Seed Issues

1. **Check if JSON file exists:**
   ```bash
   ls -la ../../data/Analytics_Test_Data.json
   ```

2. **Verify JSON file format:**
   ```bash
   cat ../../data/Analytics_Test_Data.json | jq .
   ```

3. **Run seed manually:**
   ```bash
   npm run db:seed
   ```

## API Endpoints

Once the database is set up, the following API endpoints are available:

- `GET /health` - Health check
- `GET /api/stats` - Dashboard statistics
- `GET /api/invoice-trends` - Monthly invoice trends
- `GET /api/vendors/top10` - Top 10 vendors by spend
- `GET /api/category-spend` - Spend by category
- `GET /api/cash-outflow` - Cash outflow forecast
- `GET /api/invoices` - Paginated invoices with search
- `GET /api/invoices/:id` - Invoice details
- `POST /api/chat-with-data` - Natural language query to SQL

## Data Ingestion

The seed script reads data from `data/Analytics_Test_Data.json` and:
1. Extracts unique vendors and customers
2. Creates vendors and customers in the database
3. Creates invoices with line items and payments
4. Maintains referential integrity

The JSON file contains nested structures (vendor, customer, payment, line items) that are normalized into relational tables.

## Next Steps

1. Start the API server: `npm run dev`
2. Start the frontend: `cd ../web && npm run dev`
3. Start Vanna AI: `cd ../vanna && python main.py`

For more information, see the main [README.md](../../README.md).

