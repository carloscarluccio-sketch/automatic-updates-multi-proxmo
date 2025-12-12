import { Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import prisma from '../config/database';
import { AuthRequest } from '../middlewares/auth';
import logger from '../utils/logger';
import { encrypt } from '../utils/encryption';
import * as fs from 'fs';

const execAsync = promisify(exec);

/**
 * Generate LetsEncrypt SSL Certificate
 * POST /api/ssl/generate-letsencrypt
 */
export const generateLetsEncrypt = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mapping_id, email } = req.body;
    const { role, company_id } = req.user!;

    if (!mapping_id || !email) {
      res.status(400).json({ success: false, message: 'Mapping ID and email are required' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      res.status(400).json({ success: false, message: 'Invalid email address' });
      return;
    }

    let where: any = { id: Number(mapping_id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const mapping = await prisma.company_url_mappings.findFirst({
      where,
      include: { companies: { select: { name: true } } }
    });

    if (!mapping) {
      res.status(404).json({ success: false, message: 'URL mapping not found or access denied' });
      return;
    }

    const domain = mapping.url_pattern;
    const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    if (!domainRegex.test(domain)) {
      res.status(400).json({ success: false, message: 'Invalid domain format' });
      return;
    }

    await prisma.company_url_mappings.update({
      where: { id: mapping.id },
      data: {
        ssl_status: 'generating',
        ssl_last_checked: new Date(),
        ssl_error_message: null
      }
    });

    await prisma.activity_logs.create({
      data: {
        user_id: req.user!.id,
        company_id: mapping.company_id,
        activity_type: 'ssl_certificate',
        entity_type: 'url_mapping',
        entity_id: mapping.id,
        action: 'generate_letsencrypt',
        description: `Generating LetsEncrypt certificate for ${domain}`,
        status: 'in_progress',
        metadata: JSON.stringify({ domain, email }),
        ip_address: req.ip || null
      }
    });

    res.json({
      success: true,
      message: `LetsEncrypt certificate generation started for ${domain}`,
      data: {
        mapping_id: mapping.id,
        domain,
        status: 'generating'
      }
    });

    generateCertificateBackground(mapping.id, domain, email, req.user!.id, mapping.company_id);

  } catch (error: any) {
    logger.error('Generate LetsEncrypt error:', error);
    res.status(500).json({ success: false, message: 'Failed to start certificate generation', error: error.message });
  }
};

async function generateCertificateBackground(
  mappingId: number,
  domain: string,
  email: string,
  userId: number,
  companyId: number
): Promise<void> {
  try {
    logger.info(`Starting LetsEncrypt generation for ${domain}`);

    try {
      await execAsync('which certbot');
    } catch {
      throw new Error('Certbot is not installed');
    }

    const webroot = `/var/www/letsencrypt-webroot`;
    await execAsync(`mkdir -p ${webroot}`);

    const certbotCmd = `certbot certonly --webroot --webroot-path=${webroot} --email ${email} --agree-tos --no-eff-email --non-interactive --domain ${domain}`;

    logger.info(`Running certbot command for ${domain}`);
    const { stderr } = await execAsync(certbotCmd);

    if (stderr && !stderr.includes('Successfully received certificate')) {
      throw new Error(`Certbot error: ${stderr}`);
    }

    const certPath = `/etc/letsencrypt/live/${domain}`;
    const certificate = await fs.promises.readFile(`${certPath}/fullchain.pem`, 'utf-8');
    const privateKey = await fs.promises.readFile(`${certPath}/privkey.pem`, 'utf-8');
    const chain = await fs.promises.readFile(`${certPath}/chain.pem`, 'utf-8');

    const encryptedPrivateKey = encrypt(privateKey);

    await prisma.company_url_mappings.update({
      where: { id: mappingId },
      data: {
        ssl_enabled: true,
        ssl_certificate: certificate,
        ssl_private_key: encryptedPrivateKey,
        ssl_chain: chain,
        ssl_status: 'active',
        ssl_last_checked: new Date(),
        ssl_error_message: null,
        use_letsencrypt: true,
        letsencrypt_email: email
      }
    });

    await prisma.activity_logs.create({
      data: {
        user_id: userId,
        company_id: companyId,
        activity_type: 'ssl_certificate',
        entity_type: 'url_mapping',
        entity_id: mappingId,
        action: 'letsencrypt_generated',
        description: `LetsEncrypt certificate generated for ${domain}`,
        status: 'success',
        metadata: JSON.stringify({ domain, email, cert_path: certPath })
      }
    });

    logger.info(`LetsEncrypt certificate generated for ${domain}`);

  } catch (error: any) {
    logger.error(`LetsEncrypt generation failed for ${domain}:`, error);

    await prisma.company_url_mappings.update({
      where: { id: mappingId },
      data: {
        ssl_status: 'failed',
        ssl_last_checked: new Date(),
        ssl_error_message: error.message
      }
    });

    await prisma.activity_logs.create({
      data: {
        user_id: userId,
        company_id: companyId,
        activity_type: 'ssl_certificate',
        entity_type: 'url_mapping',
        entity_id: mappingId,
        action: 'letsencrypt_failed',
        description: `LetsEncrypt generation failed for ${domain}: ${error.message}`,
        status: 'failed',
        metadata: JSON.stringify({ domain, email, error: error.message })
      }
    });
  }
}

export const getCertificateStatus = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mapping_id } = req.params;
    const { role, company_id } = req.user!;

    let where: any = { id: Number(mapping_id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const mapping = await prisma.company_url_mappings.findFirst({
      where,
      select: {
        id: true,
        url_pattern: true,
        ssl_enabled: true,
        ssl_status: true,
        ssl_last_checked: true,
        ssl_error_message: true,
        use_letsencrypt: true,
        letsencrypt_email: true
      }
    });

    if (!mapping) {
      res.status(404).json({ success: false, message: 'URL mapping not found' });
      return;
    }

    res.json({ success: true, data: mapping });
  } catch (error: any) {
    logger.error('Get SSL status error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch SSL status', error: error.message });
  }
};

export const uploadCertificate = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { mapping_id, certificate, private_key, chain } = req.body;
    const { role, company_id } = req.user!;

    if (!mapping_id || !certificate || !private_key) {
      res.status(400).json({ success: false, message: 'Mapping ID, certificate, and private key are required' });
      return;
    }

    let where: any = { id: Number(mapping_id) };
    if (role !== 'super_admin' && company_id !== null) {
      where.company_id = company_id;
    }

    const mapping = await prisma.company_url_mappings.findFirst({ where });

    if (!mapping) {
      res.status(404).json({ success: false, message: 'URL mapping not found' });
      return;
    }

    if (!certificate.includes('BEGIN CERTIFICATE') || !private_key.includes('BEGIN PRIVATE KEY')) {
      res.status(400).json({ success: false, message: 'Invalid certificate or private key format' });
      return;
    }

    const encryptedPrivateKey = encrypt(private_key);

    await prisma.company_url_mappings.update({
      where: { id: mapping.id },
      data: {
        ssl_enabled: true,
        ssl_certificate: certificate,
        ssl_private_key: encryptedPrivateKey,
        ssl_chain: chain || null,
        ssl_status: 'active',
        ssl_last_checked: new Date(),
        ssl_error_message: null,
        use_letsencrypt: false
      }
    });

    await prisma.activity_logs.create({
      data: {
        user_id: req.user!.id,
        company_id: mapping.company_id,
        activity_type: 'ssl_certificate',
        entity_type: 'url_mapping',
        entity_id: mapping.id,
        action: 'manual_upload',
        description: `SSL certificate manually uploaded for ${mapping.url_pattern}`,
        status: 'success',
        metadata: JSON.stringify({ domain: mapping.url_pattern }),
        ip_address: req.ip || null
      }
    });

    res.json({
      success: true,
      message: 'SSL certificate uploaded successfully',
      data: { mapping_id: mapping.id, domain: mapping.url_pattern }
    });
  } catch (error: any) {
    logger.error('Upload SSL certificate error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload certificate', error: error.message });
  }
};
