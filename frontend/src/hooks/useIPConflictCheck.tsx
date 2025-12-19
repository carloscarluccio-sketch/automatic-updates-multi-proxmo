/**
 * React Hook for IP Conflict Checking
 * Frontend validation for VM IP assignments
 */

import { useState, useCallback } from 'react';
import api from '../services/api';

interface IPConflictResult {
  conflict: boolean;
  message: string;
  warnings?: string[];
  conflictingVM?: {
    id: number;
    name: string;
    ip_address: string;
  };
}

export const useIPConflictCheck = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIPConflict = useCallback(
    async (
      ipAddress: string,
      clusterId: number,
      rangeId?: number,
      vmId?: number
    ): Promise<IPConflictResult> => {
      setIsChecking(true);
      setError(null);

      try {
        const response = await api.post('/network/check-ip-conflict', {
          ipAddress,
          clusterId,
          rangeId,
          vmId,
        });

        const data = response.data;

        if (data.conflict) {
          return {
            conflict: true,
            message: data.message,
            conflictingVM: data.conflictingVM,
          };
        }

        return {
          conflict: false,
          message: data.message,
          warnings: data.warnings,
        };
      } catch (err: any) {
        setError(err.message || 'Failed to check IP conflict');
        return {
          conflict: false,
          message: err.message || 'Failed to check IP conflict',
        };
      } finally {
        setIsChecking(false);
      }
    },
    []
  );

  const checkSubnetConflict = useCallback(
    async (
      subnet: string,
      clusterId: number,
      rangeId?: number
    ): Promise<IPConflictResult> => {
      setIsChecking(true);
      setError(null);

      try {
        const response = await api.post('/network/check-subnet-conflict', {
          subnet,
          clusterId,
          rangeId,
        });

        const data = response.data;

        if (data.conflict) {
          return {
            conflict: true,
            message: data.message,
          };
        }

        return {
          conflict: false,
          message: data.message,
          warnings: data.warnings,
        };
      } catch (err: any) {
        setError(err.message || 'Failed to check subnet conflict');
        return {
          conflict: false,
          message: err.message || 'Failed to check subnet conflict',
        };
      } finally {
        setIsChecking(false);
      }
    },
    []
  );

  const validateIPFormat = useCallback((ip: string): boolean => {
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(ip)) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }, []);

  const validateSubnetFormat = useCallback((subnet: string): boolean => {
    const subnetRegex = /^(\d{1,3}\.){3}\d{1,3}\/\d{1,2}$/;
    if (!subnetRegex.test(subnet)) return false;

    const [ip, cidr] = subnet.split('/');
    const cidrNum = parseInt(cidr, 10);

    if (cidrNum < 0 || cidrNum > 32) return false;

    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }, []);

  const isIPInSubnet = useCallback((ip: string, subnet: string): boolean => {
    if (!validateIPFormat(ip) || !validateSubnetFormat(subnet)) return false;

    const [subnetIP, cidr] = subnet.split('/');
    const cidrNum = parseInt(cidr, 10);

    const ipToNumber = (ipStr: string): number => {
      return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0);
    };

    const ipNum = ipToNumber(ip);
    const subnetNum = ipToNumber(subnetIP);
    const mask = -1 << (32 - cidrNum);

    return (ipNum & mask) === (subnetNum & mask);
  }, [validateIPFormat, validateSubnetFormat]);

  return {
    checkIPConflict,
    checkSubnetConflict,
    validateIPFormat,
    validateSubnetFormat,
    isIPInSubnet,
    isChecking,
    error,
  };
};
