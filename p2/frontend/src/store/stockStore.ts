import { create } from 'zustand'
import * as api from '../api/client'
import type { FundFlowResp, KlineBar, MarketMoodResp, RatingResp, SentimentResp, Source } from '../api/types'

export type Period = 'daily' | 'weekly' | 'monthly' | '60' | '15'

interface StockState {
  code: string
  period: Period
  bars: KlineBar[]
  klineSource: Source | null
  fundflow: FundFlowResp | null
  sentiment: SentimentResp | null
  market: MarketMoodResp | null
  rating: RatingResp | null
  loading: boolean
  error: string | null
  setCode: (code: string) => void
  setPeriod: (p: Period) => Promise<void>
  loadAll: (code: string) => Promise<void>
}

export const useStock = create<StockState>((set, get) => ({
  code: '',
  period: 'daily',
  bars: [],
  klineSource: null,
  fundflow: null,
  sentiment: null,
  market: null,
  rating: null,
  loading: false,
  error: null,

  setCode: (code) => set({ code, bars: [], fundflow: null, sentiment: null, rating: null, error: null }),

  setPeriod: async (p) => {
    set({ period: p })
    const { code } = get()
    if (!code) return
    const r = await api.get<{ source: Source; items: KlineBar[] }>(`/kline/${code}`, { period: p, limit: 500 })
    set({ bars: r.items, klineSource: r.source })
  },

  loadAll: async (code) => {
    set({ code, loading: true, error: null })
    try {
      const period = get().period
      const [kline, ff, senti, market, rate] = await Promise.all([
        api.get<{ source: Source; items: KlineBar[] }>(`/kline/${code}`, { period, limit: 500 }),
        api.get<FundFlowResp>(`/fundflow/${code}`),
        api.get<SentimentResp>(`/sentiment/${code}`),
        api.get<MarketMoodResp>('/sentiment/market'),
        api.get<RatingResp>(`/rating/${code}`).catch(() => null),
      ])
      set({ bars: kline.items, klineSource: kline.source, fundflow: ff, sentiment: senti, market, rating: rate })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e) })
    } finally {
      set({ loading: false })
    }
  },
}))
