import { create } from 'zustand'
import * as api from '../api/client'
import type { BacktestResult } from '../api/types'

export interface BacktestForm {
  code: string
  strategy: 'ma_cross' | 'macd' | 'kdj'
  params: Record<string, number>
  start_date?: string
  initial_capital: number
  fee_rate: number
}

interface BacktestState {
  form: BacktestForm
  result: BacktestResult | null
  loading: boolean
  error: string | null
  setForm: (patch: Partial<BacktestForm>) => void
  run: () => Promise<void>
}

export const useBacktest = create<BacktestState>((set, get) => ({
  form: { code: '600519', strategy: 'macd', params: {}, initial_capital: 100000, fee_rate: 0.0003 },
  result: null,
  loading: false,
  error: null,

  setForm: (patch) => set({ form: { ...get().form, ...patch } }),

  run: async () => {
    set({ loading: true, error: null })
    try {
      const result = await api.post<BacktestResult>('/backtest', get().form)
      set({ result })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), result: null })
    } finally {
      set({ loading: false })
    }
  },
}))
