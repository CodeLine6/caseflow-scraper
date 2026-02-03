import { config } from './config'
import { logger } from './utils/logger'
import { createSocketServer } from './socket/server'
import { startScheduler } from './jobs/scheduler'
import { startWorker } from './jobs/processor'
import { prisma } from './database/client'
import { redis } from './database/redis'
import { closeBrowser } from './browser/pool'

async function main() {
    logger.info('Starting CaseFlow Display Board Scraper Service')

    // Test database connection
    try {
        await prisma.$connect()
        logger.info('Database connected')
    } catch (error) {
        logger.error('Failed to connect to database', { error })
        process.exit(1)
    }

    // Test Redis connection
    try {
        await redis.ping()
        logger.info('Redis connected')
    } catch (error) {
        logger.error('Failed to connect to Redis', { error })
        process.exit(1)
    }

    // Create Socket.io server
    const { httpServer } = createSocketServer()
    httpServer.listen(config.socketPort, () => {
        logger.info(`Socket.io server listening on port ${config.socketPort}`)
    })

    // Start scheduler and worker
    startScheduler()
    startWorker()

    logger.info('Scraper service is running')
    logger.info(`Frontend URL: ${config.frontendUrl}`)
    logger.info(`Scrape schedule: ${config.scrapeCron}`)
}

// Graceful shutdown
async function shutdown() {
    logger.info('Shutting down...')
    await closeBrowser()
    await prisma.$disconnect()
    redis.disconnect()
    process.exit(0)
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)

// Start the service
main().catch((error) => {
    logger.error('Failed to start service', { error })
    process.exit(1)
})
