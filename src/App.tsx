import TopMenu from './components/layout/TopMenu';
import SideMenu from './components/layout/SideMenu';
import YieldBinParetoPage from './pages/YieldBinParetoPage';

export default function App() {
  return (
    <div className="deyms-app">
      <TopMenu />
      <div className="deyms-body">
        <SideMenu />
        <div className="deyms-content">
          <YieldBinParetoPage />
        </div>
      </div>
    </div>
  );
}
