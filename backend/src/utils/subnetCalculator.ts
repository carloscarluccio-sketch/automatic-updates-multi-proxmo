/**
 * Subnet Calculator Utility
 *
 * Provides functions for calculating subnet information from CIDR notation
 * Supports both CIDR (e.g., 192.168.1.0/24) and separate subnet/netmask
 */

export interface SubnetInfo {
  subnet: string;
  netmask: string;
  cidr: number;
  networkAddress: string;
  broadcastAddress: string;
  firstUsableIP: string;
  lastUsableIP: string;
  totalIPs: number;
  usableIPs: number;
  wildcardMask: string;
  binaryNetmask: string;
  ipClass: string;
  isPrivate: boolean;
}

/**
 * Calculate complete subnet information from CIDR notation
 * @param cidr - CIDR notation (e.g., "192.168.1.0/24")
 * @returns SubnetInfo object
 */
export function calculateSubnetFromCIDR(cidr: string): SubnetInfo {
  const [subnet, prefixStr] = cidr.split('/');
  const prefix = parseInt(prefixStr);

  if (!subnet || !prefix || prefix < 0 || prefix > 32) {
    throw new Error('Invalid CIDR notation');
  }

  const netmask = cidrToNetmask(prefix);
  return calculateSubnet(subnet, netmask);
}

/**
 * Calculate complete subnet information
 * @param subnet - Subnet address (e.g., "192.168.1.0")
 * @param netmask - Netmask (e.g., "255.255.255.0")
 * @returns SubnetInfo object
 */
export function calculateSubnet(subnet: string, netmask: string): SubnetInfo {
  const subnetNum = ipToNumber(subnet);
  const netmaskNum = ipToNumber(netmask);

  const networkAddress = subnetNum & netmaskNum;
  const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

  const firstUsableIP = networkAddress + 1;
  const lastUsableIP = broadcastAddress - 1;

  const totalIPs = broadcastAddress - networkAddress + 1;
  const usableIPs = totalIPs - 2; // Exclude network and broadcast

  const wildcardMask = ~netmaskNum >>> 0;
  const cidr = netmaskToCIDR(netmask);

  return {
    subnet: numberToIP(networkAddress),
    netmask,
    cidr,
    networkAddress: numberToIP(networkAddress),
    broadcastAddress: numberToIP(broadcastAddress),
    firstUsableIP: numberToIP(firstUsableIP),
    lastUsableIP: numberToIP(lastUsableIP),
    totalIPs,
    usableIPs,
    wildcardMask: numberToIP(wildcardMask),
    binaryNetmask: numberToBinary(netmaskNum),
    ipClass: getIPClass(subnet),
    isPrivate: isPrivateIP(subnet),
  };
}

/**
 * Convert CIDR prefix to netmask
 * @param cidr - CIDR prefix (0-32)
 * @returns Netmask string
 */
export function cidrToNetmask(cidr: number): string {
  if (cidr < 0 || cidr > 32) {
    throw new Error('CIDR prefix must be between 0 and 32');
  }

  const mask = (0xffffffff << (32 - cidr)) >>> 0;
  return numberToIP(mask);
}

/**
 * Convert netmask to CIDR prefix
 * @param netmask - Netmask string
 * @returns CIDR prefix number
 */
export function netmaskToCIDR(netmask: string): number {
  const num = ipToNumber(netmask);
  let cidr = 0;

  for (let i = 0; i < 32; i++) {
    if ((num & (1 << (31 - i))) !== 0) {
      cidr++;
    } else {
      break;
    }
  }

  return cidr;
}

/**
 * Get IP class (A, B, C, D, E)
 * @param ip - IP address string
 * @returns IP class letter
 */
export function getIPClass(ip: string): string {
  const firstOctet = parseInt(ip.split('.')[0]);

  if (firstOctet >= 1 && firstOctet <= 126) return 'A';
  if (firstOctet >= 128 && firstOctet <= 191) return 'B';
  if (firstOctet >= 192 && firstOctet <= 223) return 'C';
  if (firstOctet >= 224 && firstOctet <= 239) return 'D';
  if (firstOctet >= 240 && firstOctet <= 255) return 'E';

  return 'Unknown';
}

/**
 * Check if IP is private (RFC 1918)
 * @param ip - IP address string
 * @returns True if private, false otherwise
 */
export function isPrivateIP(ip: string): boolean {
  const num = ipToNumber(ip);

  // 10.0.0.0/8
  if (num >= ipToNumber('10.0.0.0') && num <= ipToNumber('10.255.255.255')) {
    return true;
  }

  // 172.16.0.0/12
  if (num >= ipToNumber('172.16.0.0') && num <= ipToNumber('172.31.255.255')) {
    return true;
  }

  // 192.168.0.0/16
  if (num >= ipToNumber('192.168.0.0') && num <= ipToNumber('192.168.255.255')) {
    return true;
  }

  return false;
}

/**
 * Validate IP address format
 * @param ip - IP address string
 * @returns True if valid, false otherwise
 */
export function isValidIP(ip: string): boolean {
  const parts = ip.split('.');

  if (parts.length !== 4) return false;

  for (const part of parts) {
    const num = parseInt(part);
    if (isNaN(num) || num < 0 || num > 255) {
      return false;
    }
  }

  return true;
}

/**
 * Validate netmask format
 * @param netmask - Netmask string
 * @returns True if valid, false otherwise
 */
export function isValidNetmask(netmask: string): boolean {
  if (!isValidIP(netmask)) return false;

  const num = ipToNumber(netmask);
  const binary = num.toString(2).padStart(32, '0');

  // Valid netmask must be contiguous 1s followed by contiguous 0s
  const pattern = /^1*0*$/;
  return pattern.test(binary);
}

/**
 * Convert IP address string to number
 * @param ip - IP address string
 * @returns IP as 32-bit unsigned integer
 */
export function ipToNumber(ip: string): number {
  const parts = ip.split('.').map((p) => parseInt(p));
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

/**
 * Convert number to IP address string
 * @param num - 32-bit unsigned integer
 * @returns IP address string
 */
export function numberToIP(num: number): string {
  return [
    (num >>> 24) & 0xff,
    (num >>> 16) & 0xff,
    (num >>> 8) & 0xff,
    num & 0xff,
  ].join('.');
}

/**
 * Convert number to binary string
 * @param num - Number to convert
 * @returns Binary string (32 bits with dots every 8 bits)
 */
export function numberToBinary(num: number): string {
  const binary = num.toString(2).padStart(32, '0');
  return `${binary.slice(0, 8)}.${binary.slice(8, 16)}.${binary.slice(16, 24)}.${binary.slice(24, 32)}`;
}

/**
 * Get all subnets when dividing a network
 * @param subnet - Parent subnet
 * @param netmask - Parent netmask
 * @param newCIDR - New CIDR prefix for subnets
 * @returns Array of subnet information
 */
export function divideSubnet(subnet: string, netmask: string, newCIDR: number): SubnetInfo[] {
  const parentCIDR = netmaskToCIDR(netmask);

  if (newCIDR <= parentCIDR || newCIDR > 32) {
    throw new Error('New CIDR must be larger than parent CIDR and <= 32');
  }

  const subnets: SubnetInfo[] = [];
  const subnetCount = Math.pow(2, newCIDR - parentCIDR);
  const subnetSize = Math.pow(2, 32 - newCIDR);

  const parentNetwork = ipToNumber(subnet) & ipToNumber(netmask);

  for (let i = 0; i < subnetCount; i++) {
    const subnetAddress = parentNetwork + i * subnetSize;
    const newNetmask = cidrToNetmask(newCIDR);
    subnets.push(calculateSubnet(numberToIP(subnetAddress), newNetmask));
  }

  return subnets;
}

/**
 * Check if two IP addresses are in the same subnet
 * @param ip1 - First IP address
 * @param ip2 - Second IP address
 * @param netmask - Netmask
 * @returns True if in same subnet, false otherwise
 */
export function isSameSubnet(ip1: string, ip2: string, netmask: string): boolean {
  const ip1Num = ipToNumber(ip1);
  const ip2Num = ipToNumber(ip2);
  const netmaskNum = ipToNumber(netmask);

  const network1 = ip1Num & netmaskNum;
  const network2 = ip2Num & netmaskNum;

  return network1 === network2;
}

/**
 * Get human-readable subnet size
 * @param cidr - CIDR prefix
 * @returns Human-readable size (e.g., "/24 - 254 hosts")
 */
export function getSubnetSize(cidr: number): string {
  const totalIPs = Math.pow(2, 32 - cidr);
  const usableIPs = totalIPs - 2;

  if (usableIPs > 1000000) {
    return `/${cidr} - ${(usableIPs / 1000000).toFixed(2)}M hosts`;
  } else if (usableIPs > 1000) {
    return `/${cidr} - ${(usableIPs / 1000).toFixed(2)}K hosts`;
  } else {
    return `/${cidr} - ${usableIPs} hosts`;
  }
}

/**
 * Common subnet masks for quick reference
 */
export const COMMON_SUBNET_MASKS = {
  '/8': { cidr: 8, netmask: '255.0.0.0', hosts: 16777214 },
  '/16': { cidr: 16, netmask: '255.255.0.0', hosts: 65534 },
  '/24': { cidr: 24, netmask: '255.255.255.0', hosts: 254 },
  '/25': { cidr: 25, netmask: '255.255.255.128', hosts: 126 },
  '/26': { cidr: 26, netmask: '255.255.255.192', hosts: 62 },
  '/27': { cidr: 27, netmask: '255.255.255.224', hosts: 30 },
  '/28': { cidr: 28, netmask: '255.255.255.240', hosts: 14 },
  '/29': { cidr: 29, netmask: '255.255.255.248', hosts: 6 },
  '/30': { cidr: 30, netmask: '255.255.255.252', hosts: 2 },
  '/31': { cidr: 31, netmask: '255.255.255.254', hosts: 2 }, // Point-to-point
  '/32': { cidr: 32, netmask: '255.255.255.255', hosts: 1 }, // Single host
};

/**
 * Get recommended subnet size for number of hosts
 * @param hostCount - Number of hosts needed
 * @returns Recommended CIDR prefix
 */
export function recommendSubnetSize(hostCount: number): number {
  // Add 2 for network and broadcast addresses
  const totalNeeded = hostCount + 2;

  // Find smallest CIDR that fits
  for (let cidr = 32; cidr >= 0; cidr--) {
    const capacity = Math.pow(2, 32 - cidr);
    if (capacity >= totalNeeded) {
      return cidr;
    }
  }

  return 0; // /0 - entire IPv4 space (shouldn't reach here)
}
