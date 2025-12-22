# Proxmox Multi-Tenant Platform v1.7.0

A comprehensive web-based management platform for Proxmox VE infrastructure with multi-tenant support, automated updates, and enterprise features.

## 🚀 Features

### Core Functionality
- **Multi-Tenant Management**: Complete isolation between companies/customers
- **VM Management**: Create, edit, delete, start/stop VMs with advanced configuration
- **Network Management**: IP range allocation, static IP assignment, VLAN support
- **Cluster Management**: Multiple Proxmox cluster support with SSH key automation
- **User Management**: Role-based access control (super_admin, company_admin, salesperson, user)
- **OPNsense Automation**: Automated firewall deployment with zero-touch configuration
- **ESXi Import**: Discover and import VMs from VMware ESXi infrastructure

### Advanced Features
- **Web-Based System Updates**: Update the platform from the GUI without SSH access
- **Automated Backups**: Schedule VM backups with retention policies
- **Activity Logging**: Comprehensive audit trail for all system operations
- **SSL Certificate Management**: Automated Let's Encrypt integration
- **Single Sign-On (SSO)**: Microsoft Azure AD / Office 365 integration
- **Background Jobs**: BullMQ + Redis for async task processing
- **API Access**: RESTful API with JWT authentication
- **Mobile Interface**: Responsive mobile-optimized UI
- **Support Ticketing**: Built-in support ticket system

### Security & Performance
- **SSH Key Authentication**: Automated SSH key deployment and rotation
- **Encrypted Credentials**: AES-256-CBC encryption for sensitive data
- **Rate Limiting**: Configurable API rate limits
- **CSRF Protection**: Cross-site request forgery protection
- **Performance Tracking**: NAT deployment metrics with auth method comparison

## 📋 Requirements

### Server Requirements
- **OS**: Ubuntu 22.04 LTS or newer
- **RAM**: Minimum 4GB (8GB recommended)
- **Disk**: Minimum 20GB
- **CPU**: 2 cores minimum (4 cores recommended)
- **Network**: Internet connection for package installation

### Software Dependencies (Auto-Installed)
- Node.js 20.x LTS
- MySQL 8.0+
- Redis 6.x+
- Nginx 1.18+
- PM2 (process manager)
- Git
- Certbot (for SSL certificates)

## 🔧 Installation

### Quick Install (Recommended)

1. Download the installation script:
```bash
wget https://raw.githubusercontent.com/carloscarluccio-sketch/automatic-updates-multi-proxmo/main/install.sh
chmod +x install.sh
```

2. Run as root:
```bash
sudo ./install.sh
```

3. Follow the post-installation steps displayed at the end

### SSL Certificate

The installation script automatically generates a **self-signed SSL certificate** valid for 10 years:
- Certificate: `/etc/nginx/ssl/multpanel.crt`
- Private key: `/etc/nginx/ssl/multpanel.key`

**Important**: Your browser will show a security warning for self-signed certificates. You can:
1. Accept the certificate (for testing/internal use)
2. Replace with Let's Encrypt (recommended for production):
```bash
certbot --nginx -d your-domain.com
```

**Note**: All HTTP traffic is automatically redirected to HTTPS. The platform requires HTTPS for:
- Secure authentication
- VM console access (WebSocket over SSL)
- Protected API communication

### Environment Configuration

After installation, edit the configuration file:
```bash
nano /var/www/multpanelreact/backend/.env
```

Key settings to configure:
- **DATABASE_URL**: MySQL connection string (auto-generated)
- **SMTP_***: Email server settings for notifications
- **BACKEND_PORT**: API server port (default: 3001)
- **JWT_SECRET**: Authentication secret (auto-generated)
- **ENCRYPTION_KEY**: For encrypting sensitive data (auto-generated)

### First Login

1. Access the platform: `http://your-server-ip`
2. Create initial admin user via Prisma Studio:
```bash
cd /var/www/multpanelreact/backend
npx prisma studio
```
3. Or import a database dump with existing users

## 🔄 Updates

### Web-Based Updates (Recommended)

1. Login as super_admin
2. Navigate to **System > System Updates**
3. Click "Check for Updates"
4. Review available versions and changelog
5. Click "Update to vX.X.X"
6. Wait for automatic backup, update, and restart

### Manual Updates via SSH

```bash
cd /var/www/multpanelreact
./update-platform.sh v1.7.0  # Update to specific version
# or
./update-platform.sh  # Update to latest version
```

### Rollback to Previous Version

```bash
cd /var/www/multpanelreact
./rollback-platform.sh /root/backups/backup_20251222_111555.tar.gz
```

## 📦 System Architecture

### Backend (TypeScript + Express)
```
backend/
├── src/
│   ├── controllers/    # Request handlers
│   ├── routes/         # API endpoints
│   ├── services/       # Business logic
│   ├── middlewares/    # Auth, validation, etc.
│   ├── utils/          # Helper functions
│   ├── workers/        # Background jobs
│   └── index.ts        # Entry point
├── prisma/
│   ├── schema.prisma   # Database schema
│   └── migrations/     # SQL migrations
└── dist/               # Compiled JavaScript
```

### Frontend (React + TypeScript + Material-UI)
```
frontend/
├── src/
│   ├── pages/          # Page components
│   ├── components/     # Reusable components
│   ├── services/       # API clients
│   ├── store/          # State management
│   └── App.tsx         # Root component
└── dist/               # Production build
```

### Database (MySQL)
- **Primary Database**: proxmox_multitenant (production)
- **Tables**: 60+ tables including:
  - User management (users, companies, roles)
  - VM management (virtual_machines, vm_projects)
  - Network management (ip_ranges, vm_ip_assignments)
  - Backup management (backup_schedules, backup_history)
  - System updates (system_updates, system_info)
  - Activity logs (activity_logs)

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/sso/login` - SSO login (Microsoft)

### VMs
- `GET /api/vms` - List VMs
- `POST /api/vms` - Create VM
- `PUT /api/vms/:id` - Update VM
- `DELETE /api/vms/:id` - Delete VM
- `POST /api/vms/:id/control` - Start/stop/reboot VM

### System Updates (super_admin only)
- `GET /api/system/updates/check` - Check for available updates
- `GET /api/system/updates/changelog/:version` - Get changelog
- `POST /api/system/updates/execute` - Execute update
- `POST /api/system/updates/rollback` - Rollback update
- `GET /api/system/updates/history` - Update history
- `GET /api/system/updates/info` - Current system info

### Clusters
- `GET /api/clusters` - List Proxmox clusters
- `POST /api/clusters` - Add cluster
- `POST /api/clusters/:id/test` - Test SSH connection
- `POST /api/bulk-clusters/test-connection` - Bulk test multiple clusters
- `POST /api/bulk-clusters/push-ssh-keys` - Push SSH keys to multiple clusters

### Backup Management
- `GET /api/backup-schedules` - List backup schedules
- `POST /api/backup-schedules` - Create schedule
- `GET /api/backup-history` - Backup execution history

## 🔐 Security Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- SSO integration with Microsoft Azure AD
- Password hashing with bcrypt
- Session management with Redis

### Data Protection
- AES-256-CBC encryption for sensitive credentials
- Encrypted password storage for Proxmox, ESXi, and OPNsense
- SQL injection prevention via Prisma ORM
- XSS protection headers
- CSRF token validation

### Network Security
- Firewall configuration (UFW)
- SSL/TLS certificate automation
- HTTP to HTTPS redirection
- Rate limiting per IP address
- Fail2ban integration

## 📊 Performance Features

### Background Job Processing
- BullMQ for queue management
- Redis for job storage
- Separate worker process
- Job types:
  - ISO scanning
  - Template scanning
  - ESXi import
  - Backup execution

### Caching & Optimization
- Redis caching layer
- Nginx reverse proxy
- Gzip compression
- Static asset caching
- Database query optimization

### Monitoring & Metrics
- SSH key health monitoring
- NAT deployment performance tracking
- Backup success rate tracking
- Activity log analytics
- PM2 process monitoring

## 📱 Mobile Support

The platform includes a fully responsive mobile interface with:
- Automatic device detection
- Bottom navigation for mobile UX
- VM management (start/stop/reboot)
- Support ticket system
- User profile access

Access mobile interface at: `/mobile`

## 🔧 Troubleshooting

### Check Service Status
```bash
pm2 list
pm2 logs multpanel-api
pm2 logs job-workers
```

### Check Nginx Status
```bash
systemctl status nginx
nginx -t  # Test configuration
tail -f /var/log/nginx/error.log
```

### Check Database Connection
```bash
cd /var/www/multpanelreact/backend
npx prisma studio  # Opens database GUI at localhost:5555
```

### Check Backend Logs
```bash
tail -f /var/log/multpanel-install.log
pm2 logs multpanel-api --lines 100
```

### Reset PM2 Processes
```bash
pm2 delete all
cd /var/www/multpanelreact/backend
pm2 start ecosystem.config.js
pm2 save
```

## 📝 Configuration Files

### Environment Variables (.env)
```env
DATABASE_URL=mysql://user:pass@localhost:3306/db
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-here
ENCRYPTION_KEY=your-key-here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

### PM2 Ecosystem (ecosystem.config.js)
```javascript
module.exports = {
  apps: [
    {
      name: 'multpanel-api',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '1G',
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'job-workers',
      script: 'dist/workers/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      env: { NODE_ENV: 'production' }
    }
  ]
};
```

### Nginx Configuration (/etc/nginx/sites-available/multpanel)
```nginx
# HTTP server - redirect to HTTPS
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/multpanel.crt;
    ssl_certificate_key /etc/nginx/ssl/multpanel.key;

    root /var/www/multpanelreact/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket support for VM console
    location /api/vms/console {
        proxy_pass http://localhost:3001/api/vms/console;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_read_timeout 3600s;
    }
}
```

## 🌟 Version History

### v1.7.0 (December 2025) - Current
- Web-based system updates with git integration
- SSH key health monitoring
- NAT deployment performance tracking
- Bulk cluster operations
- Backup automation system
- Mobile interface
- System info singleton table

### v1.6.0
- Background jobs system with BullMQ
- ESXi import and discovery
- Snapshot schedules
- Disaster recovery cluster pairs

### v1.5.0
- Single Sign-On (SSO) with Microsoft Azure AD
- Activity logging enhancements
- SSL certificate automation
- URL mapping and branding

## 📄 License

Proprietary - All rights reserved

## 👥 Support

For support and bug reports:
- GitHub Issues: https://github.com/carloscarluccio-sketch/automatic-updates-multi-proxmo/issues
- Documentation: See CLAUDE.md for developer documentation

## 🚀 Deployment

### Multiple Instance Deployment

The `instances.yml` file tracks all deployed instances:

```yaml
instances:
  - id: production-main
    name: "Production Server"
    ip: 98.142.209.206
    ssh_user: root
    backend_port: 3001
    database: proxmox_multitenant
    version: v1.7.0
    environment: production
```

### Deploying to New Instance

1. Prepare clean Ubuntu 22.04 server
2. Copy installation script:
   ```bash
   scp install.sh root@new-server-ip:/root/
   ```
3. SSH to new server and run:
   ```bash
   chmod +x /root/install.sh
   /root/install.sh
   ```
4. Configure .env file
5. Add to instances.yml registry

### Production Checklist

Before going to production:
- [ ] Configure SMTP for email notifications
- [ ] Set up SSL certificates (certbot --nginx)
- [ ] Configure firewall rules
- [ ] Set up database backups
- [ ] Configure monitoring
- [ ] Test backup/restore procedures
- [ ] Document admin credentials securely
- [ ] Set up fail2ban rules
- [ ] Configure log rotation
- [ ] Test update and rollback procedures

---

**Developed with ❤️ using Claude Code**
