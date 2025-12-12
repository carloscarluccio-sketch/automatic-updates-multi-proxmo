import prisma from '../config/database';
import logger from '../utils/logger';
import { buildProxmoxNATCommand, buildProxmoxNATDeleteCommand, buildProxmoxNATPersistCommand, buildProxmoxNATListCommand } from '../utils/natCommands';
import { executeSSHCommandWithFallback } from '../utils/ssh';
import { decrypt } from '../utils/encryption';
import axios from 'axios';
import https from 'https';
import { trackNATDeploymentMetric } from '../utils/natMetricsHelper';

/**
 * NAT Deployment Service
 *
 * Handles automated deployment of NAT rules to Proxmox nodes and OPNsense firewalls
 */

interface DeploymentResult {
  success: boolean;
  message: string;
  command?: string;
  output?: string;
  authMethod?: string;
  executionTimeMs?: number;
}

/**
 * Deploy a NAT rule to its target infrastructure
 */
export async function deployNATRule(natRuleId: number, userId?: number): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const rule = await prisma.nat_rules.findUnique({
      where: { id: natRuleId },
      include: {
        proxmox_clusters: true,
        virtual_machines: true,
        opnsense_instances: {
          include: {
            proxmox_clusters: true,
            virtual_machines: true
          }
        }
      }
    });

    if (!rule) {
      return { success: false, message: 'NAT rule not found' };
    }

    await prisma.nat_rules.update({
      where: { id: natRuleId },
      data: { status: 'deploying' }
    });

    let result: DeploymentResult;

    switch (rule.nat_type) {
      case 'opnsense':
        result = await deployToOPNsense(rule);
        break;
      case 'proxmox_nat':
        result = await deployToProxmox(rule);
        break;
      case 'port_forward':
        result = await deployPortForward(rule);
        break;
      default:
        result = { success: false, message: `Unknown NAT type: ${rule.nat_type}` };
    }

    await prisma.nat_rules.update({
      where: { id: natRuleId },
      data: {
        status: result.success ? 'active' : 'failed',
        error_message: result.success ? null : result.message,
        last_applied_at: result.success ? new Date() : undefined,
        last_error_at: result.success ? undefined : new Date(),
        apply_count: { increment: 1 }
      }
    });

    await prisma.nat_deployment_log.create({
      data: {
        nat_rule_id: natRuleId,
        action: 'create',
        status: result.success ? 'success' : 'failed',
        node_name: rule.node_name,
        command_executed: result.command || null,
        output: result.output || null,
        error_message: result.success ? null : result.message,
        execution_time_ms: Date.now() - startTime,
        deployed_by: userId || null
      }
    });
    // Track deployment metrics for SSH key health monitoring
    await trackNATDeploymentMetric({
      nat_rule_id: natRuleId,
      cluster_id: rule.cluster_id,
      deployment_type: 'create',
      auth_method: result.authMethod === 'ssh-key' ? 'ssh_key' : 'password',
      deployment_duration_ms: Date.now() - startTime,
      success: result.success,
      error_message: result.success ? undefined : result.message,
      deployed_by: userId
    });

    logger.info(`NAT rule deployment: ${result.success ? 'succeeded' : 'failed'}`);
    return result;

  } catch (error: any) {
    logger.error('NAT deployment error:', error);

    await prisma.nat_rules.update({
      where: { id: natRuleId },
      data: {
        status: 'failed',
        error_message: error.message,
        last_error_at: new Date()
      }
    });

    return {
      success: false,
      message: `Deployment failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Deploy NAT rule to Proxmox node via SSH
 */
async function deployToProxmox(rule: any): Promise<DeploymentResult> {
  try {
    const cluster = rule.proxmox_clusters;
    if (!cluster) {
      return { success: false, message: 'Cluster not found for NAT rule' };
    }

    // Build iptables commands
    const natCommand = buildProxmoxNATCommand(rule);
    const persistCommand = buildProxmoxNATPersistCommand();
    const fullCommand = `${natCommand}\n${persistCommand}`;

    logger.info(`Deploying NAT rule to Proxmox: ${cluster.host}`);

    // Execute via SSH with key-based auth first, fallback to password
    // (always use port 22 for SSH, cluster.port is for Proxmox API)
    const result = await executeSSHCommandWithFallback(
      cluster.host,
      22,
      'root',
      cluster.password_encrypted,
      fullCommand
    );

    if (result.success) {
      const authInfo = result.authMethod === 'ssh-key' ? ' (SSH key auth)' : ' (password auth)';
      logger.info(`NAT rule applied successfully using ${result.authMethod} authentication`);

      return {
        success: true,
        message: `NAT rule applied to Proxmox node successfully${authInfo}`,
        command: fullCommand,
        output: result.output
      };
        authMethod: result.authMethod
    }

    return {
      success: false,
      message: `Proxmox deployment failed: ${result.error}`,
      command: fullCommand
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Proxmox NAT deployment error: ${error.message}`
    };
  }
}

/**
 * Deploy NAT rule to OPNsense firewall via API
 */
async function deployToOPNsense(rule: any): Promise<DeploymentResult> {
  try {
    if (!rule.opnsense_instances) {
      return { success: false, message: 'No OPNsense instance associated with this rule' };
    }

    const opnsense = rule.opnsense_instances;
    const vm = opnsense.virtual_machines;

    if (!vm) {
      return { success: false, message: 'OPNsense VM not found' };
    }

    const apiUrl = `https://${vm.primary_ip_external || vm.primary_ip_internal}`;
    const adminPassword = decrypt(opnsense.admin_password);

    logger.info(`Deploying NAT rule to OPNsense: ${apiUrl}`);

    // Prepare port forward rule data
    const portForwardData = {
      rule: {
        interface: 'wan',
        protocol: rule.protocol === 'both' ? 'tcp/udp' : rule.protocol,
        src: 'any',
        dst: rule.external_ip,
        dstport: rule.external_port?.toString() || '',
        target: rule.internal_ip,
        local_port: rule.internal_port?.toString() || rule.external_port?.toString() || '',
        descr: rule.rule_name,
        enabled: rule.enabled ? '1' : '0'
      }
    };

    // Create port forward rule
    const response = await axios.post(
      `${apiUrl}/api/firewall/nat/portforward/addRule`,
      portForwardData,
      {
        auth: {
          username: 'root',
          password: adminPassword
        },
        httpsAgent: new https.Agent({
          rejectUnauthorized: false
        }),
        timeout: 30000
      }
    );

    if (response.data && response.data.uuid) {
      // Store UUID for future updates/deletes
      await prisma.nat_rules.update({
        where: { id: rule.id },
        data: { opnsense_rule_uuid: response.data.uuid }
      });

      // Apply configuration changes
      await axios.post(
        `${apiUrl}/api/firewall/nat/portforward/apply`,
        {},
        {
          auth: { username: 'root', password: adminPassword },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }),
          timeout: 30000
        }
      );

      return {
        success: true,
        message: 'NAT rule deployed to OPNsense successfully',
        command: 'OPNsense API: addRule + apply',
        output: JSON.stringify(response.data)
      };
    }

    return {
      success: false,
      message: 'OPNsense API returned unexpected response',
      output: JSON.stringify(response.data)
    };

  } catch (error: any) {
    logger.error('OPNsense deployment error:', error);
    return {
      success: false,
      message: `OPNsense API error: ${error.message}`
    };
  }
}

/**
 * Deploy simple port forward (uses Proxmox NAT)
 */
async function deployPortForward(rule: any): Promise<DeploymentResult> {
  return deployToProxmox(rule);
}

/**
 * Remove/undeploy NAT rule from infrastructure
 */
export async function undeployNATRule(natRuleId: number, userId?: number): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const rule = await prisma.nat_rules.findUnique({
      where: { id: natRuleId },
      include: {
        proxmox_clusters: true,
        opnsense_instances: {
          include: {
            virtual_machines: true
          }
        }
      }
    });

    if (!rule) {
      return { success: false, message: 'NAT rule not found' };
    }

    await prisma.nat_rules.update({
      where: { id: natRuleId },
      data: { status: 'deleting' }
    });

    let result: DeploymentResult;

    // Route to appropriate removal method
    if (rule.nat_type === 'opnsense' && rule.opnsense_rule_uuid) {
      result = await removeFromOPNsense(rule);
    } else {
      result = await removeFromProxmox(rule);
    }

    // Update status based on result
    await prisma.nat_rules.update({
      where: { id: natRuleId },
      data: {
        status: result.success ? 'pending' : 'failed',
        error_message: result.success ? null : result.message,
        opnsense_rule_uuid: result.success ? null : rule.opnsense_rule_uuid
      }
    });

    // Log undeploy action
    await prisma.nat_deployment_log.create({
      data: {
        nat_rule_id: natRuleId,
        action: 'delete',
        status: result.success ? 'success' : 'failed',
        node_name: rule.node_name,
        command_executed: result.command || null,
        output: result.output || null,
        error_message: result.success ? null : result.message,
        execution_time_ms: Date.now() - startTime,
        deployed_by: userId || null
      }
    });

    return result;

  } catch (error: any) {
    return {
      success: false,
      message: `Undeploy failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime
    };
  }
}

/**
 * Remove NAT rule from Proxmox node
 */
async function removeFromProxmox(rule: any): Promise<DeploymentResult> {
  try {
    const cluster = rule.proxmox_clusters;
    if (!cluster) {
      return { success: false, message: 'Cluster not found' };
    }

    const deleteCommand = buildProxmoxNATDeleteCommand(rule);
    const persistCommand = buildProxmoxNATPersistCommand();
    const fullCommand = `${deleteCommand}\n${persistCommand}`;

    logger.info(`Removing NAT rule from Proxmox: ${cluster.host}`);

    // Execute via SSH with key-based auth first, fallback to password
    // (always use port 22 for SSH, cluster.port is for Proxmox API)
    const result = await executeSSHCommandWithFallback(
      cluster.host,
      22,
      'root',
      cluster.password_encrypted,
      fullCommand
    );

    if (result.success) {
      const authInfo = result.authMethod === 'ssh-key' ? ' (SSH key auth)' : ' (password auth)';
      logger.info(`NAT rule removed successfully using ${result.authMethod} authentication`);

      return {
        success: true,
        message: `NAT rule removed from Proxmox successfully${authInfo}`,
        command: fullCommand,
        output: result.output
      };
    }

    return {
      success: false,
      message: `Proxmox removal failed: ${result.error}`,
      command: fullCommand
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Proxmox removal error: ${error.message}`
    };
  }
}

/**
 * Remove NAT rule from OPNsense firewall
 */
async function removeFromOPNsense(rule: any): Promise<DeploymentResult> {
  try {
    const opnsense = rule.opnsense_instances;
    const vm = opnsense.virtual_machines;

    if (!vm) {
      return { success: false, message: 'OPNsense VM not found' };
    }

    const apiUrl = `https://${vm.primary_ip_external || vm.primary_ip_internal}`;
    const adminPassword = decrypt(opnsense.admin_password);

    logger.info(`Removing NAT rule from OPNsense: ${apiUrl}`);

    // Delete port forward rule by UUID
    await axios.post(
      `${apiUrl}/api/firewall/nat/portforward/delRule/${rule.opnsense_rule_uuid}`,
      {},
      {
        auth: { username: 'root', password: adminPassword },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      }
    );

    // Apply configuration
    await axios.post(
      `${apiUrl}/api/firewall/nat/portforward/apply`,
      {},
      {
        auth: { username: 'root', password: adminPassword },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        timeout: 30000
      }
    );

    return {
      success: true,
      message: 'NAT rule removed from OPNsense successfully',
      command: 'OPNsense API: delRule + apply'
    };

  } catch (error: any) {
    return {
      success: false,
      message: `OPNsense removal error: ${error.message}`
    };
  }
}

/**
 * Deploy all pending NAT rules with auto_apply enabled
 */
export async function deployPendingNATRules(): Promise<void> {
  try {
    const pendingRules = await prisma.nat_rules.findMany({
      where: {
        status: 'pending',
        auto_apply: true,
        enabled: true
      },
      take: 10
    });

    logger.info(`Found ${pendingRules.length} pending NAT rules to deploy`);

    for (const rule of pendingRules) {
      await deployNATRule(rule.id);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

  } catch (error: any) {
    logger.error('Deploy pending NAT rules error:', error);
  }
}

/**
 * Test SSH connection to Proxmox cluster
 */
export async function testNATConnection(natRuleId: number): Promise<DeploymentResult> {
  try {
    const rule = await prisma.nat_rules.findUnique({
      where: { id: natRuleId },
      include: {
        proxmox_clusters: true,
        opnsense_instances: {
          include: {
            virtual_machines: true
          }
        }
      }
    });

    if (!rule) {
      return { success: false, message: 'NAT rule not found' };
    }

    // Test Proxmox SSH connection
    if (rule.nat_type === 'proxmox_nat' || rule.nat_type === 'port_forward') {
      const cluster = rule.proxmox_clusters;
      if (!cluster) {
        return { success: false, message: 'Cluster not found for NAT rule' };
      }

      logger.info(`Testing SSH connection to Proxmox: ${cluster.host}`);

      const result = await executeSSHCommandWithFallback(
        cluster.host,
        22,
        'root',
        cluster.password_encrypted,
        'echo "SSH connection successful" && iptables --version',
        10000
      );

      if (result.success) {
        const authInfo = result.authMethod === 'ssh-key' ? ' (SSH key)' : ' (password)';
        return {
          success: true,
          message: `SSH connection successful${authInfo}`,
          output: result.output
        };
      }

      return {
        success: false,
        message: `SSH connection failed: ${result.error}`
      };
    }

    // Test OPNsense API connection
    if (rule.nat_type === 'opnsense') {
      const opnsense = rule.opnsense_instances;
      const vm = opnsense?.virtual_machines;

      if (!vm) {
        return { success: false, message: 'OPNsense VM not found' };
      }

      const apiUrl = `https://${vm.primary_ip_external || vm.primary_ip_internal}`;
      const adminPassword = decrypt(opnsense.admin_password!);

      try {
        const response = await axios.get(
          `${apiUrl}/api/diagnostics/interface/getInterfaceNames`,
          {
            auth: { username: 'root', password: adminPassword },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 10000
          }
        );

        return {
          success: true,
          message: 'OPNsense API connection successful',
          output: JSON.stringify(response.data)
        };
      } catch (error: any) {
        return {
          success: false,
          message: `OPNsense API connection failed: ${error.message}`
        };
      }
    }

    return { success: false, message: `Unknown NAT type: ${rule.nat_type}` };

  } catch (error: any) {
    return {
      success: false,
      message: `Connection test failed: ${error.message}`
    };
  }
}

/**
 * Verify NAT rule deployment on Proxmox
 */
export async function verifyNATDeployment(natRuleId: number): Promise<DeploymentResult> {
  const startTime = Date.now();

  try {
    const rule = await prisma.nat_rules.findUnique({
      where: { id: natRuleId },
      include: {
        proxmox_clusters: true,
        opnsense_instances: {
          include: {
            virtual_machines: true
          }
        }
      }
    });

    if (!rule) {
      return { success: false, message: 'NAT rule not found' };
    }

    // Verify Proxmox deployment
    if (rule.nat_type === 'proxmox_nat' || rule.nat_type === 'port_forward') {
      const cluster = rule.proxmox_clusters;
      if (!cluster) {
        return { success: false, message: 'Cluster not found' };
      }

      logger.info(`Verifying NAT rule on Proxmox: ${cluster.host}`);

      // List all NAT rules
      const listCommand = buildProxmoxNATListCommand();
      const result = await executeSSHCommandWithFallback(
        cluster.host,
        22,
        'root',
        cluster.password_encrypted,
        listCommand,
        15000
      );

      if (!result.success) {
        return {
          success: false,
          message: `Failed to list NAT rules: ${result.error}`,
          executionTimeMs: Date.now() - startTime
        };
      }

      logger.info(`NAT rules listed successfully using ${result.authMethod} authentication`);

      // Check if our specific rule exists in the output
      const ruleExists = result.output?.includes(rule.external_ip) &&
                         result.output?.includes(rule.internal_ip);

      // Log verification result
      await prisma.nat_deployment_log.create({
        data: {
          nat_rule_id: natRuleId,
          action: 'create' as any, // Using 'create' for verification logs
          status: ruleExists ? 'success' : 'failed',
          node_name: rule.node_name,
          command_executed: listCommand,
          output: result.output || null,
          error_message: ruleExists ? null : 'NAT rule not found in iptables output',
          execution_time_ms: Date.now() - startTime,
          deployed_by: null
        }
      });

      if (ruleExists) {
        return {
          success: true,
          message: 'NAT rule verified on Proxmox',
          output: result.output,
          executionTimeMs: Date.now() - startTime
        };
      }

      return {
        success: false,
        message: 'NAT rule not found on Proxmox (may need deployment)',
        output: result.output,
        executionTimeMs: Date.now() - startTime
      };
    }

    // Verify OPNsense deployment
    if (rule.nat_type === 'opnsense' && rule.opnsense_rule_uuid) {
      const opnsense = rule.opnsense_instances;
      const vm = opnsense?.virtual_machines;

      if (!vm) {
        return { success: false, message: 'OPNsense VM not found' };
      }

      const apiUrl = `https://${vm.primary_ip_external || vm.primary_ip_internal}`;
      const adminPassword = decrypt(opnsense.admin_password!);

      try {
        const response = await axios.get(
          `${apiUrl}/api/firewall/nat/portforward/getRule/${rule.opnsense_rule_uuid}`,
          {
            auth: { username: 'root', password: adminPassword },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            timeout: 15000
          }
        );

        await prisma.nat_deployment_log.create({
          data: {
            nat_rule_id: natRuleId,
            action: 'create' as any, // Using 'create' for verification logs
            status: 'success',
            node_name: rule.node_name,
            command_executed: 'OPNsense API: getRule',
            output: JSON.stringify(response.data),
            error_message: null,
            execution_time_ms: Date.now() - startTime,
            deployed_by: null
          }
        });

        return {
          success: true,
          message: 'NAT rule verified on OPNsense',
          output: JSON.stringify(response.data),
          executionTimeMs: Date.now() - startTime
        };
      } catch (error: any) {
        return {
          success: false,
          message: `OPNsense verification failed: ${error.message}`,
          executionTimeMs: Date.now() - startTime
        };
      }
    }

    return {
      success: false,
      message: 'Cannot verify: Rule not deployed or unknown type',
      executionTimeMs: Date.now() - startTime
    };

  } catch (error: any) {
    return {
      success: false,
      message: `Verification failed: ${error.message}`,
      executionTimeMs: Date.now() - startTime
    };
  }
}

export default {
  deployNATRule,
  undeployNATRule,
  deployPendingNATRules,
  testNATConnection,
  verifyNATDeployment
};
