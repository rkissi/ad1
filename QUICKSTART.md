# 🚀 Quick Start Guide
## Get Your Backend Running in 10 Minutes

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL 15+ installed
- Git installed

---

## Step 1: Install PostgreSQL

### macOS
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Ubuntu/Debian
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
Download from: https://www.postgresql.org/download/windows/

---

## Step 2: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Run these commands:
CREATE DATABASE metaverse_ads;
CREATE USER metaverse_user WITH ENCRYPTED PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE metaverse_ads TO metaverse_user;
\q
```

---

## Step 3: Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values
nano .env
```

**Update these values in .env:**
```bash
DB_PASSWORD=your_password_here
JWT_SECRET=your_random_32_char_secret_here
ENCRYPTION_KEY=your_random_32_char_key_here
```

---

## Step 4: Initialize Database

```bash
# Run the SQL initialization script
psql -U metaverse_user -d metaverse_ads -f init-db.sql

# You should see:
# CREATE TABLE
# CREATE INDEX
# INSERT 0 3
```

---

## Step 5: Install Dependencies

```bash
npm install
```

---

## Step 6: Start Backend Server

```bash
# Development mode with auto-reload
npm run api:dev

# You should see:
# 🚀 API Server running on port 3001
# ✅ Connected to PostgreSQL database
```

---

## Step 7: Test API

Open a new terminal and run:

```bash
# Health check
curl http://localhost:3001/health

# Should return:
# {"status":"healthy","timestamp":"..."}
```

---

## Step 8: Test Authentication

```bash
# Register a new user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User",
    "role": "user"
  }'

# Should return:
# {"success":true,"data":{"user":{...},"token":"..."}}
```

---

## Step 9: Connect Frontend

Update your `.env` file:
```bash
VITE_USE_REAL_API=true
VITE_API_URL=http://localhost:3001/api/v1
```

Restart frontend:
```bash
npm run dev
```

---

## Step 10: Test Full Flow

1. Open browser: http://localhost:5173
2. Click "Sign Up"
3. Create account
4. You should be redirected to dashboard
5. ✅ Success! Backend is working!

---

## 🐳 Alternative: Docker Quick Start

If you prefer Docker:

```bash
# Set required environment variables
export DB_PASSWORD=secure_password
export REDIS_PASSWORD=redis_password
export JWT_SECRET=your_jwt_secret_32_chars
export ENCRYPTION_KEY=your_encryption_key_32

# Start all services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f api
```

---

## 🔧 Troubleshooting

### Database Connection Failed
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check credentials
psql -U metaverse_user -d metaverse_ads -c "SELECT 1"
```

### Port Already in Use
```bash
# Find process using port 3001
lsof -i :3001

# Kill the process
kill -9 <PID>
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules
npm install
```

---

## 📚 Available Scripts

```bash
# Backend
npm run api:dev          # Start API in development mode
npm run api:build        # Build API for production
npm run api:start        # Start production API

# Frontend
npm run dev              # Start frontend dev server
npm run build            # Build frontend for production

# Database
npm run db:setup         # Initialize database
npm run db:migrate       # Run migrations
npm run db:reset         # Reset database

# Docker
npm run docker:up        # Start all services
npm run docker:down      # Stop all services
npm run docker:logs      # View logs

# Testing
npm test                 # Run tests
npm run test:coverage    # Run with coverage

# Full Stack
npm run start:all        # Start both API and frontend
```

---

## 🎯 Next Steps

1. ✅ Backend running
2. ✅ Frontend connected
3. ⏳ Deploy smart contracts (see BACKEND_SETUP.md)
4. ⏳ Set up monitoring (see IMPLEMENTATION_ROADMAP.md)
5. ⏳ Configure production (see PRODUCTION_DEPLOYMENT.md)

---

## 🆘 Need Help?

- Check logs: `npm run api:dev`
- Test health: `curl http://localhost:3001/health`
- Verify database: `psql -U metaverse_user -d metaverse_ads`
- Review docs: `BACKEND_SETUP.md`

---

**Estimated Time**: 10-15 minutes  
**Difficulty**: Beginner  
**Status**: ✅ Ready to use