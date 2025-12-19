// Main Express application
import path from "path";
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createServer } from 'http';
import config from './config/env';
import logger from './utils/logger';
import { errorHandler } from './middlewares/errorHandler';
import { apiLimiter } from './middlewares/rateLimiter';
import { initializeConsoleProxy } from './utils/proxmoxConsoleProxy';

// Routes
import authRoutes from './routes/authRoutes';
import usersRoutes from './routes/usersRoutes';
import companiesRoutes from './routes/companiesRoutes';
import vmsRoutes from './routes/vmsRoutes';
import clustersRoutes from './routes/clustersRoutes';
import bulkClusterRoutes from './routes/bulkClusterRoutes';
import projectsRoutes from './routes/projectsRoutes';
import ipRangesRoutes from './routes/ipRangesRoutes';
import statsRoutes from './routes/statsRoutes';
import templatesRoutes from './routes/templatesRoutes';
import brandingRoutes from './routes/brandingRoutes';
import isosRoutes from './routes/isosRoutes';
import apiTokensRoutes from './routes/apiTokensRoutes';
import profilesRoutes from './routes/profilesRoutes';
import natRoutes from './routes/natRoutes';
import ssoRoutes from './routes/ssoRoutes';
import twoFactorRoutes from './routes/twoFactorRoutes';
import analyticsRoutes from './routes/analyticsRoutes';
import activityLogsRoutes from './routes/activityLogsRoutes';
import feedbackRoutes from './routes/feedbackRoutes';
import opnsenseRoutes from './routes/opnsenseRoutes';
import vmImportRoutes from './routes/vmImportRoutes';
import billingRoutes from './routes/billingRoutes';
import pricingPlanRoutes from './routes/pricingPlanRoutes';
import pricingRoutes from './routes/pricingRoutes';
import companyClusterRoutes from './routes/companyClusterRoutes';
import paygRoutes from './routes/paygRoutes';
import invoicesRoutes from './routes/invoicesRoutes';
import isoSyncRoutes from './routes/isoSyncRoutes';
import backupSchedulesRoutes from './routes/backupSchedulesRoutes';
import snapshotSchedulesRoutes from './routes/snapshotSchedulesRoutes';
import onboardingRoutes from './routes/onboardingRoutes';
import drTestSchedulesRoutes from './routes/drTestSchedulesRoutes';
import drClusterPairsRoutes from './routes/drClusterPairsRoutes';
import backupPoliciesRoutes from './routes/backupPoliciesRoutes';
import vmTemplatesRoutes from './routes/vmTemplatesRoutes';
import publicApiRoutes from './routes/publicApiRoutes';
import alertRulesRoutes from './routes/alertRulesRoutes';
import esxiRoutes from './routes/esxiRoutes';
import batchIPRoutes from './routes/batchIPRoutes';
import ipTrackingRoutes from './routes/ipTrackingRoutes';
import ipReservationsRoutes from './routes/ipReservationsRoutes';
import sslRoutes from './routes/sslRoutes';
import nginxRoutes from './routes/nginxRoutes';
import subnetCalculatorRoutes from './routes/subnetCalculatorRoutes';
import vmSchedulesRoutes from './routes/vmSchedulesRoutes';
import resourceMonitoringRoutes from './routes/resourceMonitoringRoutes';
import notificationRoutes from './routes/notificationRoutes';
import helpRoutes from './routes/helpRoutes';
import helpAdminRoutes from './routes/helpAdminRoutes';
import supportTicketRoutes from './routes/supportTicketRoutes';
import searchRoutes from './routes/searchRoutes';
import webhookRoutes from './routes/webhookRoutes';
import rateLimitRoutes from './routes/rateLimitRoutes';
import notificationSettingsRoutes from './routes/notificationSettingsRoutes';
import emailSettingsRoutes from './routes/emailSettingsRoutes';
import paymentMethodsRoutes from './routes/paymentMethodsRoutes';
import subscriptionRoutes from './routes/subscriptionRoutes';

const app = express();

// Trust proxy - nginx is on the same machine, trust first proxy hop
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGINS,
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());


// Serve uploaded files
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
// Rate limiting
app.use('/api', apiLimiter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);

// IMPORTANT: Mount more specific /api/companies/* routes BEFORE the generic /api/companies route
// This prevents routes like /api/companies/branding from being matched by /api/companies/:id
app.use('/api/companies', brandingRoutes);       // Handles /branding and /url-mappings
app.use('/api/companies', companyClusterRoutes); // Handles /clusters
app.use('/api/companies', companiesRoutes);       // Handles / and /:id (must be last!)

app.use('/api/vms', vmsRoutes);
app.use('/api/clusters', clustersRoutes);
app.use('/api/bulk-clusters', bulkClusterRoutes);
app.use('/api/ip-ranges', ipRangesRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/isos', isosRoutes);
app.use('/api/tokens', apiTokensRoutes);
app.use('/api/profiles', profilesRoutes);
app.use('/api/nat', natRoutes);
app.use('/api/sso', ssoRoutes);
app.use('/api/2fa', twoFactorRoutes);
app.use('/api/ssl', sslRoutes);
app.use('/api/nginx', nginxRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/logs', activityLogsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/opnsense', opnsenseRoutes);
app.use('/api/vm-import', vmImportRoutes);
app.use('/api/pricing-plans', pricingPlanRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/payg', paygRoutes);
app.use('/api/invoices', invoicesRoutes);
app.use('/api/isos', isoSyncRoutes);
app.use('/api/backup-schedules', backupSchedulesRoutes);
app.use('/api/snapshot-schedules', snapshotSchedulesRoutes);
app.use('/api/dr-test-schedules', drTestSchedulesRoutes);
app.use('/api/dr-cluster-pairs', drClusterPairsRoutes);
app.use('/api/backup-policies', backupPoliciesRoutes);
app.use('/api/vm-templates', vmTemplatesRoutes);
app.use('/api/alert-rules', alertRulesRoutes);
app.use('/api/esxi-hosts', esxiRoutes);
app.use('/api/batch-ip', batchIPRoutes);
app.use('/api/ip-tracking', ipTrackingRoutes);
app.use('/api/ip-reservations', ipReservationsRoutes);
app.use('/api/subnet-calculator', subnetCalculatorRoutes);
app.use('/api/vm-schedules', vmSchedulesRoutes);
app.use('/api/monitoring', resourceMonitoringRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/help', helpRoutes);
app.use('/api/help-admin', helpAdminRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/notification-settings', notificationSettingsRoutes);
app.use('/api/rate-limits', rateLimitRoutes);
app.use('/api/v1', publicApiRoutes);
app.use('/api/public/onboarding', onboardingRoutes);
app.use('/api/admin/onboarding', onboardingRoutes);
app.use('/api/email', emailSettingsRoutes);
app.use('/api/payment', paymentMethodsRoutes);
app.use('/api/subscriptions', subscriptionRoutes);


// 404 handler
app.use((_req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error handler
app.use(errorHandler);


const PORT = config.PORT;
const HOST = '0.0.0.0';

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Initialize console proxy WebSocket server
initializeConsoleProxy({
  server: httpServer,
  path: '/console-proxy'
});

httpServer.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on http://${HOST}:${PORT}`);
  logger.info(`📺 Console proxy available at ws://${HOST}:${PORT}/console-proxy`);
  logger.info(`Environment: ${config.NODE_ENV}`);
  logger.info(`API URL: ${config.API_URL}`);
  logger.info(`Accepting connections from all network interfaces`);
});

export default app;
