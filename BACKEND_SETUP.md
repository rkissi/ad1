# 🚀 Backend Implementation Guide

## ✅ Phase 1: Backend Foundation (COMPLETED)

### What We've Built:

1. **API Server** (`src/api/server.ts`)
   - Express.js REST API with TypeScript
   - Authentication endpoints (login/register)
   - Campaign management
   - Event tracking
   - Analytics endpoints
   - Fraud prevention integration
   - Health checks and metrics

2. **Database Layer** (`src/lib/database.ts`)
   - PostgreSQL integration with connection pooling
   - Complete CRUD operations for all entities
   - Proper indexing for performance
   - Transaction support

3. **Payment Routes** (`src/api/payment-routes.ts`)
   - Stripe integration
   - Payment intent creation
   - Customer management
   - Transaction history
   - Webhook handling

4. **Admin Routes** (`src/api/admin-routes.ts`)
   - Platform statistics
   - User management
   - Campaign approval workflow
   - Fraud monitoring
   - System health checks

5. **Database Schema** (`init-db.sql`)
   - Users, campaigns, publishers tables
   - Events and consents tracking
   - Transactions ledger
   - Proper foreign keys and indexes
   - Demo seed data

6. **Authentication Context** (Updated)
   - Support for real API calls
   - Mock API fallback for development
   - Token management
   - Role-based access control

---

## 📋 Next Steps: Getting Backend Running

### Step 1: Install PostgreSQL

**macOS:**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from https://www.postgresql.org/download/windows/

### Step 2: Create Database

```bash
# Connect to PostgreSQL
psql postgres

# Create database and user
CREATE DATABASE metaverse_ads;
CREATE USER metaverse_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE metaverse_ads TO metaverse_user;
\q
```

### Step 3: Configure Environment

```bash
# Copy example env file
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required values:**
- `DB_PASSWORD`: Your PostgreSQL password
- `JWT_SECRET`: Random 32+ character string
- `ENCRYPTION_KEY`: Random 32 character string
- `STRIPE_SECRET_KEY`: Get from Stripe dashboard

### Step 4: Initialize Database

```bash
# Run database setup script
npm run setup:db

# Or manually run SQL
psql -U metaverse_user -d metaverse_ads -f init-db.sql
```

### Step 5: Start Backend Server

```bash
# Development mode with auto-reload
npm run api:dev

# Production build
npm run api:build
npm run api:start
```

Server will start on: http://localhost:3001

### Step 6: Test API Endpoints

```bash
# Health check
curl http://localhost:3001/health

# Register user
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User","role":"user"}'

# Login
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Step 7: Connect Frontend to Backend

Update `.env`:
```bash
VITE_USE_REAL_API=true
VITE_API_URL=http://localhost:3001/api/v1
```

Restart frontend:
```bash
npm run dev
```

---

## 🐳 Docker Deployment (Recommended)

### Quick Start with Docker Compose

```bash
# Set environment variables
export DB_PASSWORD=secure_password_here
export REDIS_PASSWORD=redis_password_here
export JWT_SECRET=your_jwt_secret_32_chars_min
export ENCRYPTION_KEY=your_encryption_key_32_chars

# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

### Services Included:
- **PostgreSQL** (port 5432)
- **Redis** (port 6379)
- **API Server** (port 3001)
- **Prometheus** (port 9090)
- **Grafana** (port 3000)

---

## 🔐 Security Checklist

- [ ] Change all default passwords
- [ ] Generate strong JWT_SECRET (32+ chars)
- [ ] Enable SSL/TLS in production
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable database encryption at rest
- [ ] Implement audit logging
- [ ] Set up monitoring alerts

---

## 📊 Monitoring & Observability

### Prometheus Metrics
Access: http://localhost:9090

Available metrics:
- `metaverse_ads_impressions_total`
- `metaverse_ads_clicks_total`
- `metaverse_ads_conversions_total`
- `metaverse_ads_active_campaigns`
- `metaverse_ads_fraud_alerts_total`

### Grafana Dashboards
Access: http://localhost:3000
Default credentials: admin / (set in .env)

---

## 🧪 Testing

```bash
# Run all tests
npm test

# Run integration tests
npm run test:integration

# Run with coverage
npm test -- --coverage
```

---

## 🚀 Production Deployment

### AWS Deployment

1. **RDS PostgreSQL**
   - Create RDS instance (db.t3.medium recommended)
   - Enable automated backups
   - Set up read replicas for scaling

2. **ElastiCache Redis**
   - Create Redis cluster
   - Enable encryption in transit

3. **ECS/EKS**
   - Deploy API container
   - Set up auto-scaling
   - Configure load balancer

4. **Environment Variables**
   - Use AWS Secrets Manager
   - Never commit secrets to git

### Deployment Commands

```bash
# Build production image
docker build -f Dockerfile.api -t metaverse-ads-api:latest .

# Tag for registry
docker tag metaverse-ads-api:latest your-registry/metaverse-ads-api:latest

# Push to registry
docker push your-registry/metaverse-ads-api:latest

# Deploy to production
kubectl apply -f k8s/production/
```

---

## 📈 Performance Optimization

### Database Optimization
- Enable connection pooling (already configured)
- Add database indexes (already added)
- Use read replicas for analytics queries
- Implement query caching with Redis

### API Optimization
- Enable response compression (already enabled)
- Implement request caching
- Use CDN for static assets
- Enable HTTP/2

### Monitoring
- Set up APM (New Relic/Datadog)
- Configure error tracking (Sentry)
- Enable slow query logging
- Set up uptime monitoring

---

## 🔧 Troubleshooting

### Database Connection Issues
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Check connection
psql -U metaverse_user -d metaverse_ads -c "SELECT 1"
```

### API Server Issues
```bash
# Check logs
npm run api:dev

# Check port availability
lsof -i :3001

# Test health endpoint
curl http://localhost:3001/health
```

### Docker Issues
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs api

# Restart services
docker-compose restart api
```

---

## 📚 API Documentation

Full API documentation available at:
- Swagger UI: http://localhost:3001/api-docs (coming soon)
- Postman Collection: `docs/postman-collection.json` (coming soon)

### Key Endpoints:

**Authentication:**
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user

**Campaigns:**
- `POST /api/v1/campaigns` - Create campaign
- `GET /api/v1/campaigns/:id` - Get campaign
- `PATCH /api/v1/campaigns/:id` - Update campaign

**Events:**
- `POST /api/v1/events/impression` - Track impression
- `POST /api/v1/events/click` - Track click

**Analytics:**
- `GET /api/v1/analytics/dashboard` - Dashboard metrics
- `GET /api/v1/analytics/campaigns/:id` - Campaign performance

---

## 🎯 What's Next?

### Phase 2: Blockchain Integration (Week 2-3)
- Deploy smart contracts to testnet
- Integrate Web3 wallet connections
- Implement automated payouts
- Add transaction monitoring

### Phase 3: Advanced Features (Week 4-6)
- ML-powered ad matching
- Real-time bidding system
- Advanced fraud detection
- Multi-chain support

### Phase 4: Scale & Polish (Week 7-8)
- Load testing and optimization
- Security audit
- Documentation completion
- Beta launch preparation

---

## 💡 Tips for Success

1. **Start Simple**: Get basic API working first
2. **Test Early**: Write tests as you build
3. **Monitor Everything**: Set up monitoring from day 1
4. **Document**: Keep API docs updated
5. **Security First**: Never skip security steps

---

## 🆘 Need Help?

- Check logs: `docker-compose logs -f`
- Review health endpoint: `curl http://localhost:3001/health`
- Test database: `npm run setup:db`
- Verify environment: Check `.env` file

---

**Status**: ✅ Backend foundation complete and ready for deployment!
