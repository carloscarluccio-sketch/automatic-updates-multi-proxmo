// Invoice Generation Service for PAYG Billing
// Generates monthly invoices from daily usage records

import prisma from '../config/database';
import logger from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';
import { sendInvoiceEmail } from './emailNotificationService';

interface InvoiceLineItem {
  line_type: 'usage';
  description: string;
  quantity: Decimal;
  unit_price: Decimal;
  amount: Decimal;
  tax_rate?: Decimal;
  tax_amount?: Decimal;
  metadata?: any;
  vm_id?: number;
  daily_usage_id?: bigint;
}

/**
 * Generate invoice number in format: INV-YYYYMM-CCCCC (e.g., INV-202512-00001)
 */
async function generateInvoiceNumber(year: number, month: number): Promise<string> {
  const prefix = `INV-${year}${month.toString().padStart(2, '0')}-`;

  // Find the highest invoice number for this month
  const lastInvoice = await prisma.invoices.findFirst({
    where: {
      invoice_number: {
        startsWith: prefix
      }
    },
    orderBy: {
      invoice_number: 'desc'
    },
    select: {
      invoice_number: true
    }
  });

  let sequence = 1;
  if (lastInvoice) {
    const lastSequence = parseInt(lastInvoice.invoice_number.split('-')[2]);
    sequence = lastSequence + 1;
  }

  return `${prefix}${sequence.toString().padStart(5, '0')}`;
}

/**
 * Generate invoice for a company for a specific month
 */
export async function generateMonthlyInvoice(
  companyId: number,
  year: number,
  month: number
): Promise<number | null> {
  try {
    logger.info(`Generating invoice for company ${companyId} for ${year}-${month.toString().padStart(2, '0')}`);

    // Get company details
    const company = await prisma.companies.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        name: true,
        tax_rate: true,
        status: true
      }
    });

    if (!company) {
      logger.error(`Company ${companyId} not found`);
      return null;
    }

    if (company.status !== 'active') {
      logger.warn(`Company ${companyId} (${company.name}) is not active, skipping invoice`);
      return null;
    }

    // Define billing period
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);
    periodEnd.setHours(23, 59, 59, 999);

    // Check if invoice already exists for this period
    const existingInvoice = await prisma.invoices.findFirst({
      where: {
        company_id: companyId,
        billing_period_start: periodStart,
        billing_period_end: periodEnd
      }
    });

    if (existingInvoice) {
      logger.warn(`Invoice already exists for company ${companyId} for period ${periodStart.toISOString().split('T')[0]}`);
      return existingInvoice.id;
    }

    // Get all daily usage records for this company in this period
    const dailyUsage = await prisma.daily_vm_usage.findMany({
      where: {
        company_id: companyId,
        usage_date: {
          gte: periodStart,
          lte: periodEnd
        }
      },
      include: {
        virtual_machines: {
          select: {
            id: true,
            name: true,
            vmid: true
          }
        },
        vm_projects: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [
        { vm_id: 'asc' },
        { usage_date: 'asc' }
      ]
    });

    if (dailyUsage.length === 0) {
      logger.info(`No usage data for company ${companyId} in ${year}-${month}, skipping invoice`);
      return null;
    }

    // Aggregate usage by VM
    const vmUsageMap = new Map<number, {
      vm: any;
      project: any;
      totalCpuHours: Decimal;
      totalMemoryGbHours: Decimal;
      totalDiskGbHours: Decimal;
      totalNetworkGb: Decimal;
      costCpu: Decimal;
      costMemory: Decimal;
      costStorage: Decimal;
      costNetwork: Decimal;
      totalCost: Decimal;
      days: number;
      dailyUsageIds: bigint[];
    }>();

    for (const usage of dailyUsage) {
      const vmId = usage.vm_id;

      if (!vmUsageMap.has(vmId)) {
        vmUsageMap.set(vmId, {
          vm: usage.virtual_machines,
          project: usage.vm_projects,
          totalCpuHours: new Decimal(0),
          totalMemoryGbHours: new Decimal(0),
          totalDiskGbHours: new Decimal(0),
          totalNetworkGb: new Decimal(0),
          costCpu: new Decimal(0),
          costMemory: new Decimal(0),
          costStorage: new Decimal(0),
          costNetwork: new Decimal(0),
          totalCost: new Decimal(0),
          days: 0,
          dailyUsageIds: []
        });
      }

      const vmData = vmUsageMap.get(vmId)!;
      vmData.totalCpuHours = vmData.totalCpuHours.add(usage.total_cpu_hours);
      vmData.totalMemoryGbHours = vmData.totalMemoryGbHours.add(usage.total_memory_gb_hours);
      vmData.totalDiskGbHours = vmData.totalDiskGbHours.add(usage.total_disk_gb_hours);
      vmData.totalNetworkGb = vmData.totalNetworkGb.add(usage.total_network_gb || 0);
      vmData.costCpu = vmData.costCpu.add(usage.cost_cpu || 0);
      vmData.costMemory = vmData.costMemory.add(usage.cost_memory || 0);
      vmData.costStorage = vmData.costStorage.add(usage.cost_storage || 0);
      vmData.costNetwork = vmData.costNetwork.add(usage.cost_network || 0);
      vmData.totalCost = vmData.totalCost.add(usage.total_cost || 0);
      vmData.days++;
      vmData.dailyUsageIds.push(usage.id);
    }

    // Create invoice line items
    const lineItems: InvoiceLineItem[] = [];

    for (const [vmId, vmData] of vmUsageMap.entries()) {
      const vmName = vmData.vm?.name || `VM ${vmId}`;
      const projectName = vmData.project?.name || 'No Project';

      // CPU line item
      if (vmData.costCpu.greaterThan(0)) {
        lineItems.push({
          line_type: 'usage',
          description: `CPU Usage - ${vmName} (${projectName}) - ${vmData.days} days`,
          quantity: vmData.totalCpuHours,
          unit_price: vmData.costCpu.div(vmData.totalCpuHours),
          amount: vmData.costCpu,
          vm_id: vmId,
          metadata: {
            vm_name: vmName,
            project_name: projectName,
            days: vmData.days,
            total_cpu_hours: vmData.totalCpuHours.toString()
          }
        });
      }

      // Memory line item
      if (vmData.costMemory.greaterThan(0)) {
        lineItems.push({
          line_type: 'usage',
          description: `Memory Usage - ${vmName} (${projectName}) - ${vmData.days} days`,
          quantity: vmData.totalMemoryGbHours,
          unit_price: vmData.costMemory.div(vmData.totalMemoryGbHours),
          amount: vmData.costMemory,
          vm_id: vmId,
          metadata: {
            vm_name: vmName,
            project_name: projectName,
            days: vmData.days,
            total_memory_gb_hours: vmData.totalMemoryGbHours.toString()
          }
        });
      }

      // Storage line item
      if (vmData.costStorage.greaterThan(0)) {
        lineItems.push({
          line_type: 'usage',
          description: `Storage Usage - ${vmName} (${projectName}) - ${vmData.days} days`,
          quantity: vmData.totalDiskGbHours,
          unit_price: vmData.costStorage.div(vmData.totalDiskGbHours),
          amount: vmData.costStorage,
          vm_id: vmId,
          metadata: {
            vm_name: vmName,
            project_name: projectName,
            days: vmData.days,
            total_disk_gb_hours: vmData.totalDiskGbHours.toString()
          }
        });
      }

      // Network line item
      if (vmData.costNetwork.greaterThan(0)) {
        lineItems.push({
          line_type: 'usage',
          description: `Network Transfer - ${vmName} (${projectName})`,
          quantity: vmData.totalNetworkGb,
          unit_price: vmData.costNetwork.div(vmData.totalNetworkGb),
          amount: vmData.costNetwork,
          vm_id: vmId,
          metadata: {
            vm_name: vmName,
            project_name: projectName,
            total_network_gb: vmData.totalNetworkGb.toString()
          }
        });
      }
    }

    // Calculate totals
    const subtotal = lineItems.reduce((sum, item) => sum.add(item.amount), new Decimal(0));
    // Get tax rate from company settings
    const taxRate = company.tax_rate ? new Decimal(company.tax_rate) : new Decimal(0);
    const taxAmount = subtotal.mul(taxRate);
    const totalAmount = subtotal.add(taxAmount);

    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(year, month);

    // Calculate due date (30 days from end of billing period)
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice
    const invoice = await prisma.invoices.create({
      data: {
        invoice_number: invoiceNumber,
        company_id: companyId,
        billing_period_start: periodStart,
        billing_period_end: periodEnd,
        usage_period_start: periodStart,
        usage_period_end: periodEnd,
        subtotal: subtotal,
        tax_amount: taxAmount,
        discount_amount: new Decimal(0),
        total_amount: totalAmount,
        currency: 'USD',
        status: 'draft',
        due_date: dueDate,
        auto_generated: true,
        notes: `Pay-As-You-Go billing for ${year}-${month.toString().padStart(2, '0')}\nGenerated from ${dailyUsage.length} daily usage records across ${vmUsageMap.size} VMs`,
        sent_to_email: null
      }
    });

    // Create invoice line items
    for (const item of lineItems) {
      await prisma.invoice_line_items.create({
        data: {
          invoice_id: invoice.id,
          line_type: item.line_type,
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          amount: item.amount,
          tax_rate: item.tax_rate || new Decimal(0),
          tax_amount: item.tax_amount || new Decimal(0),
          vm_id: item.vm_id,
          metadata: item.metadata ? JSON.stringify(item.metadata) : null
        }
      });
    }

    logger.info(`✅ Invoice ${invoiceNumber} created for company ${companyId} (${company.name}): $${totalAmount.toFixed(2)} with ${lineItems.length} line items`);

    return invoice.id;
  } catch (error: any) {
    logger.error(`Error generating invoice for company ${companyId}:`, error);
    throw error;
  }
}

/**
 * Generate invoices for all active companies for a specific month
 */
export async function generateAllMonthlyInvoices(year: number, month: number): Promise<void> {
  const startTime = Date.now();
  logger.info(`========== Generating monthly invoices for ${year}-${month.toString().padStart(2, '0')} ==========`);

  try {
    // Get all active companies
    const companies = await prisma.companies.findMany({
      where: {
        status: 'active'
      },
      select: {
        id: true,
        name: true
      }
    });

    logger.info(`Found ${companies.length} active companies`);

    let successCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    // Generate invoice for each company
    for (const company of companies) {
      try {
        const invoiceId = await generateMonthlyInvoice(company.id, year, month);

        if (invoiceId) {
          successCount++;
        } else {
          skippedCount++;
        }
      } catch (error: any) {
        logger.error(`Failed to generate invoice for company ${company.id} (${company.name}):`, error.message);
        errorCount++;
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info(`========== Invoice generation completed in ${duration}s ==========`);
    logger.info(`Results: ${successCount} created, ${skippedCount} skipped, ${errorCount} errors`);

  } catch (error: any) {
    logger.error('Error in invoice generation:', error);
    throw error;
  }
}

/**
 * Finalize invoice (mark as issued and send notification)
 */
export async function finalizeInvoice(invoiceId: number): Promise<void> {
  try {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          }
        }
      }
    });

    if (!invoice) {
      throw new Error(`Invoice ${invoiceId} not found`);
    }

    if (invoice.status !== 'draft') {
      logger.warn(`Invoice ${invoice.invoice_number} is already ${invoice.status}`);
      return;
    }

    // Update status to issued
    await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        issued_at: new Date()
      }
    });

    logger.info(`✅ Invoice ${invoice.invoice_number} finalized and marked as issued`);

    // Send email notification with PDF attachment
    try {
      const emailResult = await sendInvoiceEmail(invoice.id);
      if (emailResult.success) {
        logger.info(`Invoice email sent for ${invoice.invoice_number}`);
      } else {
        logger.warn(`Failed to send invoice email: ${emailResult.message}`);
      }
    } catch (emailError) {
      logger.error(`Error sending invoice email for ${invoice.invoice_number}:`, emailError);
      // Don't fail invoice generation if email fails
    }

  } catch (error: any) {
    logger.error(`Error finalizing invoice ${invoiceId}:`, error);
    throw error;
  }
}

/**
 * Mark invoice as paid
 */
export async function markInvoicePaid(
  invoiceId: number,
  paymentReference?: string
): Promise<void> {
  try {
    await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        status: 'paid',
        paid_at: new Date(),
        payment_reference: paymentReference || null
      }
    });

    logger.info(`✅ Invoice ${invoiceId} marked as paid`);
  } catch (error: any) {
    logger.error(`Error marking invoice ${invoiceId} as paid:`, error);
    throw error;
  }
}

/**
 * Get invoice generation status
 */
export async function getInvoiceGenerationStatus(year: number, month: number): Promise<{
  totalCompanies: number;
  invoicesGenerated: number;
  totalAmount: Decimal;
  pendingCompanies: number;
}> {
  try {
    const periodStart = new Date(year, month - 1, 1);
    const periodEnd = new Date(year, month, 0);

    const activeCompanies = await prisma.companies.count({
      where: { status: 'active' }
    });

    const generatedInvoices = await prisma.invoices.count({
      where: {
        billing_period_start: periodStart,
        billing_period_end: periodEnd
      }
    });

    const totalAmount = await prisma.invoices.aggregate({
      where: {
        billing_period_start: periodStart,
        billing_period_end: periodEnd
      },
      _sum: {
        total_amount: true
      }
    });

    return {
      totalCompanies: activeCompanies,
      invoicesGenerated: generatedInvoices,
      totalAmount: totalAmount._sum.total_amount || new Decimal(0),
      pendingCompanies: activeCompanies - generatedInvoices
    };
  } catch (error: any) {
    logger.error('Error getting invoice generation status:', error);
    throw error;
  }
}

export default {
  generateMonthlyInvoice,
  generateAllMonthlyInvoices,
  finalizeInvoice,
  markInvoicePaid,
  getInvoiceGenerationStatus
};
