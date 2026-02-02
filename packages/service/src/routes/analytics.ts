/**
 * @module routes/analytics
 * @description Analytics API routes for dashboard data.
 *
 * Queries TimescaleDB continuous aggregates for efficient analytics.
 *
 * Endpoints:
 * - GET /analytics/daily - Daily message counts
 * - GET /analytics/tools - Tool call statistics
 *
 * Note: Database rows return plain strings while Schema expects branded types.
 * Actual validation happens via effectValidator on request parameters.
 */

import { Hono } from 'hono'
import { effectValidator } from '@hono/effect-validator'
import { Schema as S } from 'effect'
import { db, getDailyMessageCounts, getHourlyToolCallStats } from '../db/index.ts'

const analytics = new Hono()

// ============================================================================
// Shared Query Schema
// ============================================================================

/**
 * Date range query parameters for analytics endpoints.
 */
const DateRangeQuery = S.Struct({
  start_date: S.optional(S.String),
  end_date: S.optional(S.String),
  days: S.optional(S.NumberFromString.pipe(S.int(), S.positive(), S.lessThanOrEqualTo(365))),
})

// ============================================================================
// GET /analytics/daily - Daily message counts
// ============================================================================

/**
 * Get daily message counts from continuous aggregate.
 *
 * Query parameters:
 * - start_date: ISO 8601 date (default: end_date - days)
 * - end_date: ISO 8601 date (default: now)
 * - days: Number of days back (default: 30, max: 365)
 */
analytics.get('/daily', effectValidator('query', DateRangeQuery), async (c) => {
  const query = c.req.valid('query')
  const days = query.days ?? 30

  const endDate = query.end_date ? new Date(query.end_date) : new Date()
  const startDate = query.start_date
    ? new Date(query.start_date)
    : new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  const data = await getDailyMessageCounts(db(), startDate, endDate)

  const response = {
    data,
    start_date: startDate,
    end_date: endDate,
  }

  return c.json(response)
})

// ============================================================================
// GET /analytics/tools - Tool call statistics
// ============================================================================

/**
 * Get hourly tool call statistics from continuous aggregate.
 *
 * Query parameters:
 * - start_date: ISO 8601 date
 * - end_date: ISO 8601 date
 * - days: Number of days back (default: 7)
 */
analytics.get('/tools', effectValidator('query', DateRangeQuery), async (c) => {
  const query = c.req.valid('query')
  const days = query.days ?? 7

  const endDate = query.end_date ? new Date(query.end_date) : new Date()
  const startDate = query.start_date
    ? new Date(query.start_date)
    : new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  const data = await getHourlyToolCallStats(db(), startDate, endDate)

  const response = {
    data,
    start_date: startDate,
    end_date: endDate,
  }

  return c.json(response)
})

export default analytics
