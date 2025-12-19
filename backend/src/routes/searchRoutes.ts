import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { globalSearch } from '../controllers/globalSearchController';
import { getSearchSuggestions, getSearchHistory } from '../controllers/searchController';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Global search (legacy route from frontend)
router.get('/global', globalSearch);

// Also support root path
router.get('/', globalSearch);

// Search suggestions
router.get('/suggestions', getSearchSuggestions);

// Search history
router.get('/history', getSearchHistory);

export default router;
