# Proxmox Multi-Tenant Platform

## Project Overview
A multi-tenant web application for managing Proxmox VE infrastructure, allowing multiple companies to manage their virtual machines, clusters, and resources through a centralized platform.

## Technology Stack
- **Backend**: PHP 8.3
- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Database**: MySQL/MariaDB
- **Server**: Apache 2.4.58 on Ubuntu
- **API**: Proxmox VE REST API
- **Authentication**: JWT (JSON Web Tokens)

## Server Information
- **Production Server**: 192.168.142.236
- **SSH User**: root
- **Document Root**: `/var/www/proxmox-multi-tenant/public/`
- **Database Name**: proxmox_tenant

## Architecture

### User Roles
1. **super_admin**: Full system access, manages all companies and clusters
2. **company_admin**: Manages their own company's resources
3. **salesperson**: Limited access for sales-related operations
4. **user**: Basic user with limited permissions

### JWT Authentication
- Token stored in localStorage
- User data stored in localStorage
- JWT payload structure: `{ sub: user_id, iat: issued_at, exp: expiration }`
- All API endpoints require Bearer token authentication
- Token decoded using `JWT::decode()` (not `JWT::verify()`)
- User details fetched from database using `$payload['sub']`

**Important**: Always fetch user data from database after JWT decode:
```php
$payload = JWT::decode($token);
$user = $db->fetchOne("SELECT id, role, company_id FROM users WHERE id = ?", [$payload['sub']]);
```

## Key Features

### 1. Virtual Machine Management
- Create, edit, delete VMs
- Start/stop/restart VM operations
- VM project organization
- Network configuration with static IPs
- Integration with Proxmox API

### 2. Network Management (NEW)
- IP range allocation per company/cluster
- CIDR notation support (e.g., 10.0.1.0/24)
- VLAN configuration
- Gateway and netmask settings
- IP assignment tracking
- Prevention of deleting IP ranges in use

### 3. Company Management
- Multi-company support
- Company-specific resource isolation
- User management per company
- Cluster assignments

### 4. Cluster Management
- Multiple Proxmox clusters
- Node management
- Storage management
- Quota management
- **On-Demand Version Fetching**: Proxmox version retrieved only when requested (via "Fetch Version" button)
- **Version Caching**: Fetched versions cached in memory until page reload
- **Performance Optimization**: Fast cluster list loading without version check timeouts

### 5. User Management
- Role-based access control
- Company-specific users
- Permission profiles
- User authentication

### 6. Billing & Usage Tracking
- Resource usage monitoring
- Billing information
- Usage reports

### 7. Permission Profiles
- Custom permission sets
- Profile-based access control

### 8. OPNsense Firewall Deployment (AUTOMATED)
- **Automated Deployment**: Template-based OPNsense firewall deployment per company/project
- **Network Isolation**: Automatic VLAN assignment for LAN security (100 + company_id + project_id)
- **External IP Management**: Multiple external (public) IP ranges per company
- **Configuration Automation**: Auto-generated config.xml with pre-configured settings
- **Credential Management**: Secure admin password generation and encrypted storage
- **Zero-Touch Installation**: Eliminates manual console configuration steps

#### OPNsense Architecture
1. **Proxmox Bridge to LAN**: Main network connection
2. **VLAN Bridges**: Isolated network segments per project
3. **OPNsense per Project**: Dedicated firewall instance
4. **VMs per Project**: Grouped virtual machines behind firewall

#### Deployment Process
1. Select company, project, cluster, and node
2. Choose external IP range for WAN interface
3. Define internal LAN subnet (e.g., 10.0.1.0/24)
4. Configure NAT and DHCP services
5. **Automatic config generation**: System generates:
   - Complete OPNsense config.xml
   - Secure admin password (encrypted in database)
   - Network interface configuration (WAN + LAN)
   - Gateway and routing setup
   - DHCP server configuration
   - NAT rules (automatic outbound mode)
   - Default firewall rules
6. VM deployment with pre-configured ISO mount
7. Post-installation: Download config.xml and import via web UI

#### Features
- **Template System**: Reusable OPNsense configurations
- **Credentials Access**: View and copy generated passwords
- **Config Download**: One-click config.xml download
- **Status Tracking**: Deployment progress monitoring
- **Multi-Interface Setup**: WAN (external) + LAN (internal with VLAN tags)
- **Service Configuration**: Pre-configured NAT, DHCP, and firewall rules

#### External IP Management
- **Multiple Ranges**: Companies can manage multiple external IP pools
- **Shared Ranges**: Super admins can create shared IP pools
- **IP Type Distinction**: Internal vs External IP classification
- **Automatic Assignment**: WAN IPs auto-assigned from available pool
- **Access Control**: Role-based IP range permissions

### 9. Import & Discovery (NEW)
- **VM Discovery**: Scan Proxmox clusters to discover existing VMs
- **Automated Import**: Bulk import VMs into database with full metadata
- **Smart Detection**: Automatically detects VM resources (CPU, RAM, storage, IP)
- **Company Assignment**: Assign imported VMs to companies during discovery
- **VM Reassignment**: Reassign VMs between companies post-import
- **Duplicate Prevention**: Skips VMs already in database
- **Template Filtering**: Automatically excludes Proxmox templates
- **Network Sync**: Link to existing network sync functionality

#### Import Features
- **Cluster Selection**: Choose which Proxmox cluster to scan
- **Default Company**: Assign all discovered VMs to a specific company
- **Import Statistics**: Real-time display of found/imported/skipped VMs
- **Detailed Results**: Shows full VM details including node, IP, status
- **Skip Reasons**: Clear explanation for each skipped VM
- **Filters**: Filter VMs by company or cluster for reassignment

#### VM Reassignment
- **Company Transfer**: Move VMs between companies
- **Bulk Management**: View all VMs in a sortable table
- **Role-Based Access**: Only super_admin can reassign VMs
- **Audit Trail**: Tracks old and new company assignments

## File Structure

```
proxmox-multi-tenant/
├── public/
│   ├── api/
│   │   ├── company/
│   │   │   ├── list.php
│   │   │   ├── create.php
│   │   │   ├── update.php
│   │   │   ├── delete.php
│   │   │   ├── clusters/
│   │   │   ├── permissions/
│   │   │   ├── quotas/
│   │   │   └── users/
│   │   ├── vm/
│   │   │   ├── create.php
│   │   │   ├── list.php
│   │   │   ├── import.php (NEW - VM discovery)
│   │   │   ├── reassign_company.php (NEW - company reassignment)
│   │   │   └── projects/
│   │   │       ├── list.php
│   │   │       ├── create.php
│   │   │       ├── update.php
│   │   │       └── delete.php
│   │   ├── network/
│   │   │   ├── ip_range/
│   │   │   │   ├── list.php
│   │   │   │   ├── create.php
│   │   │   │   ├── update.php
│   │   │   │   ├── delete.php
│   │   │   │   └── available_ips.php
│   │   │   └── external_ip_ranges/
│   │   │       ├── list.php
│   │   │       ├── create.php
│   │   │       └── delete.php
│   │   ├── opnsense/
│   │   │   ├── list.php
│   │   │   ├── create.php
│   │   │   ├── delete.php
│   │   │   ├── details.php
│   │   │   ├── config.php
│   │   │   └── templates/
│   │   │       └── list.php
│   │   ├── profile/
│   │   ├── permission/
│   │   ├── billing/
│   │   └── cluster/
│   ├── js/
│   │   ├── common.js (shared utilities)
│   │   ├── vms.js
│   │   ├── companies.js
│   │   ├── clusters.js
│   │   ├── users.js
│   │   ├── network.js
│   │   ├── external_ips.js
│   │   ├── opnsense.js
│   │   ├── import.js (NEW - import & discovery)
│   │   ├── billing.js
│   │   └── profiles.js
│   ├── css/
│   │   ├── variables.css
│   │   ├── modern.css
│   │   ├── layout-fix.css
│   │   ├── vms.css
│   │   ├── companies.css
│   │   ├── network.css
│   │   └── ...
│   ├── vms.html
│   ├── companies.html
│   ├── clusters.html
│   ├── users.html
│   ├── network.html
│   ├── external_ips.html
│   ├── opnsense.html
│   ├── import.html (NEW - import & discovery)
│   ├── billing.html
│   ├── profiles.html
│   └── index.php (login page)
├── config/
│   └── config.php
├── includes/
│   ├── Database.php (Singleton pattern)
│   ├── JWT.php
│   ├── ProxmoxAPI.php
│   ├── EncryptionService.php
│   ├── ActivityLogger.php
│   └── OPNsenseConfig.php (config.xml generator)
├── scripts/
│   ├── deploy_opnsense.php (async OPNsense deployment)
│   └── generate_letsencrypt_cert.php
└── database/
    └── migrations/
        ├── 001_*.sql - 013_*.sql (previous migrations)
        └── 014_opnsense_automation.sql
```

## Database Schema

### Core Tables

**companies**
- Multi-tenant isolation
- Company details and status

**users**
- User authentication
- Role assignment
- Company association

**proxmox_clusters**
- Cluster connection details
- API credentials
- Location information

**virtual_machines**
- VM metadata
- Resource specifications
- `primary_ip_internal` (NEW)
- `primary_ip_external` (NEW)
- Project assignments

**vm_projects**
- Project organization
- Company-specific projects

### Network Tables (NEW)

**ip_ranges**
- Subnet allocation (CIDR notation)
- Gateway configuration
- VLAN assignments
- Company and cluster association

**vm_ip_assignments**
- Individual IP assignments to VMs
- IP type (internal/external)
- Primary IP designation
- Interface mapping

**nat_rules**
- Future NAT port forwarding
- External to internal IP mapping

### OPNsense Tables (AUTOMATED DEPLOYMENT)

**opnsense_templates**
- Reusable OPNsense configurations
- CPU, memory, storage specifications
- ISO filename and storage location
- Network bridge configuration
- Default service settings (NAT, DHCP)

**opnsense_instances**
- Deployed OPNsense firewall instances
- Company and project association
- VM linkage (virtual_machines table)
- Network configuration (WAN + LAN)
- VLAN assignment for LAN isolation
- `admin_password` (encrypted) - Auto-generated admin credentials
- `config_xml` (MEDIUMTEXT) - Complete OPNsense configuration
- `config_generated_at` - Configuration generation timestamp
- Deployment status tracking (pending, deploying, configuring, active, failed, stopped)
- Service flags (NAT enabled, DHCP enabled)

**opnsense_firewall_rules**
- Custom firewall rules per instance
- Source/destination configuration
- Port and protocol settings
- Action (allow/deny)
- Rule ordering

### External IP Management Tables

**ip_ranges** (Enhanced)
- `ip_type` ENUM('internal', 'external') - Distinguishes public vs private IPs
- `is_shared` BOOLEAN - Allows shared IP pools for multiple companies
- Company ownership and cluster association
- Used for both internal networks and external WAN interfaces

## Common Patterns

### API File Structure (Standard Pattern)
```php
<?php
// Output buffering to prevent warnings
ob_start();

require_once __DIR__ . '/path/to/config/config.php';
require_once __DIR__ . '/path/to/includes/Database.php';
require_once __DIR__ . '/path/to/includes/JWT.php';

ob_end_clean();

header('Content-Type: application/json');

try {
    // JWT Authentication
    $headers = getallheaders();
    $token = str_replace('Bearer ', '', $headers['Authorization'] ?? '');

    if (!$token) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'No token']);
        exit;
    }

    $payload = JWT::decode($token);
    if (!$payload || !isset($payload['sub'])) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'Invalid token']);
        exit;
    }

    $db = Database::getInstance();

    // ALWAYS fetch user data from database
    $user = $db->fetchOne("SELECT id, role, company_id FROM users WHERE id = ?", [$payload['sub']]);

    if (!$user) {
        http_response_code(401);
        echo json_encode(['success' => false, 'message' => 'User not found']);
        exit;
    }

    // Role-based logic
    if ($user['role'] === 'super_admin') {
        // Super admin logic
    } else {
        // Company-specific logic using $user['company_id']
    }

    // Response
    echo json_encode(['success' => true, 'data' => $data]);

} catch (Exception $e) {
    error_log("API Error: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Server error']);
}
```

### JavaScript Page Structure
```javascript
// Global variables
let allData = [];
let currentUser = null;

// Helper functions (fallbacks)
function showLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'flex';
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
}

function showAlert(message, type = 'success') {
    const alert = document.getElementById('alert');
    if (alert) {
        alert.textContent = message;
        alert.className = `alert alert-${type}`;
        alert.style.display = 'block';
        setTimeout(() => alert.style.display = 'none', 5000);
    }
}

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    if (typeof checkAuth === 'function') {
        currentUser = checkAuth();
    }

    loadData();

    // Event listeners
    document.getElementById('some-btn').addEventListener('click', handleClick);
});

// Async data loading
async function loadData() {
    try {
        showLoading();
        const response = await apiRequest('/endpoint/list.php');
        allData = response.data || [];
        displayData();
    } catch (error) {
        showAlert('Error: ' + error.message, 'error');
    } finally {
        hideLoading();
    }
}
```

### HTML Page Structure
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Title - Proxmox Multi-Tenant</title>
    <link rel="stylesheet" href="css/variables.css">
    <link rel="stylesheet" href="css/modern.css">
    <link rel="stylesheet" href="css/layout-fix.css">
    <link rel="stylesheet" href="css/page-specific.css">
</head>
<body>
    <div class="loading-overlay" id="loading-overlay">
        <div class="spinner"></div>
    </div>

    <nav class="navbar">
        <div class="navbar-brand">
            <h1>Proxmox Multi-Tenant</h1>
        </div>
        <div class="navbar-menu">
            <span id="user-info" class="user-info"></span>
            <button id="logout-btn" class="btn btn-secondary">Logout</button>
        </div>
    </nav>

    <div class="page-layout">
        <aside class="sidebar">
            <ul class="menu">
                <li class="menu-item" data-page="overview">
                    <a href="index.php">
                        <span class="icon">📊</span>
                        <span class="menu-text">Overview</span>
                    </a>
                </li>
                <!-- More menu items with icons and menu-text spans -->
            </ul>
        </aside>

        <main class="main-content">
            <div id="alert" class="alert"></div>

            <div class="page-header">
                <h2>Page Title</h2>
                <button id="action-btn" class="btn btn-primary">Action</button>
            </div>

            <!-- Page content -->
        </main>
    </div>

    <script src="js/common.js"></script>
    <script src="js/page-specific.js"></script>
</body>
</html>
```

## Recent Fixes & Current State

### Fixed Issues (October 2025)

1. **JWT Token Structure Mismatch** (CRITICAL FIX)
   - Changed all APIs from `JWT::verify()` to `JWT::decode()`
   - Changed from direct payload access to database user lookup
   - Pattern: `$user = $db->fetchOne("SELECT id, role, company_id FROM users WHERE id = ?", [$payload['sub']])`
   - Affected: All API files (company, project, profile, permission, etc.)

2. **Profile Page JSON Errors**
   - Fixed file paths in profile APIs
   - Changed `new Database()` to `Database::getInstance()`
   - Added output buffering to prevent PHP warnings

3. **Project Editing JavaScript Errors**
   - Fixed inline onclick handlers with string escaping issues
   - Implemented ID-based lookups instead of passing strings
   - Added global `allProjects` array for safe lookups

4. **Companies Page Blank**
   - Fixed JWT authentication in all company APIs
   - Added null checks for missing DOM elements in companies.js
   - Removed event listeners for non-existent elements

5. **Network Page Loading Issues**
   - Fixed navigation structure (added icons and proper menu)
   - Added missing alert div
   - Fixed async/await issue with checkAuth()
   - Added fallback helper functions

6. **Cluster API Performance & Version Fetching** (November 2025)
   - **Problem**: Cluster list API was timing out when trying to fetch Proxmox versions from all clusters automatically
   - **Solution**: Made version fetching optional via `?include_version=true` parameter
   - **UI Enhancement**: Added "Fetch Version" button for on-demand version retrieval
   - **Caching**: Versions cached in memory (`versionCache` object) until page reload
   - **Filtering**: Added `cluster_id` parameter support for fetching single cluster data
   - **Result**: Fast cluster list loading without timeout issues

   **Implementation Details**:
   ```javascript
   // clusters.js - On-demand version fetching
   async function fetchClusterVersion(clusterId) {
       const response = await apiRequest(`/cluster/list.php?include_version=true&cluster_id=${clusterId}`);
       versionCache[clusterId] = response.data[0].proxmox_version;
       // Update display dynamically
   }
   ```

   **API Changes**:
   - `/api/cluster/list.php?include_version=true` - Fetches versions for all clusters
   - `/api/cluster/list.php?include_version=true&cluster_id=123` - Fetches version for specific cluster
   - Default behavior: Fast list without version checks

7. **Post-ESXi Import Critical Fixes** (November 25, 2025)
   - **Cluster API 500 Error**: Fixed database column name mismatch in cluster list API
     - Problem: SQL query referenced `c.password` but column is `c.password_encrypted`
     - Solution: Changed to `c.password_encrypted AS password` in both super_admin and company_admin queries
     - Affected pages: clusters.html, isos.html, esxi_import.html
     - Error log: `/var/log/apache2/proxmox-tenant-error.log` showed `SQLSTATE[42S22]: Column not found`

   - **Loading Spinner Stuck**: Fixed JavaScript ID mismatch causing persistent loading overlay
     - Problem: HTML uses `id="loading-overlay"` but common.js used `getElementById('loading')`
     - Solution: Updated `showLoading()` and `hideLoading()` functions in common.js to use correct ID
     - Impact: All pages with loading overlay now properly hide spinner after data loads

   - **Activity Page Menu Corruption**: Fixed HTML structure and added missing menu items
     - Problem: Corrupted inline HTML tags, missing Import & Discovery, ESXi Import, NAT Management
     - Solution: Rebuilt menu structure with proper `<li>` nesting and all current menu items

   - **Feedback Page Token Error**: Fixed localStorage token key name mismatch
     - Problem: feedback.js used `localStorage.getItem('jwt_token')` instead of `getItem('token')`
     - Solution: Changed to use correct `token` key name, updated redirect to `index.php`
     - Result: Feedback page now loads properly with valid authentication

   - **Index.php Navigation Menu**: Updated dashboard navigation to match current features
     - Added: Import & Discovery and ESXi Import menu items
     - Removed: Old "Backup & Replication" button from navigation
     - Status: Dashboard navigation now consistent with other pages

### Network Management System (NEW FEATURE)

**Status**: Fully implemented and deployed

**Components**:
- ✅ Database tables (ip_ranges, vm_ip_assignments, nat_rules)
- ✅ CRUD APIs for IP range management
- ✅ Frontend UI with filters
- ✅ VM creation integration with static IP assignment
- ✅ Proxmox API integration (ipconfig0, VLAN tagging)

**Proxmox Integration**:
```php
// VM network configuration sent to Proxmox
$vmConfig = [
    'name' => $vmName,
    'cores' => $cores,
    'memory' => $memory,
    'agent' => '1',  // Enable QEMU guest agent
    'net0' => 'virtio,bridge=vmbr0,tag=100',  // VLAN tagging
    'ipconfig0' => 'ip=10.0.1.100/24,gw=10.0.1.1'  // Static IP
];
```

**Requirements**:
- Cloud-init enabled VMs OR
- QEMU guest agent installed in guest OS

## Deployment Workflow

### File Upload via WinSCP
```powershell
# Create upload script
Set-Content -Path 'C:\Users\Usuario\winscp_script.txt' -Value @"
option batch abort
option confirm off
open scp://root:PASSWORD@192.168.142.236/ -hostkey="KEY"
put "local_file.php" /var/www/proxmox-multi-tenant/public/api/path/file.php
call chown www-data:www-data /var/www/proxmox-multi-tenant/public/api/path/file.php
call chmod 755 /var/www/proxmox-multi-tenant/public/api/path/file.php
exit
"@

# Execute upload
& "C:\Program Files (x86)\WinSCP\WinSCP.com" /script="C:\Users\Usuario\winscp_script.txt"
```

### Error Log Checking
```bash
# Check custom application error log (primary)
tail -50 /var/log/apache2/proxmox-tenant-error.log

# Check standard Apache error log (fallback)
tail -50 /var/log/apache2/error.log

# Search for specific errors
tail -200 /var/log/apache2/proxmox-tenant-error.log | grep -i "cluster\|fatal\|parse"
```

## Known Issues & Notes

### Important Notes

1. **Always use Database::getInstance()**, never `new Database()`

2. **API path calculation**:
   - `/api/company/*.php` → 3 levels up: `__DIR__ . '/../../../config/config.php'`
   - `/api/vm/projects/*.php` → 4 levels up: `__DIR__ . '/../../../../config/config.php'`
   - `/api/network/ip_range/*.php` → 4 levels up: `__DIR__ . '/../../../../config/config.php'`

3. **Navigation consistency**: All HTML pages must have identical navigation structure with icons

4. **JavaScript safety**: Always check for element existence before adding event listeners:
   ```javascript
   const btn = document.getElementById('some-btn');
   if (btn) {
       btn.addEventListener('click', handler);
   }
   ```

5. **Onclick handlers**: Avoid inline onclick with strings. Use ID-based lookups instead:
   ```javascript
   // BAD: onclick="editItem('${name.replace(/'/g, "\\'")}')"
   // GOOD: onclick="editItemById(${id})"
   ```

6. **Output buffering**: Always use in API files to prevent PHP warnings from breaking JSON:
   ```php
   ob_start();
   // require statements
   ob_end_clean();
   ```

7. **DOM Element ID Matching**: JavaScript `getElementById()` must exactly match HTML element ID attributes:
   ```javascript
   // HTML: <div id="loading-overlay">
   // JavaScript: document.getElementById('loading-overlay') ✓
   // JavaScript: document.getElementById('loading') ✗ (will return null)
   ```

8. **LocalStorage Key Consistency**: Always use `token` as the key name for JWT tokens:
   ```javascript
   // CORRECT: localStorage.getItem('token')
   // WRONG: localStorage.getItem('jwt_token')
   ```

9. **Apache Error Logs**: Check custom application log first for debugging:
   - Primary: `/var/log/apache2/proxmox-tenant-error.log`
   - Fallback: `/var/log/apache2/error.log`

### Current Limitations

1. **No DHCP Management**: VMs can use DHCP by not selecting an IP range
2. **No IP Conflict Detection**: Manual IP entry doesn't validate if IP is already in use
3. **No IPv6 Support**: Only IPv4 addresses supported
4. **No Subnet Calculator**: Users must manually calculate available IPs
5. **No Batch Operations**: Can't assign multiple IPs at once

## Testing Checklist

When making changes, test:

1. **Authentication**:
   - Login/logout functionality
   - Token expiration handling
   - Role-based menu filtering

2. **API Endpoints**:
   - All CRUD operations
   - Permission checks
   - Error handling

3. **JavaScript**:
   - Page load without errors
   - Form submissions
   - Modal operations
   - Data refresh after actions

4. **Cross-Browser**:
   - Chrome/Edge (primary)
   - Firefox
   - Safari (if applicable)

5. **Responsive Design**:
   - Desktop (1920x1080)
   - Tablet (768px)
   - Mobile (375px)

## Development Guidelines

1. **Consistency First**: Follow existing patterns exactly
2. **Database Singleton**: Always use `Database::getInstance()`
3. **JWT Pattern**: Always decode then fetch user from database
4. **Output Buffering**: Add to all API files
5. **Error Handling**: Always log errors and return JSON responses
6. **NULL Checks**: Check element existence before manipulation
7. **Escaping**: Use `escapeHtml()` for all user-generated content
8. **Success Messages**: Provide clear feedback for all actions

### 8. Activity Tracking System (NEW)
- Comprehensive activity logging for all system operations
- Real-time activity timeline view
- Filter activities by type, status, and time
- Automatic tracking of:
  - Authentication events (login, logout)
  - SSL certificate generation and status
  - Apache configuration changes
  - VM management operations
  - Company and user management
  - System-level changes
- Activity metadata storage in JSON format
- Role-based activity filtering (super_admin sees all, users see company-specific)
- Auto-refresh every 30 seconds
- Activity details with user, company, IP address, and user agent
- Status indicators: success, failed, in_progress, warning

### 9. SSL Certificate Management & Let's Encrypt (NEW)
- Automated Let's Encrypt certificate generation
- Manual SSL certificate upload support
- SSL status tracking (pending, generating, active, failed, expired)
- Automatic Apache virtual host generation with SSL
- HTTP to HTTPS redirection
- SSL error message tracking
- Certificate chain support
- Security headers (HSTS, X-Frame-Options, X-Content-Type-Options)
- Per-domain SSL configuration
- Certificate renewal tracking

#### SSL Certificate Scripts
1. **generate_letsencrypt_cert.php**: Generates Let's Encrypt certificates
   - Usage: `php generate_letsencrypt_cert.php <mapping_id>`
   - Validates domain and email
   - Uses certbot with webroot mode
   - Stores certificates in database
   - Updates SSL status in real-time
   - Logs all operations to activity log

2. **generate_apache_vhosts.php**: Generates Apache virtual host configurations
   - Creates HTTP and HTTPS virtual hosts
   - Writes SSL certificates to `/etc/apache2/ssl/`
   - Enables sites and reloads Apache
   - Logs configuration changes to activity log

### 10. URL Mapping & Branding
- Custom URL mapping for companies
- Per-company branding:
  - Custom logo upload
  - Custom color scheme (primary, secondary, accent)
  - Custom panel name
- SSL configuration per URL mapping
- Active/inactive status for mappings
- Apache virtual host automation

### 11. Single Sign-On (SSO) Integration (NEW)
Complete Microsoft Office 365 / Azure AD SSO integration at company level:

**Features:**
- Company-level SSO configuration
- Microsoft Azure AD / Office 365 authentication
- OAuth 2.0 / OpenID Connect protocol
- Automatic user provisioning on first login
- Email domain validation
- Role-based default permissions
- SSO login audit trail
- Test connection functionality

**User Experience:**
- "Sign in with Microsoft" button on login page (when SSO is configured)
- Seamless redirect to Microsoft login
- Automatic account creation for authorized users
- Standard login fallback always available

**Configuration Page:**
- Located at `/sso_config.html`
- Accessible by company_admin and super_admin roles
- Azure AD app configuration:
  - Application (Client) ID
  - Directory (Tenant) ID
  - Client Secret (encrypted storage)
  - Redirect URI (auto-generated)
  - OAuth scopes
- User provisioning settings:
  - Auto-provision toggle
  - Default role for new users
  - Email domain restrictions
- SSO login audit viewer
- Test connection button

**Security:**
- Client secrets encrypted in database (AES-256-CBC)
- JWT token generation after successful SSO
- OAuth state parameter validation
- Domain-based company matching
- IP address and user agent logging
- Failed login attempt tracking

**Components:**
- **API Endpoints**:
  - `/api/company/sso/list.php` - List SSO configurations
  - `/api/company/sso/update.php` - Create/update SSO config
  - `/api/company/sso/delete.php` - Delete SSO config
  - `/api/company/sso/test.php` - Test SSO connection
  - `/api/company/sso/audit.php` - SSO login audit logs
  - `/api/auth/sso/login.php` - Initiate SSO login
  - `/api/auth/sso/callback.php` - OAuth callback handler

- **Libraries**:
  - `MicrosoftOAuth.php` - OAuth 2.0 client for Microsoft Graph API
    - Authorization URL generation
    - Token exchange
    - Token refresh
    - User profile retrieval
    - ID token verification
    - Connection testing

- **Frontend**:
  - SSO button in login page (auto-shows when available)
  - SSO configuration management UI
  - Real-time SSO availability checking
  - Audit log viewer with filtering

**Database Schema:**
```sql
-- SSO Configuration Table (Migration 020)
CREATE TABLE company_sso_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    provider ENUM('microsoft', 'google', 'okta', 'generic') DEFAULT 'microsoft',
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(500) NOT NULL,  -- Encrypted
    tenant_id VARCHAR(255),
    authority_url VARCHAR(500),
    redirect_uri VARCHAR(500) NOT NULL,
    scopes VARCHAR(500) DEFAULT 'openid profile email User.Read',
    enabled TINYINT(1) DEFAULT 1,
    auto_provision TINYINT(1) DEFAULT 1,
    default_role ENUM('user', 'company_admin') DEFAULT 'user',
    require_domain_match TINYINT(1) DEFAULT 1,
    allowed_domains TEXT,  -- JSON array
    attribute_mapping JSON,
    settings JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    last_tested_at TIMESTAMP,
    last_test_status ENUM('success', 'failed', 'pending'),
    last_test_message TEXT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    UNIQUE KEY unique_company_provider (company_id, provider)
);

-- SSO Login Audit Table
CREATE TABLE sso_login_audit (
    id INT AUTO_INCREMENT PRIMARY KEY,
    company_id INT NOT NULL,
    sso_config_id INT NOT NULL,
    user_id INT,
    email VARCHAR(255) NOT NULL,
    provider ENUM('microsoft', 'google', 'okta', 'generic') NOT NULL,
    status ENUM('success', 'failed', 'blocked') NOT NULL,
    failure_reason TEXT,
    user_provisioned TINYINT(1) DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    oauth_subject VARCHAR(255),
    oauth_claims JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY (sso_config_id) REFERENCES company_sso_config(id) ON DELETE CASCADE
);

-- User SSO Tracking
ALTER TABLE users
ADD COLUMN sso_provider VARCHAR(50) DEFAULT NULL,
ADD COLUMN sso_subject VARCHAR(255) DEFAULT NULL,
ADD COLUMN sso_last_login TIMESTAMP DEFAULT NULL,
ADD INDEX idx_sso_subject (sso_provider, sso_subject);
```

**Setup Instructions for Company Admins:**
1. Register app in Azure Portal at portal.azure.com
2. Navigate to: Azure Active Directory > App registrations
3. Create new registration: "Proxmox Multi-Tenant SSO"
4. Add redirect URI from SSO config page
5. Create client secret in Certificates & secrets
6. Copy Application ID, Tenant ID, and Client Secret
7. Enter values in SSO Configuration page
8. Enable SSO and configure user provisioning
9. Test connection
10. Users can now login with "Sign in with Microsoft"

### 12. ESXi Import & Discovery (NEW - December 2025)
Complete VMware ESXi infrastructure import and migration system for multi-tenant environments:

**Features:**
- ESXi host management (CRUD operations)
- Encrypted credential storage for ESXi hosts
- VM discovery from ESXi infrastructure
- Automated VM import tracking
- Multi-step import wizard
- Company-level ESXi host isolation
- Connection testing and validation

**ESXi Host Management:**
- Add ESXi hosts with encrypted credentials
- Test connectivity to ESXi servers
- Discover virtual machines on ESXi hosts
- Track discovered VMs in dedicated table
- View discovered VM metadata (CPU, memory, disk, network)

**VM Discovery Process:**
1. Configure ESXi host connection details
2. Test connection to ESXi server
3. Discover VMs with full metadata extraction
4. Review discovered VMs with resource details
5. Select VMs for import to Proxmox
6. Configure target Proxmox cluster and node
7. Track import progress and status

**Import Wizard:**
- Two-tab interface: ESXi Hosts and Import Wizard
- Add/Edit host dialog with password visibility toggle
- Company selector for super_admin users
- Test connection button for validation
- Discover VMs workflow with progress tracking
- Multi-select discovered VMs for import
- Target Proxmox configuration (cluster, node, storage)

**Security:**
- AES-256-CBC encryption for ESXi passwords
- Password masking in UI (••••••••)
- Role-based access control (super_admin vs company_admin)
- Company isolation for ESXi hosts
- Encrypted storage of all credentials

**Components:**
- **Backend API** (`/api/esxi-hosts`):
  - `GET /` - List all ESXi hosts
  - `GET /:id` - Get single host details
  - `POST /` - Create new ESXi host
  - `PUT /:id` - Update ESXi host
  - `DELETE /:id` - Delete ESXi host
  - `POST /:id/test` - Test ESXi connection
  - `POST /:id/discover` - Discover VMs on host
  - `GET /:id/discovered-vms` - List discovered VMs
  - `POST /:id/import` - Import VMs to Proxmox

- **Frontend**:
  - ESXi Hosts management table
  - Add/Edit host dialog with validation
  - Password visibility toggle
  - Connection test button per host
  - VM discovery dialog
  - Discovered VMs viewer with multi-select
  - Import wizard with Proxmox target config
  - Status indicators (active, inactive, error)

**Database Schema:**
```sql
-- ESXi Hosts Table
CREATE TABLE esxi_hosts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INT DEFAULT 443,
    username VARCHAR(255) NOT NULL,
    password_encrypted TEXT NOT NULL,  -- AES-256-CBC encrypted
    company_id INT,
    status ENUM('active', 'inactive', 'error') DEFAULT 'active',
    last_tested TIMESTAMP NULL,
    last_test_message TEXT NULL,
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    created_by INT,
    FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
    INDEX idx_company (company_id),
    INDEX idx_status (status)
);

-- ESXi Discovered VMs Table
CREATE TABLE esxi_discovered_vms (
    id INT AUTO_INCREMENT PRIMARY KEY,
    esxi_host_id INT NOT NULL,
    vm_name VARCHAR(255) NOT NULL,
    vm_path VARCHAR(500),
    power_state VARCHAR(50),
    cpu_cores INT,
    memory_mb INT,
    disk_gb DECIMAL(10,2),
    guest_os VARCHAR(255),
    network_adapters TEXT,  -- JSON array
    disk_info TEXT,  -- JSON array
    metadata JSON,  -- Additional VM metadata
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (esxi_host_id) REFERENCES esxi_hosts(id) ON DELETE CASCADE,
    INDEX idx_esxi_host (esxi_host_id),
    INDEX idx_discovered_at (discovered_at)
);
```

**Technology Stack:**
- **Backend**: Node.js + TypeScript + Express
- **Frontend**: React + TypeScript + Material-UI
- **Encryption**: AES-256-CBC via EncryptionService utility
- **Authentication**: JWT with role-based permissions
- **Future Integration**: VMware vSphere API (placeholder for actual ESXi API calls)

**Current Status:**
- ✅ Full CRUD for ESXi host management
- ✅ Encrypted password storage and retrieval
- ✅ Frontend UI with Material-UI components
- ✅ Two-tab interface (Hosts + Import Wizard)
- ✅ Password masking and visibility toggle
- ✅ Multi-tenant company isolation
- ⏳ Pending: VMware vSphere API integration for actual VM discovery
- ⏳ Pending: VM conversion and import automation to Proxmox

**Access:**
- **URL**: http://192.168.142.237/esxi-import
- **Menu**: Infrastructure > ESXi Import
- **Permissions**: super_admin (all companies), company_admin (own company only)

### 13. Mobile Interface (NEW - December 2025)
Complete mobile-optimized interface with automatic device detection and responsive design for managing VMs and support tickets on mobile devices.

**Status:** ✅ FULLY DEPLOYED (Frontend)

#### Overview
This feature provides a mobile-first user experience for key platform functionality:
- Automatic mobile device detection and redirect
- Bottom navigation for mobile-friendly UX
- VM management with start/stop/shutdown/reboot controls
- Support ticket creation, viewing, and replying
- User profile and quick actions
- Responsive Material-UI components

#### Feature Components

**Mobile Pages:**
1. **MobileDashboard** (`/mobile`) - Overview with statistics and recent VMs
2. **MobileVMsPage** (`/mobile/vms`) - VM management with search and controls
3. **MobileSupportPage** (`/mobile/support`) - Ticket creation and messaging
4. **MobileProfilePage** (`/mobile/profile`) - User information and quick actions

**Mobile Detection:**
- User agent pattern matching (Android, iOS, iPad, etc.)
- Screen width detection (< 768px)
- Touch capability detection
- Force desktop mode option via localStorage

**Auto-Redirect:**
- Login page redirects to `/mobile` for mobile devices
- Desktop route protection via MobileRedirect component
- Prevents mobile users from accessing desktop sidebar interface

#### Mobile Dashboard Features
- Company and user information header
- Statistics cards (Total VMs, Open Tickets, Running VMs, Stopped VMs)
- Recent VMs list with quick start/stop controls
- Color-coded status indicators
- Refresh button for manual updates
- Bottom navigation (Dashboard, VMs, Support, Profile)

#### Mobile VMs Page Features
- Full VM list with search functionality
- VM status chips (running, stopped)
- Resource information (CPU, RAM, IP address)
- Action buttons per VM:
  - Start (when stopped)
  - Shutdown (graceful shutdown when running)
  - Stop (force stop when running)
  - Reboot (restart when running)
- Loading states for action buttons
- Automatic refresh after actions

#### Mobile Support Page Features
- Support ticket list with status and priority
- Create ticket floating action button (FAB)
- Full-screen create ticket dialog with:
  - Subject and description fields
  - Priority selector (low, medium, high, urgent)
  - Category selector (general, technical, billing, vm_issue, network)
- Full-screen ticket viewer with:
  - Original ticket description
  - Message timeline with user names and timestamps
  - Staff badge indicators
  - Reply text field with send button
- Real-time message updates after reply
- Color-coded priority and status chips

#### Mobile Profile Page Features
- User information card (username, email, role, company)
- Quick actions:
  - Go to Admin Dashboard (for admin roles)
  - Logout
- Company information display

#### Technical Implementation

**Frontend Files:**
- `/var/www/multpanelreact/frontend/src/pages/MobileDashboard.tsx` (300 lines)
- `/var/www/multpanelreact/frontend/src/pages/MobileVMsPage.tsx` (450 lines)
- `/var/www/multpanelreact/frontend/src/pages/MobileSupportPage.tsx` (520 lines)
- `/var/www/multpanelreact/frontend/src/pages/MobileProfilePage.tsx` (280 lines)
- `/var/www/multpanelreact/frontend/src/utils/isMobile.ts` (53 lines)
- `/var/www/multpanelreact/frontend/src/components/MobileRedirect.tsx` (25 lines)

**Routing:**
- `/var/www/multpanelreact/frontend/src/App.tsx` (Modified)
  - Added 4 mobile routes (all use ProtectedRoute)
  - Desktop routes wrapped with MobileRedirect component
- `/var/www/multpanelreact/frontend/src/pages/LoginPage.tsx` (Modified)
  - Added `getInitialRoute()` for device-based redirect after login

**API Integration:**
- VM Controls: `POST /api/vms/:id/control` with `{ action }` payload
  - Actions: start, stop, shutdown, reboot
  - Matches desktop implementation pattern
- Support Tickets:
  - `GET /api/support-tickets` - List all tickets
  - `GET /api/support-tickets/:id` - Get ticket with included messages
  - `POST /api/support-tickets` - Create new ticket
  - `POST /api/support-tickets/:id/messages` - Add reply message
- Dashboard Stats:
  - `GET /api/vms` - VM list with status
  - `GET /api/support-tickets` - Ticket counts

**Material-UI Components:**
- BottomNavigation - 4-section navigation bar
- Card, CardContent - Information containers
- Chip - Status and priority indicators
- Dialog - Full-screen create/view modals
- Fab - Floating action button for create ticket
- IconButton - Action buttons (start, stop, etc.)
- TextField - Input fields for forms
- CircularProgress - Loading indicators

#### Mobile Detection Algorithm
```typescript
export const isMobileDevice = (): boolean => {
  // 1. User Agent Check
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  const isMobileUA = mobileRegex.test(userAgent);

  // 2. Screen Width Check
  const isMobileScreen = window.innerWidth < 768;

  // 3. Touch Capability Check
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  // Return true if mobile UA OR (small screen AND touch)
  return isMobileUA || (isMobileScreen && isTouchDevice);
};
```

#### Bottom Navigation Structure
```typescript
<BottomNavigation value={navValue} onChange={(_, newValue) => {
  setNavValue(newValue);
  switch(newValue) {
    case 0: navigate('/mobile'); break;           // Dashboard
    case 1: navigate('/mobile/vms'); break;       // VMs
    case 2: navigate('/mobile/support'); break;   // Support
    case 3: navigate('/mobile/profile'); break;   // Profile
  }
}}>
  <BottomNavigationAction label="Dashboard" icon={<DashboardIcon />} />
  <BottomNavigationAction label="VMs" icon={<ComputerIcon />} />
  <BottomNavigationAction label="Support" icon={<SupportIcon />} />
  <BottomNavigationAction label="Profile" icon={<PersonIcon />} />
</BottomNavigation>
```

#### Force Desktop Mode
Users can force desktop mode from mobile devices:
```typescript
// Enable desktop mode
localStorage.setItem('forceDesktopMode', 'true');

// Check if desktop mode is forced
export const isDesktopModeForced = (): boolean => {
  return localStorage.getItem('forceDesktopMode') === 'true';
};

// Disable desktop mode
localStorage.removeItem('forceDesktopMode');
```

#### Access Control
- All mobile pages use `ProtectedRoute` wrapper
- JWT authentication required (matches desktop)
- Role-based features (admin dashboard button only for admins)
- Company isolation maintained (users see only their data)

#### Deployment Details
- TypeScript compilation: ✅ 0 errors
- Frontend build: ✅ Success (1.6MB bundle)
- Deployed to: `/var/www/multpanelreact/frontend/dist/`
- Accessible at: https://192.168.142.237/mobile

#### Implementation Fixes

**Critical Fixes Applied:**
1. **VM Control API Mismatch** - Changed from `/vms/:id/:action` to `/vms/:id/control` with payload
2. **Ticket Messages Loading** - Changed from `/support-tickets/:id/messages` to getting messages from `/support-tickets/:id` response
3. **TypeScript Unused Imports** - Removed unused Material-UI imports
4. **Event Parameter Naming** - Prefixed unused event parameters with underscore

**Important Notes:**
1. Mobile pages use exact same API endpoints as desktop (no separate mobile API)
2. VM control implementation must match desktop pattern: `POST /vms/:id/control` with `{ action }` body
3. Support ticket messages are included in ticket response via Prisma `include` directive
4. Bottom navigation is fixed at bottom of screen (position: fixed)
5. Full-screen dialogs used for create/view operations (better mobile UX)

#### Future Enhancements

**Planned:**
- [ ] VM creation from mobile interface
- [ ] Project management
- [ ] Settings and preferences
- [ ] Push notifications for ticket replies
- [ ] Offline mode with sync
- [ ] Biometric authentication
- [ ] VM performance graphs
- [ ] Dark mode toggle

**Nice to Have:**
- [ ] Swipe gestures for navigation
- [ ] Pull-to-refresh on lists
- [ ] VM console access
- [ ] File uploads for tickets
- [ ] Image attachments
- [ ] Voice-to-text for ticket creation

#### Testing Checklist

**Tested:**
- [x] Mobile device detection works
- [x] Auto-redirect from login to /mobile
- [x] Desktop route protection (redirect to /mobile)
- [x] VM start/stop/shutdown/reboot controls
- [x] Support ticket creation
- [x] Support ticket viewing
- [x] Support ticket replying
- [x] Bottom navigation works
- [x] User profile displays correctly
- [x] Admin dashboard link (for admins)

**Devices Tested:**
- [x] iPhone (iOS Safari)
- [x] Android phone (Chrome)
- [x] Tablet (iPad)
- [ ] Android tablet
- [ ] Desktop browser (force desktop mode)

---

**Deployment Completed:** December 18, 2025
**Developer:** Claude (Sonnet 4.5)
**Total Implementation Time:** ~2 hours
**Status:** Production-ready

### 14. SSH Key Management & Automation (NEW - December 2025)
Complete SSH key lifecycle management system with health monitoring, performance tracking, and bulk operations for multi-cluster environments.

**Status:** ✅ Backend DEPLOYED | ✅ Frontend DEPLOYED (Health Dashboard, NAT Performance) | ⏳ Frontend IN PROGRESS (Bulk Operations UI)

#### Overview
This feature set provides comprehensive SSH key management for Proxmox clusters, including:
- Automated SSH key generation and rotation
- Health monitoring with expiration tracking
- Performance analytics comparing SSH key vs password authentication
- Bulk operations for managing multiple clusters simultaneously

#### Feature 1: SSH Key Health Monitoring

**Purpose:** Track SSH key lifecycle, configuration status, and provide proactive health warnings.

**Backend Endpoints:**
- `GET /api/clusters/ssh-keys/health` - Get comprehensive health status
- `POST /api/clusters/ssh-keys/set-expiration` - Set key expiration date (90-365 days)
- `GET /api/clusters/ssh-keys/cluster-details` - Per-cluster SSH key status

**Frontend Integration:**
- **Location:** ClustersPage.tsx (SSH Key Health Monitoring card)
- **Access:** super_admin only
- **Auto-loads:** Health data loads automatically when page loads

**Health Dashboard Features:**
- Overall health status (Excellent/Good/Warning/Critical)
- Key age tracking with rotation count
- Expiration countdown with configurable expiration date
- Cluster coverage visualization (X/Y clusters configured)
- Warning alerts for keys > 90 days old or expiring < 30 days
- Real-time fingerprint display

**Health Status Algorithm:**
```typescript
if (daysUntilExpiration < 7 || keyAge > 180) → CRITICAL
if (daysUntilExpiration < 30 || keyAge > 90) → WARNING
if (configurationRate < 50%) → WARNING
if (configurationRate >= 80% && keyAge < 90) → EXCELLENT
else → GOOD
```

**Database Tables:**
- `ssh_keys` - SSH key lifecycle tracking (fingerprint, generated_at, expires_at, rotation_count, status)
- `ssh_key_cluster_status` - Per-cluster configuration status (is_configured, last_tested_at, auth_method_last_used, push_count)

**Automatic Tracking:**
Every SSH operation automatically updates cluster status:
- Connection tests update `last_tested_at`, `last_test_success`
- SSH key pushes update `is_configured`, increment `push_count`
- Auth method tracked (`ssh_key` vs `password`)

#### Feature 2: NAT Deployment Performance Tracking

**Purpose:** Demonstrate performance benefits of SSH keys vs password authentication for NAT deployments.

**Backend Endpoints:**
- `GET /api/nat/performance-stats` - Get comprehensive performance metrics
- Optional `?cluster_id=X` parameter for cluster-specific stats

**Frontend Integration:**
- **Location:** Standalone page at `/nat-performance`
- **Menu:** Network > NAT Performance (with SpeedIcon)
- **Access:** super_admin only

**Performance Metrics Page Features:**
- Overall deployment statistics (total, successful, failed, success rate)
- Auth method comparison cards:
  - SSH Key: average time, deployment count (green card)
  - Password: average time, deployment count (orange card)
- Performance improvement calculation (percentage faster)
- Time saved per deployment display
- Recent deployments timeline (last 7 days, up to 50 entries)
- Color-coded success/failure indicators

**Automatic Integration:**
Every NAT deployment automatically logs metrics to `nat_deployment_metrics` table:
```typescript
await trackNATDeploymentMetric({
  nat_rule_id: ruleId,
  cluster_id: clusterId,
  deployment_type: 'create',
  auth_method: result.authMethod === 'ssh-key' ? 'ssh_key' : 'password',
  deployment_duration_ms: Date.now() - startTime,
  success: result.success,
  error_message: result.success ? undefined : result.message,
  deployed_by: userId
});
```

**Database Table:**
- `nat_deployment_metrics` - Tracks every NAT deployment with auth method, duration, success/failure

**Integration Point:**
- Modified `natDeploymentService.ts` to call `trackNATDeploymentMetric()` after each deployment
- Automatically calls `trackSSHKeyUsage()` to update cluster status

#### Feature 3: Bulk Cluster Operations

**Purpose:** Perform operations on multiple Proxmox clusters simultaneously for efficiency.

**Backend Endpoints:**
- `POST /api/bulk-clusters/test-connection` - Test SSH connections to multiple clusters
- `POST /api/bulk-clusters/push-ssh-keys` - Push SSH keys to multiple clusters
- `GET /api/bulk-clusters/history` - View bulk operation logs

**Request Format:**
```json
{
  "cluster_ids": [1, 2, 3, 4]
}
```

**Response Format:**
```json
{
  "success": true,
  "data": {
    "total": 4,
    "successful": 3,
    "failed": 1,
    "duration_seconds": 5,
    "results": [
      {
        "cluster_id": 1,
        "cluster_name": "Internal Lab",
        "success": true,
        "message": "Connection successful",
        "auth_method": "ssh-key",
        "exit_code": 0
      }
      // ... more results
    ]
  }
}
```

**Bulk Test Connection:**
- Executes `echo "Connection test successful"` on each cluster
- Uses `executeSSHCommandWithFallback()` (tries SSH key first, falls back to password)
- Runs tests in parallel using `Promise.allSettled()`
- Tracks authentication method used per cluster
- Automatically updates `ssh_key_cluster_status` table

**Bulk Push SSH Keys:**
- Fetches active SSH key from `ssh_keys` table
- Constructs command: `mkdir -p ~/.ssh && echo "<public_key>" >> ~/.ssh/authorized_keys && chmod 700 ~/.ssh && chmod 600 ~/.ssh/authorized_keys`
- Executes on each cluster in parallel
- Updates `ssh_key_cluster_status` with `is_configured = true`, increments `push_count`
- Automatically refreshes SSH Key Health Dashboard

**Operation Logging:**
All bulk operations logged to `bulk_cluster_operations` table:
```typescript
{
  operation_type: 'test_connection' | 'push_ssh_keys',
  cluster_ids: JSON.stringify([1, 2, 3]),
  total_clusters: 3,
  success_count: 2,
  failure_count: 1,
  results: JSON.stringify(detailedResults),
  duration_seconds: 5,
  initiated_by: userId,
  status: 'completed'
}
```

**Frontend Integration (Planned):**
- Checkbox column in clusters DataTable
- "Select All" checkbox in table header
- Bulk action buttons (Test Selected, Push SSH Keys to Selected)
- Progress dialog showing real-time status
- Results summary with success/failure counts
- Automatic refresh of cluster table and health dashboard

**Database Table:**
- `bulk_cluster_operations` - History of bulk operations with detailed results

#### Technical Implementation Details

**SSH Command Execution Pattern:**
```typescript
const result = await executeSSHCommandWithFallback(
  cluster.host,
  cluster.port || 22,
  cluster.username,
  cluster.password_encrypted,
  command
);

// Returns: { success, output, error, exitCode, authMethod }
// authMethod: 'ssh-key' | 'password'
```

**Tracking Integration:**
```typescript
export async function trackSSHKeyUsage(
  clusterId: number,
  authMethod: 'ssh_key' | 'password',
  success: boolean
): Promise<void> {
  // Creates or updates ssh_key_cluster_status record
  // Sets is_configured = true if SSH key succeeded
  // Updates last_tested_at, last_test_success, auth_method_last_used
}
```

**Key Differences: 'ssh-key' vs 'ssh_key'**
- `executeSSHCommandWithFallback()` returns `authMethod: 'ssh-key'` (hyphen)
- Database stores `auth_method_last_used` as `'ssh_key'` (underscore)
- Conversion required: `result.authMethod === 'ssh-key' ? 'ssh_key' : 'password'`

#### Backend Files

**Controllers:**
- `/var/www/multpanelreact/backend/src/controllers/sshKeyHealthController.ts` (148 lines)
  - `getSSHKeyHealth()`, `setSSHKeyExpiration()`, `getSSHKeyClusterDetails()`
  - `trackSSHKeyUsage()` - Helper function called by all SSH operations
- `/var/www/multpanelreact/backend/src/controllers/bulkClusterController.ts` (309 lines)
  - `bulkTestConnection()`, `bulkPushSSHKeys()`, `getBulkOperationHistory()`

**Utilities:**
- `/var/www/multpanelreact/backend/src/utils/natMetricsHelper.ts` (120 lines)
  - `trackNATDeploymentMetric()` - Logs metrics and calls trackSSHKeyUsage()
  - `getNATPerformanceStats()` - Calculate performance statistics

**Routes:**
- `/var/www/multpanelreact/backend/src/routes/clustersRoutes.ts` (Modified)
  - Added 3 SSH key health routes
- `/var/www/multpanelreact/backend/src/routes/natRoutes.ts` (Modified)
  - Added performance-stats route
- `/var/www/multpanelreact/backend/src/routes/bulkClusterRoutes.ts` (NEW - 15 lines)
  - Bulk operations routes

**Service Integration:**
- `/var/www/multpanelreact/backend/src/services/natDeploymentService.ts` (Modified)
  - Added `trackNATDeploymentMetric()` call after deployments
  - Added `authMethod` to DeploymentResult interface

#### Frontend Files

**Pages:**
- `/var/www/multpanelreact/frontend/src/pages/ClustersPage.tsx` (Modified - +146 lines)
  - SSH Key Health Monitoring Dashboard card
  - Set Expiration dialog
  - Auto-loading via useEffect watching currentUser
- `/var/www/multpanelreact/frontend/src/pages/NATPerformancePage.tsx` (NEW - 210 lines)
  - Standalone performance metrics page

**Routing:**
- `/var/www/multpanelreact/frontend/src/App.tsx` (Modified)
  - Added route: `/nat-performance`
- `/var/www/multpanelreact/frontend/src/components/layout/MainLayout.tsx` (Modified)
  - Added menu item: Network > NAT Performance (with SpeedIcon)

#### Database Schema

**ssh_keys Table:**
```sql
CREATE TABLE ssh_keys (
  id INT AUTO_INCREMENT PRIMARY KEY,
  key_type VARCHAR(50) NOT NULL DEFAULT 'rsa',
  key_size INT NOT NULL DEFAULT 4096,
  public_key TEXT NOT NULL,
  fingerprint VARCHAR(255) NOT NULL UNIQUE,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  last_rotated_at TIMESTAMP NULL,
  last_used_at TIMESTAMP NULL,
  rotation_count INT DEFAULT 0,
  status ENUM('active', 'expired', 'revoked') DEFAULT 'active',
  created_by INT,
  notes TEXT
);
```

**ssh_key_cluster_status Table:**
```sql
CREATE TABLE ssh_key_cluster_status (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ssh_key_id INT NOT NULL,
  cluster_id INT NOT NULL,
  is_configured BOOLEAN DEFAULT FALSE,
  last_tested_at TIMESTAMP NULL,
  last_test_success BOOLEAN NULL,
  last_push_at TIMESTAMP NULL,
  push_count INT DEFAULT 0,
  auth_method_last_used ENUM('ssh_key', 'password', 'unknown') DEFAULT 'unknown',
  last_auth_at TIMESTAMP NULL,
  UNIQUE KEY ssh_key_id_cluster_id (ssh_key_id, cluster_id),
  FOREIGN KEY (ssh_key_id) REFERENCES ssh_keys(id) ON DELETE CASCADE,
  FOREIGN KEY (cluster_id) REFERENCES proxmox_clusters(id) ON DELETE CASCADE
);
```

**nat_deployment_metrics Table:**
```sql
CREATE TABLE nat_deployment_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nat_rule_id INT NULL,
  cluster_id INT NOT NULL,
  deployment_type VARCHAR(50) NOT NULL,
  auth_method ENUM('ssh_key', 'password') NOT NULL,
  deployment_duration_ms INT NOT NULL,
  success BOOLEAN NOT NULL,
  error_message TEXT NULL,
  commands_executed INT DEFAULT 1,
  deployed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deployed_by INT NULL,
  FOREIGN KEY (cluster_id) REFERENCES proxmox_clusters(id) ON DELETE CASCADE,
  INDEX idx_cluster_auth (cluster_id, auth_method),
  INDEX idx_deployed_at (deployed_at)
);
```

**bulk_cluster_operations Table:**
```sql
CREATE TABLE bulk_cluster_operations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operation_type ENUM('test_connection', 'push_ssh_keys', 'rotate_keys') NOT NULL,
  cluster_ids JSON NOT NULL,
  total_clusters INT NOT NULL,
  success_count INT DEFAULT 0,
  failure_count INT DEFAULT 0,
  results JSON NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  duration_seconds INT NULL,
  initiated_by INT NOT NULL,
  status ENUM('pending', 'running', 'completed', 'failed') DEFAULT 'pending',
  INDEX idx_initiated_by (initiated_by),
  INDEX idx_status (status)
);
```

#### Deployment Status

**Backend:** ✅ FULLY DEPLOYED
- TypeScript compilation: 0 errors
- PM2 process: multpanel-api (PID 207240, status: online)
- All endpoints functional and tested

**Frontend:** ✅ PARTIALLY DEPLOYED
- SSH Key Health Dashboard: ✅ DEPLOYED (auto-loads on page load)
- NAT Performance Page: ✅ DEPLOYED (accessible at /nat-performance)
- Bulk Operations UI: ⏳ IN PROGRESS (backend ready, UI pending)

**Database:** ✅ DEPLOYED
- All 4 tables created via migration
- Prisma schema synced (npx prisma db pull && npx prisma generate)
- Enum values standardized ('ssh_key' not 'ssh-key')

#### Access Control

**SSH Key Health Dashboard:**
- Role: super_admin only
- Location: Clusters page (top card)
- Server-side: Checked in getSSHKeyHealth controller
- Client-side: Conditional rendering based on currentUser.role

**NAT Performance Page:**
- Role: super_admin only
- Location: /nat-performance (Network menu)
- Server-side: Checked in getNATPerformanceStatsController
- Client-side: Access denied message for non-admins

**Bulk Operations:**
- Role: super_admin only (will be enforced in UI)
- Backend: Validates req.user?.id exists (returns 401 if not authenticated)

#### Testing Checklist

**Backend:**
- [x] TypeScript compilation succeeds
- [x] PM2 process restarted
- [x] SSH key health endpoint responds
- [x] NAT performance stats endpoint responds
- [x] Bulk operations endpoints respond
- [x] Database logging works
- [ ] End-to-end bulk operations test
- [ ] Verify health dashboard updates after bulk push

**Frontend:**
- [x] Health dashboard displays correctly
- [x] Health data auto-loads on page load
- [x] Set expiration dialog works
- [x] NAT performance page loads
- [x] Performance stats display correctly
- [ ] Bulk operations UI implemented
- [ ] Checkbox selection works
- [ ] Bulk action buttons trigger operations
- [ ] Progress dialog shows results

#### Performance Impact

**Database Queries:**
- Health endpoint: 4 queries (ssh_keys, ssh_key_cluster_status, cluster count, status join)
- NAT performance: 5 queries (counts, aggregates, recent deployments)
- Bulk operations: N+1 queries (1 for clusters, N for SSH operations)

**Caching:**
- Frontend: No backend caching (real-time data)
- Health dashboard: Manual refresh button available
- NAT performance: Auto-refresh not implemented (manual page load)

**Automatic Tracking Overhead:**
- Each NAT deployment adds ~50ms for metric logging
- Each SSH operation adds ~30ms for status tracking
- Negligible impact on overall deployment time

#### Future Enhancements

**Planned:**
- [ ] Bulk operations frontend UI completion
- [ ] SSH key rotation scheduler (automatic rotation every X days)
- [ ] Email notifications for expiring keys
- [ ] SSH key usage reports
- [ ] Cluster-specific SSH key assignment
- [ ] SSH key backup/export functionality

**Nice to Have:**
- [ ] Cluster health timeline graph
- [ ] Performance trend analysis
- [ ] Bulk operation scheduling
- [ ] Custom health thresholds
- [ ] Integration with monitoring systems

#### Related Documentation

- **Deployment Summary:** `SSH_FEATURES_DEPLOYMENT_SUMMARY.md`
- **Bulk Operations:** `BULK_OPERATIONS_DEPLOYMENT_SUMMARY.md`
- **Database Migration:** `ssh_keys_migration.sql`

#### Known Issues & Notes

**Critical Fixes Applied:**
1. **Enum Mismatch:** Database had 'ssh-key' (hyphen) but code used 'ssh_key' (underscore) - Fixed via ALTER TABLE
2. **is_configured Not Updating:** trackSSHKeyUsage wasn't updating configuration status - Fixed in line 131-140
3. **Auto-loading Issue:** Health data didn't load on page load - Fixed with useEffect watching currentUser
4. **NAT Tracking Not Integrated:** NAT deployments weren't calling tracking functions - Fixed in natDeploymentService.ts
5. **rotateSSHKeys Not Tracking:** Rotate function doesn't call trackSSHKeyUsage - Workaround: manual DB update

**Important Notes:**
1. Always convert `result.authMethod` from 'ssh-key' to 'ssh_key' before storing in database
2. trackSSHKeyUsage() is the central tracking function - called by all SSH operations
3. Health dashboard auto-loads via useEffect, not in loadClusters()
4. Bulk operations require authenticated user (userId is required field)

---

**Deployment Completed:** December 12, 2025
**Developer:** Claude (Sonnet 4.5)
**Total Implementation Time:** ~3 hours
**Status:** Production-ready (pending bulk operations UI)

### 15. Backup Automation System (NEW - December 2025)
Complete automated backup execution system with scheduled backups, email notifications, and retention management for Proxmox VMs.

**Status:** ✅ FULLY DEPLOYED

#### Overview
This feature provides automated backup execution for Proxmox VMs with:
- Scheduled backup execution via cron job (every 5 minutes)
- Proxmox vzdump integration for VM backups
- Email notifications for success/failure
- Configurable retention policies (by days or count)
- Automatic next-run calculation
- Backup history tracking
- Support for multiple backup modes (snapshot, suspend, stop)

#### Architecture

**Backup Execution Flow:**
1. Cron job runs every 5 minutes (`*/5 * * * *`)
2. Query `backup_schedules` table for enabled schedules where `next_run <= NOW()`
3. For each due schedule:
   - Authenticate with Proxmox cluster (get ticket + CSRF token)
   - Create `backup_history` record with status='running'
   - Execute vzdump task via Proxmox API
   - Poll task status every 5 seconds (max 5 minutes)
   - Update `backup_history` with completion status
   - Send email notification (if configured)
   - Clean up old backups based on retention policy
   - Calculate and update `next_run` timestamp
4. Update schedule's `last_run`, `last_status`, `last_error` fields

**Components:**
- `backupExecutorCron.ts` - Cron job entry point
- `backupExecutorService.ts` - Business logic service
- `/var/log/backup-executor.log` - Execution logs

#### Schedule Types

**Once (one-time backup):**
- Executes immediately when next_run passes
- Sets next_run to 2099-12-31 (disabled)

**Hourly:**
- Executes every hour on the hour
- next_run = current time + 1 hour

**Daily:**
- Executes at specified time (HH:MM format in schedule_time)
- Example: schedule_time = "02:00" → runs at 2:00 AM daily
- next_run = next occurrence of that time

**Weekly:**
- Executes on specified day of week (0-6, Sunday-Saturday in schedule_time)
- Example: schedule_time = "1" → runs every Monday
- next_run = next occurrence of that day

**Monthly:**
- Executes on specified day of month (1-31 in schedule_time)
- Example: schedule_time = "15" → runs on 15th of each month
- next_run = next occurrence of that date

#### Backup Modes

**Snapshot (default):**
- Creates VM snapshot during backup
- VM continues running
- Fastest backup mode
- Requires QEMU agent installed

**Suspend:**
- Suspends VM during backup
- VM is paused briefly
- Consistent backup guaranteed
- Minimal downtime

**Stop:**
- Stops VM completely during backup
- Maximum consistency
- Requires VM shutdown
- Most disruptive but safest

#### Retention Policies

**By Days (retention_days):**
- Keeps backups for specified number of days
- Example: retention_days = 7 → keeps last 7 days of backups
- Deletes backups older than cutoff date
- Cleanup runs after each successful backup

**By Count (retention_count):**
- Keeps specified number of most recent backups
- Example: retention_count = 5 → keeps latest 5 backups
- Deletes older backups beyond count
- Useful for limiting storage usage

#### Email Notifications

**Configuration:**
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@proxmox-panel.local
```

**Notification Settings:**
- `notify_on_success` - Send email when backup completes successfully
- `notify_on_failure` - Send email when backup fails
- `notification_email` - Recipient email address

**Email Content:**
- Backup schedule name
- VM name and VMID
- Cluster and company name
- Start time and duration
- Status (Success/Failed)
- Error message (if failed)
- Backup size (if available)

#### Database Schema

**backup_schedules Table:**
```sql
CREATE TABLE backup_schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  company_id INT NOT NULL,
  vm_id INT,
  cluster_id INT,
  schedule_type ENUM('once', 'hourly', 'daily', 'weekly', 'monthly') NOT NULL,
  schedule_time VARCHAR(50),  -- HH:MM for daily, 0-6 for weekly, 1-31 for monthly
  schedule_cron VARCHAR(100),  -- Custom cron expression (future use)
  enabled BOOLEAN DEFAULT TRUE,
  retention_days INT DEFAULT 7,
  retention_count INT,
  compression ENUM('none', 'lzo', 'gzip', 'zstd') DEFAULT 'zstd',
  mode ENUM('snapshot', 'suspend', 'stop') DEFAULT 'snapshot',
  storage_location VARCHAR(200),
  include_ram BOOLEAN DEFAULT FALSE,
  notification_email VARCHAR(255),
  notify_on_success BOOLEAN DEFAULT FALSE,
  notify_on_failure BOOLEAN DEFAULT TRUE,
  next_run TIMESTAMP,
  last_run TIMESTAMP,
  last_status ENUM('pending', 'success', 'failed') DEFAULT 'pending',
  last_error TEXT,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (vm_id) REFERENCES virtual_machines(id) ON DELETE CASCADE,
  FOREIGN KEY (cluster_id) REFERENCES proxmox_clusters(id),
  INDEX idx_next_run_enabled (next_run, enabled)
);
```

**backup_history Table:**
```sql
CREATE TABLE backup_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT,
  company_id INT NOT NULL,
  vm_id INT NOT NULL,
  vm_name VARCHAR(200) NOT NULL,
  cluster_id INT NOT NULL,
  node_name VARCHAR(100) NOT NULL,
  backup_type ENUM('scheduled', 'manual', 'policy') DEFAULT 'scheduled',
  backup_mode ENUM('snapshot', 'suspend', 'stop') NOT NULL,
  backup_file VARCHAR(500),
  backup_size_bytes BIGINT,
  compression ENUM('none', 'lzo', 'gzip', 'zstd'),
  status ENUM('running', 'completed', 'failed', 'expired') DEFAULT 'running',
  error_message TEXT,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration_seconds INT,
  verified_at TIMESTAMP,
  verification_status ENUM('pending', 'passed', 'failed') DEFAULT 'pending',
  expires_at TIMESTAMP,
  deleted_at TIMESTAMP,
  initiated_by INT,
  notes TEXT,
  FOREIGN KEY (schedule_id) REFERENCES backup_schedules(id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_schedule_status (schedule_id, status),
  INDEX idx_started_at (started_at)
);
```

#### Frontend Pages

**Backup Schedules Page** (`/backup-schedules`):
- List all backup schedules with filters
- Create/edit/delete schedules
- Enable/disable schedules
- View next run time and last status
- Manual backup execution (trigger now)

**Backup History Page** (via Backup Schedules):
- View backup execution history
- Filter by VM, status, date range
- Download backup files
- Verify backup integrity
- Delete expired backups

**Snapshot Schedules Page** (`/snapshot-schedules`):
- Manage VM snapshots (separate from backups)
- Scheduled snapshot creation
- Snapshot retention policies

**Backup Policies Page** (`/backup-policies`):
- Company-wide backup policies
- Default retention settings
- Storage location policies
- Compliance tracking

#### Cron Job Installation

**Crontab Entry:**
```bash
*/5 * * * * /usr/bin/node /var/www/multpanelreact/backend/dist/scripts/backupExecutorCron.js >> /var/log/backup-executor.log 2>&1
```

**Log File:**
```bash
/var/log/backup-executor.log
```

**Permissions:**
```bash
-rw-r--r-- 1 www-data www-data /var/log/backup-executor.log
```

#### Monitoring & Troubleshooting

**Check Cron Status:**
```bash
# View crontab
crontab -l

# Check recent executions
tail -50 /var/log/backup-executor.log

# Check for errors
grep -i error /var/log/backup-executor.log

# Test manual execution
/usr/bin/node /var/www/multpanelreact/backend/dist/scripts/backupExecutorCron.js
```

**Common Issues:**

**No backups running:**
- Check if schedules are enabled: `SELECT * FROM backup_schedules WHERE enabled=1`
- Verify next_run is in the past: `SELECT id, name, next_run FROM backup_schedules WHERE next_run <= NOW()`
- Check cron job is installed: `crontab -l | grep backup`

**Email notifications not working:**
- Verify SMTP environment variables in .env file
- Test SMTP connection manually
- Check email logs: `grep -i smtp /var/log/backup-executor.log`
- For Gmail: Enable "Less secure app access" or use App Password

**Backups failing:**
- Check Proxmox cluster connectivity
- Verify VM exists and is accessible
- Check storage location has enough space
- Review error message in backup_history.error_message
- Check Proxmox task logs: `/var/log/pve/tasks/`

**Retention cleanup not working:**
- Verify retention_days or retention_count is set
- Check if cleanup function is called (log shows "Cleanup old backups")
- Manually verify backup_history records for schedule_id

#### Performance Considerations

**Cron Frequency:**
- Default: Every 5 minutes (*/5)
- Tradeoff: Faster execution vs. system load
- Can be adjusted: */1 (every minute), */15 (every 15 minutes)

**Backup Polling:**
- Max 5 minutes of polling (60 attempts * 5 seconds)
- Prevents infinite loops for stuck tasks
- Task considered failed if still running after 5 minutes

**Database Impact:**
- Each execution queries backup_schedules once
- Creates 1 backup_history record per backup
- Updates 2 rows (schedule + history) per backup
- Deletes old backups based on retention policy

**Storage Management:**
- Proxmox stores backups in configured storage_location
- Default: 'local' storage
- Monitor storage usage: `pvesm status`
- Consider NFS/CIFS for centralized backup storage

#### Security Considerations

**Credentials:**
- Proxmox passwords encrypted in database (XOR with ENCRYPTION_KEY)
- SMTP passwords stored in .env file (should use app passwords, not main password)
- Cron runs as root (has access to all system resources)

**Access Control:**
- Backup schedules are company-scoped
- Only company_admin and super_admin can create schedules
- Users can only view backups for their own company's VMs

**Backup File Access:**
- Backup files stored on Proxmox nodes
- Access controlled by Proxmox permissions
- Consider encryption for sensitive VM data
- Implement backup verification for data integrity

#### Testing Checklist

**Backend:**
- [x] TypeScript compilation succeeds
- [x] Cron script executes without errors
- [x] Service finds due schedules correctly
- [x] Proxmox authentication works
- [x] Vzdump task execution works
- [x] Task status polling works
- [x] Email notifications sent successfully
- [x] Retention cleanup functions
- [x] Next run calculation accurate

**Frontend:**
- [x] Backup schedules page loads
- [x] Create schedule form works
- [x] Edit schedule updates correctly
- [x] Delete schedule removes from database
- [x] Enable/disable toggle works
- [x] Backup history displays
- [ ] Manual backup execution (future feature)

#### API Endpoints

**Backup Schedules:**
- `GET /api/backup-schedules` - List all schedules (filtered by company)
- `GET /api/backup-schedules/:id` - Get single schedule
- `POST /api/backup-schedules` - Create new schedule
- `PUT /api/backup-schedules/:id` - Update schedule
- `DELETE /api/backup-schedules/:id` - Delete schedule
- `POST /api/backup-schedules/:id/execute` - Trigger manual backup (future)

**Backup History:**
- `GET /api/backup-history` - List backup history (filtered by company)
- `GET /api/backup-history/:id` - Get backup details
- `DELETE /api/backup-history/:id` - Delete backup record

**Snapshot Schedules:**
- `GET /api/snapshot-schedules` - List snapshot schedules
- `POST /api/snapshot-schedules` - Create snapshot schedule
- (Full CRUD endpoints available)

**Backup Policies:**
- `GET /api/backup-policies` - List company policies
- `POST /api/backup-policies` - Create policy
- (Full CRUD endpoints available)

#### Future Enhancements

**Planned:**
- [ ] Manual backup execution (trigger now button)
- [ ] Backup verification automation
- [ ] Restore functionality from UI
- [ ] Incremental backups support
- [ ] Multi-VM backup groups
- [ ] Backup job queuing system
- [ ] Backup bandwidth throttling
- [ ] Backup window restrictions
- [ ] Advanced scheduling (cron expressions)
- [ ] Backup encryption at rest
- [ ] Off-site backup replication
- [ ] Backup compliance reports
- [ ] Slack/Teams notifications
- [ ] Webhook integration for backup events

**Nice to Have:**
- [ ] Backup size estimation before execution
- [ ] Storage capacity planning
- [ ] Backup deduplication
- [ ] Compression ratio analytics
- [ ] Backup chain management
- [ ] VM-level backup exclusions
- [ ] Pre/post-backup scripts
- [ ] Backup performance metrics dashboard

---

**Deployment Completed:** December 19, 2025
**Developer:** Claude (Sonnet 4.5)
**Total Implementation Time:** ~3 hours
**Status:** Production-ready

## Database Schema Updates

### Activity Logs Table (Migration 011)
```sql
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    company_id INT NULL,
    activity_type VARCHAR(50) NOT NULL,  -- authentication, ssl_certificate, system, vm_management, etc.
    entity_type VARCHAR(50) NOT NULL,    -- user, vm, company, url_mapping, etc.
    entity_id INT NULL,
    action VARCHAR(50) NOT NULL,         -- login, logout, generate_certificate, etc.
    description TEXT NOT NULL,
    status ENUM('success', 'failed', 'in_progress', 'warning') DEFAULT 'success',
    metadata JSON NULL,                   -- Additional context data
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE company_url_mappings
ADD COLUMN ssl_status ENUM('pending', 'generating', 'active', 'failed', 'expired') DEFAULT 'pending',
ADD COLUMN ssl_last_checked TIMESTAMP NULL,
ADD COLUMN ssl_error_message TEXT NULL;
```

### ActivityLogger Class
Central logging utility for all system activities:
- `log($data)`: Generic activity logging
- `logLogin($userId, $success, $message)`: Login tracking
- `logLogout($userId)`: Logout tracking
- `logSSLGeneration($mappingId, $domain, $status, $message, $companyId)`: SSL cert tracking
- `logApacheConfig($status, $message, $companyId)`: Apache config tracking
- `logVMAction($vmId, $action, $status, $message, $companyId)`: VM operation tracking
- `logCompanyAction($companyId, $action, $status, $message)`: Company management tracking
- `logUserAction($userId, $action, $status, $message, $companyId)`: User management tracking
- `getRecentActivities($limit, $filters)`: Retrieve activities with filtering

## Future Enhancements

### Planned Features
- [ ] IP conflict detection
- [ ] Subnet calculator
- [ ] IPv6 support
- [ ] Batch IP assignment
- [ ] Network topology visualization
- [ ] DHCP server management
- [ ] DNS management
- [ ] Firewall rule management
- [ ] VPN configuration
- [ ] Backup and snapshot management
- [ ] Resource usage graphs
- [ ] Email notifications
- [ ] Audit log viewer
- [ ] API documentation page

### Technical Debt
- Migrate to TypeScript for better type safety
- Implement proper frontend routing
- Add unit tests for APIs
- Add integration tests
- Implement caching layer
- Optimize database queries
- Add request rate limiting
- Implement WebSocket for real-time updates

## Support & Troubleshooting

### Common Issues

**Page shows "coming soon"**:
- Check if correct HTML file is loaded
- Verify JavaScript has no syntax errors
- Check browser console for errors

**API returns 401 Unauthorized**:
- Check JWT token in localStorage
- Verify token hasn't expired
- Check API file paths to config files
- Verify Database::getInstance() usage
- Ensure user fetch after JWT decode

**Page layout broken**:
- Verify all CSS files are loaded
- Check navigation structure matches other pages
- Ensure sidebar has proper icon structure

**JavaScript errors**:
- Check common.js is loaded before page-specific JS
- Verify all required functions exist
- Check for NULL element references

### Debug Mode

Add to config.php for debugging:
```php
define('APP_DEBUG', true);
error_reporting(E_ALL);
ini_set('display_errors', 1);
```

Remember to disable in production!

## Contact & Resources

- **Proxmox API Docs**: https://pve.proxmox.com/pve-docs/api-viewer/
- **Project Repository**: Local development only
- **Production Server**: 192.168.142.236

---

**Last Updated**: December 11, 2025
**Version**: 1.4.0
**Status**: Active Development

**Recent Additions:**
- ESXi Import & Discovery feature (v1.4.0)
- Complete VMware ESXi host management
- VM discovery and import tracking
- AES-256-CBC encrypted credential storage

## Recent Updates (November 24, 2025)

### Cluster Management Performance Improvements
- **Fixed cluster list API timeout issues** when attempting to fetch Proxmox versions from all clusters
- **Implemented on-demand version fetching**: Added "Fetch Version" button for each cluster
- **Version caching**: Fetched versions stored in memory until page reload
- **API optimization**: Version fetching now optional via `?include_version=true` parameter
- **Cluster filtering**: Added `cluster_id` parameter support for single-cluster queries
- **Result**: Fast, reliable cluster list loading without timeout errors

### Technical Details
- Modified `/api/cluster/list.php` to make version fetching opt-in
- Added `versionCache` object in `clusters.js` for client-side caching
- Implemented dynamic UI updates when version is fetched
- Each cluster can fetch its version independently without affecting others

### JWT Authentication Fix
- **Fixed cluster list API authentication** to use correct JWT pattern
- Changed from `JWT::verify()` to `JWT::decode()` + database user fetch
- Ensures consistency with all other API endpoints
- Proper role-based access control for cluster management

## Recent Updates (November 25, 2025)

### Post-ESXi Import Critical Fixes
After the ESXi Import Wizard implementation, several critical issues were discovered and fixed:

1. **Cluster API 500 Internal Server Error**
   - **Problem**: Database column name mismatch - SQL queried `c.password` but column is named `password_encrypted`
   - **Error**: `SQLSTATE[42S22]: Column not found: 1054 Unknown column 'c.password' in 'SELECT'`
   - **Fix**: Changed both super_admin and company_admin queries to use `c.password_encrypted AS password`
   - **Affected Pages**: clusters.html, isos.html, esxi_import.html
   - **Log Location**: `/var/log/apache2/proxmox-tenant-error.log`

2. **Loading Spinner Stuck on All Pages**
   - **Problem**: JavaScript ID mismatch - HTML uses `id="loading-overlay"` but common.js used `getElementById('loading')`
   - **Symptom**: Persistent "looping" loading icon in top left corner that never disappears
   - **Fix**: Updated `showLoading()` and `hideLoading()` functions in common.js to use correct element ID
   - **Files Modified**: `C:\Users\Usuario\common_deployed.js` (lines 118, 125)
   - **Impact**: All pages now properly hide loading spinner after data loads

3. **Activity Page Menu Corruption**
   - **Problem**: Corrupted HTML tags merged onto single lines, missing menu items
   - **Missing Items**: Import & Discovery, ESXi Import, NAT Management
   - **Fix**: Rebuilt menu structure with proper `<li>` nesting and all current menu items
   - **File Modified**: activity.html

4. **Feedback Page Invalid Token Error**
   - **Problem**: Used wrong localStorage key `jwt_token` instead of `token`
   - **Error**: "Invalid token format" in Apache error log
   - **Fix**: Changed `localStorage.getItem('jwt_token')` to `localStorage.getItem('token')`
   - **Additional Fix**: Updated redirect from `login.html` to `index.php`
   - **File Modified**: feedback.js (line 347, 358)

5. **Index.php Navigation Menu Outdated**
   - **Problem**: Dashboard still showing old "Backup & Replication" button, missing new menu items
   - **Fix**: Added Import & Discovery and ESXi Import menu items, removed old button
   - **File Modified**: index.php
   - **Status**: Navigation now consistent across all pages

### Apache Error Log Configuration
- **Custom Application Log**: `/var/log/apache2/proxmox-tenant-error.log`
- **Standard Log**: `/var/log/apache2/error.log`
- Application-specific errors logged to custom file for easier debugging

### Browser Cache Issues
- Required full cache clear (Ctrl+Shift+Delete) to see fixes
- Apache restart needed after PHP file changes to clear opcache
- Hard refresh (Ctrl+F5) alone was insufficient for some fixes

## Recent Updates (December 11, 2025)

### ESXi Import & Discovery Feature Implementation
Complete ESXi import functionality deployed to production with full backend and frontend integration:

**Backend Deployment:**
- Created `esxiController.ts` with 9 controller functions for ESXi management
- Created `esxiRoutes.ts` with RESTful routing at `/api/esxi-hosts`
- Updated `backend/src/index.ts` to register ESXi routes
- Fixed TypeScript compilation errors with unused password variables
- Deployed to `/var/www/multpanelreact/backend/src/`
- PM2 restarted successfully (PID 123367)

**Frontend Deployment:**
- Created `ESXiPage.tsx` (850+ lines, 25KB) with Material-UI components
- Two-tab interface: ESXi Hosts and Import Wizard
- Updated `App.tsx` to add route at `/esxi-import`
- Updated `MainLayout.tsx` to add menu item under Infrastructure section
- Fixed TypeScript compilation errors with unused imports
- Built and deployed to `/var/www/multpanelreact/frontend/dist/`
- Build size: 1.6MB, compiled successfully

**Features Implemented:**
- ✅ Full CRUD operations for ESXi hosts
- ✅ AES-256-CBC password encryption/decryption
- ✅ Password masking (••••••••) with visibility toggle
- ✅ Multi-tenant company isolation
- ✅ Role-based permissions (super_admin, company_admin)
- ✅ Add/Edit host dialog with validation
- ✅ Test connection functionality (placeholder)
- ✅ VM discovery workflow (placeholder for VMware API)
- ✅ Discovered VMs viewer with multi-select
- ✅ Import wizard with Proxmox target configuration
- ✅ Status tracking (active, inactive, error)

**Database Tables:**
- `esxi_hosts` - ESXi server credentials and metadata
- `esxi_discovered_vms` - Discovered VM inventory with full specs

**API Endpoints:**
- `GET /api/esxi-hosts` - List hosts (filtered by company)
- `GET /api/esxi-hosts/:id` - Get single host
- `POST /api/esxi-hosts` - Create new host
- `PUT /api/esxi-hosts/:id` - Update host
- `DELETE /api/esxi-hosts/:id` - Delete host
- `POST /api/esxi-hosts/:id/test` - Test connection
- `POST /api/esxi-hosts/:id/discover` - Discover VMs
- `GET /api/esxi-hosts/:id/discovered-vms` - List discovered VMs
- `POST /api/esxi-hosts/:id/import` - Import VMs to Proxmox

**TypeScript Fixes:**
1. Backend: Changed unused `password` variables to `_password` with `@ts-ignore` comments
2. Frontend: Removed unused imports (Card, CardContent, VMIcon)

**Access:**
- URL: http://192.168.142.237/esxi-import
- Menu: Infrastructure > ESXi Import
- Visible to: super_admin (all companies), company_admin (own company)

**Status:** ✅ Fully deployed and operational (awaiting VMware vSphere API integration for actual VM discovery)

## Previous Updates (November 20, 2025)

### Import & Discovery Feature
- Implemented VM discovery API to scan Proxmox clusters
- Added bulk VM import with automatic metadata extraction (CPU, RAM, storage, IP)
- Created VM company reassignment functionality for super admins
- Built Import & Discovery UI page with real-time statistics
- Added duplicate prevention and template filtering
- Integrated with existing network sync functionality
- Fixed showNotification to showAlert function calls
- Fixed event parameter handling in discoverVMs function

### OPNsense Deployment Fixes
- Fixed cluster_id database error in deployment script
- Removed cluster_id filter from opnsense_templates query (templates are global)
- Added automatic IP configuration via SSH for template-based deployments
- Switched default template to Fast Deploy (Template ID 2)
- Added sshpass for automated configuration injection
- Added config_applied_at timestamp tracking
- Updated deployment to wait 60 seconds for VM boot before config injection

### Navigation Updates
- Added Import & Discovery menu item to all pages
- Menu positioned between Clusters and Users
- Restricted to super_admin role only
- Updated sidebar navigation across vms.html, companies.html, clusters.html, users.html, network.html, billing.html

### Git Repository
- Initialized git repository for the project
- Created initial commit with 479 files
- Set up .gitignore for sensitive files
- Configured git user and email

## Previous Updates (November 5, 2025)

### Activity Tracking System
- Implemented comprehensive activity logging system
- Created ActivityLogger class for centralized logging
- Added activity viewer page with real-time updates
- Implemented filtering by activity type, status, and entity
- Added automatic activity tracking to SSL certificate generation
- Added activity tracking to Apache configuration regeneration

### SSL Status Tracking
- Added SSL status column to URL mappings (pending, generating, active, failed, expired)
- Implemented SSL error message tracking
- Updated URL mappings UI to display SSL status badges
- Added visual indicators for SSL certificate state
- Integrated SSL status updates throughout certificate generation process

## Recent Updates (December 12, 2025)

### SSH Key Management & Automation Feature Suite
Implemented comprehensive SSH key lifecycle management system with three major features:

**Feature 1: SSH Key Health Monitoring** ✅ DEPLOYED
- Created SSH key health monitoring endpoints (health, set-expiration, cluster-details)
- Integrated health dashboard into ClustersPage.tsx
- Auto-loading health data on page load via useEffect watching currentUser
- Health status algorithm (Excellent/Good/Warning/Critical)
- Expiration date management (90-365 days)
- Cluster coverage visualization with progress bar
- Warning alerts for old keys (>90 days) or expiring keys (<30 days)

**Feature 2: NAT Deployment Performance Tracking** ✅ DEPLOYED
- Created standalone NAT Performance page at /nat-performance
- Performance metrics comparing SSH key vs password authentication
- Overall deployment statistics (total, successful, failed, success rate)
- Average deployment time tracking by auth method
- Performance improvement percentage calculation
- Recent deployments timeline (last 7 days)
- Automatic metric logging integrated into natDeploymentService.ts

**Feature 3: Bulk Cluster Operations** ✅ BACKEND DEPLOYED | ⏳ FRONTEND PENDING
- Backend endpoints for bulk test-connection and push-ssh-keys
- Parallel execution using Promise.allSettled()
- Bulk operation history logging to bulk_cluster_operations table
- Automatic SSH key status tracking integration
- Frontend UI components designed (checkboxes, bulk buttons, progress dialog)

**Database Tables Created:**
1. `ssh_keys` - SSH key lifecycle tracking (fingerprint UNIQUE, expires_at, rotation_count, status)
2. `ssh_key_cluster_status` - Per-cluster configuration status (is_configured, auth_method_last_used, push_count)
3. `nat_deployment_metrics` - NAT deployment performance tracking (auth_method, deployment_duration_ms, success)
4. `bulk_cluster_operations` - Bulk operation history (operation_type, cluster_ids JSON, results JSON, duration_seconds)

**Critical Fixes Applied:**
1. Database enum mismatch: Changed 'ssh-key' (hyphen) to 'ssh_key' (underscore) via ALTER TABLE
2. trackSSHKeyUsage() not updating is_configured field - Added conditional update logic
3. Health dashboard not auto-loading - Added useEffect watching currentUser changes
4. NAT tracking not integrated - Modified natDeploymentService.ts to call trackNATDeploymentMetric()
5. Rotate SSH keys not calling tracking - Workaround: manual database update

**Backend Files:**
- Created: `bulkClusterController.ts` (309 lines), `bulkClusterRoutes.ts` (15 lines)
- Created: `sshKeyHealthController.ts` (148 lines), `natMetricsHelper.ts` (120 lines)
- Modified: `clustersRoutes.ts`, `natRoutes.ts`, `natDeploymentService.ts`, `index.ts`

**Frontend Files:**
- Created: `NATPerformancePage.tsx` (210 lines)
- Modified: `ClustersPage.tsx` (+146 lines for health dashboard)
- Modified: `App.tsx` (added /nat-performance route), `MainLayout.tsx` (added NAT Performance menu item)

**Deployment Details:**
- Backend TypeScript compilation: ✅ 0 errors
- PM2 restart: ✅ Success (multpanel-api PID 207240, status: online)
- Frontend build: ✅ Success (1.6MB bundle, 468KB gzip)
- Database migration: ✅ Applied, Prisma synced

**Access Control:**
- All features restricted to super_admin role
- Server-side validation in controllers
- Client-side conditional rendering

**Implementation Time:** ~3 hours
**Status:** Production-ready (bulk operations UI pending completion)

---

**Last Updated**: December 21, 2025
**Version**: 1.7.0
**Status**: Active Development

**Recent Additions:**
- Mobile Interface (v1.6.0)
  - 4 mobile-optimized pages (Dashboard, VMs, Support, Profile)
  - Automatic device detection and redirect
  - Bottom navigation for mobile UX
  - VM management with full controls
  - Support ticket system with messaging
- SSH Key Management & Automation (v1.5.0)
  - SSH Key Health Monitoring Dashboard
  - NAT Deployment Performance Analytics
  - Bulk Cluster Operations (backend complete)


### 16. Background Jobs System (NEW - December 2025)
Complete asynchronous job processing system using BullMQ and Redis for long-running operations.

**Status:** ✅ FULLY DEPLOYED (Dev + Production)

#### Overview
Background job processing for operations that take too long for synchronous API responses:
- ISO scanning across Proxmox clusters
- Template discovery and cataloging
- ESXi VM imports to Proxmox
- VM discovery and bulk operations

#### Architecture

**Components:**
- **Redis Server** (v7.0.15) - Message queue backend
- **BullMQ** - Job queue management library
- **Worker Processes** - Separate PM2 process for job execution
- **Activity Logging** - Automatic tracking of all job lifecycle events

**Queue Types:**
1. **iso-scan** - Scan Proxmox storage for ISO files (3 concurrent workers)
2. **template-scan** - Discover VM templates across clusters (3 concurrent workers)
3. **esxi-import** - Import VMs from ESXi to Proxmox (2 concurrent workers)
4. **vm-discovery** - General VM discovery operations (2 concurrent workers)

#### Job Lifecycle

1. **Queued** - User triggers job, returns immediately
2. **Started** - Worker picks up job
3. **Processing** - Task executes with progress updates
4. **Completed** - Results saved to database
5. **Failed** - Error logged with details
6. **Cancelled** - User can cancel job

#### Database Tables

- **cluster_isos**: Stores discovered ISO files per cluster
- **cluster_templates**: Stores discovered VM templates

#### PM2 Configuration

Two processes run via ecosystem.config.js:
- **multpanel-api** - Main API server
- **job-workers** - Background job workers

#### Deployment

**Dev Server** (192.168.142.237): Port 5000
**Production Server** (98.142.209.206): Port 3001

Both servers have:
- ✅ Redis installed and running
- ✅ job-workers PM2 process active
- ✅ Activity logging integrated

**Deployment Completed:** December 21, 2025



## Deployment Automation

### Overview

Automated deployment scripts transfer code changes from dev server (192.168.142.237) to production server (98.142.209.206).

**Location:** `C:\Users\Usuario\`

### Deployment Scripts

**1. deploy_to_production.ps1** (PowerShell - Windows)
**2. deploy_to_production.sh** (Bash - Linux/WSL)
**3. DEPLOYMENT_GUIDE.md** (Complete documentation)

### Deployment Modes

#### Quick Mode (Default) - 30 seconds
```powershell
.\deploy_to_production.ps1
```
**Deploys:**
- Controllers (clusterScanController, jobsController)
- Utilities (activityLogger)

**Use when:** Modified API endpoints or utilities

#### Full Mode - 2-3 minutes
```powershell
.\deploy_to_production.ps1 -Mode full
```
**Deploys:**
- All controllers and workers
- Configuration files
- Database schema
- NPM dependencies

**Use when:** New features, dependencies, or schema changes

#### Workers Only - 45 seconds
```powershell
.\deploy_to_production.ps1 -Mode workers-only
```
**Deploys:**
- Worker files only

**Use when:** Modified background job logic

### Deployment Process

The script automatically:
1. Transfers files from dev to production via SCP
2. Regenerates Prisma client (full mode)
3. Installs NPM dependencies (full mode)
4. Builds TypeScript
5. Restarts PM2 processes
6. Verifies deployment

### Manual Deployment

If automation fails, deploy manually:

```bash
# 1. Transfer file
scp root@192.168.142.237:/path/to/file.ts C:/tmp/
scp C:/tmp/file.ts root@98.142.209.206:/path/to/file.ts

# 2. Build on production
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend
npm run build

# 3. Restart services
pm2 restart multpanel-api job-workers
```

### Monitoring After Deployment

```bash
# Check PM2 status
ssh root@98.142.209.206 'pm2 list'

# View logs
ssh root@98.142.209.206 'pm2 logs --lines 50'

# Check Redis
ssh root@98.142.209.206 'redis-cli ping'
```

### Rollback Procedure

If deployment causes issues:

```bash
ssh root@98.142.209.206
cd /var/www/multpanelreact/backend

# Restore from backup
tar -xzf /root/backups/backend_YYYYMMDD_HHMMSS.tar.gz

# Rebuild and restart
npm run build
pm2 restart all
```

### Best Practices

1. **Always test on dev first** before deploying to production
2. **Create backups** before major deployments
3. **Deploy during low traffic** periods
4. **Monitor logs** after deployment for errors
5. **Use version control** - commit changes before deploying

### Server Configuration Differences

| Setting | Dev (192.168.142.237) | Production (98.142.209.206) |
|---------|----------------------|----------------------------|
| Backend Port | 5000 | 3001 |
| Database | proxmox_tenant | proxmox_multitenant |
| Nginx Config | /etc/nginx/sites-enabled/multpanel | /etc/nginx/sites-enabled/proxmox-panel |
| Redis | localhost:6379 | localhost:6379 |

### Troubleshooting

**Build Fails:**
- Check TypeScript errors
- Verify dependencies installed: `npm install`
- Regenerate Prisma: `npx prisma generate`

**PM2 Won't Start:**
- Check logs: `pm2 logs --err`
- Delete and restart: `pm2 delete <name> && pm2 start ecosystem.config.js`

**Redis Connection Failed:**
- Start Redis: `systemctl start redis-server`
- Test connection: `redis-cli ping`

---

**Deployment System Created:** December 21, 2025
**Status:** Operational on both dev and production

- Background Jobs System (v1.7.0)
  - BullMQ + Redis integration
  - ISO and template scanning workers
  - ESXi import worker
  - Activity logging for all job operations
  - PM2 job-workers process
- Deployment Automation (v1.7.0)
  - Automated deployment scripts (PowerShell + Bash)
  - Three deployment modes (quick, full, workers-only)
  - Comprehensive deployment guide
  - Production deployment completed
