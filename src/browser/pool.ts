import puppeteer, { Browser, Page } from 'puppeteer'
import { config } from '../config'
import { logger } from '../utils/logger'

let browser: Browser | null = null

export async function getBrowser(): Promise<Browser> {
    if (!browser || !browser.connected) {
        logger.info('Launching new Puppeteer browser instance')
        browser = await puppeteer.launch({
            headless: config.puppeteerHeadless,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
        })
    }
    return browser
}

export async function getPage(): Promise<Page> {
    const b = await getBrowser()
    const page = await b.newPage()

    // Set reasonable defaults
    await page.setViewport({ width: 1280, height: 800 })
    await page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    return page
}

export async function closeBrowser(): Promise<void> {
    if (browser) {
        await browser.close()
        browser = null
        logger.info('Browser closed')
    }
}

// Graceful shutdown
process.on('SIGTERM', closeBrowser)
process.on('SIGINT', closeBrowser)
