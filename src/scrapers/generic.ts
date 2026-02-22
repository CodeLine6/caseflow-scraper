import * as cheerio from 'cheerio'
import { getPage } from '../browser/pool'
import { logger } from '../utils/logger'
import { BaseScraper, ScraperResult } from './base'
import { DisplayBoardEntry } from '../socket/server'
import { parseDisplayBoardHTML } from './ai-parser'
import { config } from '../config'

export class GenericTableScraper extends BaseScraper {
    async scrape(): Promise<ScraperResult> {
        const page = await getPage()

        try {
            logger.info(`Scraping (generic): ${this.courtInfo.displayBoardUrl}`)

            await page.goto(this.courtInfo.displayBoardUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            })

            // Get the fully-rendered HTML after JS execution
            const html = await page.content()

            // Try AI-powered parsing first, fall back to rigid parsing
            let entries: DisplayBoardEntry[]

            if (config.geminiApiKey) {
                try {
                    entries = await parseDisplayBoardHTML(html)
                    logger.info(`AI parser extracted ${entries.length} entries`)
                } catch (aiError) {
                    const aiMsg = aiError instanceof Error ? aiError.message : 'Unknown AI error'
                    logger.warn(`AI parser failed, falling back to rigid parser: ${aiMsg}`)
                    entries = this.fallbackParse(html)
                }
            } else {
                logger.warn('GEMINI_API_KEY not set — using rigid fallback parser')
                entries = this.fallbackParse(html)
            }

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
        } finally {
            await page.close()
        }
    }

    /**
     * Original rigid column-position-based parser.
     * Used as a fallback when AI parsing is unavailable or fails.
     */
    private fallbackParse(html: string): DisplayBoardEntry[] {
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

        logger.debug(`Fallback parser extracted ${entries.length} entries`)
        return entries
    }
}
