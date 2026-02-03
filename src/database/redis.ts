import IORedis from 'ioredis'
import { config } from '../config'

export const redis = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null // Required for BullMQ
})

// For BullMQ connection options
export const redisConnection = {
    connection: redis
}
