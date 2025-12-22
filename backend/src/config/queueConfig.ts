// Job Queue Configuration
import { Queue, QueueEvents } from 'bullmq';
import Redis from 'ioredis';

// Redis connection
export const connection = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
});

// Queue names
export const QUEUE_NAMES = {
  ISO_SCAN: 'iso-scan',
  TEMPLATE_SCAN: 'template-scan',
  ESXI_IMPORT: 'esxi-vm-import',
  VM_DISCOVERY: 'vm-discovery',
} as const;

// Create queues
export const isoScanQueue = new Queue(QUEUE_NAMES.ISO_SCAN, { connection });
export const templateScanQueue = new Queue(QUEUE_NAMES.TEMPLATE_SCAN, { connection });
export const esxiImportQueue = new Queue(QUEUE_NAMES.ESXI_IMPORT, { connection });
export const vmDiscoveryQueue = new Queue(QUEUE_NAMES.VM_DISCOVERY, { connection });

// Export all queues
export const queues = {
  isoScan: isoScanQueue,
  templateScan: templateScanQueue,
  esxiImport: esxiImportQueue,
  vmDiscovery: vmDiscoveryQueue,
};

// Queue events for monitoring
export const isoScanEvents = new QueueEvents(QUEUE_NAMES.ISO_SCAN, { connection });
export const templateScanEvents = new QueueEvents(QUEUE_NAMES.TEMPLATE_SCAN, { connection });
export const esxiImportEvents = new QueueEvents(QUEUE_NAMES.ESXI_IMPORT, { connection });
export const vmDiscoveryEvents = new QueueEvents(QUEUE_NAMES.VM_DISCOVERY, { connection });
