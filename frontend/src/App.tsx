import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CssBaseline } from '@mui/material';
import { DynamicThemeProvider } from './theme/DynamicThemeProvider';
import { LoginPage } from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import CompaniesPage from './pages/CompaniesPage';
import { VMsPage } from './pages/VMsPage';
import { ClustersPage } from './pages/ClustersPage';
import { NATPerformancePage } from './pages/NATPerformancePage';
import { ProjectsPage } from './pages/ProjectsPage';
import { IPRangesPage } from './pages/IPRangesPage';
import { TemplatesPage } from './pages/TemplatesPage';
import { BrandingPage } from './pages/BrandingPage';
import { ISOsPage } from './pages/ISOsPage';
import { APITokensPage } from './pages/APITokensPage';
import { ProfilesPage } from './pages/ProfilesPage';
import { NATManagementPage } from './pages/NATManagementPage';
import { SSOConfigPage } from './pages/SSOConfigPage';
import { TwoFactorAuthPage } from './pages/TwoFactorAuthPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { ActivityLogsPage } from './pages/ActivityLogsPage';
import { FeedbackPage } from './pages/FeedbackPage';
import HelpCenterPage from './pages/HelpCenterPage';
import { ArticleManagementPage } from './pages/ArticleManagementPage';
import { OPNsensePage } from './pages/OPNsensePage';
import VMImportPage from './pages/VMImportPage';
import BillingPage from './pages/BillingPage';
import BillingDashboardPage from './pages/BillingDashboardPage';
import PricingPlansPage from './pages/PricingPlansPage';
import PricingManagementPage from './pages/PricingManagementPage';
import UsageDashboardPage from './pages/UsageDashboardPage';
import InvoiceManagementPage from './pages/InvoiceManagementPage';
import ApiDocsPage from './pages/ApiDocsPage';
import BackupSchedulesPage from './pages/BackupSchedulesPage';
import SystemUpdatesPage from './pages/SystemUpdatesPage';
import SnapshotSchedulesPage from './pages/SnapshotSchedulesPage';
import DRTestSchedulesPage from './pages/DRTestSchedulesPage';
import DRClusterPairsPage from './pages/DRClusterPairsPage';
import BackupPoliciesPage from './pages/BackupPoliciesPage';
import VMTemplatesPage from './pages/VMTemplatesPage';
import AlertRulesPage from './pages/AlertRulesPage';
import MonitoringDashboardPage from './pages/MonitoringDashboardPage';
import NotificationsPage from './pages/NotificationsPage';
import ESXiPage from './pages/ESXiPage';
import { IPTrackingPage } from './pages/IPTrackingPage';
import IPReservationsPage from './pages/IPReservationsPage';
import WebhooksPage from "./pages/WebhooksPage";import SubscriptionPlansPage from "./pages/SubscriptionPlansPage";import RateLimitsPage from "./pages/RateLimitsPage";import NotificationSettingsPage from "./pages/NotificationSettingsPage";import SupportTicketsPage from "./pages/SupportTicketsPage";import EmailTemplatesPage from "./pages/EmailTemplatesPage";import FAQManagementPage from "./pages/FAQManagementPage";import HelpAnalyticsPage from "./pages/HelpAnalyticsPage";import CategoryManagementPage from "./pages/CategoryManagementPage";
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';

// Mobile pages
import MobileDashboard from './pages/MobileDashboard';
import MobileVMsPage from './pages/MobileVMsPage';
import MobileSupportPage from './pages/MobileSupportPage';
import MobileProfilePage from './pages/MobileProfilePage';
import { MobileRedirect } from "./components/MobileRedirect";

function App() {
  return (
    <DynamicThemeProvider>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Mobile routes (no MainLayout sidebar) */}
          <Route path="/mobile" element={<ProtectedRoute><MobileDashboard /></ProtectedRoute>} />
          <Route path="/mobile/vms" element={<ProtectedRoute><MobileVMsPage /></ProtectedRoute>} />
          <Route path="/mobile/support" element={<ProtectedRoute><MobileSupportPage /></ProtectedRoute>} />
          <Route path="/mobile/profile" element={<ProtectedRoute><MobileProfilePage /></ProtectedRoute>} />

          {/* Desktop routes (with MainLayout sidebar) */}
          <Route path="/" element={<ProtectedRoute><MobileRedirect><MainLayout /></MobileRedirect></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="companies" element={<CompaniesPage />} />
            <Route path="vms" element={<VMsPage />} />
            <Route path="clusters" element={<ClustersPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="ip-ranges" element={<IPRangesPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="isos" element={<ISOsPage />} />
            <Route path="api-tokens" element={<APITokensPage />} />
            <Route path="api-docs" element={<ApiDocsPage />} />
            <Route path="profiles" element={<ProfilesPage />} />
            <Route path="branding" element={<BrandingPage />} />
            <Route path="nat" element={<NATManagementPage />} />
            <Route path="nat-performance" element={<NATPerformancePage />} />
            <Route path="sso" element={<SSOConfigPage />} />
            <Route path="2fa" element={<TwoFactorAuthPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="activity-logs" element={<ActivityLogsPage />} />
            <Route path="feedback" element={<FeedbackPage />} />
            <Route path="help" element={<HelpCenterPage />} />
            <Route path="help-admin/articles" element={<ArticleManagementPage />} />
            <Route path="opnsense" element={<OPNsensePage />} />
            <Route path="vm-import" element={<VMImportPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="billing-dashboard" element={<BillingDashboardPage />} />
            <Route path="pricing-plans" element={<PricingPlansPage />} />
            <Route path="usage-dashboard" element={<UsageDashboardPage />} />
            <Route path="invoices" element={<InvoiceManagementPage />} />
            <Route path="pricing" element={<PricingManagementPage />} />
            <Route path="system-updates" element={<SystemUpdatesPage />} />
            <Route path="backup-schedules" element={<BackupSchedulesPage />} />
            <Route path="snapshot-schedules" element={<SnapshotSchedulesPage />} />
            <Route path="dr-test-schedules" element={<DRTestSchedulesPage />} />
            <Route path="dr-cluster-pairs" element={<DRClusterPairsPage />} />
            <Route path="backup-policies" element={<BackupPoliciesPage />} />
            <Route path="vm-templates" element={<VMTemplatesPage />} />
            <Route path="alert-rules" element={<AlertRulesPage />} />
            <Route path="monitoring" element={<MonitoringDashboardPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="esxi-import" element={<ESXiPage />} />
            <Route path="ip-tracking" element={<IPTrackingPage />} />
            <Route path="ip-reservations" element={<IPReservationsPage />} />
<Route path="webhooks" element={<WebhooksPage />} />            <Route path="subscriptions" element={<SubscriptionPlansPage />} />            <Route path="rate-limits" element={<RateLimitsPage />} />            <Route path="notification-settings" element={<NotificationSettingsPage />} />            <Route path="support-tickets" element={<SupportTicketsPage />} />            <Route path="email-templates" element={<EmailTemplatesPage />} />            <Route path="help-admin/faqs" element={<FAQManagementPage />} />            <Route path="help-admin/analytics" element={<HelpAnalyticsPage />} />            <Route path="help-admin/categories" element={<CategoryManagementPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </BrowserRouter>
    </DynamicThemeProvider>
  );
}

export default App;
