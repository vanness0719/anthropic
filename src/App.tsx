import TopMenu from './components/layout/TopMenu';
import SideMenu from './components/layout/SideMenu';
import YieldBinParetoPage from './pages/YieldBinParetoPage';
import ByParameterPage from './pages/ByParameterPage';
import { useCpStore } from './store/cpStore';

export default function App() {
  const activeView = useCpStore((s) => s.activeView);
  return (
    <div className="deyms-app">
      <TopMenu />
      <div className="deyms-body">
        <SideMenu />
        <div className="deyms-content">
          {activeView === 'byParameter' ? <ByParameterPage /> : <YieldBinParetoPage />}
        </div>
      </div>
    </div>
  );
}
