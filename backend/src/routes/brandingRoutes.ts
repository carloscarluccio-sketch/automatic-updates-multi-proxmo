import express from 'express';
import { getDefaultBranding } from '../controllers/publicBrandingController';
import {
  getBranding,
  updateBranding,
  uploadCompanyLogo,
  deleteCompanyLogo,
  uploadCompanyFavicon,
  deleteCompanyFavicon,
  getPublicBranding,
  getGlobalBranding,
  updateGlobalBranding,
  getURLMappings,
  getURLMapping,
  createURLMapping,
  updateURLMapping,
  uploadURLMappingLogo,
  deleteURLMapping,
  listEmailTemplates,
  getEmailTemplate,
  createEmailTemplate,
  updateEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  getTemplateVariables,
} from '../controllers/brandingController';
import { authenticate } from '../middlewares/auth';
import { uploadLogo, uploadFavicon, handleUploadError } from '../middlewares/upload';

const router = express.Router();

// ===== PUBLIC ROUTES (NO AUTH) - MUST BE BEFORE authenticate() =====
router.get('/branding/public', getDefaultBranding);
router.get('/branding/public/:domain', getPublicBranding);

// ===== ALL ROUTES BELOW REQUIRE AUTHENTICATION =====
router.use(authenticate);

// Global branding routes (super_admin only)
router.get('/branding/global', getGlobalBranding);
router.put('/branding/global', updateGlobalBranding);

// Company branding routes
router.get('/branding/:companyId?', getBranding);
router.put('/branding/:companyId?', updateBranding);
router.post('/branding/:companyId?/logo', uploadLogo, handleUploadError, uploadCompanyLogo);
router.delete('/branding/:companyId?/logo', deleteCompanyLogo);
router.post('/branding/:companyId?/favicon', uploadFavicon, handleUploadError, uploadCompanyFavicon);
router.delete('/branding/:companyId?/favicon', deleteCompanyFavicon);

// URL Mapping routes
router.get('/url-mappings', getURLMappings);
router.get('/url-mappings/:id', getURLMapping);
router.post('/url-mappings', createURLMapping);
router.put('/url-mappings/:id', updateURLMapping);
router.post('/url-mappings/:id/logo', uploadLogo, handleUploadError, uploadURLMappingLogo);
router.delete('/url-mappings/:id', deleteURLMapping);

// Email template routes
router.get('/email-templates', listEmailTemplates);
router.get('/email-templates/:id', getEmailTemplate);
router.post('/email-templates', createEmailTemplate);
router.put('/email-templates/:id', updateEmailTemplate);
router.delete('/email-templates/:id', deleteEmailTemplate);
router.post('/email-templates/:id/preview', previewEmailTemplate);
router.get('/email-templates/variables/:templateType', getTemplateVariables);

export default router;
