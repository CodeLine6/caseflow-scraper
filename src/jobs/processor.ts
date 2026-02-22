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

/**
 * Get the start and end of "today" in IST (UTC+5:30).
 * Returns UTC Date objects representing the IST day boundaries.
 */
function getTodayRangeIST(): { start: Date; end: Date } {
    const now = new Date()
    // IST offset is +5:30 = 330 minutes
    const istOffsetMs = 330 * 60 * 1000
    const istNow = new Date(now.getTime() + istOffsetMs)

    // Start of today in IST (midnight IST as UTC)
    const startIST = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()))
    const startUTC = new Date(startIST.getTime() - istOffsetMs)

    // End of today in IST (next midnight IST as UTC)
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000)

    return { start: startUTC, end: endUTC }
}

/**
 * After scraping, check if any of today's SCHEDULED hearings match the
 * current item being heard in this court. If so, update them to IN_PROGRESS.
 */
async function updateHearingStatuses(
    courtId: number | string,
    entries: DisplayBoardEntry[]
): Promise<number> {
    const numericCourtId = typeof courtId === 'string' ? parseInt(courtId, 10) : courtId
    if (isNaN(numericCourtId)) return 0

    const { start, end } = getTodayRangeIST()
    let totalUpdated = 0

    for (const entry of entries) {
        // Skip entries without an item number
        if (!entry.itemNumber) continue

        // Find today's SCHEDULED hearings for this court + court room + item number
        const matchingHearings = await prisma.hearing.findMany({
            where: {
                case: { courtId: numericCourtId },
                courtNumber: entry.courtNumber,
                courtItemNumber: entry.itemNumber,
                hearingDate: { gte: start, lt: end },
                status: 'SCHEDULED',
            },
            select: { id: true, caseId: true },
        })

        if (matchingHearings.length > 0) {
            const ids = matchingHearings.map(h => h.id)
            await prisma.hearing.updateMany({
                where: { id: { in: ids } },
                data: { status: 'IN_PROGRESS' },
            })
            totalUpdated += matchingHearings.length
            logger.info(
                `Auto-updated ${matchingHearings.length} hearing(s) to IN_PROGRESS ` +
                `(court room ${entry.courtNumber}, item ${entry.itemNumber})`
            )
        }
    }

    return totalUpdated
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
                            courtId: typeof court.id === 'string' ? parseInt(court.id, 10) : court.id,
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
                        courtId: typeof court.id === 'string' ? parseInt(court.id, 10) : court.id,
                        courtNumber: entry.courtNumber,
                        itemNumber: entry.itemNumber,
                        caseNumber: entry.caseNumber,
                        caseTitle: entry.caseTitle,
                        judgeName: entry.judgeName,
                        status: entry.status
                    }
                })
            }

            // Auto-update hearing statuses based on current court item numbers
            const hearingsUpdated = await updateHearingStatuses(court.id, result.entries)
            if (hearingsUpdated > 0) {
                logger.info(`${hearingsUpdated} hearing(s) auto-updated to IN_PROGRESS for ${court.courtName}`)
            }

            // Emit real-time update via Socket.io
            const courtIdStr = String(court.id)
            emitDisplayUpdate(courtIdStr, {
                courtId: courtIdStr,
                courtName: court.courtName,
                entries: result.entries,
                timestamp: new Date().toISOString()
            })

            logger.info(`Completed job ${job.id}: ${result.entries.length} entries saved`)

            return {
                success: true,
                entriesCount: result.entries.length,
                hearingsUpdated
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
