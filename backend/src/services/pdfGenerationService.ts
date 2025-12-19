// PDF Generation Service for Invoices
// Uses PDFKit to generate professional invoice PDFs

import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import prisma from '../config/database';
import logger from '../utils/logger';
import { Decimal } from '@prisma/client/runtime/library';

interface InvoiceData {
  id: number;
  invoice_number: string;
  company_id: number;
  billing_period_start: Date;
  billing_period_end: Date;
  subtotal: Decimal;
  tax_amount: Decimal;
  discount_amount: Decimal;
  total_amount: Decimal;
  currency: string;
  status: string;
  due_date: Date | null;
  issued_at: Date | null;
  paid_at: Date | null;
  notes: string | null;
  companies: {
    id: number;
    name: string;
    company_address?: string | null;
    tax_id?: string | null;
  };
  invoice_line_items: Array<{
    id: number;
    description: string;
    quantity: Decimal;
    unit_price: Decimal;
    amount: Decimal;
    tax_rate: Decimal;
    tax_amount: Decimal;
  }>;
}

/**
 * Ensure invoices directory exists
 */
function ensureInvoiceDirectory(): string {
  const invoiceDir = path.join(__dirname, '../../invoices');
  if (!fs.existsSync(invoiceDir)) {
    fs.mkdirSync(invoiceDir, { recursive: true });
    logger.info(`Created invoices directory: ${invoiceDir}`);
  }
  return invoiceDir;
}

/**
 * Format currency amount
 */
function formatCurrency(amount: Decimal | number, currency: string = 'USD'): string {
  const value = typeof amount === 'number' ? amount : parseFloat(amount.toString());
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency
  }).format(value);
}

/**
 * Format date
 */
function formatDate(date: Date | null): string {
  if (!date) return 'N/A';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  }).format(date);
}

/**
 * Generate invoice PDF
 */
export async function generateInvoicePDF(invoiceId: number): Promise<{
  success: boolean;
  filePath?: string;
  error?: string;
}> {
  try {
    logger.info(`Generating PDF for invoice ${invoiceId}`);

    // Fetch invoice data with all required relations
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      include: {
        companies: {
          select: {
            id: true,
            name: true,
            company_address: true,
            tax_id: true
          }
        },
        invoice_line_items: {
          select: {
            id: true,
            description: true,
            quantity: true,
            unit_price: true,
            amount: true,
            tax_rate: true,
            tax_amount: true
          },
          orderBy: {
            id: 'asc'
          }
        }
      }
    }) as any as InvoiceData | null;

    if (!invoice) {
      return {
        success: false,
        error: 'Invoice not found'
      };
    }

    // Ensure invoice directory exists
    const invoiceDir = ensureInvoiceDirectory();
    const fileName = `${invoice.invoice_number}.pdf`;
    const filePath = path.join(invoiceDir, fileName);

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margin: 50
    });

    // Pipe PDF to file
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    // Header - Company Name
    doc
      .fontSize(28)
      .font('Helvetica-Bold')
      .text('INVOICE', 50, 50, { align: 'right' });

    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Proxmox Multi-Tenant Platform', 50, 50)
      .text('Virtual Infrastructure Management', 50, 65)
      .moveDown();

    // Invoice Details Box
    const invoiceBoxTop = 120;
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Invoice Number:', 50, invoiceBoxTop)
      .font('Helvetica')
      .text(invoice.invoice_number, 150, invoiceBoxTop);

    doc
      .font('Helvetica-Bold')
      .text('Invoice Date:', 50, invoiceBoxTop + 15)
      .font('Helvetica')
      .text(formatDate(invoice.issued_at || new Date()), 150, invoiceBoxTop + 15);

    doc
      .font('Helvetica-Bold')
      .text('Due Date:', 50, invoiceBoxTop + 30)
      .font('Helvetica')
      .text(formatDate(invoice.due_date), 150, invoiceBoxTop + 30);

    doc
      .font('Helvetica-Bold')
      .text('Status:', 50, invoiceBoxTop + 45)
      .font('Helvetica')
      .text(invoice.status.toUpperCase(), 150, invoiceBoxTop + 45);

    // Billing Period
    doc
      .font('Helvetica-Bold')
      .text('Billing Period:', 50, invoiceBoxTop + 60)
      .font('Helvetica')
      .text(
        `${formatDate(invoice.billing_period_start)} - ${formatDate(invoice.billing_period_end)}`,
        150,
        invoiceBoxTop + 60
      );

    // Bill To Section
    const billToTop = invoiceBoxTop + 90;
    doc
      .fontSize(12)
      .font('Helvetica-Bold')
      .text('BILL TO:', 50, billToTop);

    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text(invoice.companies.name, 50, billToTop + 20)
      .font('Helvetica')
      .text(invoice.companies.company_address || 'Address not provided', 50, billToTop + 35);

    if (invoice.companies.tax_id) {
      doc.text(`Tax ID: ${invoice.companies.tax_id}`, 50, billToTop + 50);
    }

    // Line Items Table
    const tableTop = billToTop + 90;
    let yPosition = tableTop;

    // Table Header
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('Description', 50, yPosition)
      .text('Quantity', 300, yPosition, { width: 60, align: 'right' })
      .text('Unit Price', 370, yPosition, { width: 70, align: 'right' })
      .text('Amount', 450, yPosition, { width: 90, align: 'right' });

    // Header line
    yPosition += 15;
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(50, yPosition)
      .lineTo(545, yPosition)
      .stroke();

    yPosition += 10;

    // Line Items
    doc.font('Helvetica').fontSize(9);

    for (const item of invoice.invoice_line_items) {
      // Check if we need a new page
      if (yPosition > 700) {
        doc.addPage();
        yPosition = 50;
      }

      doc
        .text(item.description, 50, yPosition, { width: 240 })
        .text(item.quantity.toString(), 300, yPosition, { width: 60, align: 'right' })
        .text(formatCurrency(item.unit_price, invoice.currency), 370, yPosition, { width: 70, align: 'right' })
        .text(formatCurrency(item.amount, invoice.currency), 450, yPosition, { width: 90, align: 'right' });

      yPosition += 20;
    }

    // Totals Section
    yPosition += 20;
    doc
      .strokeColor('#aaaaaa')
      .lineWidth(1)
      .moveTo(300, yPosition)
      .lineTo(545, yPosition)
      .stroke();

    yPosition += 15;

    // Subtotal
    doc
      .fontSize(10)
      .font('Helvetica')
      .text('Subtotal:', 380, yPosition)
      .text(formatCurrency(invoice.subtotal, invoice.currency), 450, yPosition, { width: 90, align: 'right' });

    yPosition += 18;

    // Tax
    if (invoice.tax_amount.greaterThan(0)) {
      doc
        .text('Tax:', 380, yPosition)
        .text(formatCurrency(invoice.tax_amount, invoice.currency), 450, yPosition, { width: 90, align: 'right' });
      yPosition += 18;
    }

    // Discount
    if (invoice.discount_amount.greaterThan(0)) {
      doc
        .text('Discount:', 380, yPosition)
        .text(`-${formatCurrency(invoice.discount_amount, invoice.currency)}`, 450, yPosition, { width: 90, align: 'right' });
      yPosition += 18;
    }

    // Total line
    doc
      .strokeColor('#333333')
      .lineWidth(2)
      .moveTo(300, yPosition)
      .lineTo(545, yPosition)
      .stroke();

    yPosition += 10;

    // Total Amount
    doc
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('TOTAL:', 380, yPosition)
      .text(formatCurrency(invoice.total_amount, invoice.currency), 450, yPosition, { width: 90, align: 'right' });

    // Payment Status
    if (invoice.paid_at) {
      yPosition += 30;
      doc
        .fontSize(10)
        .fillColor('#00aa00')
        .text(`✓ PAID on ${formatDate(invoice.paid_at)}`, 380, yPosition);
    } else if (invoice.due_date && new Date(invoice.due_date) < new Date()) {
      yPosition += 30;
      doc
        .fontSize(10)
        .fillColor('#cc0000')
        .text(`⚠ OVERDUE - Due ${formatDate(invoice.due_date)}`, 380, yPosition);
    }

    // Notes Section
    if (invoice.notes) {
      yPosition += 50;
      if (yPosition > 650) {
        doc.addPage();
        yPosition = 50;
      }

      doc
        .fillColor('#000000')
        .fontSize(10)
        .font('Helvetica-Bold')
        .text('Notes:', 50, yPosition);

      doc
        .font('Helvetica')
        .fontSize(9)
        .text(invoice.notes, 50, yPosition + 15, { width: 495 });
    }

    // Footer
    const footerY = 750;
    doc
      .fontSize(8)
      .fillColor('#666666')
      .text(
        'Thank you for your business!',
        50,
        footerY,
        { align: 'center', width: 495 }
      )
      .text(
        'For questions about this invoice, please contact support.',
        50,
        footerY + 12,
        { align: 'center', width: 495 }
      );

    // Finalize PDF
    doc.end();

    // Wait for PDF to be written
    await new Promise<void>((resolve, reject) => {
      stream.on('finish', () => resolve());
      stream.on('error', reject);
    });

    // Update invoice record with PDF path
    await prisma.invoices.update({
      where: { id: invoiceId },
      data: {
        pdf_generated: true,
        pdf_file_path: `/invoices/${fileName}`
      }
    });

    logger.info(`✅ PDF generated successfully: ${filePath}`);

    return {
      success: true,
      filePath: filePath
    };
  } catch (error: any) {
    logger.error(`Error generating PDF for invoice ${invoiceId}:`, error);
    return {
      success: false,
      error: error.message || 'Failed to generate PDF'
    };
  }
}

/**
 * Download invoice PDF (stream to response)
 */
export async function streamInvoicePDF(invoiceId: number, res: any): Promise<void> {
  try {
    const invoice = await prisma.invoices.findUnique({
      where: { id: invoiceId },
      select: {
        invoice_number: true,
        pdf_file_path: true,
        pdf_generated: true
      }
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    // Generate PDF if not already generated
    if (!invoice.pdf_generated || !invoice.pdf_file_path) {
      const result = await generateInvoicePDF(invoiceId);
      if (!result.success || !result.filePath) {
        throw new Error(result.error || 'Failed to generate PDF');
      }

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);

      // Stream file
      const fileStream = fs.createReadStream(result.filePath);
      fileStream.pipe(res);
      return;
    }

    // PDF already exists
    const invoiceDir = ensureInvoiceDirectory();
    const fileName = invoice.pdf_file_path.split('/').pop();
    const filePath = path.join(invoiceDir, fileName || '');

    if (!fs.existsSync(filePath)) {
      // PDF file missing, regenerate
      const result = await generateInvoicePDF(invoiceId);
      if (!result.success || !result.filePath) {
        throw new Error(result.error || 'Failed to generate PDF');
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);

      const fileStream = fs.createReadStream(result.filePath);
      fileStream.pipe(res);
      return;
    }

    // Stream existing PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error: any) {
    logger.error(`Error streaming PDF for invoice ${invoiceId}:`, error);
    throw error;
  }
}

export default {
  generateInvoicePDF,
  streamInvoicePDF
};
