import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai'
import { config } from '../config'
import { logger } from '../utils/logger'
import { DisplayBoardEntry } from '../socket/server'

// Response schema for structured JSON output
const displayBoardSchema = {
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            courtNumber: {
                type: SchemaType.STRING,
                description: 'The court or bench number (digits only, e.g. "1", "12")',
            },
            itemNumber: {
                type: SchemaType.STRING,
                nullable: true,
                description: 'The serial/item number currently being heard',
            },
            caseNumber: {
                type: SchemaType.STRING,
                nullable: true,
                description: 'The case number (e.g. "CRL.A. 123/2024")',
            },
            caseTitle: {
                type: SchemaType.STRING,
                nullable: true,
                description: 'The case title or parties (e.g. "State vs. John Doe")',
            },
            judgeName: {
                type: SchemaType.STRING,
                nullable: true,
                description: 'The name of the presiding judge or bench composition',
            },
            status: {
                type: SchemaType.STRING,
                nullable: true,
                description: 'Current status — use "IN_PROGRESS" if a case/item is actively being heard, otherwise "WAITING"',
            },
        },
        required: ['courtNumber'],
    },
}

const SYSTEM_PROMPT = `You are a structured data extraction engine for Indian court display boards.

You will receive the HTML content of a court's display board web page. Your job is to extract every row of hearing/case data into a structured JSON array.

Rules:
1. Look for court display board data in ANY format — HTML tables, div-based layouts, lists, etc.
2. Extract these fields for each entry:
   - courtNumber: The court/bench number (numeric part only, e.g. "1", "12"). This is REQUIRED.
   - itemNumber: The item/serial number currently being heard (if available).
   - caseNumber: The full case number as displayed (e.g. "W.P.(C) 1234/2024").
   - caseTitle: The case title or party names (e.g. "State vs. John Doe").
   - judgeName: The presiding judge's name or bench composition.
   - status: Set to "IN_PROGRESS" if the entry appears to be the case currently being heard (has an active item number), otherwise "WAITING".
3. Skip header rows, footer rows, and any non-data rows.
4. If a field is not present or not applicable, set it to null.
5. Return an empty array if no valid display board data is found.
6. Do NOT make up or infer data that isn't present in the HTML.`

/**
 * Strips non-essential HTML (scripts, styles, head) to reduce token usage.
 */
function stripNonEssentialHTML(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<head[\s\S]*?<\/head>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim()
}

/**
 * Parses court display board HTML using Gemini AI for flexible extraction.
 * Returns structured DisplayBoardEntry[] regardless of the HTML format.
 */
export async function parseDisplayBoardHTML(html: string): Promise<DisplayBoardEntry[]> {
    if (!config.geminiApiKey) {
        throw new Error('GEMINI_API_KEY is not configured')
    }

    const genAI = new GoogleGenerativeAI(config.geminiApiKey)
    const model = genAI.getGenerativeModel({
        model: 'gemini-3-flash-preview',
        generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: displayBoardSchema as any,
            temperature: 0, // Deterministic output for data extraction
        },
    })

    const cleanedHTML = stripNonEssentialHTML(html)

    logger.debug(`AI parser: sending ${cleanedHTML.length} characters to Gemini`)

    const result = await model.generateContent([
        { text: SYSTEM_PROMPT },
        { text: `Here is the display board HTML to extract data from:\n\n${cleanedHTML}` },
    ])

    const responseText = result.response.text()
    const entries: DisplayBoardEntry[] = JSON.parse(responseText)

    // Validate and clean entries
    const validEntries = entries
        .filter(e => e.courtNumber && e.courtNumber.trim() !== '')
        .map(e => ({
            courtNumber: e.courtNumber.replace(/\D/g, '') || e.courtNumber,
            itemNumber: e.itemNumber || null,
            caseNumber: e.caseNumber || null,
            caseTitle: e.caseTitle || null,
            judgeName: e.judgeName || null,
            status: e.status || 'WAITING',
        }))

    logger.debug(`AI parser: extracted ${validEntries.length} valid entries`)

    return validEntries
}
