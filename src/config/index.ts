import dotenv from 'dotenv'
dotenv.config()

export const config = {
    // Database
    databaseUrl: process.env.DATABASE_URL!,

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // Socket.io
    socketPort: parseInt(process.env.SOCKET_PORT || '3001', 10),
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',

    // Scraper
    scrapeCron: process.env.SCRAPE_CRON || '*/2 10-17 * * 1-5',
    maxConcurrentScrapers: parseInt(process.env.MAX_CONCURRENT_SCRAPERS || '3', 10),
    puppeteerHeadless: process.env.PUPPETEER_HEADLESS !== 'false',

    // AI (Gemini)
    geminiApiKey: process.env.GEMINI_API_KEY || '',

    // Logging
    logLevel: process.env.LOG_LEVEL || 'info',
}

// Validate required config
if (!config.databaseUrl) {
    throw new Error('DATABASE_URL is required')
}
