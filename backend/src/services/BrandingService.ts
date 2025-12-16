/**
 * Branding Service
 * Resolves white-label branding with hierarchy: URL Mapping → Company → Global
 */

import prisma from '../config/database';
import logger from '../utils/logger';

export interface BrandingContext {
  // Brand Identity
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;

  // Colors
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;

  // Typography
  fontFamily: string;

  // URLs
  appUrl: string;
  loginUrl: string;
  dashboardUrl: string;
  settingsUrl: string;
  termsUrl: string | null;
  privacyUrl: string | null;

  // Contact
  supportEmail: string;
  supportPhone: string | null;

  // Customization
  customCss: string | null;
  customHeaderHtml: string | null;
  customFooterHtml: string | null;

  // SEO
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogImageUrl: string | null;

  // Localization
  language: string;
  timezone: string;
  currency: string;

  // Tracking
  gaTrackingId: string | null;
  gtmContainerId: string | null;
  fbPixelId: string | null;
  customScripts: string | null;

  // Login Page
  loginBackgroundUrl: string | null;
  loginLogoUrl: string | null;
  welcomeMessage: string | null;

  // White-Label Control
  hidePoweredBy: boolean;
  whiteLabelLevel: string;

  // Additional Settings
  brandingSettings: any;

  // Source info (for debugging)
  source: 'url_mapping' | 'company' | 'global';
  companyId: number | null;
  urlMappingId: number | null;
}

export interface GlobalBranding {
  platformName: string;
  platformLogoUrl: string;
  platformFaviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  supportEmail: string;
  supportPhone: string | null;
  termsUrl: string;
  privacyUrl: string;
  showPoweredBy: boolean;
  defaultLanguage: string;
  defaultTimezone: string;
  defaultCurrency: string;
}

export interface CompanyBranding {
  companyId: number;
  companyName: string;
  logoFilename: string | null;
  panelName: string | null;
  headerColor: string | null;
  menuColor: string | null;
  loginBgColor: string | null;
}

export interface UrlMappingBranding {
  id: number;
  companyId: number;
  urlPattern: string;
  brandingName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  customCss: string | null;
  customHeaderHtml: string | null;
  customFooterHtml: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  metaKeywords: string | null;
  ogImageUrl: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  language: string;
  timezone: string;
  currency: string;
  gaTrackingId: string | null;
  gtmContainerId: string | null;
  fbPixelId: string | null;
  customScripts: string | null;
  loginBackgroundUrl: string | null;
  loginLogoUrl: string | null;
  welcomeMessage: string | null;
  hidePoweredBy: boolean;
  whiteLabelLevel: string;
  brandingSettings: any;
}

class BrandingService {
  /**
   * Get global branding defaults
   */
  async getGlobalBranding(): Promise<GlobalBranding> {
    try {
      const settings = await prisma.global_settings.findMany({
        where: {
          setting_category: 'branding'
        }
      });

      const getValue = (key: string, defaultValue: any = null) => {
        const setting = settings.find(s => s.setting_key === key);
        if (!setting) return defaultValue;

        switch (setting.setting_type) {
          case 'string':
          case 'text':
            return setting.setting_value_text || defaultValue;
          case 'integer':
            return setting.setting_value_int || defaultValue;
          case 'float':
            return setting.setting_value_float || defaultValue;
          case 'boolean':
            return setting.setting_value_bool !== null ? setting.setting_value_bool : defaultValue;
          case 'json':
            return setting.setting_value_json || defaultValue;
          default:
            return defaultValue;
        }
      };

      return {
        platformName: getValue('platform_name', 'Proxmox Multi-Tenant Platform'),
        platformLogoUrl: getValue('platform_logo_url', '/assets/logo.png'),
        platformFaviconUrl: getValue('platform_favicon_url', '/assets/favicon.ico'),
        primaryColor: getValue('primary_color', '#0066cc'),
        secondaryColor: getValue('secondary_color', '#004499'),
        accentColor: getValue('accent_color', '#ff6600'),
        fontFamily: getValue('font_family', 'Inter, Arial, sans-serif'),
        supportEmail: getValue('support_email', 'support@proxmox-platform.com'),
        supportPhone: getValue('support_phone', null),
        termsUrl: getValue('terms_url', '/terms'),
        privacyUrl: getValue('privacy_url', '/privacy'),
        showPoweredBy: getValue('show_powered_by', true),
        defaultLanguage: getValue('default_language', 'en'),
        defaultTimezone: getValue('default_timezone', 'UTC'),
        defaultCurrency: getValue('default_currency', 'USD')
      };
    } catch (error) {
      logger.error('Failed to get global branding:', error);
      // Return hardcoded defaults as fallback
      return {
        platformName: 'Proxmox Multi-Tenant Platform',
        platformLogoUrl: '/assets/logo.png',
        platformFaviconUrl: '/assets/favicon.ico',
        primaryColor: '#0066cc',
        secondaryColor: '#004499',
        accentColor: '#ff6600',
        fontFamily: 'Inter, Arial, sans-serif',
        supportEmail: 'support@proxmox-platform.com',
        supportPhone: null,
        termsUrl: '/terms',
        privacyUrl: '/privacy',
        showPoweredBy: true,
        defaultLanguage: 'en',
        defaultTimezone: 'UTC',
        defaultCurrency: 'USD'
      };
    }
  }

  /**
   * Get company branding
   */
  async getCompanyBranding(companyId: number): Promise<CompanyBranding | null> {
    try {
      const company = await prisma.companies.findUnique({
        where: { id: companyId },
        select: {
          id: true,
          name: true,
          logo_filename: true,
          panel_name: true,
          header_color: true,
          menu_color: true,
          login_bg_color: true
        }
      });

      if (!company) return null;

      return {
        companyId: company.id,
        companyName: company.name,
        logoFilename: company.logo_filename,
        panelName: company.panel_name,
        headerColor: company.header_color,
        menuColor: company.menu_color,
        loginBgColor: company.login_bg_color
      };
    } catch (error) {
      logger.error(`Failed to get company branding for company ${companyId}:`, error);
      return null;
    }
  }

  /**
   * Get URL mapping branding
   */
  async getUrlMappingBranding(mappingId: number): Promise<UrlMappingBranding | null> {
    try {
      const mapping = await prisma.company_url_mappings.findUnique({
        where: { id: mappingId }
      });

      if (!mapping) return null;

      return {
        id: mapping.id,
        companyId: mapping.company_id,
        urlPattern: mapping.url_pattern,
        brandingName: mapping.branding_name,
        logoUrl: mapping.logo_url,
        faviconUrl: mapping.favicon_url,
        primaryColor: mapping.primary_color || '#0066cc',
        secondaryColor: mapping.secondary_color || '#004499',
        accentColor: mapping.accent_color || '#ff6600',
        fontFamily: mapping.font_family || 'Inter, Arial, sans-serif',
        customCss: mapping.custom_css,
        customHeaderHtml: mapping.custom_header_html,
        customFooterHtml: mapping.custom_footer_html,
        metaTitle: mapping.meta_title,
        metaDescription: mapping.meta_description,
        metaKeywords: mapping.meta_keywords,
        ogImageUrl: mapping.og_image_url,
        termsUrl: mapping.terms_url,
        privacyUrl: mapping.privacy_url,
        supportEmail: mapping.support_email,
        supportPhone: mapping.support_phone,
        language: mapping.language || 'en',
        timezone: mapping.timezone || 'UTC',
        currency: mapping.currency || 'USD',
        gaTrackingId: mapping.ga_tracking_id,
        gtmContainerId: mapping.gtm_container_id,
        fbPixelId: mapping.fb_pixel_id,
        customScripts: mapping.custom_scripts,
        loginBackgroundUrl: mapping.login_background_url,
        loginLogoUrl: mapping.login_logo_url,
        welcomeMessage: mapping.welcome_message,
        hidePoweredBy: mapping.hide_powered_by || false,
        whiteLabelLevel: mapping.white_label_level || 'basic',
        brandingSettings: mapping.branding_settings
      };
    } catch (error) {
      logger.error(`Failed to get URL mapping branding for mapping ${mappingId}:`, error);
      return null;
    }
  }

  /**
   * Get URL mapping branding by domain
   */
  async getUrlMappingBrandingByDomain(domain: string): Promise<UrlMappingBranding | null> {
    try {
      const mapping = await prisma.company_url_mappings.findFirst({
        where: {
          url_pattern: domain,
          is_active: true
        }
      });

      if (!mapping) return null;

      return this.getUrlMappingBranding(mapping.id);
    } catch (error) {
      logger.error(`Failed to get URL mapping branding for domain ${domain}:`, error);
      return null;
    }
  }

  /**
   * Resolve complete branding context with hierarchy
   * Priority: URL Mapping → Company → Global
   */
  async resolveBranding(
    companyId?: number,
    urlMappingId?: number,
    domain?: string
  ): Promise<BrandingContext> {
    // Start with global defaults
    const global = await this.getGlobalBranding();
    const appUrl = process.env.APP_URL || 'http://localhost:3000';

    let context: BrandingContext = {
      brandName: global.platformName,
      logoUrl: global.platformLogoUrl,
      faviconUrl: global.platformFaviconUrl,
      primaryColor: global.primaryColor,
      secondaryColor: global.secondaryColor,
      accentColor: global.accentColor,
      fontFamily: global.fontFamily,
      appUrl,
      loginUrl: `${appUrl}/login`,
      dashboardUrl: `${appUrl}/dashboard`,
      settingsUrl: `${appUrl}/settings`,
      termsUrl: global.termsUrl,
      privacyUrl: global.privacyUrl,
      supportEmail: global.supportEmail,
      supportPhone: global.supportPhone,
      customCss: null,
      customHeaderHtml: null,
      customFooterHtml: null,
      metaTitle: null,
      metaDescription: null,
      metaKeywords: null,
      ogImageUrl: null,
      language: global.defaultLanguage,
      timezone: global.defaultTimezone,
      currency: global.defaultCurrency,
      gaTrackingId: null,
      gtmContainerId: null,
      fbPixelId: null,
      customScripts: null,
      loginBackgroundUrl: null,
      loginLogoUrl: null,
      welcomeMessage: null,
      hidePoweredBy: !global.showPoweredBy,
      whiteLabelLevel: 'basic',
      brandingSettings: null,
      source: 'global',
      companyId: null,
      urlMappingId: null
    };

    // Apply company branding
    if (companyId) {
      const companyBranding = await this.getCompanyBranding(companyId);
      if (companyBranding) {
        if (companyBranding.panelName) {
          context.brandName = companyBranding.panelName;
        }
        if (companyBranding.logoFilename) {
          context.logoUrl = `/uploads/logos/${companyBranding.logoFilename}`;
        }
        if (companyBranding.headerColor) {
          context.primaryColor = companyBranding.headerColor;
        }
        if (companyBranding.menuColor) {
          context.secondaryColor = companyBranding.menuColor;
        }
        if (companyBranding.loginBgColor) {
          context.loginBackgroundUrl = companyBranding.loginBgColor; // Note: This is a color, not URL in current schema
        }
        context.source = 'company';
        context.companyId = companyId;
      }
    }

    // Apply URL mapping branding (highest priority)
    let urlMapping: UrlMappingBranding | null = null;

    if (urlMappingId) {
      urlMapping = await this.getUrlMappingBranding(urlMappingId);
    } else if (domain) {
      urlMapping = await this.getUrlMappingBrandingByDomain(domain);
    }

    if (urlMapping) {
      // Override with URL mapping settings
      if (urlMapping.brandingName) context.brandName = urlMapping.brandingName;
      if (urlMapping.logoUrl) context.logoUrl = urlMapping.logoUrl;
      if (urlMapping.faviconUrl) context.faviconUrl = urlMapping.faviconUrl;
      context.primaryColor = urlMapping.primaryColor;
      context.secondaryColor = urlMapping.secondaryColor;
      context.accentColor = urlMapping.accentColor;
      context.fontFamily = urlMapping.fontFamily;
      context.customCss = urlMapping.customCss;
      context.customHeaderHtml = urlMapping.customHeaderHtml;
      context.customFooterHtml = urlMapping.customFooterHtml;
      context.metaTitle = urlMapping.metaTitle;
      context.metaDescription = urlMapping.metaDescription;
      context.metaKeywords = urlMapping.metaKeywords;
      context.ogImageUrl = urlMapping.ogImageUrl;
      if (urlMapping.termsUrl) context.termsUrl = urlMapping.termsUrl;
      if (urlMapping.privacyUrl) context.privacyUrl = urlMapping.privacyUrl;
      if (urlMapping.supportEmail) context.supportEmail = urlMapping.supportEmail;
      if (urlMapping.supportPhone) context.supportPhone = urlMapping.supportPhone;
      context.language = urlMapping.language;
      context.timezone = urlMapping.timezone;
      context.currency = urlMapping.currency;
      context.gaTrackingId = urlMapping.gaTrackingId;
      context.gtmContainerId = urlMapping.gtmContainerId;
      context.fbPixelId = urlMapping.fbPixelId;
      context.customScripts = urlMapping.customScripts;
      context.loginBackgroundUrl = urlMapping.loginBackgroundUrl;
      context.loginLogoUrl = urlMapping.loginLogoUrl;
      context.welcomeMessage = urlMapping.welcomeMessage;
      context.hidePoweredBy = urlMapping.hidePoweredBy;
      context.whiteLabelLevel = urlMapping.whiteLabelLevel;
      context.brandingSettings = urlMapping.brandingSettings;
      context.source = 'url_mapping';
      context.companyId = urlMapping.companyId;
      context.urlMappingId = urlMapping.id;
    }

    return context;
  }

  /**
   * Get branding for public API (used by widget)
   */
  async getPublicBranding(domain: string): Promise<Partial<BrandingContext>> {
    const branding = await this.resolveBranding(undefined, undefined, domain);

    // Return only public-safe fields
    return {
      brandName: branding.brandName,
      logoUrl: branding.logoUrl,
      faviconUrl: branding.faviconUrl,
      primaryColor: branding.primaryColor,
      secondaryColor: branding.secondaryColor,
      accentColor: branding.accentColor,
      fontFamily: branding.fontFamily,
      supportEmail: branding.supportEmail,
      supportPhone: branding.supportPhone,
      termsUrl: branding.termsUrl,
      privacyUrl: branding.privacyUrl,
      language: branding.language,
      hidePoweredBy: branding.hidePoweredBy,
      customCss: branding.customCss
    };
  }
}

export default new BrandingService();
