export type Source = 'akshare' | 'mock' | 'mixed'

export interface Quote {
  code: string
  name: string
  price: number
  change_pct: number
  change: number
  volume: number
  amount: number
  turnover: number
}

export interface KlineBar {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
  amount: number
}

export interface FundFlowDay {
  date: string
  close: number
  change_pct: number
  main_net: number
  main_pct: number
  xl_net: number
  xl_pct: number
  lg_net: number
  lg_pct: number
  md_net: number
  md_pct: number
  sm_net: number
  sm_pct: number
}

export interface FundFlowResp {
  source: Source
  code: string
  latest: FundFlowDay | null
  history: FundFlowDay[]
}

export interface SentimentDim {
  score: number
  [k: string]: number | null | undefined
}

export interface SentimentResp {
  source: Source
  code: string
  score: number
  label: string
  dimensions: { fund: SentimentDim; heat: SentimentDim; institution: SentimentDim; market: SentimentDim }
}

export interface MarketMoodResp {
  source: Source
  up: number
  down: number
  flat: number
  limit_up: number
  limit_down: number
  real_limit_up: number
  real_limit_down: number
  suspended: number
  activity: number
  date: string
  mood: { score: number; up: number; down: number; limit_up: number; limit_down: number }
}

export interface RatingSignal {
  name: string
  key: 'trend' | 'macd' | 'kdj' | 'volume' | 'fund'
  score: number
  signal: 'bullish' | 'bearish' | 'neutral'
  detail: string
}

export interface RatingResp {
  source: Source
  code: string
  score: number
  action: string
  strategy: string
  signals: RatingSignal[]
  disclaimer: string
}

export interface RatingLite {
  code: string
  score: number
  action: string
}

export interface Trade {
  entry_ts: number
  entry_price: number
  exit_ts: number
  exit_price: number
  pnl_pct: number
  exit_reason: 'signal' | 'end'
}

export interface BacktestResult {
  source: Source
  code: string
  strategy: string
  params: Record<string, number>
  initial_capital: number
  final_value: number
  total_return_pct: number
  annual_return_pct: number
  max_drawdown_pct: number
  benchmark_return_pct: number
  num_trades: number
  win_rate_pct: number | null
  equity: { timestamp: number; value: number; benchmark: number }[]
  trades: Trade[]
}
