/**
 * Email Template Service
 * Handles email template retrieval, rendering, and management with hierarchy support
 * Priority: URL Mapping → Company → Global
 */

import prisma from '../config/database';
import logger from '../utils/logger';
import brandingService, { BrandingContext } from './BrandingService';

export interface EmailTemplate {
  id: number;
  companyId: number | null;
  urlMappingId: number | null;
  templateType: string;
  templateSlug: string;
  subject: string;
  htmlBody: string;
  textBody: string | null;
  availableVariables: any;
  isDefault: boolean;
  parentTemplateId: number | null;
}

export interface TemplateVariables {
  // User variables
  user_name?: string;
  user_email?: string;
  user_username?: string;
  user_password?: string;
  user_first_name?: string;
  user_last_name?: string;
  user_role?: string;

  // Company variables
  company_name?: string;
  company_id?: number;
  company_email?: string;
  company_phone?: string;

  // Branding variables
  brand_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  support_email?: string;
  support_phone?: string;

  // URLs
  app_url?: string;
  login_url?: string;
  dashboard_url?: string;
  settings_url?: string;
  verification_url?: string;
  reset_password_url?: string;

  // Action variables
  verification_token?: string;
  reset_token?: string;
  tracking_code?: string;

  // VM variables
  vm_name?: string;
  vm_id?: number;
  vm_ip?: string;
  vm_username?: string;
  vm_password?: string;

  // Generic
  date?: string;
  year?: number;
  custom_message?: string;
  [key: string]: any;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
  templateUsed: {
    id: number;
    slug: string;
    source: 'url_mapping' | 'company' | 'global';
  };
}

class EmailTemplateService {
  /**
   * Get template with hierarchy resolution
   * Priority: URL Mapping → Company → Global
   */
  async getTemplate(
    templateSlug: string,
    companyId?: number,
    urlMappingId?: number
  ): Promise<EmailTemplate | null> {
    try {
      // Try URL mapping template first
      if (urlMappingId) {
        const urlTemplate = await prisma.email_templates.findFirst({
          where: {
            template_slug: templateSlug,
            url_mapping_id: urlMappingId,
            is_active: true
          }
        });

        if (urlTemplate) {
          return this.mapTemplate(urlTemplate);
        }
      }

      // Try company template
      if (companyId) {
        const companyTemplate = await prisma.email_templates.findFirst({
          where: {
            template_slug: templateSlug,
            company_id: companyId,
            url_mapping_id: null,
            is_active: true
          }
        });

        if (companyTemplate) {
          return this.mapTemplate(companyTemplate);
        }
      }

      // Fall back to global template
      const globalTemplate = await prisma.email_templates.findFirst({
        where: {
          template_slug: templateSlug,
          company_id: null,
          url_mapping_id: null,
          is_active: true
        }
      });

      if (globalTemplate) {
        return this.mapTemplate(globalTemplate);
      }

      logger.warn(`No template found for slug: ${templateSlug}`);
      return null;
    } catch (error) {
      logger.error('Failed to get template:', error);
      return null;
    }
  }

  /**
   * Get template by type with hierarchy
   */
  async getTemplateByType(
    templateType: string,
    companyId?: number,
    urlMappingId?: number
  ): Promise<EmailTemplate | null> {
    try {
      // Try URL mapping template first
      if (urlMappingId) {
        const urlTemplate = await prisma.email_templates.findFirst({
          where: {
            template_type: templateType as any,
            url_mapping_id: urlMappingId,
            is_active: true
          }
        });

        if (urlTemplate) {
          return this.mapTemplate(urlTemplate);
        }
      }

      // Try company template
      if (companyId) {
        const companyTemplate = await prisma.email_templates.findFirst({
          where: {
            template_type: templateType as any,
            company_id: companyId,
            url_mapping_id: null,
            is_active: true
          }
        });

        if (companyTemplate) {
          return this.mapTemplate(companyTemplate);
        }
      }

      // Fall back to global template
      const globalTemplate = await prisma.email_templates.findFirst({
        where: {
          template_type: templateType as any,
          company_id: null,
          url_mapping_id: null,
          is_active: true
        }
      });

      if (globalTemplate) {
        return this.mapTemplate(globalTemplate);
      }

      return null;
    } catch (error) {
      logger.error('Failed to get template by type:', error);
      return null;
    }
  }

  /**
   * Render template with variables and branding
   */
  async renderTemplate(
    template: EmailTemplate,
    variables: TemplateVariables,
    branding?: BrandingContext
  ): Promise<RenderedEmail> {
    try {
      // If branding not provided, resolve it
      if (!branding) {
        branding = await brandingService.resolveBranding(
          template.companyId || undefined,
          template.urlMappingId || undefined
        );
      }

      // Merge branding into variables
      const allVariables: TemplateVariables = {
        ...variables,
        brand_name: branding.brandName,
        logo_url: branding.logoUrl || '',
        primary_color: branding.primaryColor,
        secondary_color: branding.secondaryColor,
        accent_color: branding.accentColor,
        support_email: branding.supportEmail,
        support_phone: branding.supportPhone || '',
        app_url: branding.appUrl,
        login_url: branding.loginUrl,
        dashboard_url: branding.dashboardUrl,
        settings_url: branding.settingsUrl,
        date: new Date().toLocaleDateString(),
        year: new Date().getFullYear()
      };

      // Replace variables in subject
      const renderedSubject = this.replaceVariables(template.subject, allVariables);

      // Replace variables in HTML body
      const renderedHtml = this.replaceVariables(template.htmlBody, allVariables);

      // Replace variables in text body
      const renderedText = template.textBody
        ? this.replaceVariables(template.textBody, allVariables)
        : this.htmlToText(renderedHtml);

      // Determine source
      let source: 'url_mapping' | 'company' | 'global' = 'global';
      if (template.urlMappingId) {
        source = 'url_mapping';
      } else if (template.companyId) {
        source = 'company';
      }

      return {
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
        templateUsed: {
          id: template.id,
          slug: template.templateSlug,
          source
        }
      };
    } catch (error) {
      logger.error('Failed to render template:', error);
      throw error;
    }
  }

  /**
   * Replace variables in template text
   * Supports: {{variable}}, {{#if condition}}...{{/if}}, {{#unless condition}}...{{/unless}}
   */
  private replaceVariables(text: string, variables: TemplateVariables): string {
    let result = text;

    // Process conditionals first
    result = this.processConditionals(result, variables);

    // Replace simple variables
    result = result.replace(/\{\{([^}]+)\}\}/g, (_,  key) => {
      const trimmedKey = key.trim();

      // Check for nested properties (e.g., {{user.name}})
      if (trimmedKey.includes('.')) {
        const parts = trimmedKey.split('.');
        let value: any = variables;
        for (const part of parts) {
          value = value?.[part];
        }
        return value !== undefined && value !== null ? String(value) : '';
      }

      const value = variables[trimmedKey];
      return value !== undefined && value !== null ? String(value) : '';
    });

    return result;
  }

  /**
   * Process conditional blocks: {{#if}}...{{/if}}, {{#unless}}...{{/unless}}
   */
  private processConditionals(text: string, variables: TemplateVariables): string {
    let result = text;

    // Process {{#if condition}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_,  condition, content) => {
      const trimmedCondition = condition.trim();
      const value = variables[trimmedCondition];

      // Check if condition is truthy
      if (value && value !== 'false' && value !== '0') {
        return content;
      }
      return '';
    });

    // Process {{#unless condition}}...{{/unless}}
    result = result.replace(/\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g, (_,  condition, content) => {
      const trimmedCondition = condition.trim();
      const value = variables[trimmedCondition];

      // Check if condition is falsy
      if (!value || value === 'false' || value === '0') {
        return content;
      }
      return '';
    });

    // Process {{#if condition}}...{{else}}...{{/if}}
    result = result.replace(/\{\{#if\s+([^}]+)\}\}([\s\S]*?)\{\{else\}\}([\s\S]*?)\{\{\/if\}\}/g, (_,  condition, ifContent, elseContent) => {
      const trimmedCondition = condition.trim();
      const value = variables[trimmedCondition];

      if (value && value !== 'false' && value !== '0') {
        return ifContent;
      }
      return elseContent;
    });

    return result;
  }

  /**
   * Convert HTML to plain text (basic implementation)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Create new email template
   */
  async createTemplate(data: {
    companyId?: number;
    urlMappingId?: number;
    templateType: string;
    templateSlug: string;
    subject: string;
    htmlBody: string;
    textBody?: string;
    availableVariables?: any;
    parentTemplateId?: number;
  }): Promise<EmailTemplate> {
    try {
      const template = await prisma.email_templates.create({
        data: {
          company_id: data.companyId || null,
          url_mapping_id: data.urlMappingId || null,
          template_type: data.templateType as any,
          template_slug: data.templateSlug,
          subject: data.subject,
          html_body: data.htmlBody,
          text_body: data.textBody || null,
          available_variables: data.availableVariables || null,
          parent_template_id: data.parentTemplateId || null,
          is_active: true,
          is_default: false
        }
      });

      return this.mapTemplate(template);
    } catch (error) {
      logger.error('Failed to create template:', error);
      throw error;
    }
  }

  /**
   * Update email template
   */
  async updateTemplate(
    templateId: number,
    data: {
      subject?: string;
      htmlBody?: string;
      textBody?: string;
      availableVariables?: any;
      isActive?: boolean;
    }
  ): Promise<EmailTemplate> {
    try {
      const template = await prisma.email_templates.update({
        where: { id: templateId },
        data: {
          subject: data.subject,
          html_body: data.htmlBody,
          text_body: data.textBody,
          available_variables: data.availableVariables,
          is_active: data.isActive
        }
      });

      return this.mapTemplate(template);
    } catch (error) {
      logger.error('Failed to update template:', error);
      throw error;
    }
  }

  /**
   * Delete email template
   */
  async deleteTemplate(templateId: number): Promise<void> {
    try {
      await prisma.email_templates.delete({
        where: { id: templateId }
      });
    } catch (error) {
      logger.error('Failed to delete template:', error);
      throw error;
    }
  }

  /**
   * List templates with filters
   */
  async listTemplates(filters: {
    companyId?: number;
    urlMappingId?: number;
    templateType?: string;
    isActive?: boolean;
  }): Promise<EmailTemplate[]> {
    try {
      const where: any = {};

      if (filters.companyId !== undefined) {
        where.company_id = filters.companyId;
      }

      if (filters.urlMappingId !== undefined) {
        where.url_mapping_id = filters.urlMappingId;
      }

      if (filters.templateType) {
        where.template_type = filters.templateType;
      }

      if (filters.isActive !== undefined) {
        where.is_active = filters.isActive;
      }

      const templates = await prisma.email_templates.findMany({
        where,
        orderBy: [
          { template_type: 'asc' },
          { template_slug: 'asc' }
        ]
      });

      return templates.map(t => this.mapTemplate(t));
    } catch (error) {
      logger.error('Failed to list templates:', error);
      throw error;
    }
  }

  /**
   * Preview template with sample data
   */
  async previewTemplate(
    templateId: number,
    sampleVariables: TemplateVariables
  ): Promise<RenderedEmail> {
    try {
      const template = await prisma.email_templates.findUnique({
        where: { id: templateId }
      });

      if (!template) {
        throw new Error('Template not found');
      }

      const mappedTemplate = this.mapTemplate(template);
      return await this.renderTemplate(mappedTemplate, sampleVariables);
    } catch (error) {
      logger.error('Failed to preview template:', error);
      throw error;
    }
  }

  /**
   * Get available variables for a template type
   */
  getAvailableVariables(templateType: string): string[] {
    const baseVariables = [
      'brand_name', 'logo_url', 'primary_color', 'secondary_color', 'accent_color',
      'support_email', 'support_phone', 'app_url', 'login_url', 'dashboard_url',
      'settings_url', 'date', 'year', 'company_name'
    ];

    switch (templateType) {
      case 'verification':
        return [...baseVariables, 'user_name', 'user_email', 'verification_url', 'verification_token'];

      case 'welcome':
        return [...baseVariables, 'user_name', 'user_email', 'user_username', 'user_password', 'login_url'];

      case 'password_reset':
        return [...baseVariables, 'user_name', 'user_email', 'reset_password_url', 'reset_token'];

      case 'vm_created':
        return [...baseVariables, 'user_name', 'vm_name', 'vm_id', 'vm_ip', 'vm_username', 'vm_password'];

      case 'invoice':
        return [...baseVariables, 'user_name', 'company_name', 'invoice_number', 'invoice_amount', 'invoice_due_date'];

      default:
        return baseVariables;
    }
  }

  /**
   * Map database template to EmailTemplate interface
   */
  private mapTemplate(dbTemplate: any): EmailTemplate {
    return {
      id: dbTemplate.id,
      companyId: dbTemplate.company_id,
      urlMappingId: dbTemplate.url_mapping_id,
      templateType: dbTemplate.template_type,
      templateSlug: dbTemplate.template_slug,
      subject: dbTemplate.subject,
      htmlBody: dbTemplate.html_body,
      textBody: dbTemplate.text_body,
      availableVariables: dbTemplate.available_variables,
      isDefault: dbTemplate.is_default,
      parentTemplateId: dbTemplate.parent_template_id
    };
  }
}

export default new EmailTemplateService();
