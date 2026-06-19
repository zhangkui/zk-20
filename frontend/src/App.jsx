import { Router, Route } from '@solidjs/router';
import { onMount, onCleanup } from 'solid-js';
import Layout from './components/Layout';
import { actions } from './store/appStore';
import './styles/thermal.css';

import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Buildings from './pages/Buildings';
import ThermalMonitor from './pages/ThermalMonitor';
import PatrolMap from './pages/PatrolMap';
import Alerts from './pages/Alerts';
import ResponsiblePersons from './pages/ResponsiblePersons';
import Statistics from './pages/Statistics';

function App() {
  onMount(async () => {
    await actions.initAll();
  });

  onCleanup(() => {
    actions.disconnectWebSocket();
  });

  return (
    <Router>
      <div class="app">
        <Layout>
          <Route path="/" component={Dashboard} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/buildings" component={Buildings} />
          <Route path="/thermal-monitor" component={ThermalMonitor} />
          <Route path="/patrol-map" component={PatrolMap} />
          <Route path="/alerts" component={Alerts} />
          <Route path="/responsible-persons" component={ResponsiblePersons} />
          <Route path="/statistics" component={Statistics} />
        </Layout>
      </div>
    </Router>
  );
}

export default App;
