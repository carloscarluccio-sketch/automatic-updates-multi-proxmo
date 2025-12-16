import React, { useState } from 'react';
import {
  Box,
  Container,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Alert,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Card,
  CardContent,
  Grid
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon,
  PlayArrow as PlayArrowIcon,
  Code as CodeIcon,
  Security as SecurityIcon,
  Speed as SpeedIcon,
  Description as DescriptionIcon
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

interface EndpointParam {
  name: string;
  type: string;
  default?: string;
  description: string;
  optional?: boolean;
  inPath?: boolean;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`api-tabpanel-${index}`}
      aria-labelledby={`api-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

const ApiDocsPage: React.FC = () => {
  const [tabValue, setTabValue] = useState(0);
  const [testEndpoint, setTestEndpoint] = useState('/api/v1/health');
  const [testToken, setTestToken] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testError, setTestError] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState('curl');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const testApiEndpoint = async () => {
    setTestLoading(true);
    setTestError('');
    setTestResponse('');

    try {
      const headers: any = {};
      if (testToken) {
        headers['Authorization'] = `Bearer ${testToken}`;
      }

      const response = await fetch(`http://192.168.142.237:3000${testEndpoint}`, {
        headers
      });

      const data = await response.json();
      setTestResponse(JSON.stringify(data, null, 2));
    } catch (error: any) {
      setTestError(error.message || 'Request failed');
    } finally {
      setTestLoading(false);
    }
  };

  const endpoints: Array<{ method: string; path: string; scope: string; description: string; params: EndpointParam[]; response: any }> = [
    {
      method: 'GET',
      path: '/api/v1/health',
      scope: 'None',
      description: 'Check API health status',
      params: [],
      response: {
        success: true,
        version: '1.0.0',
        status: 'operational',
        timestamp: '2025-12-15T21:00:00.000Z'
      }
    },
    {
      method: 'GET',
      path: '/api/v1/vms',
      scope: 'vms:read',
      description: 'List all virtual machines',
      params: [
        { name: 'limit', type: 'integer', default: '50', description: 'Number of results (max 100)' },
        { name: 'offset', type: 'integer', default: '0', description: 'Pagination offset' },
        { name: 'status', type: 'string', optional: true, description: 'Filter by status (running, stopped, etc.)' },
        { name: 'cluster_id', type: 'integer', optional: true, description: 'Filter by cluster ID' }
      ],
      response: {
        success: true,
        data: [
          {
            id: 1,
            vmid: 100,
            name: 'web-server-1',
            status: 'running',
            cpu_cores: 4,
            memory_mb: 8192,
            storage_gb: 100,
            ip_address: '10.0.1.100',
            created_at: '2025-01-01T00:00:00.000Z'
          }
        ],
        meta: {
          total: 25,
          limit: 50,
          offset: 0,
          has_more: false
        }
      }
    },
    {
      method: 'GET',
      path: '/api/v1/vms/:id',
      scope: 'vms:read',
      description: 'Get single VM details',
      params: [
        { name: 'id', type: 'integer', description: 'VM ID', inPath: true }
      ],
      response: {
        success: true,
        data: {
          id: 1,
          vmid: 100,
          name: 'web-server-1',
          description: 'Production web server',
          status: 'running',
          cpu_cores: 4,
          memory_mb: 8192,
          storage_gb: 100,
          ip_address: '10.0.1.100',
          node: 'pve-node-1',
          proxmox_clusters: {
            id: 1,
            name: 'Main Cluster',
            location: 'DC1'
          }
        }
      }
    },
    {
      method: 'GET',
      path: '/api/v1/billing/invoices',
      scope: 'billing:read',
      description: 'List invoices',
      params: [
        { name: 'limit', type: 'integer', default: '50', description: 'Number of results (max 100)' },
        { name: 'offset', type: 'integer', default: '0', description: 'Pagination offset' },
        { name: 'status', type: 'string', optional: true, description: 'Filter by status (draft, issued, paid, overdue, cancelled)' }
      ],
      response: {
        success: true,
        data: [
          {
            id: 1,
            invoice_number: 'INV-2025-001',
            billing_period_start: '2025-01-01',
            billing_period_end: '2025-01-31',
            subtotal: 100.00,
            tax_amount: 8.00,
            total_amount: 108.00,
            status: 'paid',
            due_date: '2025-02-15',
            issued_at: '2025-02-01T00:00:00.000Z'
          }
        ]
      }
    },
    {
      method: 'GET',
      path: '/api/v1/billing/estimate',
      scope: 'billing:read',
      description: 'Get current billing estimate',
      params: [],
      response: {
        success: true,
        data: {
          company_name: 'Acme Corp',
          pricing_plan: 'Business Plan',
          billing_cycle: 'monthly',
          vm_count: 5,
          total_base_price: 100.00,
          total_overages: 25.50,
          estimated_total: 125.50,
          currency: 'USD',
          vm_breakdown: [
            {
              vm_id: 1,
              vm_name: 'web-server-1',
              base_price: 20.00,
              cpu_overage_cost: 5.00,
              memory_overage_cost: 0.50,
              storage_overage_cost: 0.00,
              total_cost: 25.50
            }
          ]
        }
      }
    },
    {
      method: 'GET',
      path: '/api/v1/clusters',
      scope: 'clusters:read',
      description: 'List assigned Proxmox clusters',
      params: [],
      response: {
        success: true,
        data: [
          {
            id: 1,
            name: 'Main Cluster',
            location: 'DC1',
            host: '192.168.1.100',
            port: 8006
          }
        ]
      }
    },
    {
      method: 'GET',
      path: '/api/v1/usage',
      scope: 'authenticated',
      description: 'Get API usage statistics',
      params: [],
      response: {
        success: true,
        data: {
          total_calls: 1523,
          calls_last_30_days: 487,
          endpoint_stats: [
            {
              endpoint: '/api/v1/vms',
              call_count: 245,
              avg_response_time: 85.3
            }
          ]
        }
      }
    }
  ];

  const codeExamples: Record<string, any> = {
    curl: {
      health: `curl -X GET http://192.168.142.237:3000/api/v1/health`,
      vms: `curl -X GET "http://192.168.142.237:3000/api/v1/vms?limit=10" \\
  -H "Authorization: Bearer pmt_YOUR_TOKEN_HERE"`,
      vm_detail: `curl -X GET "http://192.168.142.237:3000/api/v1/vms/1" \\
  -H "Authorization: Bearer pmt_YOUR_TOKEN_HERE"`,
      invoices: `curl -X GET "http://192.168.142.237:3000/api/v1/billing/invoices" \\
  -H "Authorization: Bearer pmt_YOUR_TOKEN_HERE"`,
      estimate: `curl -X GET "http://192.168.142.237:3000/api/v1/billing/estimate" \\
  -H "Authorization: Bearer pmt_YOUR_TOKEN_HERE"`
    },
    python: {
      health: `import requests

response = requests.get('http://192.168.142.237:3000/api/v1/health')
print(response.json())`,
      vms: `import requests

headers = {
    'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
}

params = {
    'limit': 10,
    'offset': 0
}

response = requests.get(
    'http://192.168.142.237:3000/api/v1/vms',
    headers=headers,
    params=params
)

data = response.json()
if data['success']:
    for vm in data['data']:
        print(f"VM {vm['name']}: {vm['status']}")`,
      vm_detail: `import requests

headers = {
    'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
}

vm_id = 1
response = requests.get(
    f'http://192.168.142.237:3000/api/v1/vms/{vm_id}',
    headers=headers
)

vm = response.json()['data']
print(f"VM: {vm['name']}")
print(f"Cluster: {vm['proxmox_clusters']['name']}")`,
      invoices: `import requests

headers = {
    'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
}

response = requests.get(
    'http://192.168.142.237:3000/api/v1/billing/invoices',
    headers=headers
)

invoices = response.json()['data']
for invoice in invoices:
    print("Example: INV-2025-001: $108.00")`,
      estimate: `import requests

headers = {
    'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
}

response = requests.get(
    'http://192.168.142.237:3000/api/v1/billing/estimate',
    headers=headers
)

estimate = response.json()['data']
print("Estimated Total: $125.50")
print("Base Price: $100.00")
print("Overages: $25.50")`
    },
    javascript: {
      health: `fetch('http://192.168.142.237:3000/api/v1/health')
  .then(response => response.json())
  .then(data => console.log(data));`,
      vms: `const fetchVMs = async () => {
  const response = await fetch(
    'http://192.168.142.237:3000/api/v1/vms?limit=10',
    {
      headers: {
        'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
      }
    }
  );

  const data = await response.json();

  if (data.success) {
    data.data.forEach(vm => {
      console.log(\`VM \${vm.name}: \${vm.status}\`);
    });
  }
};

fetchVMs();`,
      vm_detail: `const fetchVM = async (vmId) => {
  const response = await fetch(
    \`http://192.168.142.237:3000/api/v1/vms/\${vmId}\`,
    {
      headers: {
        'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
      }
    }
  );

  const { data } = await response.json();
  console.log('VM:', data.name);
  console.log('Cluster:', data.proxmox_clusters.name);
};

fetchVM(1);`,
      invoices: `const fetchInvoices = async () => {
  const response = await fetch(
    'http://192.168.142.237:3000/api/v1/billing/invoices',
    {
      headers: {
        'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
      }
    }
  );

  const { data } = await response.json();

  data.forEach(invoice => {
    console.log(\`\${invoice.invoice_number}: $\${invoice.total_amount}\`);
  });
};

fetchInvoices();`,
      estimate: `const fetchBillingEstimate = async () => {
  const response = await fetch(
    'http://192.168.142.237:3000/api/v1/billing/estimate',
    {
      headers: {
        'Authorization': 'Bearer pmt_YOUR_TOKEN_HERE'
      }
    }
  );

  const { data } = await response.json();

  console.log('Estimated Total:', data.estimated_total);
  console.log('Base Price:', data.total_base_price);
  console.log('Overages:', data.total_overages);
};

fetchBillingEstimate();`
    },
    php: {
      health: `<?php
$response = file_get_contents('http://192.168.142.237:3000/api/v1/health');
$data = json_decode($response, true);
print_r($data);`,
      vms: `<?php
$token = 'pmt_YOUR_TOKEN_HERE';

$options = [
    'http' => [
        'header' => "Authorization: Bearer $token\\r\\n"
    ]
];

$context = stream_context_create($options);
$response = file_get_contents(
    'http://192.168.142.237:3000/api/v1/vms?limit=10',
    false,
    $context
);

$data = json_decode($response, true);

if ($data['success']) {
    foreach ($data['data'] as $vm) {
        echo "VM {$vm['name']}: {$vm['status']}\\n";
    }
}`,
      vm_detail: `<?php
$token = 'pmt_YOUR_TOKEN_HERE';
$vm_id = 1;

$options = [
    'http' => [
        'header' => "Authorization: Bearer $token\\r\\n"
    ]
];

$context = stream_context_create($options);
$response = file_get_contents(
    "http://192.168.142.237:3000/api/v1/vms/$vm_id",
    false,
    $context
);

$data = json_decode($response, true);
$vm = $data['data'];

echo "VM: {$vm['name']}\\n";
echo "Cluster: {$vm['proxmox_clusters']['name']}\\n";`,
      invoices: `<?php
$token = 'pmt_YOUR_TOKEN_HERE';

$options = [
    'http' => [
        'header' => "Authorization: Bearer $token\\r\\n"
    ]
];

$context = stream_context_create($options);
$response = file_get_contents(
    'http://192.168.142.237:3000/api/v1/billing/invoices',
    false,
    $context
);

$data = json_decode($response, true);

foreach ($data['data'] as $invoice) {
    echo "{$invoice['invoice_number']}: \${$invoice['total_amount']}\\n";
}`,
      estimate: `<?php
$token = 'pmt_YOUR_TOKEN_HERE';

$options = [
    'http' => [
        'header' => "Authorization: Bearer $token\\r\\n"
    ]
];

$context = stream_context_create($options);
$response = file_get_contents(
    'http://192.168.142.237:3000/api/v1/billing/estimate',
    false,
    $context
);

$data = json_decode($response, true);
$estimate = $data['data'];

echo "Estimated Total: \${$estimate['estimated_total']}\\n";
echo "Base Price: \${$estimate['total_base_price']}\\n";
echo "Overages: \${$estimate['total_overages']}\\n";`
    }
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h3" gutterBottom>
          <CodeIcon sx={{ mr: 2, verticalAlign: 'middle' }} />
          API Documentation
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Complete reference for the Proxmox Multi-Tenant Public API (v1.0.0)
        </Typography>
      </Box>

      {/* Quick Start Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <SecurityIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Authentication
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All API requests require Bearer token authentication with proper scopes.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <SpeedIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Rate Limiting
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Default limit: 100 requests per minute. Configurable per token.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <DescriptionIcon color="primary" sx={{ fontSize: 40, mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Response Format
              </Typography>
              <Typography variant="body2" color="text.secondary">
                All responses return JSON with consistent structure and error codes.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Paper>
        <Tabs value={tabValue} onChange={handleTabChange} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Overview" />
          <Tab label="Endpoints" />
          <Tab label="Authentication" />
          <Tab label="Code Examples" />
          <Tab label="API Explorer" />
        </Tabs>

        {/* Overview Tab */}
        <TabPanel value={tabValue} index={0}>
          <Typography variant="h5" gutterBottom>
            Getting Started
          </Typography>

          <Typography variant="body1" paragraph>
            The Proxmox Multi-Tenant API provides programmatic access to manage your virtual machines,
            view billing information, and monitor usage statistics.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Base URL
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.100', fontFamily: 'monospace' }}>
            http://192.168.142.237:3000/api/v1
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Quick Example
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white' }}>
            <pre style={{ margin: 0, overflow: 'auto' }}>
{`curl -X GET "http://192.168.142.237:3000/api/v1/vms" \\
  -H "Authorization: Bearer pmt_YOUR_TOKEN_HERE"`}
            </pre>
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Response Structure
          </Typography>
          <Typography variant="body2" paragraph>
            All successful responses follow this structure:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white' }}>
            <pre style={{ margin: 0, overflow: 'auto' }}>
{`{
  "success": true,
  "data": { ... },
  "meta": { ... }  // Optional pagination info
}`}
            </pre>
          </Paper>

          <Typography variant="body2" paragraph sx={{ mt: 2 }}>
            All error responses follow this structure:
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white' }}>
            <pre style={{ margin: 0, overflow: 'auto' }}>
{`{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}`}
            </pre>
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Available Scopes
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Scope</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell><Chip label="vms:read" size="small" /></TableCell>
                  <TableCell>Read access to virtual machines</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Chip label="billing:read" size="small" /></TableCell>
                  <TableCell>Read access to billing and invoices</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><Chip label="clusters:read" size="small" /></TableCell>
                  <TableCell>Read access to Proxmox clusters</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Endpoints Tab */}
        <TabPanel value={tabValue} index={1}>
          <Typography variant="h5" gutterBottom>
            API Endpoints
          </Typography>

          {endpoints.map((endpoint, index) => (
            <Accordion key={index}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Chip
                    label={endpoint.method}
                    size="small"
                    color="primary"
                    sx={{ mr: 2, minWidth: 60 }}
                  />
                  <Typography sx={{ fontFamily: 'monospace', flexGrow: 1 }}>
                    {endpoint.path}
                  </Typography>
                  <Chip label={endpoint.scope} size="small" variant="outlined" />
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box>
                  <Typography variant="body1" paragraph>
                    {endpoint.description}
                  </Typography>

                  {endpoint.params.length > 0 && (
                    <>
                      <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                        Parameters
                      </Typography>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell><strong>Name</strong></TableCell>
                              <TableCell><strong>Type</strong></TableCell>
                              <TableCell><strong>Default</strong></TableCell>
                              <TableCell><strong>Description</strong></TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {endpoint.params.map((param, pIndex) => (
                              <TableRow key={pIndex}>
                                <TableCell>
                                  <code>{param.name}</code>
                                  {param.optional && <Chip label="optional" size="small" sx={{ ml: 1 }} />}
                                  {param.inPath && <Chip label="path" size="small" sx={{ ml: 1 }} />}
                                </TableCell>
                                <TableCell>{param.type}</TableCell>
                                <TableCell>{param.default || '-'}</TableCell>
                                <TableCell>{param.description}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </>
                  )}

                  <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                    Example Response
                  </Typography>
                  <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white', position: 'relative' }}>
                    <IconButton
                      size="small"
                      sx={{ position: 'absolute', top: 8, right: 8, color: 'white' }}
                      onClick={() => copyToClipboard(JSON.stringify(endpoint.response, null, 2))}
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                    <pre style={{ margin: 0, overflow: 'auto' }}>
                      {JSON.stringify(endpoint.response, null, 2)}
                    </pre>
                  </Paper>
                </Box>
              </AccordionDetails>
            </Accordion>
          ))}
        </TabPanel>

        {/* Authentication Tab */}
        <TabPanel value={tabValue} index={2}>
          <Typography variant="h5" gutterBottom>
            Authentication
          </Typography>

          <Typography variant="body1" paragraph>
            The API uses Bearer token authentication. You must include your API token in the
            Authorization header of every request.
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Creating an API Token
          </Typography>
          <Typography variant="body2" paragraph>
            1. Navigate to <strong>Settings &gt; API Tokens</strong> in your dashboard<br />
            2. Click <strong>Create New Token</strong><br />
            3. Enter a name and select the required scopes<br />
            4. Copy the token immediately (it won't be shown again)
          </Typography>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Using Your Token
          </Typography>
          <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white' }}>
            <pre style={{ margin: 0 }}>
{`Authorization: Bearer pmt_YOUR_TOKEN_HERE`}
            </pre>
          </Paper>

          <Typography variant="h6" gutterBottom sx={{ mt: 3 }}>
            Error Codes
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell><strong>Code</strong></TableCell>
                  <TableCell><strong>Description</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <TableRow>
                  <TableCell><code>UNAUTHORIZED</code></TableCell>
                  <TableCell>Missing or invalid API key</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>INVALID_API_KEY</code></TableCell>
                  <TableCell>Token format incorrect or not found</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>INSUFFICIENT_SCOPE</code></TableCell>
                  <TableCell>Token doesn't have required permissions</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>RATE_LIMIT_EXCEEDED</code></TableCell>
                  <TableCell>Too many requests</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>NOT_FOUND</code></TableCell>
                  <TableCell>Resource not found</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell><code>INTERNAL_ERROR</code></TableCell>
                  <TableCell>Server error</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </TabPanel>

        {/* Code Examples Tab */}
        <TabPanel value={tabValue} index={3}>
          <Typography variant="h5" gutterBottom>
            Code Examples
          </Typography>

          <FormControl fullWidth sx={{ mb: 3 }}>
            <InputLabel>Language</InputLabel>
            <Select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              label="Language"
            >
              <MenuItem value="curl">cURL</MenuItem>
              <MenuItem value="python">Python</MenuItem>
              <MenuItem value="javascript">JavaScript</MenuItem>
              <MenuItem value="php">PHP</MenuItem>
            </Select>
          </FormControl>

          {Object.keys(codeExamples[selectedLanguage]).map((exampleKey) => (
            <Box key={exampleKey} sx={{ mb: 4 }}>
              <Typography variant="h6" gutterBottom sx={{ textTransform: 'capitalize' }}>
                {exampleKey.replace('_', ' ')}
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white', position: 'relative' }}>
                <IconButton
                  size="small"
                  sx={{ position: 'absolute', top: 8, right: 8, color: 'white' }}
                  onClick={() => copyToClipboard(codeExamples[selectedLanguage][exampleKey])}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {codeExamples[selectedLanguage][exampleKey]}
                </pre>
              </Paper>
            </Box>
          ))}
        </TabPanel>

        {/* API Explorer Tab */}
        <TabPanel value={tabValue} index={4}>
          <Typography variant="h5" gutterBottom>
            API Explorer
          </Typography>

          <Typography variant="body1" paragraph>
            Test API endpoints directly from your browser.
          </Typography>

          <Box sx={{ mb: 3 }}>
            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Endpoint</InputLabel>
              <Select
                value={testEndpoint}
                onChange={(e) => setTestEndpoint(e.target.value)}
                label="Endpoint"
              >
                {endpoints.map((endpoint, index) => (
                  <MenuItem key={index} value={endpoint.path}>
                    {endpoint.method} {endpoint.path}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="API Token"
              value={testToken}
              onChange={(e) => setTestToken(e.target.value)}
              placeholder="pmt_YOUR_TOKEN_HERE"
              type="password"
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SecurityIcon />
                  </InputAdornment>
                ),
              }}
            />

            <Button
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={testApiEndpoint}
              disabled={testLoading}
              fullWidth
            >
              {testLoading ? 'Testing...' : 'Test Endpoint'}
            </Button>
          </Box>

          {testError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {testError}
            </Alert>
          )}

          {testResponse && (
            <Box>
              <Typography variant="h6" gutterBottom>
                Response
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'grey.900', color: 'white', position: 'relative' }}>
                <IconButton
                  size="small"
                  sx={{ position: 'absolute', top: 8, right: 8, color: 'white' }}
                  onClick={() => copyToClipboard(testResponse)}
                >
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
                <pre style={{ margin: 0, overflow: 'auto' }}>
                  {testResponse}
                </pre>
              </Paper>
            </Box>
          )}
        </TabPanel>
      </Paper>
    </Container>
  );
};

export default ApiDocsPage;
