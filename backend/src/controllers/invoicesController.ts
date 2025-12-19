import { Request, Response } from 'express';
import prisma from '../config/database';
import logger from '../utils/logger';
import { generateInvoicePDF, streamInvoicePDF } from '../services/pdfGenerationService';
import { sendInvoiceEmail } from '../services/emailNotificationService';

/**
 * Get list of invoices for a company
 * Query params: status, page, limit, sort
 */
export const getCompanyInvoices = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;
    const {
      status,
      page = '1',
      limit = '20',
      sort = 'desc',
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    const where: any = {
      company_id: parseInt(companyId),
    };

    if (status && status !== 'all') {
      where.status = status;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoices.findMany({
        where,
        skip,
        take,
        orderBy: { issued_at: sort === 'asc' ? 'asc' : 'desc' },
        include: {
          companies: {
            select: {
              id: true,
              name: true,
            },
          },
          users: {
            select: {
              id: true,
              email: true,
              first_name: true,
              last_name: true,
            },
          },
        },
      }),
      prisma.invoices.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error: any) {
    logger.error('Get company invoices error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoices',
      error: error.message,
    });
  }
};

/**
 * Get invoice detail with line items
 */
export const getInvoiceDetail = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { id: parseInt(invoiceId) },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
        users: {
          select: {
            id: true,
            email: true,
            first_name: true,
            last_name: true,
          },
        },
        invoice_line_items: {
          include: {
            virtual_machines: {
              select: {
                id: true,
                name: true,
                vmid: true,
                node: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    return res.json({
      success: true,
      data: invoice,
    });
  } catch (error: any) {
    logger.error('Get invoice detail error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice detail',
      error: error.message,
    });
  }
};

/**
 * Update invoice status
 */
export const updateInvoiceStatus = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { status, payment_reference, paid_at } = req.body;

    const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
      });
    }

    const updateData: any = { status };

    if (status === 'paid') {
      updateData.paid_at = paid_at ? new Date(paid_at) : new Date();
      if (payment_reference) {
        updateData.payment_reference = payment_reference;
      }
    }

    const updatedInvoice = await prisma.invoices.update({
      where: { id: parseInt(invoiceId) },
      data: updateData,
    });

    logger.info(`Invoice ${invoiceId} status updated to ${status}`, {
      invoiceId: parseInt(invoiceId),
      status,
      payment_reference,
    });

    return res.json({
      success: true,
      data: updatedInvoice,
      message: 'Invoice status updated successfully',
    });
  } catch (error: any) {
    logger.error('Update invoice status error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update invoice status',
      error: error.message,
    });
  }
};

/**
 * Mark invoice as sent (with email sending capability)
 */
export const sendInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;
    const { email } = req.body;

    const invoice = await prisma.invoices.findUnique({
      where: { id: parseInt(invoiceId) },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // Generate PDF if not already generated
    if (!invoice.pdf_generated) {
      const pdfResult = await generateInvoicePDF(parseInt(invoiceId));
      if (!pdfResult.success) {
        logger.error(`Failed to generate PDF for invoice ${invoiceId}:`, pdfResult.error);
      }
    }

    // Update invoice
    const updatedInvoice = await prisma.invoices.update({
      where: { id: parseInt(invoiceId) },
      data: {
        status: 'sent',
        sent_to_email: email,
        sent_at: new Date(),
      },
    });

    // Send invoice email with PDF attachment
    try {
      const emailResult = await sendInvoiceEmail(parseInt(invoiceId));
      if (!emailResult.success) {
        logger.warn("Failed to send invoice email: " + emailResult.message);
      }
    } catch (emailError) {
      logger.error('Error sending invoice email:', emailError);
      // Don't fail the sendInvoice operation if email fails
    }

    logger.info(`Invoice ${invoiceId} marked as sent to ${email}`, {
      invoiceId: parseInt(invoiceId),
      email,
    });

    return res.json({
      success: true,
      data: updatedInvoice,
      message: `Invoice marked as sent to ${email}`,
    });
  } catch (error: any) {
    logger.error('Send invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send invoice',
      error: error.message,
    });
  }
};

/**
 * Generate invoice PDF
 */
export const generateInvoicePDFController = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { id: parseInt(invoiceId) },
      select: {
        id: true,
        invoice_number: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    const result = await generateInvoicePDF(parseInt(invoiceId));

    if (!result.success) {
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to generate PDF',
      });
    }

    logger.info(`Invoice ${invoiceId} PDF generated successfully`, {
      invoiceId: parseInt(invoiceId),
      invoice_number: invoice.invoice_number,
      file_path: result.filePath,
    });

    return res.json({
      success: true,
      message: 'PDF generated successfully',
      data: {
        invoice_number: invoice.invoice_number,
        pdf_path: `/invoices/${invoice.invoice_number}.pdf`,
      },
    });
  } catch (error: any) {
    logger.error('Generate invoice PDF error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate invoice PDF',
      error: error.message,
    });
  }
};

/**
 * Download invoice PDF
 */
// @ts-ignore - streamInvoicePDF handles the response
export const downloadInvoicePDF = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { id: parseInt(invoiceId) },
      select: {
        id: true,
        invoice_number: true,
      },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    // Stream PDF to response
    await streamInvoicePDF(parseInt(invoiceId), res);
  } catch (error: any) {
    return;
    logger.error('Download invoice PDF error:', error);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to download invoice PDF',
        error: error.message,
      });
    }
    return;
  }
};

/**
 * Get invoice statistics for a company
 */
export const getInvoiceStatistics = async (req: Request, res: Response) => {
  try {
    const { companyId } = req.params;

    const [totalCount, paidCount, overdueCount, totalRevenue, outstandingBalance] =
      await Promise.all([
        prisma.invoices.count({
          where: { company_id: parseInt(companyId) },
        }),
        prisma.invoices.count({
          where: {
            company_id: parseInt(companyId),
            status: 'paid',
          },
        }),
        prisma.invoices.count({
          where: {
            company_id: parseInt(companyId),
            status: 'overdue',
          },
        }),
        prisma.invoices.aggregate({
          where: {
            company_id: parseInt(companyId),
            status: 'paid',
          },
          _sum: {
            total_amount: true,
          },
        }),
        prisma.invoices.aggregate({
          where: {
            company_id: parseInt(companyId),
            status: { in: ['sent', 'overdue'] },
          },
          _sum: {
            total_amount: true,
          },
        }),
      ]);

    return res.json({
      success: true,
      data: {
        total_invoices: totalCount,
        paid_invoices: paidCount,
        overdue_invoices: overdueCount,
        total_revenue: totalRevenue._sum.total_amount || 0,
        outstanding_balance: outstandingBalance._sum.total_amount || 0,
        payment_rate: totalCount > 0 ? (paidCount / totalCount) * 100 : 0,
      },
    });
  } catch (error: any) {
    logger.error('Get invoice statistics error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch invoice statistics',
      error: error.message,
    });
  }
};

/**
 * Delete draft invoice
 */
export const deleteDraftInvoice = async (req: Request, res: Response) => {
  try {
    const { invoiceId } = req.params;

    const invoice = await prisma.invoices.findUnique({
      where: { id: parseInt(invoiceId) },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        message: 'Invoice not found',
      });
    }

    if (invoice.status !== 'draft') {
      return res.status(400).json({
        success: false,
        message: 'Only draft invoices can be deleted',
      });
    }

    // Delete line items first (cascade delete)
    await prisma.invoice_line_items.deleteMany({
      where: { invoice_id: parseInt(invoiceId) },
    });

    // Delete invoice
    await prisma.invoices.delete({
      where: { id: parseInt(invoiceId) },
    });

    logger.info(`Draft invoice ${invoiceId} deleted`, {
      invoiceId: parseInt(invoiceId),
      invoice_number: invoice.invoice_number,
    });

    return res.json({
      success: true,
      message: 'Draft invoice deleted successfully',
    });
  } catch (error: any) {
    logger.error('Delete draft invoice error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete draft invoice',
      error: error.message,
    });
  }
};
