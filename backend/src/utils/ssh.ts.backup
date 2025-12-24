/**
 * SSH Execution Utility
 *
 * Handles SSH connections and command execution on remote servers
 */

import { Client } from 'ssh2';
import { decrypt } from './encryption';
import logger from './logger';
import fs from 'fs';

export interface SSHResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  authMethod?: 'ssh-key' | 'password';
}

/**
 * Execute command on remote server via SSH
 */
export async function executeSSHCommand(
  host: string,
  port: number,
  username: string,
  encryptedPassword: string,
  command: string,
  timeout: number = 30000
): Promise<SSHResult> {

  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    let error = '';

    const timeoutId = setTimeout(() => {
      conn.end();
      logger.warn(`SSH command timeout after ${timeout}ms: ${host}`);
      resolve({ success: false, error: 'SSH command timeout' });
    }, timeout);

    conn.on('ready', () => {
      logger.debug(`SSH connection established to ${host}`);

      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          conn.end();
          logger.error(`SSH exec error: ${err.message}`);
          resolve({ success: false, error: err.message });
          return;
        }

        stream.on('close', (code: number) => {
          clearTimeout(timeoutId);
          conn.end();

          logger.debug(`SSH command completed with exit code ${code}`);

          if (code === 0) {
            resolve({
              success: true,
              output: output.trim(),
              exitCode: code
            });
          } else {
            resolve({
              success: false,
              error: error.trim() || `Exit code: ${code}`,
              output: output.trim(),
              exitCode: code
            });
          }
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          error += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeoutId);
      logger.error(`SSH connection error to ${host}: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    // Decrypt password and connect
    try {
      const password = decrypt(encryptedPassword);

      conn.connect({
        host,
        port,
        username,
        password,
        readyTimeout: timeout,
        keepaliveInterval: 10000
      });
    } catch (decryptError: any) {
      clearTimeout(timeoutId);
      logger.error(`SSH password decryption error: ${decryptError.message}`);
      resolve({ success: false, error: `Password decryption failed: ${decryptError.message}` });
    }
  });
}

/**
 * Test SSH connection to a server
 */
export async function testSSHConnection(
  host: string,
  port: number,
  username: string,
  encryptedPassword: string
): Promise<SSHResult> {
  return executeSSHCommand(host, port, username, encryptedPassword, 'echo "Connection test successful"', 10000);
}

/**
 * Execute multiple commands sequentially
 */
export async function executeSSHCommands(
  host: string,
  port: number,
  username: string,
  encryptedPassword: string,
  commands: string[],
  timeout: number = 30000
): Promise<SSHResult[]> {

  const results: SSHResult[] = [];

  for (const command of commands) {
    const result = await executeSSHCommand(host, port, username, encryptedPassword, command, timeout);
    results.push(result);

    // Stop on first failure
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Execute SSH command with key-based auth first, fallback to password
 * This is the recommended function for all NAT deployments
 */
export async function executeSSHCommandWithFallback(
  host: string,
  port: number,
  username: string,
  encryptedPassword: string,
  command: string,
  timeout: number = 30000
): Promise<SSHResult> {

  const privateKeyPath = '/root/.ssh/id_rsa';

  // Try SSH key authentication first if private key exists
  if (fs.existsSync(privateKeyPath)) {
    logger.debug(`Attempting SSH key authentication to ${host}`);

    try {
      const result = await executeSSHCommandWithKey(host, port, username, privateKeyPath, command, timeout);

      if (result.success) {
        logger.info(`✅ SSH key authentication succeeded for ${host}`);
        return { ...result, authMethod: 'ssh-key' };
      }

      logger.warn(`⚠️ SSH key authentication failed for ${host}, falling back to password`);
    } catch (error: any) {
      logger.warn(`SSH key auth error for ${host}: ${error.message}, falling back to password`);
    }
  } else {
    logger.debug(`SSH private key not found at ${privateKeyPath}, using password authentication`);
  }

  // Fallback to password authentication
  logger.debug(`Attempting password authentication to ${host}`);
  const result = await executeSSHCommand(host, port, username, encryptedPassword, command, timeout);

  if (result.success) {
    logger.info(`✅ Password authentication succeeded for ${host}`);
  }

  return { ...result, authMethod: 'password' };
}

/**
 * Execute command using SSH key-based authentication
 */
async function executeSSHCommandWithKey(
  host: string,
  port: number,
  username: string,
  privateKeyPath: string,
  command: string,
  timeout: number = 30000
): Promise<SSHResult> {

  return new Promise((resolve) => {
    const conn = new Client();
    let output = '';
    let error = '';

    const timeoutId = setTimeout(() => {
      conn.end();
      logger.warn(`SSH key command timeout after ${timeout}ms: ${host}`);
      resolve({ success: false, error: 'SSH key command timeout' });
    }, timeout);

    conn.on('ready', () => {
      logger.debug(`SSH key connection established to ${host}`);

      conn.exec(command, (err, stream) => {
        if (err) {
          clearTimeout(timeoutId);
          conn.end();
          logger.error(`SSH key exec error: ${err.message}`);
          resolve({ success: false, error: err.message });
          return;
        }

        stream.on('close', (code: number) => {
          clearTimeout(timeoutId);
          conn.end();

          logger.debug(`SSH key command completed with exit code ${code}`);

          if (code === 0) {
            resolve({
              success: true,
              output: output.trim(),
              exitCode: code
            });
          } else {
            resolve({
              success: false,
              error: error.trim() || `Exit code: ${code}`,
              output: output.trim(),
              exitCode: code
            });
          }
        });

        stream.on('data', (data: Buffer) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data: Buffer) => {
          error += data.toString();
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeoutId);
      logger.error(`SSH key connection error to ${host}: ${err.message}`);
      resolve({ success: false, error: err.message });
    });

    // Read private key and connect
    try {
      const privateKey = fs.readFileSync(privateKeyPath);

      conn.connect({
        host,
        port,
        username,
        privateKey,
        readyTimeout: timeout,
        keepaliveInterval: 10000
      });
    } catch (keyError: any) {
      clearTimeout(timeoutId);
      logger.error(`SSH key read error: ${keyError.message}`);
      resolve({ success: false, error: `SSH key read failed: ${keyError.message}` });
    }
  });
}
