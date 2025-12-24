# Proxmox Multi-Tenant Platform with VDI Integration

## Project Overview
A comprehensive multi-tenant platform consisting of two integrated systems:
1. **Main Panel**: Multi-tenant Proxmox management platform (React + Node.js)
2. **VDI Platform**: Virtual Desktop Infrastructure for managing desktop pools and sessions

## System Architecture

### Main Panel (192.168.142.237)
- **Backend**: Node.js 20.x + TypeScript + Express
- **Frontend**: React 18 + TypeScript + Vite + Material-UI
- **Database**: MySQL 8.0 (database: `multpanel`)
- **ORM**: Prisma
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)
- **Backend Port**: 5000
- **Frontend Port**: Served via nginx on 443 (HTTPS)

### VDI Platform (192.168.142.240)
- **Backend**: Node.js 20.x + TypeScript + Express
- **Frontend**: React 18 + TypeScript + Vite
- **Process Manager**: PM2
- **Web Server**: Nginx (reverse proxy)
- **Backend Port**: 5001
- **Frontend Port**: Served via nginx on 443 (HTTPS)
- **Authentication**: Uses Main Panel API for authentication

## Server Information

### Main Panel Server (192.168.142.237)
- **OS**: Ubuntu 22.04 LTS
- **SSH User**: root
- **Application Path**: `/var/www/multpanelreact/`
- **Database**: `multpanel` (MySQL)
- **SSL**: Self-signed certificate

### VDI Server (192.168.142.240)
- **OS**: Ubuntu 22.04 LTS
- **SSH User**: ubuntu (with sudo access)
- **Application Path**: `/var/www/vdi-platform/`
- **Database**: Shared with Main Panel (192.168.142.237)
- **SSL**: Self-signed certificate

## Technology Stack

### Backend
- Node.js 20.x
- TypeScript 5.x
- Express.js
- Prisma ORM
- JWT Authentication
- Bcrypt for password hashing
- PM2 for process management
- Axios for HTTP requests
- BullMQ + Redis for background jobs

### Frontend
- React 18
- TypeScript
- Vite (build tool)
- Material-UI (MUI)
- Axios
- React Router

### Database
- MySQL 8.0
- Prisma migrations

### Infrastructure
- Nginx (reverse proxy)
- PM2 (process manager)
- Redis (job queue)

## Authentication Architecture

### Main Panel Authentication
- **JWT Secret**: `JWT_ACCESS_SECRET` (24-hour expiry)
- **Password Hashing**: Bcrypt (compatible with PHP $2y$ and Node.js $2a$ formats)
- **Token Storage**: LocalStorage (browser)
- **Database Field**: `password_hash` (not `password`)

### VDI Authentication (API-Only Architecture)
- **No Direct Database Access**: VDI backend exclusively calls Main Panel API
- **Authentication Endpoint**: `POST https://192.168.142.237/api/vdi-integration/auth/login`
- **Token Verification**: `GET https://192.168.142.237/api/vdi-integration/auth/me`
- **Same Credentials**: admin/admin123/admin@proxmox.local works on both systems
- **SSL Certificate Bypass**: VDI backend configured to accept self-signed certificates

### VDI Integration API Endpoints (Main Panel)
```
POST   /api/vdi-integration/auth/login      - Authenticate user
GET    /api/vdi-integration/auth/me         - Verify token & get user info
GET    /api/vdi-integration/clusters        - Get all clusters
GET    /api/vdi-integration/clusters/:id    - Get cluster details
GET    /api/vdi-integration/vms/:id         - Get VM details
GET    /api/vdi-integration/companies/:id   - Get company details
GET    /api/vdi-integration/users/:id       - Get user details
GET    /api/vdi-integration/users           - Get all users
GET    /api/vdi-integration/templates       - Get all templates
```

## Fresh Installation Guide

### Prerequisites
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2

# Install Redis (for background jobs)
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
```

### Main Panel Installation (192.168.142.237)

#### 1. Clone/Setup Application
```bash
# Create application directory
sudo mkdir -p /var/www/multpanelreact
cd /var/www/multpanelreact

# Copy backend and frontend code
# (Assuming you have the source code)
```

#### 2. Backend Setup
```bash
cd /var/www/multpanelreact/backend

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL="mysql://multpanel:MultPanel2024!Secure@localhost:3306/multpanel"

# JWT
JWT_ACCESS_SECRET="935f8e356377dd3baa31a8f5024367025aacb2dd13633017d49a23dae56f5ea1"
JWT_REFRESH_SECRET="another-secure-secret-key"

# Server
PORT=5000
NODE_ENV=production

# Encryption
ENCRYPTION_KEY="your-32-character-encryption-key-here"

# Email (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@proxmox-panel.local
EOF

# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate deploy

# Build TypeScript
npm run build

# Start with PM2
pm2 start ecosystem.config.js --only multpanel-api
pm2 save
pm2 startup
```

#### 3. Frontend Setup
```bash
cd /var/www/multpanelreact/frontend

# Create .env file
cat > .env << 'EOF'
VITE_API_URL=/api
EOF

# Install dependencies
npm install

# Build production bundle
npm run build
```

#### 4. Nginx Configuration
```bash
# Create nginx config
sudo tee /etc/nginx/sites-available/multpanel << 'EOF'
server {
    listen 80;
    server_name 192.168.142.237;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name 192.168.142.237;

    ssl_certificate /etc/nginx/ssl/multpanel.crt;
    ssl_certificate_key /etc/nginx/ssl/multpanel.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/multpanelreact/frontend/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Uploads proxy
    location ^~ /uploads/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket console proxy
    location /console-proxy {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Generate self-signed SSL certificate
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/multpanel.key \
  -out /etc/nginx/ssl/multpanel.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=192.168.142.237"

# Enable site
sudo ln -sf /etc/nginx/sites-available/multpanel /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 5. Database Setup
```bash
# Create database and user
sudo mysql << 'EOF'
CREATE DATABASE IF NOT EXISTS multpanel;
CREATE USER IF NOT EXISTS 'multpanel'@'localhost' IDENTIFIED BY 'MultPanel2024!Secure';
GRANT ALL PRIVILEGES ON multpanel.* TO 'multpanel'@'localhost';
FLUSH PRIVILEGES;
EOF

# Allow remote access from VDI server (192.168.142.240)
sudo mysql << 'EOF'
CREATE USER IF NOT EXISTS 'multpanel'@'192.168.142.240' IDENTIFIED BY 'MultPanel2024!Secure';
GRANT ALL PRIVILEGES ON multpanel.* TO 'multpanel'@'192.168.142.240';
FLUSH PRIVILEGES;
EOF

# Update MySQL bind address
sudo sed -i 's/bind-address.*=.*/bind-address = 0.0.0.0/' /etc/mysql/mysql.conf.d/mysqld.cnf
sudo systemctl restart mysql
```

#### 6. Create Default Admin User
```bash
# Run this after database migration
cd /var/www/multpanelreact/backend
node -e "
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

(async () => {
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'multpanel',
    password: 'MultPanel2024!Secure',
    database: 'multpanel'
  });

  const hashedPassword = await bcrypt.hash('admin123', 10);

  await conn.execute(\`
    INSERT INTO users (username, email, password_hash, role, status, created_at)
    VALUES ('admin', 'admin@proxmox.local', ?, 'super_admin', 'active', NOW())
    ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)
  \`, [hashedPassword]);

  console.log('Admin user created: admin / admin123');
  await conn.end();
})();
"
```

### VDI Platform Installation (192.168.142.240)

#### 1. Setup Application
```bash
# Create application directory
sudo mkdir -p /var/www/vdi-platform
sudo chown ubuntu:ubuntu /var/www/vdi-platform
cd /var/www/vdi-platform
```

#### 2. Backend Setup
```bash
cd /var/www/vdi-platform/backend

# Create .env file
cat > .env << 'EOF'
# Database (points to main panel server)
DATABASE_URL="mysql://multpanel:MultPanel2024!Secure@192.168.142.237:3306/multpanel"

# JWT (SAME SECRET AS MAIN PANEL - CRITICAL!)
JWT_SECRET="935f8e356377dd3baa31a8f5024367025aacb2dd13633017d49a23dae56f5ea1"

# Main Panel API
MAIN_PANEL_API_BASE=https://192.168.142.237
MAIN_PANEL_URL=https://192.168.142.237

# Server
PORT=5001
NODE_ENV=production

# System JWT Token (for service-to-service calls)
SYSTEM_JWT_TOKEN=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOjEsInVzZXJuYW1lIjoic3lzdGVtIiwicm9sZSI6InN1cGVyX2FkbWluIiwiY29tcGFueV9pZCI6bnVsbCwiaWF0IjoxNzY2NDg5MjAxLCJleHAiOjE3OTgwMjUyMDF9.HstO0ppv13hfiTZoL7O-m8G6AYl5H8KcwNeyVlN87CY
EOF

# Install dependencies
npm install

# Build TypeScript
npm run build

# Start with PM2
pm2 start ecosystem.config.js --name vdi-api
pm2 save
pm2 startup
```

#### 3. Frontend Setup
```bash
cd /var/www/vdi-platform/frontend

# Create .env file
cat > .env << 'EOF'
VITE_API_URL=/api
EOF

# Install dependencies
npm install

# Build production bundle
npm run build
```

#### 4. Nginx Configuration
```bash
# Create nginx config
sudo tee /etc/nginx/sites-available/vdi-platform << 'EOF'
server {
    listen 80;
    server_name 192.168.142.240;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name 192.168.142.240;

    ssl_certificate /etc/nginx/ssl/vdi.crt;
    ssl_certificate_key /etc/nginx/ssl/vdi.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    root /var/www/vdi-platform/frontend/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://localhost:5001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Generate self-signed SSL certificate
sudo mkdir -p /etc/nginx/ssl
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/vdi.key \
  -out /etc/nginx/ssl/vdi.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=192.168.142.240"

# Enable site
sudo ln -sf /etc/nginx/sites-available/vdi-platform /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

## Key Configuration Files

### Main Panel Backend (.env)
```env
DATABASE_URL="mysql://multpanel:MultPanel2024!Secure@localhost:3306/multpanel"
JWT_ACCESS_SECRET="935f8e356377dd3baa31a8f5024367025aacb2dd13633017d49a23dae56f5ea1"
JWT_REFRESH_SECRET="another-secure-secret-key"
PORT=5000
NODE_ENV=production
ENCRYPTION_KEY="your-32-character-encryption-key"
```

### VDI Backend (.env)
```env
DATABASE_URL="mysql://multpanel:MultPanel2024!Secure@192.168.142.237:3306/multpanel"
JWT_SECRET="935f8e356377dd3baa31a8f5024367025aacb2dd13633017d49a23dae56f5ea1"
MAIN_PANEL_API_BASE=https://192.168.142.237
MAIN_PANEL_URL=https://192.168.142.237
PORT=5001
NODE_ENV=production
```

### PM2 Ecosystem Config (ecosystem.config.js)
```javascript
module.exports = {
  apps: [
    {
      name: 'multpanel-api',
      script: 'dist/index.js',
      cwd: '/var/www/multpanelreact/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production'
      }
    },
    {
      name: 'job-workers',
      script: 'dist/workers/index.js',
      cwd: '/var/www/multpanelreact/backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M'
    }
  ]
};
```

## Critical Integration Points

### 1. VDI Authentication Flow
```typescript
// VDI Backend: src/controllers/authController.ts
const api = axios.create({
  baseURL: process.env.MAIN_PANEL_API_BASE,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false  // CRITICAL: Accept self-signed certs
  })
});

export const login = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  // Call main panel API
  const response = await api.post('/api/vdi-integration/auth/login', {
    username,
    password
  });

  // Return token from main panel
  return res.json(response.data);
};
```

### 2. Main Panel VDI Integration
```typescript
// Main Panel: src/controllers/vdiIntegrationController.ts
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export const vdiLogin = async (req: Request, res: Response) => {
  const { username, password } = req.body;

  const user = await prisma.users.findFirst({
    where: { username },
    select: {
      id: true,
      username: true,
      email: true,
      password_hash: true,  // NOT 'password'!
      role: true,
      company_id: true,
      status: true
    }
  });

  if (!user || user.status !== 'active') {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const passwordMatch = await bcrypt.compare(password, user.password_hash);

  if (!passwordMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      company_id: user.company_id
    },
    process.env.JWT_ACCESS_SECRET!,  // NOT JWT_SECRET!
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    data: { token, user }
  });
};
```

### 3. VDI Templates Endpoint
```typescript
// VDI Backend: src/controllers/templatesController.ts
// Create axios instance with SSL bypass
const mainPanelApi = axios.create({
  httpsAgent: new https.Agent({
    rejectUnauthorized: false  // CRITICAL!
  })
});

export async function getRegisteredTemplates(req: Request, res: Response) {
  const mainPanelUrl = process.env.MAIN_PANEL_URL || 'https://192.168.142.237';
  const url = `${mainPanelUrl}/api/vdi-integration/templates`;

  const response = await mainPanelApi.get(url, {
    headers: {
      'Authorization': `Bearer ${process.env.JWT_SECRET}`
    }
  });

  res.json({
    success: true,
    data: response.data.data || []
  });
}
```

### 4. VDI Routes Registration
```typescript
// VDI Backend: src/routes/templatesRoutes.ts
router.use(authenticateJWT);  // All routes require auth

router.get('/discover', discoverTemplates);
router.post('/register', registerTemplate);
router.get('/registered', getRegisteredTemplates);
router.post('/assign', assignTemplateToPool);
router.post('/verify-agent', verifyTemplateAgent);
router.get('/', getRegisteredTemplates);  // CRITICAL: Add this for /api/templates
```

## Common Issues & Fixes

### Issue 1: JWT Secret Mismatch
**Error**: `secretOrPrivateKey must have a value`
**Fix**: Use `JWT_ACCESS_SECRET` in main panel, `JWT_SECRET` in VDI (must be same value)

### Issue 2: Database Field Name
**Error**: `Unknown field 'password'`
**Fix**: Use `password_hash` not `password` in Prisma queries

### Issue 3: SSL Certificate Errors
**Error**: `self-signed certificate`
**Fix**: Create axios instance with `rejectUnauthorized: false`

### Issue 4: Port Connection Refused
**Error**: `connect ECONNREFUSED 192.168.142.237:3000`
**Fix**: Set `MAIN_PANEL_API_BASE=https://192.168.142.237` (no port, nginx handles it)

### Issue 5: Double /api in URL
**Error**: Calling `/api/api/vdi-integration/...`
**Fix**: MAIN_PANEL_API_BASE should NOT include `/api` suffix

### Issue 6: Templates 404 Error
**Error**: `404 on /api/templates`
**Fix**: Add `router.get('/', getRegisteredTemplates)` to templatesRoutes.ts

## Deployment Checklist

### Main Panel Server
- [ ] Node.js 20.x installed
- [ ] MySQL 8.0 installed and configured
- [ ] Nginx installed and configured
- [ ] PM2 installed globally
- [ ] Redis installed and running
- [ ] Database created (`multpanel`)
- [ ] Database user created with remote access for VDI server
- [ ] Backend dependencies installed (`npm install`)
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Database migrations run (`npx prisma migrate deploy`)
- [ ] Backend built (`npm run build`)
- [ ] Frontend built (`npm run build`)
- [ ] SSL certificates generated
- [ ] Nginx site enabled
- [ ] PM2 processes started (`multpanel-api`, `job-workers`)
- [ ] Admin user created (admin/admin123)
- [ ] Firewall allows MySQL port 3306 from VDI server

### VDI Server
- [ ] Node.js 20.x installed
- [ ] Nginx installed and configured
- [ ] PM2 installed globally
- [ ] Backend dependencies installed
- [ ] Backend built
- [ ] Frontend built
- [ ] SSL certificates generated
- [ ] Nginx site enabled
- [ ] PM2 process started (`vdi-api`)
- [ ] Can connect to main panel MySQL (test with `mysql -h 192.168.142.237 -u multpanel -p`)
- [ ] Can reach main panel API (test with `curl -k https://192.168.142.237/api/vdi-integration/auth/login`)

## Testing

### Test Main Panel
```bash
# Test backend health
curl -k https://192.168.142.237/api/health

# Test login
curl -k -X POST https://192.168.142.237/api/vdi-integration/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# Test templates endpoint
TOKEN="your-token-here"
curl -k https://192.168.142.237/api/vdi-integration/templates \
  -H "Authorization: Bearer $TOKEN"
```

### Test VDI Platform
```bash
# Test VDI login
curl -k -X POST https://192.168.142.240/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# Test VDI templates
TOKEN="your-token-here"
curl -k https://192.168.142.240/api/templates \
  -H "Authorization: Bearer $TOKEN"
```

## Monitoring

### Check PM2 Status
```bash
# Main panel
pm2 list
pm2 logs multpanel-api --lines 50
pm2 logs job-workers --lines 50

# VDI
pm2 list
pm2 logs vdi-api --lines 50
```

### Check Nginx Status
```bash
sudo nginx -t
sudo systemctl status nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Check Database Connection
```bash
# From VDI server, test connection to main panel
mysql -h 192.168.142.237 -u multpanel -p multpanel
```

## Backup & Recovery

### Backup Database
```bash
mysqldump -u multpanel -p multpanel > multpanel_backup_$(date +%Y%m%d).sql
```

### Backup Application
```bash
tar -czf multpanel_backup_$(date +%Y%m%d).tar.gz /var/www/multpanelreact
tar -czf vdi_backup_$(date +%Y%m%d).tar.gz /var/www/vdi-platform
```

### Restore Database
```bash
mysql -u multpanel -p multpanel < multpanel_backup_YYYYMMDD.sql
```

## Security Considerations

1. **Change Default Credentials**: Update admin/admin123 in production
2. **Use Strong JWT Secrets**: Generate with `openssl rand -hex 32`
3. **Firewall MySQL**: Only allow VDI server IP (192.168.142.240)
4. **Use Real SSL Certificates**: Replace self-signed certs with Let's Encrypt
5. **Environment Variables**: Never commit .env files to git
6. **Database Backups**: Schedule regular backups
7. **Update Dependencies**: Regularly run `npm audit fix`

## Support & Troubleshooting

### Database Connection Issues
- Verify MySQL bind-address is `0.0.0.0`
- Check firewall allows port 3306
- Test connection: `telnet 192.168.142.237 3306`

### PM2 Process Crashes
- Check logs: `pm2 logs <app-name> --err`
- Restart: `pm2 restart <app-name>`
- Check memory: `pm2 monit`

### Nginx 502 Bad Gateway
- Check backend is running: `pm2 list`
- Check backend port: `netstat -tlnp | grep 5000`
- Check nginx error log: `sudo tail -f /var/log/nginx/error.log`

### Frontend Not Loading
- Clear browser cache (Ctrl+Shift+R)
- Check build exists: `ls /var/www/multpanelreact/frontend/dist/`
- Check nginx serves correct directory
- Verify index.html exists

---

**Last Updated**: December 24, 2025
**Version**: 2.0.0 (Node.js/React Refactor)
**Status**: Production Ready

**Key Changes from v1.x**:
- Migrated from PHP to Node.js + TypeScript
- Migrated from vanilla JS to React + TypeScript
- Added VDI Platform with API-only architecture
- Centralized authentication via Main Panel API
- Background job processing with BullMQ + Redis
