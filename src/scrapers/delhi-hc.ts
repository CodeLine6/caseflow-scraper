import { getPage } from '../browser/pool'
import { logger } from '../utils/logger'
import { BaseScraper, ScraperResult } from './base'
import { DisplayBoardEntry } from '../socket/server'

export class DelhiHCScraper extends BaseScraper {
    async scrape(): Promise<ScraperResult> {
        const page = await getPage()

        try {
            logger.info(`Scraping Delhi HC: ${this.courtInfo.displayBoardUrl}`)

            await page.goto(this.courtInfo.displayBoardUrl, {
                waitUntil: 'networkidle0',
                timeout: 30000
            })

            // Wait for table to load
            await page.waitForSelector('table tbody tr', { timeout: 15000 })

            const entries = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('table tbody tr'))
                return rows.map(row => {
                    const cells = row.querySelectorAll('td')
                    if (cells.length < 4) return null

                    return {
                        courtNumber: cells[0]?.textContent?.trim() || '',
                        itemNumber: cells[1]?.textContent?.trim() || null,
                        judgeName: cells[2]?.textContent?.trim() || null,
                        caseNumber: cells[3]?.textContent?.trim() || null,
                        caseTitle: cells[4]?.textContent?.trim() || null,
                        vcLink: cells[5]?.querySelector('a')?.getAttribute('href') || null,
                        status: null
                    }
                }).filter(e => e !== null)
            }) as DisplayBoardEntry[]

            // Clean and filter entries
            const cleanedEntries = entries
                .filter(e => e.courtNumber && !e.courtNumber.toLowerCase().includes('court'))
                .map(e => ({
                    courtNumber: this.extractNumber(e.courtNumber),
                    itemNumber: this.cleanText(e.itemNumber),
                    caseNumber: this.cleanText(e.caseNumber),
                    caseTitle: this.cleanText(e.caseTitle),
                    judgeName: this.cleanText(e.judgeName),
                    status: e.itemNumber && this.cleanText(e.itemNumber) ? 'IN_PROGRESS' : 'WAITING'
                }))

            logger.info(`Scraped ${cleanedEntries.length} entries from Delhi HC`)

            return {
                success: true,
                entries: cleanedEntries
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            logger.error(`Failed to scrape Delhi HC: ${message}`)
            return {
                success: false,
                entries: [],
                error: message
            }
        } finally {
            await page.close()
        }
    }
}
