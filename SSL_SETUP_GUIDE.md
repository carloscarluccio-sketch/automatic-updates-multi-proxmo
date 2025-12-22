# SSL/HTTPS Setup Guide

## Automatic SSL Certificate (Installation)

The `install.sh` script automatically generates a self-signed SSL certificate during installation:

### What Gets Created
- **Certificate**: `/etc/nginx/ssl/multpanel.crt` (public certificate)
- **Private Key**: `/etc/nginx/ssl/multpanel.key` (private key, chmod 600)
- **Validity**: 10 years (3650 days)
- **Algorithm**: RSA 2048-bit

### Nginx Configuration
```nginx
# HTTP → HTTPS redirect (port 80)
server {
    listen 80;
    server_name _;
    return 301 https://$host$request_uri;
}

# HTTPS main server (port 443)
server {
    listen 443 ssl http2;
    server_name _;

    ssl_certificate /etc/nginx/ssl/multpanel.crt;
    ssl_certificate_key /etc/nginx/ssl/multpanel.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # ... rest of configuration
}
```

## Browser Security Warning

**Self-signed certificates will trigger browser warnings:**
- Chrome: "Your connection is not private" (NET::ERR_CERT_AUTHORITY_INVALID)
- Firefox: "Warning: Potential Security Risk Ahead"
- Edge: "Your connection isn't private"

**To bypass (for testing/internal use):**
1. Click "Advanced" or "More information"
2. Click "Proceed to [IP address] (unsafe)" or "Accept the Risk and Continue"
3. Browser will remember the exception

## Production SSL with Let's Encrypt

### Prerequisites
- Domain name pointing to your server's IP
- Ports 80 and 443 open
- Certbot installed (included in install.sh)

### Installation Steps

1. **Stop Nginx temporarily**:
```bash
systemctl stop nginx
```

2. **Run Certbot**:
```bash
certbot certonly --standalone -d your-domain.com -d www.your-domain.com
```

3. **Update Nginx configuration**:
```bash
nano /etc/nginx/sites-available/multpanel
```

Replace:
```nginx
ssl_certificate /etc/nginx/ssl/multpanel.crt;
ssl_certificate_key /etc/nginx/ssl/multpanel.key;
```

With:
```nginx
ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
```

4. **Test and restart Nginx**:
```bash
nginx -t
systemctl start nginx
```

### Automatic Renewal

Let's Encrypt certificates expire after 90 days. Set up automatic renewal:

```bash
# Test renewal
certbot renew --dry-run

# Add to crontab (runs daily at 2 AM)
crontab -e
```

Add this line:
```
0 2 * * * certbot renew --quiet --post-hook "systemctl reload nginx"
```

## Alternative: Using Certbot Nginx Plugin

**Easier method** (automatically updates Nginx config):

```bash
certbot --nginx -d your-domain.com -d www.your-domain.com
```

This will:
1. Obtain SSL certificate
2. Automatically update Nginx configuration
3. Set up HTTP→HTTPS redirect
4. Test and reload Nginx

## Manual SSL Certificate Installation

If you have your own SSL certificate (purchased or from another CA):

1. **Copy certificate files to server**:
```bash
scp your-cert.crt root@server:/etc/nginx/ssl/multpanel.crt
scp your-cert.key root@server:/etc/nginx/ssl/multpanel.key
```

2. **Set proper permissions**:
```bash
chmod 600 /etc/nginx/ssl/multpanel.key
chmod 644 /etc/nginx/ssl/multpanel.crt
```

3. **If you have intermediate certificates**:
```bash
cat your-cert.crt intermediate.crt > /etc/nginx/ssl/multpanel.crt
```

4. **Test and reload Nginx**:
```bash
nginx -t
systemctl reload nginx
```

## VM Console WebSocket Requirements

**The VM console (noVNC) requires HTTPS** for WebSocket connections:

### Why HTTPS is Required
- Modern browsers block insecure WebSocket connections (ws://) from secure pages
- WebSocket over SSL (wss://) is required for security
- Prevents man-in-the-middle attacks on VM console sessions

### Nginx Configuration for Console
```nginx
location /api/vms/console {
    proxy_pass http://localhost:3001/api/vms/console;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 3600s;  # 1 hour timeout
    proxy_send_timeout 3600s;
}
```

## Security Headers

The Nginx configuration includes security headers:

```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

**HSTS (HTTP Strict Transport Security)**:
- Forces browsers to use HTTPS for 1 year (31536000 seconds)
- Prevents SSL stripping attacks
- Applies to all subdomains

## Troubleshooting

### Certificate Not Trusted
**Problem**: Browser shows "Not Secure" even after installation
**Solution**: Self-signed certificates are expected to show warnings. Use Let's Encrypt for production.

### ERR_SSL_PROTOCOL_ERROR
**Problem**: SSL protocol error in browser
**Cause**: Nginx SSL configuration error or certificate mismatch
**Fix**:
```bash
nginx -t  # Check configuration syntax
openssl x509 -in /etc/nginx/ssl/multpanel.crt -text -noout  # Verify certificate
systemctl restart nginx
```

### Certificate Expired
**Problem**: SSL certificate has expired
**Check expiration**:
```bash
openssl x509 -in /etc/nginx/ssl/multpanel.crt -noout -dates
```

**Regenerate self-signed certificate**:
```bash
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/multpanel.key \
    -out /etc/nginx/ssl/multpanel.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=$(hostname -I | awk '{print $1}')"
chmod 600 /etc/nginx/ssl/multpanel.key
systemctl reload nginx
```

### VM Console Not Working
**Problem**: VM console fails to connect
**Checklist**:
1. Verify HTTPS is working: `curl -k https://localhost`
2. Check WebSocket headers in browser DevTools (Network tab)
3. Verify Nginx proxy configuration for `/api/vms/console`
4. Check backend logs: `pm2 logs multpanel-api`
5. Ensure port 443 is open in firewall: `ufw status`

### Mixed Content Errors
**Problem**: Console or API requests blocked due to mixed content
**Cause**: Trying to load HTTP resources from HTTPS page
**Fix**: Ensure all API calls use relative URLs (not hardcoded http://)

## Verification Commands

**Check SSL certificate details**:
```bash
openssl x509 -in /etc/nginx/ssl/multpanel.crt -text -noout | head -20
```

**Test SSL handshake**:
```bash
openssl s_client -connect localhost:443 -servername localhost
```

**Check which ports are listening**:
```bash
netstat -tlnp | grep nginx
# Should show: 0.0.0.0:80 and 0.0.0.0:443
```

**Test HTTP→HTTPS redirect**:
```bash
curl -I http://localhost
# Should return: HTTP/1.1 301 Moved Permanently
# Location: https://localhost/
```

**Test HTTPS response**:
```bash
curl -k https://localhost
# Should return HTML content
```

## Best Practices

1. **Production Servers**: Always use Let's Encrypt or commercial SSL certificates
2. **Internal/Development**: Self-signed certificates are acceptable
3. **Certificate Renewal**: Set up automatic renewal for Let's Encrypt
4. **Private Key Security**: Never share or commit private keys (chmod 600)
5. **HSTS Header**: Only enable after confirming HTTPS works correctly
6. **Monitoring**: Monitor certificate expiration dates
7. **Backup Certificates**: Keep backup copies of certificates and private keys

## Certificate Monitoring Script

Create a monitoring script to check certificate expiration:

```bash
cat > /usr/local/bin/check-ssl-expiry.sh << 'EOF'
#!/bin/bash
CERT_FILE="/etc/nginx/ssl/multpanel.crt"
EXPIRY_DATE=$(openssl x509 -in $CERT_FILE -noout -enddate | cut -d= -f2)
EXPIRY_EPOCH=$(date -d "$EXPIRY_DATE" +%s)
NOW_EPOCH=$(date +%s)
DAYS_LEFT=$(( ($EXPIRY_EPOCH - $NOW_EPOCH) / 86400 ))

if [ $DAYS_LEFT -lt 30 ]; then
    echo "WARNING: SSL certificate expires in $DAYS_LEFT days!"
    # Send email notification here
fi

echo "SSL certificate valid for $DAYS_LEFT more days"
EOF

chmod +x /usr/local/bin/check-ssl-expiry.sh
```

Add to crontab (check weekly):
```bash
crontab -e
# Add: 0 0 * * 0 /usr/local/bin/check-ssl-expiry.sh
```

---

**Summary**: The platform is pre-configured with SSL/HTTPS out of the box. For production use, simply replace the self-signed certificate with Let's Encrypt using `certbot --nginx`.
