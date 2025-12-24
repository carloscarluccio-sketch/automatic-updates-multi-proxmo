// Template Management Routes
import express from 'express';
import {
  getTemplates,
  getTemplateDetails,
  markAsTemplate,
  unmarkAsTemplate
} from '../controllers/templatesController';

const router = express.Router();

// Get all templates
router.get('/', getTemplates);

// Get single template details
router.get('/:id', getTemplateDetails);

// Mark VM as template
router.post('/:id/mark-template', markAsTemplate);

// Unmark VM as template
router.post('/:id/unmark-template', unmarkAsTemplate);

export default router;
