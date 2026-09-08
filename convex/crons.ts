import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()
crons.interval(
  'evict expired auth keys',
  { hours: 1 },
  internal.maintenance.evictExpiredAuthKeys,
  {},
)
export default crons
