/**
 * Customer Onboarding Controller
 * Handles customer registration and onboarding workflow
 */

import { Response } from 'express';
import { ApiTokenRequest } from '../middlewares/apiTokenAuth';
import prisma from '../config/database';
import crypto from 'crypto';
import emailService from '../utils/emailService';

/**
 * Generate unique tracking code for registration
 */
function generateTrackingCode(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `REG-${date}-${random}`;
}

/**
 * Register new customer
 * POST /api/public/onboarding/register
 */
export const registerCustomer = async (req: ApiTokenRequest, res: Response): Promise<void> => {
  try {
    const {
      company_name,
      contact_email,
      contact_name,
      contact_phone,
      industry,
      company_size,
      country,
      timezone,
      utm_source,
      utm_medium,
      utm_campaign,
      custom_fields
    } = req.body;

    // Validation
    if (!company_name || !contact_email) {
      res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'company_name and contact_email are required'
      });
      return;
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contact_email)) {
      res.status(400).json({
        success: false,
        error: 'INVALID_EMAIL',
        message: 'Invalid email address format'
      });
      return;
    }

    // Check for duplicate email
    const existingRegistration = await prisma.onboarding_registrations.findFirst({
      where: {
        contact_email: contact_email,
        status: { in: ['pending', 'approved', 'completed'] }
      }
    });

    if (existingRegistration) {
      res.status(409).json({
        success: false,
        error: 'DUPLICATE_REGISTRATION',
        message: 'A registration with this email already exists',
        tracking_code: existingRegistration.tracking_code
      });
      return;
    }

    // Generate tracking code
    const trackingCode = generateTrackingCode();

    // Create registration
    const registration = await prisma.onboarding_registrations.create({
      data: {
        tracking_code: trackingCode,
        company_name,
        contact_email,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        industry: industry || null,
        company_size: company_size || null,
        country: country || null,
        timezone: timezone || 'UTC',
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        registration_data: custom_fields ? JSON.stringify(custom_fields) : undefined,
        status: 'pending',
        created_via: 'api',
        api_token_id: req.apiToken?.id || null
      }
    });

    // Get onboarding template (default for now)
    const template = await prisma.onboarding_templates.findFirst({
      where: { is_default: true, is_active: true }
    });

    if (template && template.steps_config) {
      // Create onboarding steps
      const stepsConfig = JSON.parse(template.steps_config as string);
      const steps = stepsConfig.steps || [];

      for (const step of steps) {
        await prisma.onboarding_steps.create({
          data: {
            registration_id: registration.id,
            step_name: step.name,
            step_order: step.order,
            status: step.order === 1 ? 'completed' : 'pending', // First step (registration) is auto-completed
            completed_at: step.order === 1 ? new Date() : null
          }
        });
      }
    }

    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.email_verification_tokens.create({
      data: {
        registration_id: registration.id,
        email: contact_email,
        token: verificationToken,
        expires_at: expiresAt,
        ip_address: req.ip || req.socket.remoteAddress || null
      }
    });

    // Send verification email (async, don't wait)
    sendVerificationEmail(registration.id, contact_email, contact_name, verificationToken).catch(err =>
      console.error('Failed to send verification email:', err)
    );

    res.status(201).json({
      success: true,
      data: {
        registration_id: registration.id,
        tracking_code: trackingCode,
        status: 'pending',
        message: 'Registration submitted successfully. Please check your email to verify your address.',
        next_step: {
          name: 'email_verification',
          description: 'Verify your email address to continue'
        }
      }
    });
  } catch (error: any) {
    console.error('Customer registration error:', error);
    res.status(500).json({
      success: false,
      error: 'REGISTRATION_FAILED',
      message: 'Failed to process registration'
    });
  }
};

/**
 * Get registration status
 * GET /api/public/onboarding/status/:tracking_code
 */
export const getRegistrationStatus = async (req: ApiTokenRequest, res: Response): Promise<void> => {
  try {
    const { tracking_code } = req.params;

    const registration = await prisma.onboarding_registrations.findUnique({
      where: { tracking_code }
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Registration not found'
      });
      return;
    }

    // Get onboarding steps
    const steps = await prisma.onboarding_steps.findMany({
      where: { registration_id: registration.id },
      orderBy: { step_order: 'asc' }
    });

    // Find next action
    const pendingStep = steps.find(s => s.status === 'pending' || s.status === 'in_progress');
    let nextAction = null;

    if (pendingStep?.step_name === 'email_verification') {
      nextAction = {
        type: 'verify_email',
        description: 'Check your email and click the verification link'
      };
    } else if (pendingStep?.step_name === 'plan_selection') {
      nextAction = {
        type: 'select_plan',
        url: `/onboarding/${tracking_code}/plans`
      };
    }

    res.json({
      success: true,
      data: {
        registration_id: registration.id,
        tracking_code: registration.tracking_code,
        company_name: registration.company_name,
        contact_email: registration.contact_email,
        status: registration.status,
        company_id: registration.company_id,
        created_at: registration.created_at,
        steps: steps.map(step => ({
          name: step.step_name,
          order: step.step_order,
          status: step.status,
          completed_at: step.completed_at
        })),
        next_action: nextAction
      }
    });
  } catch (error: any) {
    console.error('Get registration status error:', error);
    res.status(500).json({
      success: false,
      error: 'STATUS_CHECK_FAILED',
      message: 'Failed to retrieve registration status'
    });
  }
};

/**
 * Verify email address
 * POST /api/public/onboarding/verify-email
 */
export const verifyEmail = async (req: ApiTokenRequest, res: Response): Promise<void> => {
  try {
    const { token } = req.body;

    if (!token) {
      res.status(400).json({
        success: false,
        error: 'MISSING_TOKEN',
        message: 'Verification token is required'
      });
      return;
    }

    // Find verification token
    const verification = await prisma.email_verification_tokens.findUnique({
      where: { token },
      include: {
        onboarding_registrations: true
      }
    });

    if (!verification) {
      res.status(404).json({
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Verification token not found'
      });
      return;
    }

    // Check if already verified
    if (verification.verified_at) {
      res.status(400).json({
        success: false,
        error: 'ALREADY_VERIFIED',
        message: 'Email already verified'
      });
      return;
    }

    // Check expiration
    if (new Date(verification.expires_at) < new Date()) {
      res.status(400).json({
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Verification token has expired'
      });
      return;
    }

    // Mark as verified
    await prisma.email_verification_tokens.update({
      where: { id: verification.id },
      data: {
        verified_at: new Date(),
        ip_address: req.ip || req.socket.remoteAddress || null
      }
    });

    // Update onboarding step
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: verification.registration_id,
        step_name: 'email_verification'
      },
      data: {
        status: 'completed',
        completed_at: new Date()
      }
    });

    // Set next step to in_progress
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: verification.registration_id,
        step_name: 'plan_selection'
      },
      data: {
        status: 'in_progress'
      }
    });

    res.json({
      success: true,
      data: {
        registration_id: verification.registration_id,
        tracking_code: verification.onboarding_registrations.tracking_code,
        message: 'Email verified successfully',
        next_step: {
          name: 'plan_selection',
          description: 'Choose your subscription plan'
        }
      }
    });
  } catch (error: any) {
    console.error('Email verification error:', error);
    res.status(500).json({
      success: false,
      error: 'VERIFICATION_FAILED',
      message: 'Failed to verify email'
    });
  }
};

/**
 * Get available subscription plans
 * GET /api/public/onboarding/plans
 */
export const getSubscriptionPlans = async (_req: ApiTokenRequest, res: Response): Promise<void> => {
  try {
    const plans = await prisma.subscription_plans.findMany({
      where: { is_active: true },
      orderBy: { display_order: 'asc' }
    });

    res.json({
      success: true,
      data: plans.map(plan => ({
        id: plan.id,
        name: plan.name,
        description: plan.description,
        price: parseFloat(plan.price as any),
        currency: plan.currency,
        billing_period: plan.billing_period,
        trial_days: plan.trial_days,
        features: JSON.parse(plan.features as string)
      }))
    });
  } catch (error: any) {
    console.error('Get subscription plans error:', error);
    res.status(500).json({
      success: false,
      error: 'PLANS_FETCH_FAILED',
      message: 'Failed to retrieve subscription plans'
    });
  }
};

/**
 * Select subscription plan
 * POST /api/public/onboarding/:tracking_code/select-plan
 */
export const selectPlan = async (req: ApiTokenRequest, res: Response): Promise<void> => {
  try {
    const { tracking_code } = req.params;
    const { plan_id } = req.body;

    if (!plan_id) {
      res.status(400).json({
        success: false,
        error: 'MISSING_PLAN_ID',
        message: 'plan_id is required'
      });
      return;
    }

    // Find registration
    const registration = await prisma.onboarding_registrations.findUnique({
      where: { tracking_code }
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Registration not found'
      });
      return;
    }

    // Verify plan exists
    const plan = await prisma.subscription_plans.findUnique({
      where: { id: plan_id }
    });

    if (!plan || !plan.is_active) {
      res.status(404).json({
        success: false,
        error: 'INVALID_PLAN',
        message: 'Selected plan not found or inactive'
      });
      return;
    }

    // Update step data
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: registration.id,
        step_name: 'plan_selection'
      },
      data: {
        status: 'completed',
        step_data: JSON.stringify({ plan_id, plan_name: plan.name }),
        completed_at: new Date()
      }
    });

    // Determine next step based on plan price
    const isFree = parseFloat(plan.price as any) === 0;
    const nextStepName = isFree ? 'account_setup' : 'payment';

    // Update next step status
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: registration.id,
        step_name: nextStepName
      },
      data: {
        status: 'in_progress'
      }
    });

    // Skip payment step if free plan
    if (isFree) {
      await prisma.onboarding_steps.updateMany({
        where: {
          registration_id: registration.id,
          step_name: 'payment'
        },
        data: {
          status: 'skipped',
          completed_at: new Date()
        }
      });
    }

    res.json({
      success: true,
      data: {
        message: 'Plan selected successfully',
        selected_plan: {
          id: plan.id,
          name: plan.name,
          price: parseFloat(plan.price as any)
        },
        next_step: {
          name: nextStepName,
          description: isFree ? 'Setting up your account' : 'Complete payment information'
        }
      }
    });
  } catch (error: any) {
    console.error('Select plan error:', error);
    res.status(500).json({
      success: false,
      error: 'PLAN_SELECTION_FAILED',
      message: 'Failed to select plan'
    });
  }
};

/**
 * Resend verification email
 * POST /api/public/onboarding/:tracking_code/resend-verification
 */
export const resendVerificationEmail = async (req: ApiTokenRequest, res: Response): Promise<void> => {
  try {
    const { tracking_code } = req.params;

    const registration = await prisma.onboarding_registrations.findUnique({
      where: { tracking_code }
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Registration not found'
      });
      return;
    }

    // Check if already verified
    const existingVerification = await prisma.email_verification_tokens.findFirst({
      where: {
        registration_id: registration.id,
        verified_at: { not: null }
      }
    });

    if (existingVerification) {
      res.status(400).json({
        success: false,
        error: 'ALREADY_VERIFIED',
        message: 'Email already verified'
      });
      return;
    }

    // Generate new token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await prisma.email_verification_tokens.create({
      data: {
        registration_id: registration.id,
        email: registration.contact_email,
        token: verificationToken,
        expires_at: expiresAt,
        ip_address: req.ip || req.socket.remoteAddress || null
      }
    });

    // Send email
    await sendVerificationEmail(
      registration.id,
      registration.contact_email,
      registration.contact_name,
      verificationToken
    );

    res.json({
      success: true,
      data: {
        message: 'Verification email sent successfully'
      }
    });
  } catch (error: any) {
    console.error('Resend verification email error:', error);
    res.status(500).json({
      success: false,
      error: 'RESEND_FAILED',
      message: 'Failed to resend verification email'
    });
  }
};

/**
 * Approve or reject registration (Admin only)
 * POST /api/admin/onboarding/:id/review
 */
export const reviewRegistration = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { action, rejection_reason } = req.body;

    if (!action || !['approve', 'reject'].includes(action)) {
      res.status(400).json({
        success: false,
        error: 'INVALID_ACTION',
        message: 'Action must be either "approve" or "reject"'
      });
      return;
    }

    const registration = await prisma.onboarding_registrations.findUnique({
      where: { id: parseInt(id) }
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Registration not found'
      });
      return;
    }

    if (action === 'reject') {
      await prisma.onboarding_registrations.update({
        where: { id: parseInt(id) },
        data: {
          status: 'rejected',
          rejection_reason: rejection_reason || null
        }
      });

      // Send rejection email
      await emailService.sendRejectionEmail(
        registration.contact_email,
        registration.company_name,
        rejection_reason
      );

      res.json({
        success: true,
        data: { message: 'Registration rejected', status: 'rejected' }
      });
      return;
    }

    // Approve and create company/user
    await prisma.onboarding_registrations.update({
      where: { id: parseInt(id) },
      data: {
        status: 'approved'
      }
    });

    // Update admin_approval step
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: registration.id,
        step_name: 'admin_approval'
      },
      data: {
        status: 'completed',
        completed_at: new Date()
      }
    });

    // Move to account setup
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: registration.id,
        step_name: 'account_setup'
      },
      data: {
        status: 'in_progress'
      }
    });

    res.json({
      success: true,
      data: {
        message: 'Registration approved',
        status: 'approved',
        next_step: 'account_setup'
      }
    });
  } catch (error: any) {
    console.error('Review registration error:', error);
    res.status(500).json({
      success: false,
      error: 'REVIEW_FAILED',
      message: 'Failed to review registration'
    });
  }
};

/**
 * Complete account setup (creates company and user)
 * POST /api/admin/onboarding/:id/complete-setup
 */
export const completeAccountSetup = async (req: any, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { assigned_clusters, initial_password } = req.body;

    const registration = await prisma.onboarding_registrations.findUnique({
      where: { id: parseInt(id) }
    });

    if (!registration) {
      res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: 'Registration not found'
      });
      return;
    }

    if (registration.status !== 'approved') {
      res.status(400).json({
        success: false,
        error: 'INVALID_STATUS',
        message: 'Registration must be approved first'
      });
      return;
    }

    // Create company
    const company = await prisma.companies.create({
      data: {
        name: registration.company_name,
        owner_name: registration.contact_name || registration.company_name,
        primary_email: registration.contact_email,
        contact_email: registration.contact_email,
        contact_phone: registration.contact_phone || null,
        address: registration.country || null,
        status: 'active'
      }
    });

    // Create user account
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(initial_password || 'TempPass123!', 10);

    const user = await prisma.users.create({
      data: {
        email: registration.contact_email,
        username: registration.contact_email.split('@')[0],
        password_hash: hashedPassword,
        first_name: registration.contact_name?.split(' ')[0] || null,
        last_name: registration.contact_name?.split(' ').slice(1).join(' ') || null,
        company_id: company.id,
        role: 'company_admin',
        status: 'active'
      }
    });

    // Assign clusters if provided
    if (assigned_clusters && Array.isArray(assigned_clusters)) {
      for (const clusterId of assigned_clusters) {
        await prisma.company_clusters.create({
          data: {
            company_id: company.id,
            cluster_id: clusterId
          }
        });
      }
    }

    // Get selected plan
    const planStep = await prisma.onboarding_steps.findFirst({
      where: {
        registration_id: registration.id,
        step_name: 'plan_selection'
      }
    });

    let planId = null;
    if (planStep?.step_data) {
      const stepData = JSON.parse(planStep.step_data as string);
      planId = stepData.plan_id;
    }

    // Create subscription if plan selected
    if (planId) {
      const plan = await prisma.subscription_plans.findUnique({
        where: { id: planId }
      });

      if (plan) {
        const startDate = new Date();
        const endDate = new Date(startDate);
        if (plan.billing_period === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (plan.billing_period === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        await prisma.company_subscriptions.create({
          data: {
            company_id: company.id,
            plan_id: planId,
            status: 'active',
            current_period_start: startDate,
            current_period_end: endDate
          }
        });
      }
    }

    // Update registration
    await prisma.onboarding_registrations.update({
      where: { id: registration.id },
      data: {
        status: 'completed',
        company_id: company.id,
        completed_at: new Date()
      }
    });

    // Complete account_setup step
    await prisma.onboarding_steps.updateMany({
      where: {
        registration_id: registration.id,
        step_name: 'account_setup'
      },
      data: {
        status: 'completed',
        completed_at: new Date(),
        step_data: JSON.stringify({
          company_id: company.id,
          user_id: user.id
        })
      }
    });

    // Send welcome email
    await emailService.sendWelcomeEmail(
      registration.contact_email,
      registration.company_name,
      registration.contact_email.split('@')[0],
      initial_password || 'TempPass123!',
      process.env.APP_URL || 'http://localhost:3000'
    );

    res.json({
      success: true,
      data: {
        message: 'Account setup completed successfully',
        company_id: company.id,
        user_id: user.id,
        tracking_code: registration.tracking_code
      }
    });
  } catch (error: any) {
    console.error('Complete account setup error:', error);
    res.status(500).json({
      success: false,
      error: 'SETUP_FAILED',
      message: 'Failed to complete account setup'
    });
  }
};

/**
 * List pending registrations (Admin only)
 * GET /api/admin/onboarding/pending
 */
export const listPendingRegistrations = async (_req: any, res: Response): Promise<void> => {
  try {
    const registrations = await prisma.onboarding_registrations.findMany({
      where: {
        status: { in: ['pending', 'approved'] }
      },
      orderBy: { created_at: 'desc' },
      take: 100
    });

    const result = await Promise.all(
      registrations.map(async (reg) => {
        const steps = await prisma.onboarding_steps.findMany({
          where: { registration_id: reg.id },
          orderBy: { step_order: 'asc' }
        });

        return {
          ...reg,
          steps: steps.map(s => ({
            name: s.step_name,
            status: s.status,
            completed_at: s.completed_at
          }))
        };
      })
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    console.error('List pending registrations error:', error);
    res.status(500).json({
      success: false,
      error: 'LIST_FAILED',
      message: 'Failed to list registrations'
    });
  }
};

/**
 * Send verification email
 */
async function sendVerificationEmail(
  _registrationId: number,
  email: string,
  name: string | null,
  token: string
): Promise<void> {
  const verificationUrl = `${process.env.APP_URL}/verify-email?token=${token}`;

  await emailService.sendVerificationEmail(
    email,
    verificationUrl,
    name || 'Guest'
  );
}
