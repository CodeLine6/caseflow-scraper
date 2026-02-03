import { BaseScraper, CourtInfo, ScraperResult } from './base'
import { DelhiHCScraper } from './delhi-hc'
import { GenericTableScraper } from './generic'
import { logger } from '../utils/logger'

// Factory function to get appropriate scraper
function getScraperForCourt(court: CourtInfo): BaseScraper {
    const url = court.displayBoardUrl.toLowerCase()

    if (url.includes('delhihighcourt')) {
        return new DelhiHCScraper(court)
    }

    // Default to generic scraper
    return new GenericTableScraper(court)
}

export async function scrapeCourt(court: CourtInfo): Promise<ScraperResult> {
    logger.info(`Starting scrape for: ${court.courtName}`)

    const scraper = getScraperForCourt(court)
    const result = await scraper.scrape()

    if (result.success) {
        logger.info(`Completed scrape for ${court.courtName}: ${result.entries.length} entries`)
    } else {
        logger.error(`Failed scrape for ${court.courtName}: ${result.error}`)
    }

    return result
}

export { BaseScraper, CourtInfo, ScraperResult } from './base'
export { DelhiHCScraper } from './delhi-hc'
export { GenericTableScraper } from './generic'
