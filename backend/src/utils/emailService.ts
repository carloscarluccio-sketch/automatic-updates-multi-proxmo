/**
 * Email Service Utility
 * Enhanced to use EmailTemplateService with branding support
 */

import emailNotificationService from '../services/emailNotificationService';
import emailTemplateService from '../services/EmailTemplateService';
import brandingService from '../services/BrandingService';
import logger from './logger';

/**
 * Send verification email to customer
 */
export async function sendVerificationEmail(
  email: string,
  verificationLink: string,
  companyName: string,
  companyId?: number,
  urlMappingId?: number
): Promise<boolean> {
  try {
    // Get branding context
    const branding = await brandingService.resolveBranding(companyId, urlMappingId);

    // Get email template
    const template = await emailTemplateService.getTemplate(
      'email-verification',
      companyId,
      urlMappingId
    );

    if (!template) {
      logger.warn('Verification email template not found, using default');
      // Fallback to old implementation if template not found
      return sendVerificationEmailFallback(email, verificationLink, companyName);
    }

    // Prepare template variables
    const variables = {
      user_name: companyName,
      user_email: email,
      verification_url: verificationLink,
      company_name: companyName
    };

    // Render template with branding
    const rendered = await emailTemplateService.renderTemplate(template, variables, branding);

    // Send email
    return await emailNotificationService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      priority: 'high'
    });
  } catch (error) {
    logger.error('Failed to send verification email:', error);
    return false;
  }
}

/**
 * Send welcome email with account credentials
 */
export async function sendWelcomeEmail(
  email: string,
  companyName: string,
  username: string,
  temporaryPassword: string,
  loginUrl: string,
  companyId?: number,
  urlMappingId?: number
): Promise<boolean> {
  try {
    // Get branding context
    const branding = await brandingService.resolveBranding(companyId, urlMappingId);

    // Get email template
    const template = await emailTemplateService.getTemplate(
      'welcome-email',
      companyId,
      urlMappingId
    );

    if (!template) {
      logger.warn('Welcome email template not found, using default');
      return sendWelcomeEmailFallback(email, companyName, username, temporaryPassword, loginUrl);
    }

    // Prepare template variables
    const variables = {
      user_name: companyName,
      user_email: email,
      user_username: username,
      user_password: temporaryPassword,
      login_url: loginUrl,
      company_name: companyName
    };

    // Render template with branding
    const rendered = await emailTemplateService.renderTemplate(template, variables, branding);

    // Send email
    return await emailNotificationService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      priority: 'high'
    });
  } catch (error) {
    logger.error('Failed to send welcome email:', error);
    return false;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  email: string,
  userName: string,
  resetLink: string,
  companyId?: number,
  urlMappingId?: number
): Promise<boolean> {
  try {
    // Get branding context
    const branding = await brandingService.resolveBranding(companyId, urlMappingId);

    // Get email template
    const template = await emailTemplateService.getTemplate(
      'password-reset',
      companyId,
      urlMappingId
    );

    if (!template) {
      logger.warn('Password reset template not found, using default');
      return sendPasswordResetEmailFallback(email, userName, resetLink);
    }

    // Prepare template variables
    const variables = {
      user_name: userName,
      user_email: email,
      reset_password_url: resetLink
    };

    // Render template with branding
    const rendered = await emailTemplateService.renderTemplate(template, variables, branding);

    // Send email
    return await emailNotificationService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      priority: 'high'
    });
  } catch (error) {
    logger.error('Failed to send password reset email:', error);
    return false;
  }
}

/**
 * Send VM created notification email
 */
export async function sendVMCreatedEmail(
  email: string,
  userName: string,
  vmName: string,
  vmDetails: {
    vmId?: number;
    ipAddress?: string;
    username?: string;
    password?: string;
  },
  companyId?: number,
  urlMappingId?: number
): Promise<boolean> {
  try {
    // Get branding context
    const branding = await brandingService.resolveBranding(companyId, urlMappingId);

    // Get email template
    const template = await emailTemplateService.getTemplate(
      'vm-created',
      companyId,
      urlMappingId
    );

    if (!template) {
      logger.warn('VM created template not found, using default');
      return false;
    }

    // Prepare template variables
    const variables = {
      user_name: userName,
      user_email: email,
      vm_name: vmName,
      vm_id: vmDetails.vmId,
      vm_ip: vmDetails.ipAddress,
      vm_username: vmDetails.username,
      vm_password: vmDetails.password
    };

    // Render template with branding
    const rendered = await emailTemplateService.renderTemplate(template, variables, branding);

    // Send email
    return await emailNotificationService.sendEmail({
      to: email,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      priority: 'normal'
    });
  } catch (error) {
    logger.error('Failed to send VM created email:', error);
    return false;
  }
}

/**
 * Send rejection email (existing implementation)
 */
export async function sendRejectionEmail(
  email: string,
  companyName: string,
  reason: string
): Promise<boolean> {
  try {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #dc3545; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Registration Update</h1>
          </div>
          <div class="content">
            <p>Dear ${companyName},</p>
            <p>Thank you for your interest in Proxmox Multi-Tenant Platform.</p>
            <p>After reviewing your registration, we regret to inform you that we are unable to proceed with your account at this time.</p>
            <p><strong>Reason:</strong> ${reason}</p>
            <p>If you have any questions or would like to discuss this further, please contact our support team.</p>
          </div>
          <div class="footer">
            <p>Proxmox Multi-Tenant Platform Support</p>
            <p>support@proxmox-platform.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Dear ${companyName},

Thank you for your interest in Proxmox Multi-Tenant Platform.

After reviewing your registration, we regret to inform you that we are unable to proceed with your account at this time.

Reason: ${reason}

If you have any questions or would like to discuss this further, please contact our support team.

Proxmox Multi-Tenant Platform Support
support@proxmox-platform.com
    `;

    return await emailNotificationService.sendEmail({
      to: email,
      subject: 'Registration Update - Proxmox Multi-Tenant Platform',
      html,
      text,
      priority: 'normal'
    });
  } catch (error) {
    logger.error('Failed to send rejection email:', error);
    return false;
  }
}

// ========== FALLBACK IMPLEMENTATIONS (Old Templates) ==========

async function sendVerificationEmailFallback(
  email: string,
  verificationLink: string,
  companyName: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Verify Your Email</h1>
        </div>
        <div class="content">
          <h2>Welcome to Proxmox Multi-Tenant Platform!</h2>
          <p>Thank you for registering ${companyName}. Please verify your email address to continue with your registration.</p>
          <p>Click the button below to verify your email:</p>
          <p style="text-align: center;">
            <a href="${verificationLink}" class="button">Verify Email Address</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0066cc;">${verificationLink}</p>
          <p><strong>Note:</strong> This link will expire in 1 hour.</p>
        </div>
        <div class="footer">
          <p>If you didn't request this email, please ignore it.</p>
          <p>&copy; ${new Date().getFullYear()} Proxmox Multi-Tenant Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Proxmox Multi-Tenant Platform!

Thank you for registering ${companyName}. Please verify your email address to continue with your registration.

Verify your email by visiting this link:
${verificationLink}

Note: This link will expire in 1 hour.

If you didn't request this email, please ignore it.
  `;

  return await emailNotificationService.sendEmail({
    to: email,
    subject: 'Verify Your Email - Proxmox Multi-Tenant Platform',
    html,
    text,
    priority: 'high'
  });
}

async function sendWelcomeEmailFallback(
  email: string,
  companyName: string,
  username: string,
  temporaryPassword: string,
  loginUrl: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #28a745; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .credentials { background-color: #e9ecef; padding: 15px; border-radius: 4px; margin: 20px 0; }
        .button { display: inline-block; padding: 12px 24px; background-color: #28a745; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Proxmox Multi-Tenant Platform!</h1>
        </div>
        <div class="content">
          <p>Hello ${companyName},</p>
          <p>Your account has been successfully created! We're excited to have you on board.</p>
          <div class="credentials">
            <h3>Your Login Credentials</h3>
            <p><strong>Username:</strong> ${username}</p>
            <p><strong>Temporary Password:</strong> ${temporaryPassword}</p>
          </div>
          <p style="text-align: center;">
            <a href="${loginUrl}" class="button">Login to Your Account</a>
          </p>
          <p><strong>Important:</strong> Please change your password after your first login for security.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Proxmox Multi-Tenant Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Welcome to Proxmox Multi-Tenant Platform!

Hello ${companyName},

Your account has been successfully created! We're excited to have you on board.

Your Login Credentials:
Username: ${username}
Temporary Password: ${temporaryPassword}

Login here: ${loginUrl}

IMPORTANT: Please change your password after your first login for security.
  `;

  return await emailNotificationService.sendEmail({
    to: email,
    subject: 'Welcome to Proxmox Multi-Tenant Platform!',
    html,
    text,
    priority: 'high'
  });
}

async function sendPasswordResetEmailFallback(
  email: string,
  userName: string,
  resetLink: string
): Promise<boolean> {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #0066cc; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { display: inline-block; padding: 12px 24px; background-color: #0066cc; color: white; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password.</p>
          <p style="text-align: center;">
            <a href="${resetLink}" class="button">Reset Password</a>
          </p>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #0066cc;">${resetLink}</p>
          <p><strong>Note:</strong> This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} Proxmox Multi-Tenant Platform. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Hello ${userName},

We received a request to reset your password.

Reset your password by visiting this link:
${resetLink}

Note: This link will expire in 1 hour.

If you didn't request this, please ignore this email.
  `;

  return await emailNotificationService.sendEmail({
    to: email,
    subject: 'Password Reset Request - Proxmox Multi-Tenant Platform',
    html,
    text,
    priority: 'high'
  });
}

export default {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendVMCreatedEmail,
  sendRejectionEmail
};
