import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, NavBar, PullToRefresh, SearchBar, SwipeAction, Tag, Toast } from 'antd-mobile'
import { AddCircleOutline } from 'antd-mobile-icons'
import * as api from '../api/client'
import type { Quote, Source } from '../api/types'
import { useWatchlist } from '../store/watchlistStore'
import { actionColor } from '../components/rating/RatingCard'
import { fmtAmount, fmtSigned } from '../utils/format'
import { ACCENT, signColor, TEXT_2 } from '../theme'

export default function WatchlistPage() {
  const nav = useNavigate()
  const { codes, quotes, mainNets, ratings, sortByScore, source, add, remove, toggleSort, refresh, loadMainNets, loadRatings } = useWatchlist()
  const [kw, setKw] = useState('')
  const [hits, setHits] = useState<Quote[]>([])
  const [searching, setSearching] = useState(false)
  const debounceTimer = useRef<number>()
  const reqSeq = useRef(0) // 丢弃过期的搜索响应,避免旧结果覆盖新输入

  useEffect(() => {
    void refresh()
    void loadMainNets()
    void loadRatings()
    const timer = setInterval(() => void refresh(), 30_000)
    return () => clearInterval(timer)
  }, [refresh, loadMainNets, loadRatings])

  const shownCodes = sortByScore
    ? [...codes].sort((a, b) => (ratings[b]?.score ?? -1) - (ratings[a]?.score ?? -1))
    : codes

  const search = (v: string) => {
    setKw(v)
    window.clearTimeout(debounceTimer.current)
    if (!v.trim()) { setHits([]); setSearching(false); return }
    // 防抖:全市场快照接口较重,停止输入 300ms 后才发请求
    debounceTimer.current = window.setTimeout(async () => {
      const seq = ++reqSeq.current
      setSearching(true)
      try {
        const r = await api.get<{ source: Source; items: Quote[] }>('/search', { kw: v.trim() })
        if (seq === reqSeq.current) setHits(r.items)
      } catch (e) {
        if (seq === reqSeq.current) { setHits([]); Toast.show(`搜索失败:${e instanceof Error ? e.message : e}`) }
      } finally {
        if (seq === reqSeq.current) setSearching(false)
      }
    }, 300)
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <NavBar
        back={null}
        left={
          <span
            onClick={toggleSort}
            style={{
              fontSize: 12, padding: '2px 10px', borderRadius: 12, cursor: 'pointer',
              border: `1px solid ${sortByScore ? ACCENT : '#3a3a3a'}`,
              color: sortByScore ? ACCENT : TEXT_2,
            }}
          >
            按评分排序{sortByScore ? ' ✓' : ''}
          </span>
        }
        right={source === 'mock' ? <Tag color="warning" fill="outline">模拟数据</Tag> : undefined}
      >
        自选股
      </NavBar>
      <div style={{ padding: '0 12px 8px' }}>
        <SearchBar
          placeholder="输入代码或名称添加自选"
          value={kw}
          onChange={search}
          onClear={() => { setHits([]); setSearching(false) }}
        />
      </div>

      {searching && (
        <div style={{ padding: '10px 16px', color: TEXT_2, fontSize: 13 }}>搜索中…(首次搜索需拉取全市场行情,可能要几秒)</div>
      )}

      {!searching && kw.trim() !== '' && hits.length === 0 && (
        <List header="搜索结果">
          {/^\d{6}$/.test(kw.trim()) ? (
            <List.Item
              description="快照中未找到,仍可按代码直接添加"
              extra={<AddCircleOutline fontSize={22} />}
              onClick={() => {
                add(kw.trim())
                Toast.show(`已添加 ${kw.trim()}`)
                setKw(''); setHits([])
              }}
            >
              直接添加 {kw.trim()}
            </List.Item>
          ) : (
            <List.Item disabled>未找到「{kw.trim()}」,可尝试输入 6 位代码</List.Item>
          )}
        </List>
      )}

      {hits.length > 0 && (
        <List header="搜索结果">
          {hits.map(q => (
            <List.Item
              key={q.code}
              description={q.code}
              extra={
                codes.includes(q.code)
                  ? <span style={{ color: TEXT_2, fontSize: 13 }}>已添加</span>
                  : <AddCircleOutline fontSize={22} />
              }
              onClick={() => {
                if (!codes.includes(q.code)) {
                  add(q.code)
                  Toast.show(`已添加 ${q.name}`)
                }
                setKw(''); setHits([])
              }}
            >
              {q.name}
            </List.Item>
          ))}
        </List>
      )}

      <PullToRefresh onRefresh={async () => { await refresh(); await loadMainNets(); await loadRatings() }}>
        <List>
          {shownCodes.map(code => {
            const q = quotes[code]
            const main = mainNets[code]
            const rate = ratings[code]
            return (
              <SwipeAction
                key={code}
                rightActions={[{ key: 'del', text: '删除', color: 'danger', onClick: () => remove(code) }]}
              >
                <List.Item
                  onClick={() => nav(`/stock/${code}`)}
                  description={
                    rate ? (
                      <span>
                        {code}
                        <span style={{
                          marginLeft: 8, fontSize: 11, padding: '1px 6px', borderRadius: 4,
                          color: actionColor(rate.action), border: `1px solid ${actionColor(rate.action)}`,
                        }}>
                          {rate.score.toFixed(0)}分 · {rate.action}
                        </span>
                      </span>
                    ) : code
                  }
                  extra={
                    q ? (
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 17, fontWeight: 600, color: signColor(q.change_pct), fontVariantNumeric: 'tabular-nums' }}>
                          {q.price.toFixed(2)}
                          <span style={{ fontSize: 13, marginLeft: 8 }}>{fmtSigned(q.change_pct)}%</span>
                        </div>
                        {main !== undefined && (
                          <div style={{ fontSize: 11, color: TEXT_2 }}>
                            主力 <span style={{ color: signColor(main) }}>{main > 0 ? '+' : ''}{fmtAmount(main)}</span>
                          </div>
                        )}
                      </div>
                    ) : <span style={{ color: TEXT_2 }}>--</span>
                  }
                >
                  {q?.name ?? code}
                </List.Item>
              </SwipeAction>
            )
          })}
        </List>
      </PullToRefresh>
      {codes.length === 0 && (
        <div style={{ textAlign: 'center', color: TEXT_2, padding: 40, fontSize: 14 }}>
          暂无自选,搜索添加股票
        </div>
      )}
    </div>
  )
}
