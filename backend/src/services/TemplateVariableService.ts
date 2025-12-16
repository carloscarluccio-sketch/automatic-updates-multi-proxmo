/**
 * Template Variable Service
 * Handles variable replacement, conditional logic, and template utilities
 */

import logger from '../utils/logger';

export interface VariableDefinition {
  name: string;
  description: string;
  example: string;
  category: 'user' | 'company' | 'branding' | 'url' | 'action' | 'vm' | 'system';
  required: boolean;
}

export interface TemplateVariables {
  [key: string]: any;
}

class TemplateVariableService {
  /**
   * Replace all variables in text
   * Supports: {{variable}}, {{nested.property}}, {{#if}}...{{/if}}, {{#unless}}...{{/unless}}
   */
  replaceVariables(text: string, variables: TemplateVariables): string {
    if (!text) return '';

    let result = text;

    // Process conditionals first (they can contain variables)
    result = this.processConditionals(result, variables);

    // Process loops
    result = this.processLoops(result, variables);

    // Replace simple variables
    result = result.replace(/\{\{([^}#\/]+)\}\}/g, (_,  key) => {
      const trimmedKey = key.trim();

      // Check for filters (e.g., {{name | uppercase}})
      if (trimmedKey.includes('|')) {
        return this.applyFilters(trimmedKey, variables);
      }

      // Check for nested properties (e.g., {{user.name}})
      if (trimmedKey.includes('.')) {
        return this.getNestedValue(trimmedKey, variables);
      }

      const value = variables[trimmedKey];
      return this.formatValue(value);
    });

    return result;
  }

  /**
   * Process conditional blocks: {{#if}}...{{/if}}, {{#unless}}...{{/unless}}
   */
  processConditionals(text: string, variables: TemplateVariables): string {
    let result = text;

    // Process {{#if condition}}...{{else}}...{{/if}}
    result = result.replace(
      /\{\{#if\s+([^}]+)\}\}([\s\S]*?)(?:\{\{else\}\}([\s\S]*?))?\{\{\/if\}\}/g,
      (_,  condition, ifContent, elseContent) => {
        const isTrue = this.evaluateCondition(condition.trim(), variables);
        return isTrue ? ifContent : (elseContent || '');
      }
    );

    // Process {{#unless condition}}...{{/unless}}
    result = result.replace(
      /\{\{#unless\s+([^}]+)\}\}([\s\S]*?)\{\{\/unless\}\}/g,
      (_,  condition, content) => {
        const isTrue = this.evaluateCondition(condition.trim(), variables);
        return !isTrue ? content : '';
      }
    );

    return result;
  }

  /**
   * Process loop blocks: {{#each items}}...{{/each}}
   */
  processLoops(text: string, variables: TemplateVariables): string {
    let result = text;

    result = result.replace(
      /\{\{#each\s+([^}]+)\}\}([\s\S]*?)\{\{\/each\}\}/g,
      (_,  arrayKey, template) => {
        const items = this.getNestedValue(arrayKey.trim(), variables);

        if (!Array.isArray(items)) {
          return '';
        }

        return items
          .map((item, index) => {
            const itemVariables = {
              ...variables,
              this: item,
              index,
              first: index === 0,
              last: index === items.length - 1
            };
            return this.replaceVariables(template, itemVariables);
          })
          .join('');
      }
    );

    return result;
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(condition: string, variables: TemplateVariables): boolean {
    // Handle comparison operators
    if (condition.includes('==')) {
      const [left, right] = condition.split('==').map(s => s.trim());
      return this.getValue(left, variables) == this.getValue(right, variables);
    }

    if (condition.includes('!=')) {
      const [left, right] = condition.split('!=').map(s => s.trim());
      return this.getValue(left, variables) != this.getValue(right, variables);
    }

    if (condition.includes('>=')) {
      const [left, right] = condition.split('>=').map(s => s.trim());
      return Number(this.getValue(left, variables)) >= Number(this.getValue(right, variables));
    }

    if (condition.includes('<=')) {
      const [left, right] = condition.split('<=').map(s => s.trim());
      return Number(this.getValue(left, variables)) <= Number(this.getValue(right, variables));
    }

    if (condition.includes('>')) {
      const [left, right] = condition.split('>').map(s => s.trim());
      return Number(this.getValue(left, variables)) > Number(this.getValue(right, variables));
    }

    if (condition.includes('<')) {
      const [left, right] = condition.split('<').map(s => s.trim());
      return Number(this.getValue(left, variables)) < Number(this.getValue(right, variables));
    }

    // Simple truthiness check
    const value = this.getValue(condition, variables);
    return this.isTruthy(value);
  }

  /**
   * Get value from variables (handles nested and literals)
   */
  private getValue(key: string, variables: TemplateVariables): any {
    // Check if it's a literal string (quoted)
    if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
      return key.slice(1, -1);
    }

    // Check if it's a number
    if (!isNaN(Number(key))) {
      return Number(key);
    }

    // Check if it's a boolean
    if (key === 'true') return true;
    if (key === 'false') return false;

    // Otherwise, treat as variable name
    return this.getNestedValue(key, variables);
  }

  /**
   * Get nested property value (e.g., "user.profile.name")
   */
  private getNestedValue(path: string, variables: TemplateVariables): any {
    const parts = path.split('.');
    let value: any = variables;

    for (const part of parts) {
      if (value === null || value === undefined) {
        return '';
      }
      value = value[part];
    }

    return value;
  }

  /**
   * Apply filters to value (e.g., "name | uppercase | truncate:50")
   */
  private applyFilters(expression: string, variables: TemplateVariables): string {
    const parts = expression.split('|').map(s => s.trim());
    const variableName = parts[0];
    let value = this.getNestedValue(variableName, variables);

    // Apply each filter in sequence
    for (let i = 1; i < parts.length; i++) {
      const filterParts = parts[i].split(':');
      const filterName = filterParts[0].trim();
      const filterArgs = filterParts.slice(1).map(s => s.trim());

      value = this.applyFilter(filterName, value, filterArgs);
    }

    return this.formatValue(value);
  }

  /**
   * Apply a single filter to a value
   */
  private applyFilter(filterName: string, value: any, args: string[]): any {
    switch (filterName.toLowerCase()) {
      case 'uppercase':
        return String(value).toUpperCase();

      case 'lowercase':
        return String(value).toLowerCase();

      case 'capitalize':
        return String(value).charAt(0).toUpperCase() + String(value).slice(1).toLowerCase();

      case 'truncate':
        const maxLength = parseInt(args[0]) || 50;
        const str = String(value);
        return str.length > maxLength ? str.substring(0, maxLength) + '...' : str;

      case 'date':
        const format = args[0] || 'short';
        const date = new Date(value);
        if (isNaN(date.getTime())) return value;

        switch (format) {
          case 'short':
            return date.toLocaleDateString();
          case 'long':
            return date.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            });
          case 'iso':
            return date.toISOString();
          default:
            return date.toLocaleDateString();
        }

      case 'currency':
        const currency = args[0] || 'USD';
        const amount = parseFloat(value);
        if (isNaN(amount)) return value;
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency
        }).format(amount);

      case 'default':
        const defaultValue = args[0] || '';
        return value || defaultValue;

      case 'join':
        const separator = args[0] || ', ';
        return Array.isArray(value) ? value.join(separator) : value;

      case 'escape':
        return String(value)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');

      case 'nl2br':
        return String(value).replace(/\n/g, '<br>');

      default:
        logger.warn(`Unknown filter: ${filterName}`);
        return value;
    }
  }

  /**
   * Check if value is truthy
   */
  private isTruthy(value: any): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'number') return value !== 0;
    if (typeof value === 'string') return value !== '' && value !== 'false' && value !== '0';
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return !!value;
  }

  /**
   * Format value for output
   */
  private formatValue(value: any): string {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  /**
   * Get all available variables for a template type
   */
  getAvailableVariables(templateType: string): VariableDefinition[] {
    const baseVariables: VariableDefinition[] = [
      // Branding
      { name: 'brand_name', description: 'Brand/platform name', example: 'Acme Cloud', category: 'branding', required: true },
      { name: 'logo_url', description: 'Brand logo URL', example: 'https://example.com/logo.png', category: 'branding', required: false },
      { name: 'primary_color', description: 'Primary brand color', example: '#0066cc', category: 'branding', required: false },
      { name: 'secondary_color', description: 'Secondary brand color', example: '#004499', category: 'branding', required: false },
      { name: 'accent_color', description: 'Accent color', example: '#ff6600', category: 'branding', required: false },

      // Support
      { name: 'support_email', description: 'Support email address', example: 'support@example.com', category: 'branding', required: true },
      { name: 'support_phone', description: 'Support phone number', example: '+1-800-123-4567', category: 'branding', required: false },

      // URLs
      { name: 'app_url', description: 'Application base URL', example: 'https://app.example.com', category: 'url', required: true },
      { name: 'login_url', description: 'Login page URL', example: 'https://app.example.com/login', category: 'url', required: true },
      { name: 'dashboard_url', description: 'Dashboard URL', example: 'https://app.example.com/dashboard', category: 'url', required: false },
      { name: 'settings_url', description: 'Settings page URL', example: 'https://app.example.com/settings', category: 'url', required: false },

      // System
      { name: 'date', description: 'Current date', example: '2025-12-12', category: 'system', required: false },
      { name: 'year', description: 'Current year', example: '2025', category: 'system', required: false },

      // Company
      { name: 'company_name', description: 'Company name', example: 'Acme Corp', category: 'company', required: false }
    ];

    const typeSpecificVariables: { [key: string]: VariableDefinition[] } = {
      verification: [
        { name: 'user_name', description: 'User full name', example: 'John Doe', category: 'user', required: true },
        { name: 'user_email', description: 'User email address', example: 'john@example.com', category: 'user', required: true },
        { name: 'verification_url', description: 'Email verification URL', example: 'https://app.example.com/verify?token=abc123', category: 'action', required: true },
        { name: 'verification_token', description: 'Verification token', example: 'abc123xyz', category: 'action', required: false }
      ],

      welcome: [
        { name: 'user_name', description: 'User full name', example: 'John Doe', category: 'user', required: true },
        { name: 'user_email', description: 'User email address', example: 'john@example.com', category: 'user', required: true },
        { name: 'user_username', description: 'Username for login', example: 'johndoe', category: 'user', required: true },
        { name: 'user_password', description: 'Temporary password', example: 'TempPass123!', category: 'user', required: true }
      ],

      password_reset: [
        { name: 'user_name', description: 'User full name', example: 'John Doe', category: 'user', required: true },
        { name: 'user_email', description: 'User email address', example: 'john@example.com', category: 'user', required: true },
        { name: 'reset_password_url', description: 'Password reset URL', example: 'https://app.example.com/reset?token=abc123', category: 'action', required: true },
        { name: 'reset_token', description: 'Reset token', example: 'abc123xyz', category: 'action', required: false }
      ],

      vm_created: [
        { name: 'user_name', description: 'User full name', example: 'John Doe', category: 'user', required: true },
        { name: 'vm_name', description: 'Virtual machine name', example: 'web-server-01', category: 'vm', required: true },
        { name: 'vm_id', description: 'VM ID', example: '12345', category: 'vm', required: false },
        { name: 'vm_ip', description: 'VM IP address', example: '192.168.1.100', category: 'vm', required: false },
        { name: 'vm_username', description: 'VM login username', example: 'admin', category: 'vm', required: false },
        { name: 'vm_password', description: 'VM login password', example: 'SecurePass123!', category: 'vm', required: false }
      ],

      invoice: [
        { name: 'user_name', description: 'User full name', example: 'John Doe', category: 'user', required: true },
        { name: 'invoice_number', description: 'Invoice number', example: 'INV-2025-001', category: 'action', required: true },
        { name: 'invoice_amount', description: 'Invoice amount', example: '99.99', category: 'action', required: true },
        { name: 'invoice_due_date', description: 'Payment due date', example: '2025-12-31', category: 'action', required: true }
      ]
    };

    return [
      ...baseVariables,
      ...(typeSpecificVariables[templateType] || [])
    ];
  }

  /**
   * Validate that all required variables are present
   */
  validateVariables(templateType: string, variables: TemplateVariables): { valid: boolean; missing: string[] } {
    const requiredVars = this.getAvailableVariables(templateType)
      .filter(v => v.required)
      .map(v => v.name);

    const missing = requiredVars.filter(varName => {
      const value = variables[varName];
      return value === null || value === undefined || value === '';
    });

    return {
      valid: missing.length === 0,
      missing
    };
  }

  /**
   * Get sample variables for testing
   */
  getSampleVariables(templateType: string): TemplateVariables {
    const availableVars = this.getAvailableVariables(templateType);
    const sampleData: TemplateVariables = {};

    availableVars.forEach(varDef => {
      sampleData[varDef.name] = varDef.example;
    });

    return sampleData;
  }
}

export default new TemplateVariableService();
