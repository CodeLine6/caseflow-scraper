import * as cheerio from 'cheerio'
import { logger } from '../utils/logger'
import { BaseScraper, ScraperResult } from './base'
import { DisplayBoardEntry } from '../socket/server'

export class GenericTableScraper extends BaseScraper {
    async scrape(): Promise<ScraperResult> {
        try {
            logger.info(`Scraping (generic): ${this.courtInfo.displayBoardUrl}`)

            const response = await fetch(this.courtInfo.displayBoardUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                    'Accept': 'text/html,application/xhtml+xml',
                }
            })

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`)
            }

            const html = await response.text()
            const $ = cheerio.load(html)

            const entries: DisplayBoardEntry[] = []

            $('table tbody tr').each((_, row) => {
                const cells = $(row).find('td')
                if (cells.length >= 4) {
                    const courtNumber = $(cells[0]).text().trim()

                    // Skip header rows
                    if (!courtNumber || courtNumber.toLowerCase().includes('court')) {
                        return
                    }

                    entries.push({
                        courtNumber: this.extractNumber(courtNumber),
                        itemNumber: this.cleanText($(cells[1]).text()),
                        caseNumber: this.cleanText($(cells[2]).text()),
                        caseTitle: this.cleanText($(cells[3]).text()),
                        judgeName: cells.length > 4 ? this.cleanText($(cells[4]).text()) : null,
                        status: this.cleanText($(cells[1]).text()) ? 'IN_PROGRESS' : 'WAITING'
                    })
                }
            })

            logger.info(`Scraped ${entries.length} entries (generic)`)

            return {
                success: true,
                entries
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            logger.error(`Failed to scrape (generic): ${message}`)
            return {
                success: false,
                entries: [],
                error: message
            }
        }
    }
}
