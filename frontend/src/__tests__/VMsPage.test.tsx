/**
 * Frontend tests for VMs Page
 * Tests component rendering, user interactions, API calls
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { VMsPage } from '../pages/VMsPage';
import * as api from '../utils/api';

// Mock API module
jest.mock('../utils/api');
const mockedApi = api as jest.Mocked<typeof api>;

// Mock Material-UI Dialog to avoid portal issues
jest.mock('@mui/material/Dialog', () => {
  return function MockDialog({ children, open }: any) {
    return open ? <div data-testid="mock-dialog">{children}</div> : null;
  };
});

describe('VMsPage', () => {
  const mockVMs = [
    {
      id: 1,
      vmid: 100,
      name: 'test-vm-1',
      company_id: 1,
      cluster_id: 1,
      node: 'pve1',
      cores: 2,
      memory: 2048,
      disk: 20,
      status: 'running',
      primary_ip_internal: '192.168.1.100',
    },
    {
      id: 2,
      vmid: 101,
      name: 'test-vm-2',
      company_id: 1,
      cluster_id: 1,
      node: 'pve1',
      cores: 4,
      memory: 4096,
      disk: 40,
      status: 'stopped',
      primary_ip_internal: '192.168.1.101',
    },
  ];

  const mockClusters = [
    { id: 1, name: 'Test Cluster', host: '192.168.1.100' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock successful API responses
    mockedApi.get.mockImplementation((url: string) => {
      if (url.includes('/vms')) {
        return Promise.resolve({ data: { success: true, data: mockVMs } });
      }
      if (url.includes('/clusters')) {
        return Promise.resolve({ data: { success: true, data: mockClusters } });
      }
      return Promise.resolve({ data: { success: true, data: [] } });
    });
  });

  it('should render VMs page with loading state', () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    expect(screen.getByText(/Virtual Machines/i)).toBeInTheDocument();
  });

  it('should display VMs after loading', async () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
      expect(screen.getByText('test-vm-2')).toBeInTheDocument();
    });
  });

  it('should display VM details correctly', async () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      // Check VMID
      expect(screen.getByText('100')).toBeInTheDocument();
      expect(screen.getByText('101')).toBeInTheDocument();

      // Check status
      expect(screen.getByText(/running/i)).toBeInTheDocument();
      expect(screen.getByText(/stopped/i)).toBeInTheDocument();

      // Check resources
      expect(screen.getByText(/2 cores/i)).toBeInTheDocument();
      expect(screen.getByText(/4 cores/i)).toBeInTheDocument();
    });
  });

  it('should show error message on API failure', async () => {
    mockedApi.get.mockRejectedValue(new Error('Network error'));

    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should filter VMs by search term', async () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: 'test-vm-1' } });

    await waitFor(() => {
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
      expect(screen.queryByText('test-vm-2')).not.toBeInTheDocument();
    });
  });

  it('should filter VMs by status', async () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
    });

    const statusFilter = screen.getByLabelText(/status/i);
    fireEvent.change(statusFilter, { target: { value: 'running' } });

    await waitFor(() => {
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
      expect(screen.queryByText('test-vm-2')).not.toBeInTheDocument();
    });
  });

  it('should open create VM dialog', async () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    const createButton = screen.getByText(/create vm/i);
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByTestId('mock-dialog')).toBeInTheDocument();
    });
  });

  it('should start VM when start button clicked', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('test-vm-2')).toBeInTheDocument();
    });

    const startButtons = screen.getAllByRole('button', { name: /start/i });
    fireEvent.click(startButtons[0]);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        expect.stringContaining('/vms/2/control'),
        { action: 'start' }
      );
    });
  });

  it('should stop VM when stop button clicked', async () => {
    mockedApi.post.mockResolvedValue({ data: { success: true } });

    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('test-vm-1')).toBeInTheDocument();
    });

    const stopButtons = screen.getAllByRole('button', { name: /stop/i });
    fireEvent.click(stopButtons[0]);

    await waitFor(() => {
      expect(mockedApi.post).toHaveBeenCalledWith(
        expect.stringContaining('/vms/1/control'),
        { action: 'stop' }
      );
    });
  });

  it('should display empty state when no VMs', async () => {
    mockedApi.get.mockResolvedValue({ data: { success: true, data: [] } });

    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/no virtual machines/i)).toBeInTheDocument();
    });
  });

  it('should paginate VMs correctly', async () => {
    const manyVMs = Array.from({ length: 25 }, (_, i) => ({
      id: i + 1,
      vmid: 100 + i,
      name: `vm-${i + 1}`,
      company_id: 1,
      cluster_id: 1,
      node: 'pve1',
      cores: 2,
      memory: 2048,
      disk: 20,
      status: 'running',
    }));

    mockedApi.get.mockResolvedValue({ data: { success: true, data: manyVMs } });

    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('vm-1')).toBeInTheDocument();
    });

    // Check pagination controls exist
    const nextButton = screen.getByRole('button', { name: /next/i });
    expect(nextButton).toBeInTheDocument();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('vm-11')).toBeInTheDocument();
    });
  });

  it('should refresh VMs when refresh button clicked', async () => {
    render(
      <BrowserRouter>
        <VMsPage />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(1);
    });

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(mockedApi.get).toHaveBeenCalledTimes(2);
    });
  });
});
