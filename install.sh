#!/bin/bash
##############################################################################
# Proxmox Multi-Tenant Platform - Installation Script
# Version: 1.7.0
#
# This script performs a clean installation of the platform on Ubuntu 22.04+
#
# Requirements:
#   - Ubuntu 22.04 LTS or newer
#   - Root access
#   - Internet connection
#   - At least 4GB RAM
#   - At least 20GB disk space
#
# Usage: sudo ./install.sh
##############################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/multpanelreact"
BACKUP_DIR="/root/backups"
LOG_FILE="/var/log/multpanel-install.log"
BACKEND_PORT=3001  # Can be overridden by environment variable
DATABASE_NAME="proxmox_multitenant"  # Can be overridden

# Log function
log() {
    echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

warn() {
    echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (use sudo)"
    exit 1
fi

# Display banner
echo "================================================================"
echo "   Proxmox Multi-Tenant Platform - Installation Script"
echo "   Version: 1.7.0"
echo "================================================================"
echo ""

log "Starting installation..."

# Step 1: Update system
log "[1/12] Updating system packages..."
apt-get update -y >> "$LOG_FILE" 2>&1
apt-get upgrade -y >> "$LOG_FILE" 2>&1

# Step 2: Install required Ubuntu packages
log "[2/12] Installing required Ubuntu packages..."
apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    ca-certificates \
    gnupg \
    lsb-release \
    nginx \
    mysql-server \
    redis-server \
    certbot \
    python3-certbot-nginx \
    tar \
    gzip \
    ufw \
    fail2ban \
    >> "$LOG_FILE" 2>&1

# Step 3: Install Node.js 20.x (LTS)
log "[3/12] Installing Node.js 20.x LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG_FILE" 2>&1
apt-get install -y nodejs >> "$LOG_FILE" 2>&1

# Verify Node.js installation
NODE_VERSION=$(node --version)
NPM_VERSION=$(npm --version)
log "Node.js version: $NODE_VERSION"
log "NPM version: $NPM_VERSION"

# Step 4: Install PM2 globally
log "[4/12] Installing PM2 process manager..."
npm install -g pm2 >> "$LOG_FILE" 2>&1
pm2 startup >> "$LOG_FILE" 2>&1

# Step 5: Configure MySQL
log "[5/12] Configuring MySQL..."
if ! systemctl is-active --quiet mysql; then
    systemctl start mysql
    systemctl enable mysql
fi

# Get MySQL root password or generate one
if [ -z "$MYSQL_ROOT_PASSWORD" ]; then
    MYSQL_ROOT_PASSWORD=$(openssl rand -base64 32)
    warn "MySQL root password not set in environment, generated: $MYSQL_ROOT_PASSWORD"
    echo "$MYSQL_ROOT_PASSWORD" > /root/.mysql_root_password
    chmod 600 /root/.mysql_root_password
fi

# Secure MySQL installation (automated)
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '$MYSQL_ROOT_PASSWORD';" || true
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM mysql.user WHERE User='';" || true
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');" || true
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS test;" || true
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';" || true
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "FLUSH PRIVILEGES;" || true

# Create application database
log "Creating database: $DATABASE_NAME"
mysql -u root -p"$MYSQL_ROOT_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS $DATABASE_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || true

# Step 6: Configure Redis
log "[6/12] Configuring Redis..."
systemctl start redis-server
systemctl enable redis-server

# Step 7: Clone repository
log "[7/12] Cloning repository..."
mkdir -p "$APP_DIR"
cd /tmp

if [ ! -d "$APP_DIR/.git" ]; then
    git clone https://github.com/carloscarluccio-sketch/automatic-updates-multi-proxmo.git "$APP_DIR" >> "$LOG_FILE" 2>&1
else
    warn "Git repository already exists, pulling latest changes..."
    cd "$APP_DIR"
    git pull >> "$LOG_FILE" 2>&1
fi

cd "$APP_DIR"

# Checkout latest version tag or main
LATEST_VERSION=$(git tag -l --sort=-v:refname | head -1)
if [ -n "$LATEST_VERSION" ]; then
    log "Checking out version: $LATEST_VERSION"
    git checkout tags/"$LATEST_VERSION" >> "$LOG_FILE" 2>&1
else
    log "No version tags found, using main branch"
    git checkout main >> "$LOG_FILE" 2>&1
fi

# Step 8: Configure backend environment
log "[8/12] Configuring backend environment..."
cd "$APP_DIR/backend"

# Create .env file if not exists
if [ ! -f .env ]; then
    cat > .env << EOF
# Database Configuration
DATABASE_URL="mysql://root:${MYSQL_ROOT_PASSWORD}@localhost:3306/${DATABASE_NAME}"

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT Configuration
JWT_SECRET=$(openssl rand -hex 32)
JWT_ACCESS_EXPIRATION=15m
JWT_REFRESH_EXPIRATION=7d

# Server Configuration
PORT=${BACKEND_PORT}
NODE_ENV=production

# Email Configuration (SMTP)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@proxmox-panel.local

# Encryption
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Frontend URL
FRONTEND_URL=http://localhost

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# File Upload
MAX_FILE_SIZE=10485760

# Session
SESSION_SECRET=$(openssl rand -hex 32)
EOF

    log "Created .env file with generated secrets"
    log "IMPORTANT: Edit $APP_DIR/backend/.env to configure SMTP settings"
else
    warn ".env file already exists, skipping creation"
fi

# Step 9: Install backend dependencies and build
log "[9/12] Installing backend dependencies..."
npm install >> "$LOG_FILE" 2>&1

log "Running Prisma migrations..."
npx prisma migrate deploy >> "$LOG_FILE" 2>&1 || warn "Some migrations may have already been applied"

npx prisma generate >> "$LOG_FILE" 2>&1

log "Building backend..."
npm run build >> "$LOG_FILE" 2>&1

# Step 10: Install and build frontend
log "[10/12] Installing and building frontend..."
cd "$APP_DIR/frontend"

npm install >> "$LOG_FILE" 2>&1

log "Building frontend..."
npm run build >> "$LOG_FILE" 2>&1

# Step 11: Generate SSL certificate
log "[11/13] Generating self-signed SSL certificate..."

# Create SSL directory
mkdir -p /etc/nginx/ssl

# Generate self-signed certificate (valid for 10 years)
# This can be replaced with Let's Encrypt later
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/multpanel.key \
    -out /etc/nginx/ssl/multpanel.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$(hostname -I | awk '{print $1}')" \
    >> "$LOG_FILE" 2>&1

# Set proper permissions
chmod 600 /etc/nginx/ssl/multpanel.key
chmod 644 /etc/nginx/ssl/multpanel.crt

log "Self-signed SSL certificate generated at /etc/nginx/ssl/multpanel.crt"

# Step 12: Configure Nginx with SSL
log "[12/13] Configuring Nginx with SSL..."

cat > /etc/nginx/sites-available/multpanel << 'EOF'
# HTTP server - redirect all traffic to HTTPS
server {
    listen 80;
    server_name _;

    # Redirect all HTTP requests to HTTPS
    return 301 https://\$host\$request_uri;
}

# HTTPS server - main configuration
server {
    listen 443 ssl http2;
    server_name _;

    # SSL certificate configuration
    ssl_certificate /etc/nginx/ssl/multpanel.crt;
    ssl_certificate_key /etc/nginx/ssl/multpanel.key;

    # SSL protocols and ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # SSL session cache
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    # Frontend
    root /var/www/multpanelreact/frontend/dist;
    index index.html;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;

    # Frontend routes (SPA)
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Backend API proxy
    location /api/ {
        proxy_pass http://localhost:BACKEND_PORT_PLACEHOLDER/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # WebSocket support for VM console (noVNC)
    location /api/vms/console {
        proxy_pass http://localhost:BACKEND_PORT_PLACEHOLDER/api/vms/console;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
EOF

# Replace backend port placeholder
sed -i "s/BACKEND_PORT_PLACEHOLDER/${BACKEND_PORT}/g" /etc/nginx/sites-available/multpanel

# Enable site
ln -sf /etc/nginx/sites-available/multpanel /etc/nginx/sites-enabled/multpanel
rm -f /etc/nginx/sites-enabled/default

# Test nginx configuration
nginx -t >> "$LOG_FILE" 2>&1

# Restart nginx
systemctl restart nginx
systemctl enable nginx

# Step 13: Start PM2 services
log "[13/13] Starting PM2 services..."
cd "$APP_DIR/backend"

# Create PM2 ecosystem file if not exists
if [ ! -f ecosystem.config.js ]; then
    cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'multpanel-api',
      script: 'dist/index.js',
      instances: 1,
      exec_mode: 'fork',
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
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
EOF
fi

pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js >> "$LOG_FILE" 2>&1
pm2 save >> "$LOG_FILE" 2>&1

# Configure firewall
log "Configuring firewall..."
ufw allow 22/tcp >> "$LOG_FILE" 2>&1  # SSH
ufw allow 80/tcp >> "$LOG_FILE" 2>&1  # HTTP (will redirect to HTTPS)
ufw allow 443/tcp >> "$LOG_FILE" 2>&1  # HTTPS
echo "y" | ufw enable >> "$LOG_FILE" 2>&1 || true

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Display completion message
echo ""
echo "================================================================"
log "✅ Installation completed successfully!"
echo "================================================================"
echo ""
info "Next steps:"
echo "  1. Edit backend configuration: $APP_DIR/backend/.env"
echo "  2. Configure SMTP settings for email notifications"
echo "  3. Access the panel: https://$(hostname -I | awk '{print $1}')"
echo "     (HTTP will automatically redirect to HTTPS)"
echo "  4. Accept the self-signed SSL certificate in your browser"
echo "     (Or replace with Let's Encrypt: certbot --nginx -d your-domain.com)"
echo "  5. Default admin credentials:"
echo "     - Check database for initial admin user"
echo "     - Or create manually via Prisma Studio: cd $APP_DIR/backend && npx prisma studio"
echo ""
info "SSL Certificate Information:"
echo "  - Self-signed certificate: /etc/nginx/ssl/multpanel.crt"
echo "  - Private key: /etc/nginx/ssl/multpanel.key"
echo "  - Valid for: 10 years"
echo "  - To replace with Let's Encrypt: certbot --nginx"
echo ""
info "MySQL root password saved to: /root/.mysql_root_password"
info "Installation log: $LOG_FILE"
echo ""
log "PM2 Status:"
pm2 list
echo ""
log "Nginx Status:"
systemctl status nginx --no-pager
echo ""
echo "================================================================"
log "Installation complete! 🎉"
echo "================================================================"
