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
import Map from './pages/Map';
import Devices from './pages/Devices';
import Patrol from './pages/Patrol';
import AlertDispatch from './pages/AlertDispatch';
import PatrolTasks from './pages/PatrolTasks';
import BuildingLedger from './pages/BuildingLedger';

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

const MapPage = () => (
  <Layout>
    <Map />
  </Layout>
);

const DevicesPage = () => (
  <Layout>
    <Devices />
  </Layout>
);

const PatrolPage = () => (
  <Layout>
    <Patrol />
  </Layout>
);

const AlertDispatchPage = () => (
  <Layout>
    <AlertDispatch />
  </Layout>
);

const PatrolTasksPage = () => (
  <Layout>
    <PatrolTasks />
  </Layout>
);

const BuildingLedgerPage = () => (
  <Layout>
    <BuildingLedger />
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
      <Route path="/map" component={MapPage} />
      <Route path="/devices" component={DevicesPage} />
      <Route path="/thermal-monitor" component={ThermalMonitorPage} />
      <Route path="/patrol-map" component={PatrolMapPage} />
      <Route path="/alerts" component={AlertsPage} />
      <Route path="/patrol" component={PatrolPage} />
      <Route path="/alert-dispatch" component={AlertDispatchPage} />
      <Route path="/patrol-tasks" component={PatrolTasksPage} />
      <Route path="/building-ledger" component={BuildingLedgerPage} />
      <Route path="/responsible-persons" component={ResponsiblePersonsPage} />
      <Route path="/statistics" component={StatisticsPage} />
    </Router>
  );
}

export default App;
