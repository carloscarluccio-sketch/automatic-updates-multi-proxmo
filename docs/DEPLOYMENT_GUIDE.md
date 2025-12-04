# Proxmox Multi-Tenant Platform - Deployment Guide
**New React + TypeScript Version**
**Target VM**: 192.168.142.237

---

## Quick Start

```bash
# SSH into new VM
ssh root@192.168.142.237

# Check installation status
cat /tmp/setup.log

# Verify software versions
node --version    # Should be v20.x
npm --version     # Should be 10.x
mysql --version   # Should be 8.0.x
nginx -v          # Should be 1.24.x
pm2 --version     # Should be 5.x
```

---

## Initial Setup Completed ✅

The automated setup script has installed:
- ✅ Node.js 20 LTS
- ✅ MySQL 8.0
- ✅ Nginx
- ✅ PM2 process manager
- ✅ Git and development tools
- ✅ UFW firewall (configured)

---

## Next Steps

### Step 1: Configure MySQL
```bash
# Secure MySQL installation
mysql_secure_installation

# Create database
mysql -u root -p
CREATE DATABASE multpanel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'multpanel'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON multpanel.* TO 'multpanel'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

### Step 2: Clone GitHub Repository
```bash
cd /var/www
git clone https://github.com/carloscarluccio-sketch/multpanelreact.git
cd multpanelreact
```

### Step 3: Set Up Backend
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
NODE_ENV=production
PORT=3000

# Database
DB_HOST=localhost
DB_PORT=3306
DB_NAME=multpanel
DB_USER=multpanel
DB_PASSWORD=your_secure_password

# JWT
JWT_ACCESS_SECRET=your_access_secret_here
JWT_REFRESH_SECRET=your_refresh_secret_here
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=7d

# Encryption
ENCRYPTION_KEY=your_32_char_encryption_key_here

# App
BASE_URL=http://192.168.142.237
API_URL=http://192.168.142.237/api
FRONTEND_URL=http://192.168.142.237
EOF

# Run database migrations
npm run migrate

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/index.js --name multpanel-api
pm2 save
pm2 startup
```

### Step 4: Set Up Frontend
```bash
cd /var/www/multpanelreact/frontend

# Install dependencies
npm install

# Create .env file
cat > .env << 'EOF'
VITE_API_URL=http://192.168.142.237/api
VITE_APP_NAME=Proxmox Multi-Tenant Platform
EOF

# Build production bundle
npm run build
```

### Step 5: Configure Nginx
```bash
# Create Nginx configuration
cat > /etc/nginx/sites-available/multpanel << 'EOF'
server {
    listen 80;
    server_name 192.168.142.237;

    # Frontend (React app)
    root /var/www/multpanelreact/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # API proxy
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Frontend routes (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# Enable site
ln -s /etc/nginx/sites-available/multpanel /etc/nginx/sites-enabled/

# Remove default site
rm -f /etc/nginx/sites-enabled/default

# Test configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

---

## Verification

### Check Services
```bash
# Node.js backend
pm2 status
pm2 logs multpanel-api --lines 50

# Nginx
systemctl status nginx

# MySQL
systemctl status mysql
```

### Test API
```bash
# Health check
curl http://localhost:3000/health

# From outside
curl http://192.168.142.237/api/health
```

### Test Frontend
```bash
# Open in browser
xdg-open http://192.168.142.237
```

---

## Monitoring

### PM2 Monitoring
```bash
# View logs
pm2 logs multpanel-api

# Monitor resources
pm2 monit

# Restart app
pm2 restart multpanel-api

# Stop app
pm2 stop multpanel-api
```

### Nginx Logs
```bash
# Access log
tail -f /var/log/nginx/access.log

# Error log
tail -f /var/log/nginx/error.log
```

### Application Logs
```bash
# Backend logs
pm2 logs multpanel-api --lines 100

# Filter errors
pm2 logs multpanel-api --lines 100 | grep ERROR
```

---

## Troubleshooting

### API Not Starting
```bash
# Check logs
pm2 logs multpanel-api

# Check port
netstat -tulpn | grep 3000

# Restart
pm2 restart multpanel-api
```

### Database Connection Issues
```bash
# Test MySQL connection
mysql -u multpanel -p multpanel

# Check MySQL is running
systemctl status mysql

# Check firewall
ufw status
```

### Nginx 502 Bad Gateway
```bash
# Check backend is running
pm2 status

# Check Nginx configuration
nginx -t

# Restart Nginx
systemctl restart nginx
```

---

## Security Checklist

- [ ] MySQL root password set
- [ ] Database user created with limited permissions
- [ ] UFW firewall enabled
- [ ] Only necessary ports open (22, 80, 443)
- [ ] JWT secrets are strong random strings
- [ ] Encryption key is 32 characters
- [ ] .env files have restricted permissions (600)
- [ ] PM2 startup enabled
- [ ] Nginx security headers configured
- [ ] SSL certificates installed (Let's Encrypt)

---

## Production Hardening

### SSL Certificate (Let's Encrypt)
```bash
# Install Certbot
snap install --classic certbot

# Get certificate
certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

### Environment Variables Security
```bash
# Restrict .env permissions
chmod 600 /var/www/multpanelreact/backend/.env
chmod 600 /var/www/multpanelreact/frontend/.env
```

### Nginx Security Headers
Add to Nginx config:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

### PM2 Process Monitoring
```bash
# Install PM2 monitoring
pm2 install pm2-logrotate

# Configure log rotation
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

---

## Backup Strategy

### Database Backup
```bash
# Create backup script
cat > /root/backup-database.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_DIR="/var/backups/multpanel"
mkdir -p $BACKUP_DIR

mysqldump -u root -p multpanel > $BACKUP_DIR/multpanel-$DATE.sql
gzip $BACKUP_DIR/multpanel-$DATE.sql

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: multpanel-$DATE.sql.gz"
EOF

chmod +x /root/backup-database.sh

# Add to crontab (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * /root/backup-database.sh") | crontab -
```

### Application Backup
```bash
# Backup uploaded files and configuration
tar -czf /var/backups/multpanel-app-$(date +%Y-%m-%d).tar.gz \
    /var/www/multpanelreact/.env* \
    /var/www/multpanelreact/uploads/
```

---

## Performance Optimization

### PM2 Cluster Mode
```bash
# Use all CPU cores
pm2 start dist/index.js --name multpanel-api -i max
pm2 save
```

### Nginx Caching
Add to Nginx config:
```nginx
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m inactive=60m;

location /api {
    proxy_cache api_cache;
    proxy_cache_valid 200 1m;
    add_header X-Cache-Status $upstream_cache_status;
    # ... other proxy settings
}
```

### Database Optimization
```sql
-- Add indexes for common queries
ALTER TABLE virtual_machines ADD INDEX idx_company_id (company_id);
ALTER TABLE users ADD INDEX idx_company_role (company_id, role);
```

---

## Maintenance

### Update Application
```bash
cd /var/www/multpanelreact

# Pull latest code
git pull origin main

# Update backend
cd backend
npm install
npm run build
pm2 restart multpanel-api

# Update frontend
cd ../frontend
npm install
npm run build

# Restart Nginx
systemctl reload nginx
```

### System Updates
```bash
# Update system packages
apt-get update
apt-get upgrade -y

# Update Node.js (when needed)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Update PM2
npm install -g pm2
pm2 update
```

---

## Useful Commands

### PM2
```bash
pm2 list                    # List all processes
pm2 logs                    # View all logs
pm2 logs --lines 100        # View last 100 lines
pm2 restart all             # Restart all processes
pm2 stop all                # Stop all processes
pm2 delete all              # Delete all processes
pm2 save                    # Save process list
pm2 resurrect               # Restore saved processes
```

### Nginx
```bash
nginx -t                    # Test configuration
systemctl reload nginx      # Reload configuration
systemctl restart nginx     # Restart service
systemctl status nginx      # Check status
```

### MySQL
```bash
mysql -u root -p            # Connect as root
systemctl restart mysql     # Restart MySQL
systemctl status mysql      # Check status
```

---

## Migration from Old System

### Export Data from Old System (192.168.142.236)
```bash
# Already completed - backup files in:
# C:\Users\Usuario\proxmox-backup-2025-12-04\proxmox_tenant_backup.sql
```

### Import Data to New System
```bash
# Copy SQL file to new server
scp proxmox_tenant_backup.sql root@192.168.142.237:/tmp/

# On new server
mysql -u root -p multpanel < /tmp/proxmox_tenant_backup.sql

# Verify import
mysql -u root -p multpanel -e "SHOW TABLES;"
```

### Update Proxmox Cluster Credentials
Since passwords are encrypted with different keys, you may need to:
1. Export cluster credentials from old system
2. Re-encrypt with new system's encryption key
3. Or manually re-enter credentials in new UI

---

## Contact & Support

- **Documentation**: `/var/www/multpanelreact/docs/`
- **GitHub**: https://github.com/carloscarluccio-sketch/multpanelreact
- **Old System**: 192.168.142.236 (keep running during transition)
- **New System**: 192.168.142.237 (production)

---

**Document Version**: 1.0
**Last Updated**: December 4, 2025
**Status**: Ready for Deployment
