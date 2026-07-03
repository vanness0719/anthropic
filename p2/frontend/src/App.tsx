import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { TabBar } from 'antd-mobile'
import { HistogramOutline, StarOutline } from 'antd-mobile-icons'
import WatchlistPage from './pages/WatchlistPage'
import StockDetailPage from './pages/StockDetailPage'
import BacktestPage from './pages/BacktestPage'

export default function App() {
  const location = useLocation()
  const nav = useNavigate()
  const showTabBar = location.pathname === '/' || location.pathname === '/backtest'

  return (
    <div style={{ minHeight: '100vh' }}>
      <Routes>
        <Route path="/" element={<WatchlistPage />} />
        <Route path="/stock/:code" element={<StockDetailPage />} />
        <Route path="/backtest" element={<BacktestPage />} />
      </Routes>
      {showTabBar && (
        <TabBar
          activeKey={location.pathname}
          onChange={k => nav(k)}
          style={{
            position: 'fixed', bottom: 0, left: 0, right: 0,
            background: '#1a1a1a', borderTop: '1px solid #2c2c2c',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}
        >
          <TabBar.Item key="/" title="自选" icon={<StarOutline />} />
          <TabBar.Item key="/backtest" title="回测" icon={<HistogramOutline />} />
        </TabBar>
      )}
    </div>
  )
}
