import { Worker, Job } from 'bullmq'
import { prisma } from '../database/client'
import { redisConnection } from '../database/redis'
import { config } from '../config'
import { logger } from '../utils/logger'
import { scrapeCourt, CourtInfo } from '../scrapers'
import { emitDisplayUpdate, DisplayBoardEntry } from '../socket/server'

interface ScrapeJobData {
    court: CourtInfo
}

export function startWorker() {
    const worker = new Worker<ScrapeJobData>(
        'display-board-scrape',
        async (job: Job<ScrapeJobData>) => {
            const { court } = job.data

            logger.info(`Processing job ${job.id} for ${court.courtName}`)

            // Scrape the court display board
            const result = await scrapeCourt(court)

            if (!result.success) {
                throw new Error(result.error || 'Scrape failed')
            }

            // Upsert entries to database
            for (const entry of result.entries) {
                await prisma.displayBoardCache.upsert({
                    where: {
                        courtId_courtNumber: {
                            courtId: court.id,
                            courtNumber: entry.courtNumber
                        }
                    },
                    update: {
                        itemNumber: entry.itemNumber,
                        caseNumber: entry.caseNumber,
                        caseTitle: entry.caseTitle,
                        judgeName: entry.judgeName,
                        status: entry.status,
                        lastUpdated: new Date()
                    },
                    create: {
                        courtId: court.id,
                        courtNumber: entry.courtNumber,
                        itemNumber: entry.itemNumber,
                        caseNumber: entry.caseNumber,
                        caseTitle: entry.caseTitle,
                        judgeName: entry.judgeName,
                        status: entry.status
                    }
                })
            }

            // Emit real-time update via Socket.io
            emitDisplayUpdate(court.id, {
                courtId: court.id,
                courtName: court.courtName,
                entries: result.entries,
                timestamp: new Date().toISOString()
            })

            logger.info(`Completed job ${job.id}: ${result.entries.length} entries saved`)

            return {
                success: true,
                entriesCount: result.entries.length
            }
        },
        {
            ...redisConnection,
            concurrency: config.maxConcurrentScrapers
        }
    )

    worker.on('completed', (job) => {
        logger.debug(`Job ${job.id} completed`)
    })

    worker.on('failed', (job, err) => {
        logger.error(`Job ${job?.id} failed: ${err.message}`)
    })

    logger.info(`Worker started with concurrency: ${config.maxConcurrentScrapers}`)

    return worker
}
