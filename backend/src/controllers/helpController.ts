import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

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


interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    company_id: number | null;
  };
}

/**
 * Get all help categories
 */
export const getHelpCategories = async (_req: Request, res: Response): Promise<void> => {
  try {
    const categories = await prisma.$queryRaw<any[]>`
      SELECT
        id,
        name,
        slug,
        description,
        icon,
        parent_id,
        display_order,
        (SELECT COUNT(*) FROM help_articles WHERE category_id = help_categories.id AND is_published = TRUE) as article_count,
        (SELECT COUNT(*) FROM help_faqs WHERE category_id = help_categories.id AND is_published = TRUE) as faq_count
      FROM help_categories
      WHERE is_active = TRUE
      ORDER BY display_order, name
    `;

    res.json(serializeBigInt({
      success: true,
      data: categories
    }));
  } catch (error) {
    console.error('Get help categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch help categories'
    });
  }
};

/**
 * Get all help articles with optional filtering
 */
export const getHelpArticles = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, page_context, feature_tag, is_featured, search } = req.query;

    // Get user context for visibility filtering
    const userCompanyId = (req as any).user?.company_id;
    const userRole = (req as any).user?.role;
    
    let query = `
      SELECT
        a.id,
        a.category_id,
        a.title,
        a.slug,
        a.summary,
        a.difficulty,
        a.estimated_read_time,
        a.view_count,
        a.is_featured,
        a.published_at,
        a.updated_at,
        c.name as category_name,
        c.slug as category_slug
      FROM help_articles a
      JOIN help_categories c ON a.category_id = c.id
      WHERE a.is_published = TRUE
        AND (
          a.visibility = 'global'
          OR (a.visibility = 'company_specific' AND JSON_CONTAINS(a.target_company_ids, '[${userCompanyId}]', '$'))
          OR (a.visibility = 'role_specific' AND JSON_CONTAINS(a.target_roles, '"${userRole}"', '$'))
        )
    `;

    const params: any[] = [];

    if (category_id) {
      query += ` AND a.category_id = ?`;
      params.push(Number(category_id));
    }

    if (page_context) {
      query += ` AND a.page_context = ?`;
      params.push(page_context);
    }

    if (feature_tag) {
      query += ` AND a.feature_tag = ?`;
      params.push(feature_tag);
    }

    if (is_featured === 'true') {
      query += ` AND a.is_featured = TRUE`;
    }

    if (search) {
      query += ` AND MATCH(a.title, a.summary, a.content) AGAINST(? IN NATURAL LANGUAGE MODE)`;
      params.push(search);
    }

    query += ` ORDER BY a.is_featured DESC, a.published_at DESC`;

    const articles = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    res.json(serializeBigInt({
      success: true,
      data: articles
    }));
  } catch (error) {
    console.error('Get help articles error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch help articles'
    });
  }
};

/**
 * Get single article by slug with full content
 */
export const getArticleBySlug = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = req.params;

    const article = await prisma.$queryRaw<any[]>`
      SELECT
        a.*,
        c.name as category_name,
        c.slug as category_slug,
        u.name as author_name
      FROM help_articles a
      JOIN help_categories c ON a.category_id = c.id
      LEFT JOIN users u ON a.author_id = u.id
      WHERE a.slug = ${slug} AND a.is_published = TRUE
      LIMIT 1
    `;

    if (!article || article.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Article not found'
      });
      return;
    }

    // Increment view count
    await prisma.$executeRaw`
      UPDATE help_articles
      SET view_count = view_count + 1
      WHERE id = ${article[0].id}
    `;

    // Get related articles
    const relatedArticles = await prisma.$queryRaw<any[]>`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        r.relation_type
      FROM help_article_relations r
      JOIN help_articles a ON r.related_article_id = a.id
      WHERE r.article_id = ${article[0].id} AND a.is_published = TRUE
      ORDER BY
        CASE r.relation_type
          WHEN 'prerequisite' THEN 1
          WHEN 'next-step' THEN 2
          ELSE 3
        END
    `;

    res.json(serializeBigInt({
      success: true,
      data: {
        ...article[0],
        related_articles: relatedArticles
      }
    }));
  } catch (error) {
    console.error('Get article by slug error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch article'
    });
  }
};

/**
 * Get all FAQs with optional filtering
 */
export const getHelpFAQs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category_id, page_context, feature_tag, search } = req.query;

    let query = `
      SELECT
        f.id,
        f.category_id,
        f.question,
        f.answer,
        f.view_count,
        f.helpful_count,
        f.not_helpful_count,
        c.name as category_name,
        c.slug as category_slug
      FROM help_faqs f
      JOIN help_categories c ON f.category_id = c.id
      WHERE f.is_published = TRUE
    `;

    const params: any[] = [];

    if (category_id) {
      query += ` AND f.category_id = ?`;
      params.push(Number(category_id));
    }

    if (page_context) {
      query += ` AND f.page_context = ?`;
      params.push(page_context);
    }

    if (feature_tag) {
      query += ` AND f.feature_tag = ?`;
      params.push(feature_tag);
    }

    if (search) {
      query += ` AND MATCH(f.question, f.answer) AGAINST(? IN NATURAL LANGUAGE MODE)`;
      params.push(search);
    }

    query += ` ORDER BY f.display_order, f.helpful_count DESC`;

    const faqs = await prisma.$queryRawUnsafe<any[]>(query, ...params);

    res.json(serializeBigInt({
      success: true,
      data: faqs
    }));
  } catch (error) {
    console.error('Get help FAQs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs'
    });
  }
};

/**
 * Search help content (articles + FAQs)
 */
export const searchHelp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      res.status(400).json({
        success: false,
        message: 'Search query must be at least 2 characters'
      });
      return;
    }

    const searchTerm = q.trim();

    // Search articles
    const articles = await prisma.$queryRaw<any[]>`
      SELECT
        a.id,
        a.title,
        a.slug,
        a.summary,
        'article' as result_type,
        c.name as category_name,
        c.slug as category_slug,
        MATCH(a.title, a.summary, a.content) AGAINST(${searchTerm} IN NATURAL LANGUAGE MODE) as relevance
      FROM help_articles a
      JOIN help_categories c ON a.category_id = c.id
      WHERE a.is_published = TRUE
        AND MATCH(a.title, a.summary, a.content) AGAINST(${searchTerm} IN NATURAL LANGUAGE MODE)
      ORDER BY relevance DESC
      LIMIT 10
    `;

    // Search FAQs
    const faqs = await prisma.$queryRaw<any[]>`
      SELECT
        f.id,
        f.question as title,
        f.answer as summary,
        'faq' as result_type,
        c.name as category_name,
        c.slug as category_slug,
        MATCH(f.question, f.answer) AGAINST(${searchTerm} IN NATURAL LANGUAGE MODE) as relevance
      FROM help_faqs f
      JOIN help_categories c ON f.category_id = c.id
      WHERE f.is_published = TRUE
        AND MATCH(f.question, f.answer) AGAINST(${searchTerm} IN NATURAL LANGUAGE MODE)
      ORDER BY relevance DESC
      LIMIT 10
    `;

    // Combine and sort by relevance
    const results = [...articles, ...faqs].sort((a, b) =>
      Number(b.relevance) - Number(a.relevance)
    );

    res.json(serializeBigInt({
      success: true,
      data: {
        query: searchTerm,
        total: results.length,
        results: results.slice(0, 20)
      }
    }));
  } catch (error) {
    console.error('Search help error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search help content'
    });
  }
};

/**
 * Submit article feedback (helpful/not helpful)
 */
export const submitArticleFeedback = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { article_id } = req.params;
    const { is_helpful, feedback_text } = req.body;

    if (typeof is_helpful !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'is_helpful must be a boolean'
      });
      return;
    }

    const userId = req.user?.id || null;

    // Insert feedback
    await prisma.$executeRaw`
      INSERT INTO help_article_feedback (article_id, user_id, is_helpful, feedback_text)
      VALUES (${Number(article_id)}, ${userId}, ${is_helpful}, ${feedback_text || null})
    `;

    // Update article counts
    if (is_helpful) {
      await prisma.$executeRaw`
        UPDATE help_articles
        SET helpful_count = helpful_count + 1
        WHERE id = ${Number(article_id)}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE help_articles
        SET not_helpful_count = not_helpful_count + 1
        WHERE id = ${Number(article_id)}
      `;
    }

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });
  } catch (error) {
    console.error('Submit article feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback'
    });
  }
};

/**
 * Submit FAQ feedback (helpful/not helpful)
 */
export const submitFAQFeedback = async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { faq_id } = _req.params;
    const { is_helpful } = _req.body;

    if (typeof is_helpful !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'is_helpful must be a boolean'
      });
      return;
    }

    // Update FAQ counts
    if (is_helpful) {
      await prisma.$executeRaw`
        UPDATE help_faqs
        SET helpful_count = helpful_count + 1
        WHERE id = ${Number(faq_id)}
      `;
    } else {
      await prisma.$executeRaw`
        UPDATE help_faqs
        SET not_helpful_count = not_helpful_count + 1
        WHERE id = ${Number(faq_id)}
      `;
    }

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });
  } catch (error) {
    console.error('Submit FAQ feedback error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback'
    });
  }
};

/**
 * Increment FAQ view count
 */
export const incrementFAQView = async (req: Request, res: Response): Promise<void> => {
  try {
    const { faq_id } = req.params;

    await prisma.$executeRaw`
      UPDATE help_faqs
      SET view_count = view_count + 1
      WHERE id = ${Number(faq_id)}
    `;

    res.json({
      success: true
    });
  } catch (error) {
    console.error('Increment FAQ view error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to increment view count'
    });
  }
};
