import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { List, NavBar, PullToRefresh, SearchBar, SwipeAction, Tag, Toast } from 'antd-mobile'
import { AddCircleOutline } from 'antd-mobile-icons'
import * as api from '../api/client'
import type { Quote, Source } from '../api/types'
import { useWatchlist } from '../store/watchlistStore'
import { fmtAmount, fmtSigned } from '../utils/format'
import { signColor, TEXT_2 } from '../theme'

export default function WatchlistPage() {
  const nav = useNavigate()
  const { codes, quotes, mainNets, source, add, remove, refresh, loadMainNets } = useWatchlist()
  const [kw, setKw] = useState('')
  const [hits, setHits] = useState<Quote[]>([])

  useEffect(() => {
    void refresh()
    void loadMainNets()
    const timer = setInterval(() => void refresh(), 30_000)
    return () => clearInterval(timer)
  }, [refresh, loadMainNets])

  const search = async (v: string) => {
    if (!v.trim()) { setHits([]); return }
    try {
      const r = await api.get<{ source: Source; items: Quote[] }>('/search', { kw: v.trim() })
      setHits(r.items)
    } catch (e) {
      Toast.show(String(e))
    }
  }

  return (
    <div style={{ paddingBottom: 60 }}>
      <NavBar
        back={null}
        right={source === 'mock' ? <Tag color="warning" fill="outline">模拟数据</Tag> : undefined}
      >
        自选股
      </NavBar>
      <div style={{ padding: '0 12px 8px' }}>
        <SearchBar
          placeholder="输入代码或名称添加自选"
          value={kw}
          onChange={v => { setKw(v); void search(v) }}
          onClear={() => setHits([])}
        />
      </div>

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

      <PullToRefresh onRefresh={async () => { await refresh(); await loadMainNets() }}>
        <List>
          {codes.map(code => {
            const q = quotes[code]
            const main = mainNets[code]
            return (
              <SwipeAction
                key={code}
                rightActions={[{ key: 'del', text: '删除', color: 'danger', onClick: () => remove(code) }]}
              >
                <List.Item
                  onClick={() => nav(`/stock/${code}`)}
                  description={code}
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
