import { Router } from 'express';
import {
  getCompanyInvoices,
  getInvoiceDetail,
  updateInvoiceStatus,
  sendInvoice,
  generateInvoicePDF,
  getInvoiceStatistics,
  deleteDraftInvoice,
} from '../controllers/invoicesController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Invoice list and statistics
router.get('/companies/:companyId/invoices', getCompanyInvoices);
router.get('/companies/:companyId/invoices/statistics', getInvoiceStatistics);

// Invoice detail
router.get('/invoices/:invoiceId', getInvoiceDetail);

// Invoice actions
router.patch('/invoices/:invoiceId/status', updateInvoiceStatus);
router.post('/invoices/:invoiceId/send', sendInvoice);
router.post('/invoices/:invoiceId/generate-pdf', generateInvoicePDF);
router.delete('/invoices/:invoiceId', deleteDraftInvoice);

export default router;
