import { Router, Route } from '@solidjs/router';
import { onMount, onCleanup } from 'solid-js';
import Layout from './components/Layout';
import { actions } from './store/appStore';
import './styles/thermal.css';

import Dashboard from './pages/Dashboard';
import Buildings from './pages/Buildings';
import ThermalMonitor from './pages/ThermalMonitor';
import PatrolMap from './pages/PatrolMap';
import Alerts from './pages/Alerts';
import ResponsiblePersons from './pages/ResponsiblePersons';
import Statistics from './pages/Statistics';

const DashboardPage = () => (
  <Layout>
    <Dashboard />
  </Layout>
);

const BuildingsPage = () => (
  <Layout>
    <Buildings />
  </Layout>
);

const ThermalMonitorPage = () => (
  <Layout>
    <ThermalMonitor />
  </Layout>
);

const PatrolMapPage = () => (
  <Layout>
    <PatrolMap />
  </Layout>
);

const AlertsPage = () => (
  <Layout>
    <Alerts />
  </Layout>
);

const ResponsiblePersonsPage = () => (
  <Layout>
    <ResponsiblePersons />
  </Layout>
);

const StatisticsPage = () => (
  <Layout>
    <Statistics />
  </Layout>
);

function App() {
  onMount(async () => {
    await actions.initAll();
  });

  onCleanup(() => {
    actions.disconnectWebSocket();
  });

  return (
    <Router>
      <Route path="/" component={DashboardPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/buildings" component={BuildingsPage} />
      <Route path="/thermal-monitor" component={ThermalMonitorPage} />
      <Route path="/patrol-map" component={PatrolMapPage} />
      <Route path="/alerts" component={AlertsPage} />
      <Route path="/responsible-persons" component={ResponsiblePersonsPage} />
      <Route path="/statistics" component={StatisticsPage} />
    </Router>
  );
}

export default App;
