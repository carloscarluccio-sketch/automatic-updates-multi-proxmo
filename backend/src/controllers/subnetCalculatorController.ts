import { Request, Response } from 'express';

interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    company_id?: number;
  };
}

/**
 * Subnet Calculator Controller
 *
 * Provides subnet calculation utilities for CIDR notation
 * Helps users plan their IP ranges before creation
 */

/**
 * Calculate subnet information from CIDR notation
 * POST /api/subnet-calculator/calculate
 * Body: { cidr: "10.0.1.0/24" } or { ip: "10.0.1.0", prefix: 24 }
 */
export const calculateSubnet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cidr, ip, prefix } = req.body;

    let networkIP: string;
    let prefixLength: number;

    // Parse CIDR notation
    if (cidr) {
      const parts = cidr.split('/');
      if (parts.length !== 2) {
        res.status(400).json({
          success: false,
          message: 'Invalid CIDR notation. Use format: 10.0.1.0/24',
        });
        return;
      }
      networkIP = parts[0];
      prefixLength = parseInt(parts[1]);
    } else if (ip && prefix) {
      networkIP = ip;
      prefixLength = parseInt(prefix as string);
    } else {
      res.status(400).json({
        success: false,
        message: 'Provide either "cidr" or both "ip" and "prefix"',
      });
      return;
    }

    // Validate IP address
    if (!isValidIPv4(networkIP)) {
      res.status(400).json({
        success: false,
        message: 'Invalid IPv4 address',
      });
      return;
    }

    // Validate prefix length
    if (prefixLength < 0 || prefixLength > 32) {
      res.status(400).json({
        success: false,
        message: 'Prefix length must be between 0 and 32',
      });
      return;
    }

    // Calculate subnet information
    const subnetInfo = getSubnetInfo(networkIP, prefixLength);

    res.status(200).json({
      success: true,
      data: subnetInfo,
    });
  } catch (error: any) {
    console.error('Subnet calculator error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate subnet',
      error: error.message,
    });
  }
};

/**
 * Get suggested subnets for a given network
 * POST /api/subnet-calculator/suggest-subnets
 * Body: { cidr: "10.0.0.0/16", target_prefix: 24 }
 */
export const suggestSubnets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { cidr, target_prefix, max_subnets = 10 } = req.body;

    if (!cidr || !target_prefix) {
      res.status(400).json({
        success: false,
        message: 'CIDR and target_prefix are required',
      });
      return;
    }

    const parts = cidr.split('/');
    if (parts.length !== 2) {
      res.status(400).json({
        success: false,
        message: 'Invalid CIDR notation',
      });
      return;
    }

    const networkIP = parts[0];
    const currentPrefix = parseInt(parts[1]);
    const targetPrefix = parseInt(target_prefix as string);

    if (targetPrefix <= currentPrefix) {
      res.status(400).json({
        success: false,
        message: 'Target prefix must be larger than current prefix',
      });
      return;
    }

    const subnets = calculateSubdivisions(networkIP, currentPrefix, targetPrefix, parseInt(max_subnets as string));

    res.status(200).json({
      success: true,
      data: {
        parent_network: cidr,
        target_prefix: targetPrefix,
        total_possible_subnets: Math.pow(2, targetPrefix - currentPrefix),
        subnets_shown: subnets.length,
        subnets,
      },
    });
  } catch (error: any) {
    console.error('Suggest subnets error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to suggest subnets',
      error: error.message,
    });
  }
};

/**
 * Validate if an IP is within a subnet
 * POST /api/subnet-calculator/validate-ip-in-subnet
 */
export const validateIPInSubnet = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { ip, cidr } = req.body;

    if (!ip || !cidr) {
      res.status(400).json({
        success: false,
        message: 'IP and CIDR are required',
      });
      return;
    }

    const parts = cidr.split('/');
    if (parts.length !== 2) {
      res.status(400).json({
        success: false,
        message: 'Invalid CIDR notation',
      });
      return;
    }

    const networkIP = parts[0];
    const prefixLength = parseInt(parts[1]);

    if (!isValidIPv4(ip) || !isValidIPv4(networkIP)) {
      res.status(400).json({
        success: false,
        message: 'Invalid IPv4 address',
      });
      return;
    }

    const isWithin = isIPInSubnet(ip, networkIP, prefixLength);
    const subnetInfo = getSubnetInfo(networkIP, prefixLength);

    res.status(200).json({
      success: true,
      data: {
        ip,
        cidr,
        is_within_subnet: isWithin,
        subnet_info: subnetInfo,
      },
    });
  } catch (error: any) {
    console.error('Validate IP in subnet error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate IP',
      error: error.message,
    });
  }
};

/**
 * Calculate comprehensive subnet information
 */
function getSubnetInfo(networkIP: string, prefixLength: number): any {
  const netmask = prefixToNetmask(prefixLength);
  const wildcard = getWildcard(netmask);

  const networkNum = ipToNumber(networkIP);
  const netmaskNum = ipToNumber(netmask);

  const networkAddress = networkNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  const totalHosts = Math.pow(2, 32 - prefixLength);
  const usableHosts = totalHosts > 2 ? totalHosts - 2 : 0;

  const firstUsableIP = networkAddress + 1;
  const lastUsableIP = broadcastAddress - 1;

  return {
    cidr: `${numberToIP(networkAddress)}/${prefixLength}`,
    network_address: numberToIP(networkAddress),
    broadcast_address: numberToIP(broadcastAddress),
    netmask,
    wildcard,
    prefix_length: prefixLength,
    first_usable_ip: usableHosts > 0 ? numberToIP(firstUsableIP) : null,
    last_usable_ip: usableHosts > 0 ? numberToIP(lastUsableIP) : null,
    total_hosts: totalHosts,
    usable_hosts: usableHosts,
    network_class: getNetworkClass(numberToIP(networkAddress)),
    is_private: isPrivateIP(numberToIP(networkAddress)),
    binary_netmask: netmaskToBinary(netmask),
  };
}

/**
 * Calculate subnet subdivisions
 */
function calculateSubdivisions(
  networkIP: string,
  currentPrefix: number,
  targetPrefix: number,
  maxSubnets: number
): any[] {
  const subnets: any[] = [];

  const networkNum = ipToNumber(networkIP);
  const subnetSize = Math.pow(2, 32 - targetPrefix);
  const totalSubnets = Math.pow(2, targetPrefix - currentPrefix);

  const limit = Math.min(totalSubnets, maxSubnets);

  for (let i = 0; i < limit; i++) {
    const subnetAddress = networkNum + i * subnetSize;
    const subnetInfo = getSubnetInfo(numberToIP(subnetAddress), targetPrefix);
    subnets.push(subnetInfo);
  }

  return subnets;
}

/**
 * Check if IP is within subnet
 */
function isIPInSubnet(ip: string, networkIP: string, prefixLength: number): boolean {
  const ipNum = ipToNumber(ip);
  const netmask = prefixToNetmask(prefixLength);
  const netmaskNum = ipToNumber(netmask);
  const networkNum = ipToNumber(networkIP);

  const networkAddress = networkNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  return ipNum >= networkAddress && ipNum <= broadcastAddress;
}

/**
 * Convert prefix length to netmask
 */
function prefixToNetmask(prefixLength: number): string {
  const mask = (0xffffffff << (32 - prefixLength)) >>> 0;
  return numberToIP(mask);
}

/**
 * Get wildcard mask
 */
function getWildcard(netmask: string): string {
  const netmaskNum = ipToNumber(netmask);
  const wildcard = (~netmaskNum) >>> 0;
  return numberToIP(wildcard);
}

/**
 * Convert netmask to binary string
 */
function netmaskToBinary(netmask: string): string {
  const parts = netmask.split('.').map((p) => parseInt(p));
  return parts.map((p) => p.toString(2).padStart(8, '0')).join('.');
}

/**
 * Determine network class
 */
function getNetworkClass(ip: string): string {
  const firstOctet = parseInt(ip.split('.')[0]);

  if (firstOctet >= 1 && firstOctet <= 126) return 'A';
  if (firstOctet >= 128 && firstOctet <= 191) return 'B';
  if (firstOctet >= 192 && firstOctet <= 223) return 'C';
  if (firstOctet >= 224 && firstOctet <= 239) return 'D (Multicast)';
  if (firstOctet >= 240 && firstOctet <= 255) return 'E (Experimental)';

  return 'Unknown';
}

/**
 * Check if IP is private
 */
function isPrivateIP(ip: string): boolean {
  const parts = ip.split('.').map((p) => parseInt(p));
  const first = parts[0];
  const second = parts[1];

  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;

  return false;
}

/**
 * Validate IPv4 address
 */
function isValidIPv4(ip: string): boolean {
  const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
  const match = ip.match(ipv4Regex);

  if (!match) return false;

  return match.slice(1).every((octet) => {
    const num = parseInt(octet);
    return num >= 0 && num <= 255;
  });
}

/**
 * Convert IP address string to number
 */
function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert number to IP address string
 */
function numberToIP(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');
}
