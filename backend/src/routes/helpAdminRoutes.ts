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
  getArticleChangelog
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

export default router;
