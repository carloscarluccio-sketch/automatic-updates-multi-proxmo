import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

interface URLMapping {
  id: number;
  company_id: number;
  url_pattern: string;
  ssl_enabled: boolean;
  ssl_certificate?: string;
  ssl_private_key?: string;
  ssl_chain?: string;
  use_letsencrypt: boolean;
  letsencrypt_email?: string;
}

const NGINX_SITES_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';
const SSL_CERT_DIR = '/etc/nginx/ssl';
const BACKEND_PORT = 3000;
const FRONTEND_ROOT = '/var/www/multpanelreact/frontend/dist';

export class NginxConfigService {
  /**
   * Generate Nginx configuration for a URL mapping
   */
  static async generateConfig(mapping: URLMapping): Promise<{ success: boolean; message: string; configPath?: string }> {
    try {
      const domain = mapping.url_pattern;
      const configName = `multpanel-${domain.replace(/[^a-z0-9]/gi, '-')}`;
      const configPath = path.join(NGINX_SITES_AVAILABLE, configName);

      // Create SSL directory if it doesn't exist
      if (!fs.existsSync(SSL_CERT_DIR)) {
        fs.mkdirSync(SSL_CERT_DIR, { recursive: true, mode: 0o755 });
      }

      let config = '';

      if (mapping.ssl_enabled) {
        // HTTP redirect to HTTPS
        config += `# HTTP redirect to HTTPS\n`;
        config += `server {\n`;
        config += `    listen 80;\n`;
        config += `    server_name ${domain};\n\n`;

        // Let's Encrypt ACME challenge location
        if (mapping.use_letsencrypt) {
          config += `    # ACME challenge for Let's Encrypt\n`;
          config += `    location ^~ /.well-known/acme-challenge/ {\n`;
          config += `        default_type "text/plain";\n`;
          config += `        root /var/www/certbot;\n`;
          config += `    }\n\n`;
        }

        config += `    # Redirect all other requests to HTTPS\n`;
        config += `    location / {\n`;
        config += `        return 301 https://$server_name$request_uri;\n`;
        config += `    }\n`;
        config += `}\n\n`;

        // HTTPS server block
        config += `# HTTPS server\n`;
        config += `server {\n`;
        config += `    listen 443 ssl http2;\n`;
        config += `    server_name ${domain};\n\n`;

        // SSL certificates
        const sslCertPath = path.join(SSL_CERT_DIR, `${domain}.crt`);
        const sslKeyPath = path.join(SSL_CERT_DIR, `${domain}.key`);
        const sslChainPath = path.join(SSL_CERT_DIR, `${domain}.chain.pem`);

        config += `    # SSL certificates\n`;
        config += `    ssl_certificate ${sslCertPath};\n`;
        config += `    ssl_certificate_key ${sslKeyPath};\n`;

        if (mapping.ssl_chain) {
          config += `    ssl_trusted_certificate ${sslChainPath};\n`;
        }

        config += `\n`;
        config += `    # SSL configuration\n`;
        config += `    ssl_protocols TLSv1.2 TLSv1.3;\n`;
        config += `    ssl_ciphers 'ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384';\n`;
        config += `    ssl_prefer_server_ciphers off;\n`;
        config += `    ssl_session_timeout 1d;\n`;
        config += `    ssl_session_cache shared:SSL:50m;\n`;
        config += `    ssl_session_tickets off;\n\n`;

        config += `    # Security headers\n`;
        config += `    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;\n`;
        config += `    add_header X-Frame-Options "SAMEORIGIN" always;\n`;
        config += `    add_header X-Content-Type-Options "nosniff" always;\n`;
        config += `    add_header X-XSS-Protection "1; mode=block" always;\n\n`;

      } else {
        // HTTP only server block
        config += `server {\n`;
        config += `    listen 80;\n`;
        config += `    server_name ${domain};\n\n`;
      }

      // Common configuration for both HTTP and HTTPS
      config += `    # Logging\n`;
      config += `    access_log /var/log/nginx/${domain}.access.log;\n`;
      config += `    error_log /var/log/nginx/${domain}.error.log;\n\n`;

      config += `    # Frontend static files\n`;
      config += `    root ${FRONTEND_ROOT};\n`;
      config += `    index index.html;\n\n`;

      config += `    # API proxy\n`;
      config += `    location /api/ {\n`;
      config += `        proxy_pass http://localhost:${BACKEND_PORT};\n`;
      config += `        proxy_http_version 1.1;\n`;
      config += `        proxy_set_header Host $host;\n`;
      config += `        proxy_set_header X-Real-IP $remote_addr;\n`;
      config += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
      config += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;
      config += `        proxy_set_header Upgrade $http_upgrade;\n`;
      config += `        proxy_set_header Connection 'upgrade';\n`;
      config += `        proxy_cache_bypass $http_upgrade;\n`;
      config += `    }\n\n`;

      config += `    # Uploads proxy (logo files, etc.)\n`;
      config += `    location ^~ /uploads/ {\n`;
      config += `        proxy_pass http://localhost:${BACKEND_PORT};\n`;
      config += `        proxy_http_version 1.1;\n`;
      config += `        proxy_set_header Host $host;\n`;
      config += `        proxy_set_header X-Real-IP $remote_addr;\n`;
      config += `        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n`;
      config += `        proxy_set_header X-Forwarded-Proto $scheme;\n`;
      config += `    }\n\n`;

      config += `    # Frontend SPA routing\n`;
      config += `    location / {\n`;
      config += `        try_files $uri $uri/ /index.html;\n`;
      config += `    }\n\n`;

      config += `    # Cache static assets\n`;
      config += `    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {\n`;
      config += `        expires 1y;\n`;
      config += `        add_header Cache-Control "public, immutable";\n`;
      config += `    }\n\n`;

      config += `    # Gzip compression\n`;
      config += `    gzip on;\n`;
      config += `    gzip_vary on;\n`;
      config += `    gzip_proxied any;\n`;
      config += `    gzip_comp_level 6;\n`;
      config += `    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss application/rss+xml font/truetype font/opentype application/vnd.ms-fontobject image/svg+xml;\n`;
      config += `}\n`;

      // Write configuration file
      fs.writeFileSync(configPath, config, { mode: 0o644 });

      logger.info(`Nginx config generated for ${domain}: ${configPath}`);

      return {
        success: true,
        message: `Configuration generated successfully`,
        configPath
      };
    } catch (error: any) {
      logger.error('Nginx config generation failed:', error);
      return {
        success: false,
        message: `Failed to generate configuration: ${error.message}`
      };
    }
  }

  /**
   * Write SSL certificates to disk
   */
  static async writeSSLCertificates(
    domain: string,
    certificate: string,
    privateKey: string,
    chain?: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Create SSL directory if it doesn't exist
      if (!fs.existsSync(SSL_CERT_DIR)) {
        fs.mkdirSync(SSL_CERT_DIR, { recursive: true, mode: 0o755 });
      }

      const certPath = path.join(SSL_CERT_DIR, `${domain}.crt`);
      const keyPath = path.join(SSL_CERT_DIR, `${domain}.key`);
      const chainPath = path.join(SSL_CERT_DIR, `${domain}.chain.pem`);

      // Write certificate
      fs.writeFileSync(certPath, certificate, { mode: 0o644 });

      // Write private key (secure permissions)
      fs.writeFileSync(keyPath, privateKey, { mode: 0o600 });

      // Write chain if provided
      if (chain) {
        fs.writeFileSync(chainPath, chain, { mode: 0o644 });
      }

      logger.info(`SSL certificates written for ${domain}`);

      return {
        success: true,
        message: 'SSL certificates deployed successfully'
      };
    } catch (error: any) {
      logger.error('SSL certificate deployment failed:', error);
      return {
        success: false,
        message: `Failed to deploy SSL certificates: ${error.message}`
      };
    }
  }

  /**
   * Enable Nginx site (create symlink)
   */
  static async enableSite(configName: string): Promise<{ success: boolean; message: string }> {
    try {
      const availablePath = path.join(NGINX_SITES_AVAILABLE, configName);
      const enabledPath = path.join(NGINX_SITES_ENABLED, configName);

      if (!fs.existsSync(availablePath)) {
        return {
          success: false,
          message: `Configuration file not found: ${configName}`
        };
      }

      // Remove existing symlink if it exists
      if (fs.existsSync(enabledPath)) {
        fs.unlinkSync(enabledPath);
      }

      // Create symlink
      fs.symlinkSync(availablePath, enabledPath);

      logger.info(`Nginx site enabled: ${configName}`);

      return {
        success: true,
        message: 'Site enabled successfully'
      };
    } catch (error: any) {
      logger.error('Site enable failed:', error);
      return {
        success: false,
        message: `Failed to enable site: ${error.message}`
      };
    }
  }

  /**
   * Disable Nginx site (remove symlink)
   */
  static async disableSite(configName: string): Promise<{ success: boolean; message: string }> {
    try {
      const enabledPath = path.join(NGINX_SITES_ENABLED, configName);

      if (fs.existsSync(enabledPath)) {
        fs.unlinkSync(enabledPath);
        logger.info(`Nginx site disabled: ${configName}`);
      }

      return {
        success: true,
        message: 'Site disabled successfully'
      };
    } catch (error: any) {
      logger.error('Site disable failed:', error);
      return {
        success: false,
        message: `Failed to disable site: ${error.message}`
      };
    }
  }

  /**
   * Test Nginx configuration
   */
  static async testConfig(): Promise<{ success: boolean; message: string; output?: string }> {
    try {
      const output = execSync('nginx -t 2>&1', { encoding: 'utf-8' });
      logger.info('Nginx config test passed');

      return {
        success: true,
        message: 'Configuration test passed',
        output
      };
    } catch (error: any) {
      logger.error('Nginx config test failed:', error);
      return {
        success: false,
        message: 'Configuration test failed',
        output: error.stdout || error.message
      };
    }
  }

  /**
   * Reload Nginx
   */
  static async reload(): Promise<{ success: boolean; message: string }> {
    try {
      // Test configuration first
      const testResult = await this.testConfig();
      if (!testResult.success) {
        return {
          success: false,
          message: `Configuration test failed: ${testResult.output}`
        };
      }

      // Reload Nginx
      execSync('systemctl reload nginx', { encoding: 'utf-8' });
      logger.info('Nginx reloaded successfully');

      return {
        success: true,
        message: 'Nginx reloaded successfully'
      };
    } catch (error: any) {
      logger.error('Nginx reload failed:', error);
      return {
        success: false,
        message: `Failed to reload Nginx: ${error.message}`
      };
    }
  }

  /**
   * Deploy complete URL mapping (generate config, write certs, enable site, reload)
   */
  static async deployURLMapping(mapping: URLMapping): Promise<{ success: boolean; message: string; steps: any[] }> {
    const steps: any[] = [];

    try {
      const domain = mapping.url_pattern;
      const configName = `multpanel-${domain.replace(/[^a-z0-9]/gi, '-')}`;

      // Step 1: Generate Nginx configuration
      const configResult = await this.generateConfig(mapping);
      steps.push({ step: 'generate_config', ...configResult });
      if (!configResult.success) throw new Error(configResult.message);

      // Step 2: Write SSL certificates (if SSL enabled and manual cert)
      if (mapping.ssl_enabled && !mapping.use_letsencrypt && mapping.ssl_certificate && mapping.ssl_private_key) {
        const certResult = await this.writeSSLCertificates(
          domain,
          mapping.ssl_certificate,
          mapping.ssl_private_key,
          mapping.ssl_chain
        );
        steps.push({ step: 'write_certificates', ...certResult });
        if (!certResult.success) throw new Error(certResult.message);
      }

      // Step 3: Enable site
      const enableResult = await this.enableSite(configName);
      steps.push({ step: 'enable_site', ...enableResult });
      if (!enableResult.success) throw new Error(enableResult.message);

      // Step 4: Test configuration
      const testResult = await this.testConfig();
      steps.push({ step: 'test_config', ...testResult });
      if (!testResult.success) throw new Error(testResult.message);

      // Step 5: Reload Nginx
      const reloadResult = await this.reload();
      steps.push({ step: 'reload_nginx', ...reloadResult });
      if (!reloadResult.success) throw new Error(reloadResult.message);

      return {
        success: true,
        message: `URL mapping deployed successfully for ${domain}`,
        steps
      };
    } catch (error: any) {
      logger.error('URL mapping deployment failed:', error);
      return {
        success: false,
        message: `Deployment failed: ${error.message}`,
        steps
      };
    }
  }

  /**
   * Remove URL mapping (disable site, remove config, reload)
   */
  static async removeURLMapping(domain: string): Promise<{ success: boolean; message: string }> {
    try {
      const configName = `multpanel-${domain.replace(/[^a-z0-9]/gi, '-')}`;
      const configPath = path.join(NGINX_SITES_AVAILABLE, configName);

      // Disable site
      await this.disableSite(configName);

      // Remove config file
      if (fs.existsSync(configPath)) {
        fs.unlinkSync(configPath);
        logger.info(`Removed Nginx config: ${configPath}`);
      }

      // Remove SSL certificates
      const certPath = path.join(SSL_CERT_DIR, `${domain}.crt`);
      const keyPath = path.join(SSL_CERT_DIR, `${domain}.key`);
      const chainPath = path.join(SSL_CERT_DIR, `${domain}.chain.pem`);

      [certPath, keyPath, chainPath].forEach(file => {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      });

      // Reload Nginx
      await this.reload();

      return {
        success: true,
        message: `URL mapping removed successfully for ${domain}`
      };
    } catch (error: any) {
      logger.error('URL mapping removal failed:', error);
      return {
        success: false,
        message: `Failed to remove URL mapping: ${error.message}`
      };
    }
  }
}

export default NginxConfigService;
