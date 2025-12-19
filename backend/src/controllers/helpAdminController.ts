import { Response } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';

const prisma = new PrismaClient();

/**
 * Helper to convert BigInt values to strings for JSON serialization
 */
function serializeBigInt(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj === "bigint") {
    return obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => serializeBigInt(item));
  }
  
  if (typeof obj === "object") {
    const serialized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        serialized[key] = serializeBigInt(obj[key]);
      }
    }
    return serialized;
  }
  
  return obj;
}

/**
 * Helper function to log article changes to changelog
 */
async function logArticleChange(
  articleId: number,
  changedBy: number,
  companyId: number | null,
  action: 'created' | 'updated' | 'deleted' | 'published' | 'unpublished',
  oldValues?: any,
  newValues?: any,
  changeSummary?: string
): Promise<void> {
  try {
    await prisma.help_article_changelog.create({
      data: {
        article_id: articleId,
        changed_by: changedBy,
        company_id: companyId,
        action: action,
        old_values: oldValues ? (JSON.stringify(oldValues) as Prisma.InputJsonValue) : Prisma.DbNull,
        new_values: newValues ? (JSON.stringify(newValues) as Prisma.InputJsonValue) : Prisma.DbNull,
        change_summary: changeSummary || null,
      },
    });
    logger.info(`Article changelog entry created: ${action} for article ${articleId}`);
  } catch (error: any) {
    logger.error('Failed to log article change:', error);
  }
}

/**
 * Helper function to validate targeting based on user role
 */
function validateTargeting(
  role: string,
  companyId: number | null,
  visibility: string,
  _targetCompanyIds?: any,
  _targetCompanyTypes?: any,
  _targetRoles?: any
): { valid: boolean; error?: string } {
  // Super admin can set any targeting
  if (role === 'super_admin') {
    return { valid: true };
  }

  // Company admin can only create company-specific articles for their company
  if (role === 'company_admin') {
    if (visibility !== 'company_specific') {
      return { valid: false, error: 'Company admins can only create company-specific articles' };
    }

    if (!companyId) {
      return { valid: false, error: 'Company ID is required for company admin' };
    }

    // Target company IDs must include their own company
    const targetIds = Array.isArray(_targetCompanyIds) ? _targetCompanyIds : [];
    if (targetIds.length !== 1 || targetIds[0] !== companyId) {
      return { valid: false, error: 'Company admins can only target their own company' };
    }

    return { valid: true };
  }

  return { valid: false, error: 'Insufficient permissions' };
}

/**
 * List all articles with filtering and pagination
 * GET /api/help-admin/articles
 */
export const getArticles = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id } = req.user!;
    const {
      category_id,
      visibility,
      is_published,
      search,
      page = '1',
      limit = '20',
      company_id: filterCompanyId,
    } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    let where: any = {};

    // Role-based filtering
    if (role !== 'super_admin' && company_id !== null) {
      where.created_by_company_id = company_id;
    }

    // Apply filters
    if (category_id) where.category_id = parseInt(category_id as string, 10);
    if (visibility) where.visibility = visibility;
    if (is_published !== undefined) where.is_published = is_published === 'true';
    if (filterCompanyId && role === 'super_admin') {
      where.created_by_company_id = parseInt(filterCompanyId as string, 10);
    }

    // Full-text search
    if (search) {
      where.OR = [
        { title: { contains: search as string } },
        { summary: { contains: search as string } },
        { content: { contains: search as string } },
        { meta_keywords: { contains: search as string } },
      ];
    }

    const [articles, total] = await Promise.all([
      prisma.help_articles.findMany({
        where,
        include: {
          help_categories: {
            select: { id: true, name: true, icon: true },
          },
        },
        orderBy: { created_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.help_articles.count({ where }),
    ]);

    res.json({
      success: true,
      data: serializeBigInt(articles),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Get articles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch articles',
      error: error.message,
    });
  }
};

/**
 * Get single article by ID with edit permissions check
 * GET /api/help-admin/articles/:id
 */
export const getArticleById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;

    const article = await prisma.help_articles.findUnique({
      where: { id: parseInt(id, 10) },
      include: {
        help_categories: {
          select: { id: true, name: true, icon: true, slug: true },
        },
      },
    });

    if (!article) {
      res.status(404).json({
        success: false,
        message: 'Article not found',
      });
      return;
    }

    // Check edit permissions
    const canEdit =
      role === 'super_admin' ||
      (role === 'company_admin' && article.created_by_company_id === company_id);

    if (!canEdit) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to access this article',
      });
      return;
    }

    res.json({
      success: true,
      data: serializeBigInt(article),
      canEdit,
    });
  } catch (error: any) {
    logger.error('Get article by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article',
      error: error.message,
    });
  }
};

/**
 * Create new article
 * POST /api/help-admin/articles
 */
export const createArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: userId } = req.user!;
    const {
      category_id,
      title,
      slug,
      summary,
      content,
      content_type = 'markdown',
      page_context,
      feature_tag,
      difficulty = 'beginner',
      estimated_read_time = 5,
      is_published = false,
      visibility = 'global',
      is_featured = false,
      meta_keywords,
      meta_description,
      target_company_ids,
      target_company_types,
      target_roles,
    } = req.body;

    // Validation
    if (!category_id || !title || !slug || !content) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: category_id, title, slug, content',
      });
      return;
    }

    // Validate targeting
    const targetingValidation = validateTargeting(
      role,
      company_id,
      visibility,
      target_company_ids,
      target_company_types,
      target_roles
    );

    if (!targetingValidation.valid) {
      res.status(403).json({
        success: false,
        message: targetingValidation.error,
      });
      return;
    }

    // Check slug uniqueness
    const existingSlug = await prisma.help_articles.findUnique({
      where: { slug },
    });

    if (existingSlug) {
      res.status(400).json({
        success: false,
        message: 'Article with this slug already exists',
      });
      return;
    }

    // Create article
    const article = await prisma.help_articles.create({
      data: {
        category_id: parseInt(category_id, 10),
        title,
        slug,
        summary,
        content,
        content_type,
        page_context,
        feature_tag,
        difficulty,
        estimated_read_time: parseInt(estimated_read_time, 10),
        is_published,
        visibility,
        is_featured,
        meta_keywords,
        meta_description,
        author_id: userId,
        created_by_company_id: company_id,
        target_company_ids: target_company_ids ? (target_company_ids as Prisma.InputJsonValue) : Prisma.DbNull,
        target_company_types: target_company_types ? (target_company_types as Prisma.InputJsonValue) : Prisma.DbNull,
        target_roles: target_roles ? (target_roles as Prisma.InputJsonValue) : Prisma.DbNull,
        published_at: is_published ? new Date() : null,
      },
      include: {
        help_categories: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    // Log to changelog
    await logArticleChange(
      article.id,
      userId!,
      company_id,
      'created',
      undefined,
      article,
      `Article created: ${title}`
    );

    logger.info(`Article created: ${article.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: serializeBigInt(article),
      message: 'Article created successfully',
    });
  } catch (error: any) {
    logger.error('Create article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create article',
      error: error.message,
    });
  }
};

/**
 * Update existing article
 * PUT /api/help-admin/articles/:id
 */
export const updateArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;
    const updateData = req.body;

    // Get existing article
    const existingArticle = await prisma.help_articles.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!existingArticle) {
      res.status(404).json({
        success: false,
        message: 'Article not found',
      });
      return;
    }

    // Check edit permissions
    const canEdit =
      role === 'super_admin' ||
      (role === 'company_admin' && existingArticle.created_by_company_id === company_id);

    if (!canEdit) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to edit this article',
      });
      return;
    }

    // Validate targeting if being updated
    if (updateData.visibility || updateData.target_company_ids) {
      const targetingValidation = validateTargeting(
        role,
        company_id,
        updateData.visibility || existingArticle.visibility,
        updateData.target_company_ids,
        updateData.target_company_types,
        updateData.target_roles
      );

      if (!targetingValidation.valid) {
        res.status(403).json({
          success: false,
          message: targetingValidation.error,
        });
        return;
      }
    }

    // Check slug uniqueness if slug is being updated
    if (updateData.slug && updateData.slug !== existingArticle.slug) {
      const existingSlug = await prisma.help_articles.findUnique({
        where: { slug: updateData.slug },
      });

      if (existingSlug) {
        res.status(400).json({
          success: false,
          message: 'Article with this slug already exists',
        });
        return;
      }
    }

    // Prepare update data
    const dataToUpdate: any = {};
    const allowedFields = [
      'category_id',
      'title',
      'slug',
      'summary',
      'content',
      'content_type',
      'page_context',
      'feature_tag',
      'difficulty',
      'estimated_read_time',
      'visibility',
      'is_featured',
      'meta_keywords',
      'meta_description',
    ];

    allowedFields.forEach((field) => {
      if (updateData[field] !== undefined) {
        dataToUpdate[field] = updateData[field];
      }
    });

    // Handle JSON fields
    if (updateData.target_company_ids !== undefined) {
      dataToUpdate.target_company_ids = updateData.target_company_ids as Prisma.InputJsonValue;
    }
    if (updateData.target_company_types !== undefined) {
      dataToUpdate.target_company_types = updateData.target_company_types as Prisma.InputJsonValue;
    }
    if (updateData.target_roles !== undefined) {
      dataToUpdate.target_roles = updateData.target_roles as Prisma.InputJsonValue;
    }

    // Update article
    const updatedArticle = await prisma.help_articles.update({
      where: { id: parseInt(id, 10) },
      data: dataToUpdate,
      include: {
        help_categories: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    // Log to changelog
    await logArticleChange(
      updatedArticle.id,
      userId!,
      company_id,
      'updated',
      existingArticle,
      updatedArticle,
      `Article updated: ${updatedArticle.title}`
    );

    logger.info(`Article updated: ${updatedArticle.id} by user ${userId}`);

    res.json({
      success: true,
      data: serializeBigInt(updatedArticle),
      message: 'Article updated successfully',
    });
  } catch (error: any) {
    logger.error('Update article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update article',
      error: error.message,
    });
  }
};

/**
 * Delete article (soft delete by unpublishing or hard delete)
 * DELETE /api/help-admin/articles/:id?hard=true
 */
export const deleteArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { hard } = req.query;
    const { role, company_id, id: userId } = req.user!;

    // Get existing article
    const existingArticle = await prisma.help_articles.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!existingArticle) {
      res.status(404).json({
        success: false,
        message: 'Article not found',
      });
      return;
    }

    // Check delete permissions
    const canDelete =
      role === 'super_admin' ||
      (role === 'company_admin' && existingArticle.created_by_company_id === company_id);

    if (!canDelete) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this article',
      });
      return;
    }

    if (hard === 'true') {
      // Hard delete
      await prisma.help_articles.delete({
        where: { id: parseInt(id, 10) },
      });

      logger.info(`Article hard deleted: ${id} by user ${userId}`);

      res.json({
        success: true,
        message: 'Article permanently deleted',
      });
    } else {
      // Soft delete (unpublish)
      const updatedArticle = await prisma.help_articles.update({
        where: { id: parseInt(id, 10) },
        data: { is_published: false },
      });

      // Log to changelog
      await logArticleChange(
        updatedArticle.id,
        userId!,
        company_id,
        'deleted',
        existingArticle,
        updatedArticle,
        `Article unpublished (soft delete): ${existingArticle.title}`
      );

      logger.info(`Article soft deleted (unpublished): ${id} by user ${userId}`);

      res.json({
        success: true,
        data: serializeBigInt(updatedArticle),
        message: 'Article unpublished',
      });
    }
  } catch (error: any) {
    logger.error('Delete article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete article',
      error: error.message,
    });
  }
};

/**
 * Publish an article
 * POST /api/help-admin/articles/:id/publish
 */
export const publishArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    // Get existing article
    const existingArticle = await prisma.help_articles.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!existingArticle) {
      res.status(404).json({
        success: false,
        message: 'Article not found',
      });
      return;
    }

    // Check edit permissions
    const canEdit =
      role === 'super_admin' ||
      (role === 'company_admin' && existingArticle.created_by_company_id === company_id);

    if (!canEdit) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to publish this article',
      });
      return;
    }

    if (existingArticle.is_published) {
      res.status(400).json({
        success: false,
        message: 'Article is already published',
      });
      return;
    }

    // Publish article
    const updatedArticle = await prisma.help_articles.update({
      where: { id: parseInt(id, 10) },
      data: {
        is_published: true,
        published_at: new Date(),
      },
      include: {
        help_categories: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    // Log to changelog
    await logArticleChange(
      updatedArticle.id,
      userId!,
      company_id,
      'published',
      existingArticle,
      updatedArticle,
      `Article published: ${updatedArticle.title}`
    );

    logger.info(`Article published: ${id} by user ${userId}`);

    res.json({
      success: true,
      data: serializeBigInt(updatedArticle),
      message: 'Article published successfully',
    });
  } catch (error: any) {
    logger.error('Publish article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish article',
      error: error.message,
    });
  }
};

/**
 * Unpublish an article
 * POST /api/help-admin/articles/:id/unpublish
 */
export const unpublishArticle = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    // Get existing article
    const existingArticle = await prisma.help_articles.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!existingArticle) {
      res.status(404).json({
        success: false,
        message: 'Article not found',
      });
      return;
    }

    // Check edit permissions
    const canEdit =
      role === 'super_admin' ||
      (role === 'company_admin' && existingArticle.created_by_company_id === company_id);

    if (!canEdit) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to unpublish this article',
      });
      return;
    }

    if (!existingArticle.is_published) {
      res.status(400).json({
        success: false,
        message: 'Article is already unpublished',
      });
      return;
    }

    // Unpublish article
    const updatedArticle = await prisma.help_articles.update({
      where: { id: parseInt(id, 10) },
      data: {
        is_published: false,
      },
      include: {
        help_categories: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    // Log to changelog
    await logArticleChange(
      updatedArticle.id,
      userId!,
      company_id,
      'unpublished',
      existingArticle,
      updatedArticle,
      `Article unpublished: ${updatedArticle.title}`
    );

    logger.info(`Article unpublished: ${id} by user ${userId}`);

    res.json({
      success: true,
      data: serializeBigInt(updatedArticle),
      message: 'Article unpublished successfully',
    });
  } catch (error: any) {
    logger.error('Unpublish article error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unpublish article',
      error: error.message,
    });
  }
};

/**
 * Save article as draft
 * POST /api/help-admin/drafts
 */
export const saveDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id: userId, company_id } = req.user!;
    const {
      article_id,
      category_id,
      title,
      slug,
      summary,
      content,
      content_type = 'markdown',
      visibility = 'global',
      target_company_ids,
      target_company_types,
      target_roles,
      difficulty = 'beginner',
      estimated_read_time = 5,
      is_featured = false,
    } = req.body;

    // Validation
    if (!category_id || !title || !slug || !content) {
      res.status(400).json({
        success: false,
        message: 'Missing required fields: category_id, title, slug, content',
      });
      return;
    }

    // Create or update draft
    const draft = await prisma.help_article_drafts.create({
      data: {
        article_id: article_id ? parseInt(article_id, 10) : null,
        company_id,
        category_id: parseInt(category_id, 10),
        title,
        slug,
        summary,
        content,
        content_type,
        visibility,
        target_company_ids: target_company_ids ? (target_company_ids as Prisma.InputJsonValue) : Prisma.DbNull,
        target_company_types: target_company_types ? (target_company_types as Prisma.InputJsonValue) : Prisma.DbNull,
        target_roles: target_roles ? (target_roles as Prisma.InputJsonValue) : Prisma.DbNull,
        difficulty,
        estimated_read_time: parseInt(estimated_read_time, 10),
        is_featured,
        created_by: userId!,
      },
    });

    logger.info(`Draft saved: ${draft.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: serializeBigInt(draft),
      message: 'Draft saved successfully',
    });
  } catch (error: any) {
    logger.error('Save draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save draft',
      error: error.message,
    });
  }
};

/**
 * Get user's drafts
 * GET /api/help-admin/drafts
 */
export const getDrafts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { role, company_id, id: userId } = req.user!;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    let where: any = {};

    // Role-based filtering
    if (role !== 'super_admin') {
      where.created_by = userId;
      if (company_id !== null) {
        where.company_id = company_id;
      }
    }

    const [drafts, total] = await Promise.all([
      prisma.help_article_drafts.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.help_article_drafts.count({ where }),
    ]);

    res.json({
      success: true,
      data: serializeBigInt(drafts),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Get drafts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch drafts',
      error: error.message,
    });
  }
};

/**
 * Publish article from draft
 * POST /api/help-admin/drafts/:id/publish
 */
export const publishFromDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    // Get draft
    const draft = await prisma.help_article_drafts.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        message: 'Draft not found',
      });
      return;
    }

    // Check permissions
    const canPublish =
      role === 'super_admin' ||
      (role === 'company_admin' && draft.company_id === company_id && draft.created_by === userId);

    if (!canPublish) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to publish this draft',
      });
      return;
    }

    // Validate targeting
    const targetingValidation = validateTargeting(
      role,
      company_id,
      draft.visibility || 'global',
      draft.target_company_ids,
      draft.target_company_types,
      draft.target_roles
    );

    if (!targetingValidation.valid) {
      res.status(403).json({
        success: false,
        message: targetingValidation.error,
      });
      return;
    }

    // Check slug uniqueness
    const existingSlug = await prisma.help_articles.findUnique({
      where: { slug: draft.slug },
    });

    if (existingSlug && (!draft.article_id || existingSlug.id !== draft.article_id)) {
      res.status(400).json({
        success: false,
        message: 'Article with this slug already exists',
      });
      return;
    }

    // Create article from draft
    const article = await prisma.help_articles.create({
      data: {
        category_id: draft.category_id,
        title: draft.title,
        slug: draft.slug,
        summary: draft.summary,
        content: draft.content,
        content_type: draft.content_type || 'markdown',
        difficulty: draft.difficulty || 'beginner',
        estimated_read_time: draft.estimated_read_time || 5,
        is_published: true,
        visibility: draft.visibility || 'global',
        is_featured: draft.is_featured || false,
        author_id: userId,
        created_by_company_id: company_id,
        target_company_ids: draft.target_company_ids as Prisma.InputJsonValue,
        target_company_types: draft.target_company_types as Prisma.InputJsonValue,
        target_roles: draft.target_roles as Prisma.InputJsonValue,
        published_at: new Date(),
      },
      include: {
        help_categories: {
          select: { id: true, name: true, icon: true },
        },
      },
    });

    // Delete draft
    await prisma.help_article_drafts.delete({
      where: { id: parseInt(id, 10) },
    });

    // Log to changelog
    await logArticleChange(
      article.id,
      userId!,
      company_id,
      'created',
      undefined,
      article,
      `Article published from draft: ${article.title}`
    );

    logger.info(`Article published from draft ${id} -> article ${article.id} by user ${userId}`);

    res.status(201).json({
      success: true,
      data: serializeBigInt(article),
      message: 'Article published from draft successfully',
    });
  } catch (error: any) {
    logger.error('Publish from draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish article from draft',
      error: error.message,
    });
  }
};

/**
 * Delete draft
 * DELETE /api/help-admin/drafts/:id
 */
export const deleteDraft = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id, id: userId } = req.user!;

    // Get draft
    const draft = await prisma.help_article_drafts.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!draft) {
      res.status(404).json({
        success: false,
        message: 'Draft not found',
      });
      return;
    }

    // Check permissions
    const canDelete =
      role === 'super_admin' ||
      (role === 'company_admin' && draft.company_id === company_id && draft.created_by === userId);

    if (!canDelete) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this draft',
      });
      return;
    }

    await prisma.help_article_drafts.delete({
      where: { id: parseInt(id, 10) },
    });

    logger.info(`Draft deleted: ${id} by user ${userId}`);

    res.json({
      success: true,
      message: 'Draft deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete draft error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete draft',
      error: error.message,
    });
  }
};

/**
 * Get article changelog
 * GET /api/help-admin/articles/:id/changelog
 */
export const getArticleChangelog = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { role, company_id } = req.user!;
    const { page = '1', limit = '20' } = req.query;

    const pageNum = parseInt(page as string, 10);
    const limitNum = parseInt(limit as string, 10);
    const skip = (pageNum - 1) * limitNum;

    // Get article to check permissions
    const article = await prisma.help_articles.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!article) {
      res.status(404).json({
        success: false,
        message: 'Article not found',
      });
      return;
    }

    // Check permissions
    const canView =
      role === 'super_admin' ||
      (role === 'company_admin' && article.created_by_company_id === company_id);

    if (!canView) {
      res.status(403).json({
        success: false,
        message: 'You do not have permission to view this changelog',
      });
      return;
    }

    const [changelog, total] = await Promise.all([
      prisma.help_article_changelog.findMany({
        where: { article_id: parseInt(id, 10) },
        include: {
          users: {
            select: { id: true, username: true, email: true },
          },
        },
        orderBy: { changed_at: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.help_article_changelog.count({
        where: { article_id: parseInt(id, 10) },
      }),
    ]);

    res.json({
      success: true,
      data: serializeBigInt(changelog),
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / limitNum),
      },
    });
  } catch (error: any) {
    logger.error('Get article changelog error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article changelog',
      error: error.message,
    });
  }
};
// FAQ CRUD Functions

/**
 * Get all FAQs (admin view with unpublished FAQs)
 */
export const getFAQs = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    // Only super_admin and company_admin can manage FAQs
    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const faqs = await prisma.help_faqs.findMany({
      include: {
        help_categories: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { display_order: 'asc' },
        { created_at: 'desc' }
      ]
    });

    res.json(serializeBigInt({
      success: true,
      data: faqs
    }));
  } catch (error) {
    logger.error('Get FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs'
    });
  }
};

/**
 * Get single FAQ by ID
 */
export const getFAQById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;

    const faq = await prisma.help_faqs.findUnique({
      where: { id: parseInt(id) },
      include: {
        help_categories: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    if (!faq) {
      res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
      return;
    }

    res.json(serializeBigInt({
      success: true,
      data: faq
    }));
  } catch (error) {
    logger.error('Get FAQ by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ'
    });
  }
};

/**
 * Create new FAQ
 */
export const createFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const {
      category_id,
      question,
      answer,
      page_context,
      feature_tag,
      display_order,
      is_published
    } = req.body;

    // Validation
    if (!category_id || !question || !answer) {
      res.status(400).json({
        success: false,
        message: 'Category, question, and answer are required'
      });
      return;
    }

    const faq = await prisma.help_faqs.create({
      data: {
        category_id: parseInt(category_id),
        question,
        answer,
        page_context: page_context || null,
        feature_tag: feature_tag || null,
        display_order: display_order || 0,
        is_published: is_published || false,
        // created_by: user.id,
        // updated_by: user.id
      },
      include: {
        help_categories: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    res.status(201).json(serializeBigInt({
      success: true,
      message: 'FAQ created successfully',
      data: faq
    }));
  } catch (error) {
    logger.error('Create FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create FAQ'
    });
  }
};

/**
 * Update FAQ
 */
export const updateFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;
    const {
      category_id,
      question,
      answer,
      page_context,
      feature_tag,
      display_order,
      is_published
    } = req.body;

    const existingFAQ = await prisma.help_faqs.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingFAQ) {
      res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
      return;
    }

    const faq = await prisma.help_faqs.update({
      where: { id: parseInt(id) },
      data: {
        ...(category_id && { category_id: parseInt(category_id) }),
        ...(question && { question }),
        ...(answer && { answer }),
        ...(page_context !== undefined && { page_context }),
        ...(feature_tag !== undefined && { feature_tag }),
        ...(display_order !== undefined && { display_order }),
        ...(is_published !== undefined && { is_published }),
        // updated_by: user.id,
        updated_at: new Date()
      },
      include: {
        help_categories: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    res.json(serializeBigInt({
      success: true,
      message: 'FAQ updated successfully',
      data: faq
    }));
  } catch (error) {
    logger.error('Update FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update FAQ'
    });
  }
};

/**
 * Delete FAQ
 */
export const deleteFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;

    const existingFAQ = await prisma.help_faqs.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingFAQ) {
      res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
      return;
    }

    await prisma.help_faqs.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    logger.error('Delete FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ'
    });
  }
};

/**
 * Publish FAQ
 */
export const publishFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;

    const faq = await prisma.help_faqs.update({
      where: { id: parseInt(id) },
      data: {
        is_published: true,
        // updated_by: user.id,
        updated_at: new Date()
      }
    });

    res.json(serializeBigInt({
      success: true,
      message: 'FAQ published successfully',
      data: faq
    }));
  } catch (error) {
    logger.error('Publish FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to publish FAQ'
    });
  }
};

/**
 * Unpublish FAQ
 */
export const unpublishFAQ = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;

    const faq = await prisma.help_faqs.update({
      where: { id: parseInt(id) },
      data: {
        is_published: false,
        // updated_by: user.id,
        updated_at: new Date()
      }
    });

    res.json(serializeBigInt({
      success: true,
      message: 'FAQ unpublished successfully',
      data: faq
    }));
  } catch (error) {
    logger.error('Unpublish FAQ error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unpublish FAQ'
    });
  }
};

// ============================================================================
// CATEGORY CRUD Functions
// ============================================================================

/**
 * Get all categories (admin view)
 */
export const getAdminCategories = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const categories = await prisma.help_categories.findMany({
      include: {
        _count: {
          select: {
            help_articles: true,
            help_faqs: true
          }
        }
      },
      orderBy: {
        display_order: 'asc'
      }
    });

    res.json(serializeBigInt({
      success: true,
      data: categories
    }));
  } catch (error) {
    logger.error('Get categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch categories'
    });
  }
};

/**
 * Get single category by ID
 */
export const getCategoryById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;

    const category = await prisma.help_categories.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            help_articles: true,
            help_faqs: true
          }
        }
      }
    });

    if (!category) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    res.json(serializeBigInt({
      success: true,
      data: category
    }));
  } catch (error) {
    logger.error('Get category by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch category'
    });
  }
};

/**
 * Create new category
 */
export const createCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const {
      name,
      slug,
      description,
      icon,
      display_order,
      is_active
    } = req.body;

    // Validation
    if (!name || !slug) {
      res.status(400).json({
        success: false,
        message: 'Name and slug are required'
      });
      return;
    }

    // Check if slug already exists
    const existingCategory = await prisma.help_categories.findUnique({
      where: { slug }
    });

    if (existingCategory) {
      res.status(400).json({
        success: false,
        message: 'A category with this slug already exists'
      });
      return;
    }

    const category = await prisma.help_categories.create({
      data: {
        name,
        slug,
        description: description || null,
        icon: icon || null,
        display_order: display_order || 0,
        is_active: is_active !== undefined ? is_active : true
      }
    });

    res.status(201).json(serializeBigInt({
      success: true,
      message: 'Category created successfully',
      data: category
    }));
  } catch (error) {
    logger.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create category'
    });
  }
};

/**
 * Update category
 */
export const updateCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;
    const {
      name,
      slug,
      description,
      icon,
      display_order,
      is_active
    } = req.body;

    const existingCategory = await prisma.help_categories.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingCategory) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Check if new slug conflicts with existing category
    if (slug && slug !== existingCategory.slug) {
      const slugConflict = await prisma.help_categories.findUnique({
        where: { slug }
      });

      if (slugConflict) {
        res.status(400).json({
          success: false,
          message: 'A category with this slug already exists'
        });
        return;
      }
    }

    const category = await prisma.help_categories.update({
      where: { id: parseInt(id) },
      data: {
        ...(name && { name }),
        ...(slug && { slug }),
        ...(description !== undefined && { description }),
        ...(icon !== undefined && { icon }),
        ...(display_order !== undefined && { display_order }),
        ...(is_active !== undefined && { is_active }),
        updated_at: new Date()
      }
    });

    res.json(serializeBigInt({
      success: true,
      message: 'Category updated successfully',
      data: category
    }));
  } catch (error) {
    logger.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update category'
    });
  }
};

/**
 * Delete category
 */
export const deleteCategory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, message: 'Not authenticated' });
      return;
    }

    if (!['super_admin', 'company_admin'].includes(user.role)) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const { id } = req.params;

    const existingCategory = await prisma.help_categories.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: {
            help_articles: true,
            help_faqs: true
          }
        }
      }
    });

    if (!existingCategory) {
      res.status(404).json({
        success: false,
        message: 'Category not found'
      });
      return;
    }

    // Check if category has articles or FAQs
    const articleCount = existingCategory._count.help_articles;
    const faqCount = existingCategory._count.help_faqs;

    if (articleCount > 0 || faqCount > 0) {
      res.status(400).json({
        success: false,
        message: `Cannot delete category with ${articleCount} articles and ${faqCount} FAQs. Please reassign or delete them first.`
      });
      return;
    }

    await prisma.help_categories.delete({
      where: { id: parseInt(id) }
    });

    res.json({
      success: true,
      message: 'Category deleted successfully'
    });
  } catch (error) {
    logger.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete category'
    });
  }
};
