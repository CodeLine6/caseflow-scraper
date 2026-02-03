import { DisplayBoardEntry } from '../socket/server'

export interface CourtInfo {
    id: string
    courtName: string
    displayBoardUrl: string
}

export interface ScraperResult {
    success: boolean
    entries: DisplayBoardEntry[]
    error?: string
}

export abstract class BaseScraper {
    protected courtInfo: CourtInfo

    constructor(courtInfo: CourtInfo) {
        this.courtInfo = courtInfo
    }

    abstract scrape(): Promise<ScraperResult>

    protected cleanText(text: string | null | undefined): string | null {
        if (!text) return null
        const cleaned = text.trim()
        if (['NA', '-', '*', ''].includes(cleaned)) return null
        return cleaned
    }

    protected extractNumber(text: string): string {
        return text.replace(/\D/g, '') || text
    }
}
