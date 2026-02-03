import { Server, Socket } from 'socket.io'
import { createServer, Server as HttpServer } from 'http'
import { config } from '../config'
import { logger } from '../utils/logger'

let io: Server

export function createSocketServer(): { io: Server; httpServer: HttpServer } {
    const httpServer = createServer()

    io = new Server(httpServer, {
        cors: {
            origin: config.frontendUrl,
            methods: ['GET', 'POST']
        }
    })

    io.on('connection', (socket: Socket) => {
        logger.info(`Client connected: ${socket.id}`)

        // Client subscribes to specific courts
        socket.on('subscribe', (courtIds: string[]) => {
            if (Array.isArray(courtIds)) {
                courtIds.forEach(id => {
                    socket.join(`court-${id}`)
                    logger.debug(`Socket ${socket.id} joined court-${id}`)
                })
            }
        })

        // Client unsubscribes from courts
        socket.on('unsubscribe', (courtIds: string[]) => {
            if (Array.isArray(courtIds)) {
                courtIds.forEach(id => {
                    socket.leave(`court-${id}`)
                })
            }
        })

        socket.on('disconnect', () => {
            logger.info(`Client disconnected: ${socket.id}`)
        })
    })

    return { io, httpServer }
}

export function getIO(): Server {
    if (!io) {
        throw new Error('Socket.io not initialized')
    }
    return io
}

export interface DisplayUpdatePayload {
    courtId: string
    courtName: string
    entries: DisplayBoardEntry[]
    timestamp: string
}

export interface DisplayBoardEntry {
    courtNumber: string
    itemNumber: string | null
    caseNumber: string | null
    caseTitle: string | null
    judgeName: string | null
    status: string | null
}

export function emitDisplayUpdate(courtId: string, payload: DisplayUpdatePayload) {
    getIO().to(`court-${courtId}`).emit('display-update', payload)
    logger.debug(`Emitted display-update to court-${courtId}`, { entries: payload.entries.length })
}
