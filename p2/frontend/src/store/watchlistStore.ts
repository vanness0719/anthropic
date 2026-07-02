import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as api from '../api/client'
import type { FundFlowResp, Quote, RatingLite, Source } from '../api/types'

interface WatchlistState {
  codes: string[]
  quotes: Record<string, Quote>
  mainNets: Record<string, number> // 当日主力净流入(元)
  ratings: Record<string, RatingLite> // 赚钱指数
  sortByScore: boolean
  source: Source | null
  loading: boolean
  add: (code: string) => void
  remove: (code: string) => void
  toggleSort: () => void
  refresh: () => Promise<void>
  loadMainNets: () => Promise<void>
  loadRatings: () => Promise<void>
}

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      codes: ['600519', '000001', '300750'], // 默认自选,首次打开不留白
      quotes: {},
      mainNets: {},
      ratings: {},
      sortByScore: false,
      source: null,
      loading: false,

      add: (code) => {
        if (!get().codes.includes(code)) {
          set({ codes: [...get().codes, code] })
          void get().refresh()
          void get().loadMainNets()
          void get().loadRatings()
        }
      },

      remove: (code) => set({ codes: get().codes.filter(c => c !== code) }),

      toggleSort: () => set({ sortByScore: !get().sortByScore }),

      loadRatings: async () => {
        const { codes } = get()
        if (!codes.length) return
        try {
          const r = await api.get<{ items: RatingLite[] }>('/rating/batch', { codes: codes.join(',') })
          set({ ratings: Object.fromEntries(r.items.map(i => [i.code, i])) })
        } catch { /* 评分失败不影响列表 */ }
      },

      refresh: async () => {
        const { codes } = get()
        if (!codes.length) return
        set({ loading: true })
        try {
          const r = await api.get<{ source: Source; items: Quote[] }>('/quotes', { codes: codes.join(',') })
          set({ quotes: Object.fromEntries(r.items.map(q => [q.code, q])), source: r.source })
        } finally {
          set({ loading: false })
        }
      },

      loadMainNets: async () => {
        // N 个自选各取最近一日资金流;后端有 TTL 缓存,只在进入页面/添加时调用
        const { codes } = get()
        const results = await Promise.allSettled(
          codes.map(c => api.get<FundFlowResp>(`/fundflow/${c}`, { days: 1 })),
        )
        const next: Record<string, number> = {}
        results.forEach((r, i) => {
          if (r.status === 'fulfilled' && r.value.latest) next[codes[i]] = r.value.latest.main_net
        })
        set({ mainNets: next })
      },
    }),
    { name: 'p2-watchlist', partialize: s => ({ codes: s.codes }) },
  ),
)
