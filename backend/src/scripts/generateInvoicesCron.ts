// Monthly Invoice Generation Cron Job
// Schedule: 1st of each month at 2 AM

import { generateAllMonthlyInvoices } from '../services/invoiceGenerationService';
import logger from '../utils/logger';

async function main() {
  try {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();

    if (month === 0) {
      year--;
      month = 12;
    }

    console.log(`[${now.toISOString()}] Generating invoices for ${year}-${month.toString().padStart(2, '0')}`);

    await generateAllMonthlyInvoices(year, month);

    console.log(`[${new Date().toISOString()}] Invoice generation completed successfully`);
    process.exit(0);
  } catch (error: any) {
    console.error(`[${new Date().toISOString()}] ERROR:`, error.message);
    logger.error('Invoice generation cron failed:', error);
    process.exit(1);
  }
}

main();
