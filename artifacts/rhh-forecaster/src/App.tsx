import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';

import { AppLayout } from '@/components/layout/AppLayout';
import { PublicLayout } from '@/components/layout/PublicLayout';

import Login from '@/pages/login';
import Dashboard from '@/pages/dashboard';
import OwnersList from '@/pages/owners/index';
import OwnerNew from '@/pages/owners/new';
import OwnerDetail from '@/pages/owners/[id]';
import PropertiesList from '@/pages/properties/index';
import PropertyNew from '@/pages/properties/new';
import PropertyDetail from '@/pages/properties/[id]';
import ForecastsList from '@/pages/forecasts/index';
import ForecastWizard from '@/pages/forecasts/new';
import ForecastDetail from '@/pages/forecasts/[id]';
import MarketList from '@/pages/market/index';
import MarketImport from '@/pages/market/import';
import ProposalsList from '@/pages/proposals/index';
import ProposalDetail from '@/pages/proposals/[id]';
import Settings from '@/pages/settings';
import UsersList from '@/pages/admin/users';
import RolesPage from '@/pages/admin/roles';
import PublicProposal from '@/pages/public/proposal';
import PublicRequestForecast from '@/pages/public/request-forecast';
import RefereesList from '@/pages/referees/index';
import RefereeDetail from '@/pages/referees/[id]';
import Pipeline from '@/pages/pipeline';
import ForecastRequestsList from '@/pages/forecast-requests/index';
import NewForecastRequest from '@/pages/forecast-requests/new';
import ForecastRequestDetail from '@/pages/forecast-requests/[id]';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function ProtectedRouter() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/owners" component={OwnersList} />
        <Route path="/owners/new" component={OwnerNew} />
        <Route path="/owners/:id" component={OwnerDetail} />
        <Route path="/properties" component={PropertiesList} />
        <Route path="/properties/new" component={PropertyNew} />
        <Route path="/properties/:id" component={PropertyDetail} />
        <Route path="/forecasts" component={ForecastsList} />
        <Route path="/forecasts/new" component={ForecastWizard} />
        <Route path="/forecasts/:id" component={ForecastDetail} />
        <Route path="/market" component={MarketList} />
        <Route path="/market/import" component={MarketImport} />
        <Route path="/proposals" component={ProposalsList} />
        <Route path="/proposals/:id" component={ProposalDetail} />
        <Route path="/settings" component={Settings} />
        <Route path="/admin/users" component={UsersList} />
        <Route path="/admin/roles" component={RolesPage} />
        <Route path="/referees" component={RefereesList} />
        <Route path="/referees/:id" component={RefereeDetail} />
        <Route path="/pipeline" component={Pipeline} />
        <Route path="/forecast-requests" component={ForecastRequestsList} />
        <Route path="/forecast-requests/new" component={NewForecastRequest} />
        <Route path="/forecast-requests/:id" component={ForecastRequestDetail} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function MainRouter() {
  return (
    <Switch>
      <Route path="/" component={Login} />
      <Route path="/login" component={Login} />
      
      {/* Public Routes - No Layout */}
      <Route path="/p/:token">
        <PublicLayout>
          <PublicProposal />
        </PublicLayout>
      </Route>
      <Route path="/request-forecast" component={PublicRequestForecast} />
      
      {/* All other routes get AppLayout */}
      <Route path="*">
        <ProtectedRouter />
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <MainRouter />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;