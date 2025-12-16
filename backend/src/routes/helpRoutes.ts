import { Router } from 'express';
import {
  getHelpCategories,
  getHelpArticles,
  getArticleBySlug,
  getHelpFAQs,
  searchHelp,
  submitArticleFeedback,
  submitFAQFeedback,
  incrementFAQView
} from '../controllers/helpController';

const router = Router();

// Public routes (no authentication required)
router.get('/categories', getHelpCategories);
router.get('/articles', getHelpArticles);
router.get('/articles/:slug', getArticleBySlug);
router.get('/faqs', getHelpFAQs);
router.get('/search', searchHelp);
router.post('/faqs/:faq_id/view', incrementFAQView);

// Feedback routes (optional authentication - can track user if logged in)
router.post('/articles/:article_id/feedback', submitArticleFeedback);
router.post('/faqs/:faq_id/feedback', submitFAQFeedback);

export default router;
