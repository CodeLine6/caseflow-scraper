# CaseFlow Display Board Scraper

A standalone microservice that continuously scrapes court display boards and provides real-time updates via Socket.io.

## Architecture

```
┌─────────────────────────────────────────┐
│  Scraper Service                        │
├─────────────────────────────────────────┤
│  • Cron Scheduler (BullMQ)              │
│  • Puppeteer Workers                    │
│  • Socket.io Server (port 3001)         │
│  • Prisma (shared schema with CaseFlow) │
└─────────────────────────────────────────┘
           │
           ▼
   PostgreSQL + Redis
```

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database URL and settings
   ```

3. **Generate Prisma client**
   ```bash
   npm run db:generate
   ```

## Running

### Development
```bash
npm run dev
```

### Production (Docker)
```bash
docker-compose up -d
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `SOCKET_PORT` | Socket.io server port | `3001` |
| `FRONTEND_URL` | CaseFlow frontend URL (CORS) | `http://localhost:3000` |
| `SCRAPE_CRON` | Cron schedule for scraping | `*/2 10-17 * * 1-5` |

## Frontend Integration

Connect to the Socket.io server from CaseFlow:

```typescript
import { io } from 'socket.io-client'

const socket = io('http://localhost:3001')
socket.emit('subscribe', ['court-id-1', 'court-id-2'])
socket.on('display-update', (data) => {
    console.log('New display data:', data)
})
```
