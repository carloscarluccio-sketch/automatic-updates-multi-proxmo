// Workers Entry Point - Starts all background job workers
import logger from '../utils/logger';
import isoScanWorker from './isoScanWorker';
import templateScanWorker from './templateScanWorker';
import esxiImportWorker from './esxiImportWorker';

logger.info('=== Background Job Workers Starting ===');
logger.info('ISO Scan Worker: Active');
logger.info('Template Scan Worker: Active');
logger.info('ESXi Import Worker: Active');

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing workers gracefully');
  await isoScanWorker.close();
  await templateScanWorker.close();
  await esxiImportWorker.close();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing workers gracefully');
  await isoScanWorker.close();
  await templateScanWorker.close();
  await esxiImportWorker.close();
  process.exit(0);
});

logger.info('=== All Workers Started Successfully ===');
