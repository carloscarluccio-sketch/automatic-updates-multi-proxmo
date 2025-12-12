import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Typography,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Paper,
  Alert,
} from '@mui/material';
import {
  Router as NetworkIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

interface SubnetInfo {
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

const SubnetCalculatorComponent: React.FC = () => {
  const [cidr, setCidr] = useState<string>('192.168.1.0/24');
  const [subnetInfo, setSubnetInfo] = useState<SubnetInfo | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    calculateSubnet();
  }, [cidr]);

  const calculateSubnet = () => {
    try {
      setError('');

      // Parse CIDR notation
      const [subnet, prefixStr] = cidr.split('/');
      const prefix = parseInt(prefixStr);

      if (!subnet || !prefix || prefix < 0 || prefix > 32) {
        setError('Invalid CIDR notation. Use format: 192.168.1.0/24');
        setSubnetInfo(null);
        return;
      }

      // Validate IP address
      const ipParts = subnet.split('.');
      if (ipParts.length !== 4 || ipParts.some(p => {
        const num = parseInt(p);
        return isNaN(num) || num < 0 || num > 255;
      })) {
        setError('Invalid IP address format');
        setSubnetInfo(null);
        return;
      }

      // Calculate subnet information
      const netmask = cidrToNetmask(prefix);
      const info = calculateSubnetInfo(subnet, netmask, prefix);
      setSubnetInfo(info);

    } catch (err: any) {
      setError(err.message || 'Error calculating subnet');
      setSubnetInfo(null);
    }
  };

  const cidrToNetmask = (cidr: number): string => {
    const mask = (0xffffffff << (32 - cidr)) >>> 0;
    return [
      (mask >>> 24) & 0xff,
      (mask >>> 16) & 0xff,
      (mask >>> 8) & 0xff,
      mask & 0xff,
    ].join('.');
  };

  const ipToNumber = (ip: string): number => {
    const parts = ip.split('.').map(p => parseInt(p));
    return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
  };

  const numberToIP = (num: number): string => {
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
    ].join('.');
  };

  const numberToBinary = (num: number): string => {
    const binary = num.toString(2).padStart(32, '0');
    return `${binary.slice(0, 8)}.${binary.slice(8, 16)}.${binary.slice(16, 24)}.${binary.slice(24, 32)}`;
  };

  const getIPClass = (ip: string): string => {
    const firstOctet = parseInt(ip.split('.')[0]);
    if (firstOctet >= 1 && firstOctet <= 126) return 'A';
    if (firstOctet >= 128 && firstOctet <= 191) return 'B';
    if (firstOctet >= 192 && firstOctet <= 223) return 'C';
    if (firstOctet >= 224 && firstOctet <= 239) return 'D';
    if (firstOctet >= 240 && firstOctet <= 255) return 'E';
    return 'Unknown';
  };

  const isPrivateIP = (ip: string): boolean => {
    const num = ipToNumber(ip);
    return (
      (num >= ipToNumber('10.0.0.0') && num <= ipToNumber('10.255.255.255')) ||
      (num >= ipToNumber('172.16.0.0') && num <= ipToNumber('172.31.255.255')) ||
      (num >= ipToNumber('192.168.0.0') && num <= ipToNumber('192.168.255.255'))
    );
  };

  const calculateSubnetInfo = (subnet: string, netmask: string, cidr: number): SubnetInfo => {
    const subnetNum = ipToNumber(subnet);
    const netmaskNum = ipToNumber(netmask);

    const networkAddress = subnetNum & netmaskNum;
    const broadcastAddress = networkAddress | (~netmaskNum >>> 0);

    const firstUsableIP = networkAddress + 1;
    const lastUsableIP = broadcastAddress - 1;

    const totalIPs = broadcastAddress - networkAddress + 1;
    const usableIPs = totalIPs - 2;

    const wildcardMask = ~netmaskNum >>> 0;

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
  };

  const formatNumber = (num: number): string => {
    return num.toLocaleString();
  };

  return (
    <Box>
      <Card elevation={2}>
        <CardContent>
          <Box display="flex" alignItems="center" mb={2}>
            <NetworkIcon color="primary" sx={{ mr: 1 }} />
            <Typography variant="h6">Subnet Calculator</Typography>
          </Box>

          <TextField
            fullWidth
            label="CIDR Notation"
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            placeholder="192.168.1.0/24"
            helperText="Enter subnet in CIDR notation (e.g., 192.168.1.0/24)"
            sx={{ mb: 3 }}
          />

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {subnetInfo && (
            <>
              <Box display="flex" gap={1} mb={3} flexWrap="wrap">
                <Chip
                  label={`Class ${subnetInfo.ipClass}`}
                  color="primary"
                  size="small"
                />
                <Chip
                  label={subnetInfo.isPrivate ? 'Private' : 'Public'}
                  color={subnetInfo.isPrivate ? 'success' : 'warning'}
                  size="small"
                />
                <Chip
                  label={`/${subnetInfo.cidr}`}
                  color="info"
                  size="small"
                />
                <Chip
                  label={`${formatNumber(subnetInfo.usableIPs)} usable IPs`}
                  color="secondary"
                  size="small"
                />
              </Box>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableBody>
                    <TableRow>
                      <TableCell component="th" width="40%">
                        <Typography variant="body2" fontWeight="medium">
                          Network Address
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {subnetInfo.networkAddress}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Broadcast Address
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {subnetInfo.broadcastAddress}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          First Usable IP
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" color="success.main">
                          {subnetInfo.firstUsableIP}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Last Usable IP
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" color="success.main">
                          {subnetInfo.lastUsableIP}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Netmask
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {subnetInfo.netmask}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Wildcard Mask
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {subnetInfo.wildcardMask}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Binary Netmask
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                          {subnetInfo.binaryNetmask}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Total IP Addresses
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatNumber(subnetInfo.totalIPs)}
                        </Typography>
                      </TableCell>
                    </TableRow>

                    <TableRow>
                      <TableCell component="th">
                        <Typography variant="body2" fontWeight="medium">
                          Usable IP Addresses
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="success.main" fontWeight="medium">
                          {formatNumber(subnetInfo.usableIPs)}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              <Alert severity="info" icon={<InfoIcon />} sx={{ mt: 2 }}>
                <Typography variant="body2">
                  <strong>Quick Reference:</strong>
                </Typography>
                <Typography variant="caption" component="div">
                  • Network Address: First IP (not usable for hosts)<br />
                  • Broadcast Address: Last IP (not usable for hosts)<br />
                  • Usable Range: {subnetInfo.firstUsableIP} - {subnetInfo.lastUsableIP}<br />
                  • Gateway typically uses first or last usable IP
                </Typography>
              </Alert>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default SubnetCalculatorComponent;
