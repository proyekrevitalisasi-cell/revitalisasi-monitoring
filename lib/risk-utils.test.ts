import { describe, it, expect } from 'vitest'
import { getScoreBand } from './risk-utils'

describe('getScoreBand', () => {
  it('returns low at the bottom of the range (score 1)', () => {
    expect(getScoreBand(1)).toBe('low')
  })

  it('returns low at the low/medium boundary (score 6)', () => {
    expect(getScoreBand(6)).toBe('low')
  })

  it('returns medium just above the low/medium boundary (score 7)', () => {
    expect(getScoreBand(7)).toBe('medium')
  })

  it('returns medium at the medium/high boundary (score 12)', () => {
    expect(getScoreBand(12)).toBe('medium')
  })

  it('returns high just above the medium/high boundary (score 13)', () => {
    expect(getScoreBand(13)).toBe('high')
  })

  it('returns high at the top of the range (score 25)', () => {
    expect(getScoreBand(25)).toBe('high')
  })
})
