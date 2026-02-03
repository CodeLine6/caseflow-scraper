import { Queue } from 'bullmq'
import cron from 'node-cron'
import { prisma } from '../database/client'
import { redisConnection } from '../database/redis'
import { config } from '../config'
import { logger } from '../utils/logger'

export const scrapeQueue = new Queue('display-board-scrape', redisConnection)

export function startScheduler() {
    logger.info(`Starting scheduler with cron: ${config.scrapeCron}`)

    cron.schedule(config.scrapeCron, async () => {
        logger.info('Scheduler triggered - queuing scrape jobs')

        try {
            // Get all courts with display board URLs
            const courts = await prisma.court.findMany({
                where: {
                    displayBoardUrl: { not: null }
                },
                select: {
                    id: true,
                    courtName: true,
                    displayBoardUrl: true
                }
            })

            logger.info(`Found ${courts.length} courts with display board URLs`)

            // Queue a job for each court
            for (const court of courts) {
                if (court.displayBoardUrl) {
                    await scrapeQueue.add(
                        'scrape',
                        {
                            court: {
                                id: court.id,
                                courtName: court.courtName,
                                displayBoardUrl: court.displayBoardUrl
                            }
                        },
                        {
                            attempts: 3,
                            backoff: {
                                type: 'exponential',
                                delay: 5000
                            },
                            removeOnComplete: 100,
                            removeOnFail: 50
                        }
                    )
                }
            }

            logger.info(`Queued ${courts.length} scrape jobs`)
        } catch (error) {
            logger.error('Failed to queue scrape jobs', { error })
        }
    })

    logger.info('Scheduler started')
}
