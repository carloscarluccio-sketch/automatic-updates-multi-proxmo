import { Router } from 'express';
import {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  publishArticle,
  unpublishArticle,
  saveDraft,
  getDrafts,
  publishFromDraft,
  deleteDraft,
  getArticleChangelog,
  getFAQs,
  getFAQById,
  createFAQ,
  updateFAQ,
  deleteFAQ,
  publishFAQ,
  unpublishFAQ,
  getAdminCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory
} from '../controllers/helpAdminController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticate);

// Article CRUD routes
router.get('/articles', getArticles);
router.get('/articles/:id', getArticleById);
router.post('/articles', createArticle);
router.put('/articles/:id', updateArticle);
router.delete('/articles/:id', deleteArticle);

// Article publishing routes
router.post('/articles/:id/publish', publishArticle);
router.post('/articles/:id/unpublish', unpublishArticle);

// Changelog route
router.get('/articles/:id/changelog', getArticleChangelog);

// Draft routes
router.get('/drafts', getDrafts);
router.post('/drafts', saveDraft);
router.post('/drafts/:id/publish', publishFromDraft);
router.delete('/drafts/:id', deleteDraft);

// FAQ CRUD routes
router.get('/faqs', getFAQs);
router.get('/faqs/:id', getFAQById);
router.post('/faqs', createFAQ);
router.put('/faqs/:id', updateFAQ);
router.delete('/faqs/:id', deleteFAQ);

// FAQ publishing routes
router.post('/faqs/:id/publish', publishFAQ);
router.post('/faqs/:id/unpublish', unpublishFAQ);

// Category CRUD routes
router.get('/categories', getAdminCategories);
router.get('/categories/:id', getCategoryById);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

export default router;
