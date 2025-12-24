/**
 * ESXi Connection Service
 * Handles authentication and connection management to VMware ESXi hosts
 */

import { Client } from 'node-vsphere-soap';
import logger from '../../utils/logger';

export interface ESXiCredentials {
  host: string;
  port: number;
  username: string;
  password: string;
  ignoreSSL?: boolean;
}

export interface ConnectionTestResult {
  success: boolean;
  version?: string;
  message?: string;
  apiVersion?: string;
  build?: string;
}

export class ESXiConnection {
  private client: Client | null = null;
  private connected: boolean = false;
  public credentials: ESXiCredentials;

  constructor(credentials: ESXiCredentials) {
    this.credentials = credentials;
  }

  /**
   * Establish connection to ESXi host
   */
  async connect(): Promise<void> {
    try {
      logger.info(`Connecting to ESXi host: ${this.credentials.host}`);

      this.client = new Client(
        this.credentials.host,
        this.credentials.username,
        this.credentials.password,
        this.credentials.ignoreSSL ?? true
      );

      // Wait for connection to be ready
      await new Promise<void>((resolve, reject) => {
        this.client!.once('ready', () => {
          logger.info(`ESXi connection established: ${this.credentials.host}`);
          resolve();
        });

        this.client!.once('error', (error?: Error) => {
          const errorMsg = error?.message || 'Unknown error';
          logger.error(`ESXi connection error: ${errorMsg}`);
          reject(error || new Error('Unknown error'));
        });

        // Timeout after 30 seconds
        setTimeout(() => {
          reject(new Error('Connection timeout after 30 seconds'));
        }, 30000);
      });

      this.connected = true;
    } catch (error: any) {
      this.connected = false;
      this.client = null;
      throw new Error(`ESXi connection failed: ${error.message}`);
    }
  }

  /**
   * Test connection without maintaining it
   */
  async testConnection(): Promise<ConnectionTestResult> {
    try {
      await this.connect();

      // Get ESXi version info
      const aboutInfo = await this.client!.retrieve({
        type: 'ServiceContent',
        properties: ['about']
      });

      const result: ConnectionTestResult = {
        success: true,
        version: aboutInfo.about?.version || 'Unknown',
        apiVersion: aboutInfo.about?.apiVersion || 'Unknown',
        build: aboutInfo.about?.build || 'Unknown',
        message: `Successfully connected to ESXi ${aboutInfo.about?.version || 'Unknown'}`
      };

      await this.disconnect();

      return result;
    } catch (error: any) {
      logger.error('ESXi connection test failed:', error);
      return {
        success: false,
        message: error.message
      };
    }
  }

  /**
   * Disconnect from ESXi
   */
  async disconnect(): Promise<void> {
    if (this.client) {
      try {
        await this.client.close();
        logger.info(`Disconnected from ESXi host: ${this.credentials.host}`);
      } catch (error: any) {
        logger.warn(`Error during disconnect: ${error.message}`);
      }
      this.connected = false;
      this.client = null;
    }
  }

  /**
   * Get underlying client (for operations)
   */
  getClient(): Client {
    if (!this.connected || !this.client) {
      throw new Error('Not connected to ESXi host. Call connect() first.');
    }
    return this.client;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get host information
   */
  getHostInfo(): string {
    return `${this.credentials.username}@${this.credentials.host}:${this.credentials.port}`;
  }
}
