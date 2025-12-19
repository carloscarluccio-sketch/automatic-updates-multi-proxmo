/**
 * React Hook for IP Conflict Checking
 * Frontend validation for VM IP assignments
 */

import { useState, useCallback } from 'react';
import { apiRequest } from '../utils/api';

interface IPConflictResult {
  conflict: boolean;
  message: string;
  warnings?: string[];
  conflictingVM?: {
    id: number;
    name: string;
    vmid: number;
    companyName: string;
  };
}

export function useIPConflictCheck() {
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkIPConflict = useCallback(
    async (
      ipAddress: string,
      clusterId: number,
      rangeId?: number,
      vmId?: number
    ): Promise<IPConflictResult | null> => {
      if (!ipAddress || !clusterId) {
        return null;
      }

      setChecking(true);
      setError(null);

      try {
        const response = await apiRequest('/network/check-ip-conflict', {
          method: 'POST',
          body: JSON.stringify({
            ipAddress,
            clusterId,
            rangeId,
            vmId,
          }),
        });

        if (response.conflict) {
          return {
            conflict: true,
            message: response.message,
            conflictingVM: response.conflictingVM,
          };
        }

        return {
          conflict: false,
          message: response.message,
          warnings: response.warnings,
        };
      } catch (err: any) {
        setError(err.message || 'Failed to check IP conflict');
        return {
          conflict: true,
          message: err.message || 'Failed to check IP conflict',
        };
      } finally {
        setChecking(false);
      }
    },
    []
  );

  const getAvailableIPs = useCallback(
    async (rangeId: number, limit: number = 50): Promise<string[]> => {
      setChecking(true);
      setError(null);

      try {
        const response = await apiRequest(
          `/network/ip-ranges/${rangeId}/available?limit=${limit}`
        );
        return response.data || [];
      } catch (err: any) {
        setError(err.message || 'Failed to get available IPs');
        return [];
      } finally {
        setChecking(false);
      }
    },
    []
  );

  return {
    checkIPConflict,
    getAvailableIPs,
    checking,
    error,
  };
}

/**
 * Usage Example in VM Creation Form:
 */
/*
import { useIPConflictCheck } from '../hooks/useIPConflictCheck';

export function VMCreateForm() {
  const [ipAddress, setIPAddress] = useState('');
  const [ipError, setIPError] = useState('');
  const [ipWarnings, setIPWarnings] = useState<string[]>([]);

  const { checkIPConflict, checking } = useIPConflictCheck();

  const handleIPBlur = async () => {
    if (!ipAddress) return;

    const result = await checkIPConflict(
      ipAddress,
      selectedClusterId,
      selectedRangeId
    );

    if (result?.conflict) {
      setIPError(result.message);
      return;
    }

    if (result?.warnings && result.warnings.length > 0) {
      setIPWarnings(result.warnings);
    }

    setIPError('');
  };

  return (
    <div>
      <TextField
        label="IP Address"
        value={ipAddress}
        onChange={(e) => setIPAddress(e.target.value)}
        onBlur={handleIPBlur}
        error={!!ipError}
        helperText={ipError}
      />
      {checking && <CircularProgress size={20} />}
      {ipWarnings.length > 0 && (
        <Alert severity="warning">
          {ipWarnings.join(', ')}
        </Alert>
      )}
    </div>
  );
}
*/
