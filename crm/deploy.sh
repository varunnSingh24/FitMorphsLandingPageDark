#!/bin/bash
# FitMorphs CRM — One-command server setup script
# Run this on a fresh Ubuntu 22.04 server as root:
#   curl -fsSL https://raw.githubusercontent.com/varunnSingh24/FitMorphsLandingPageDark/main/crm/deploy.sh | bash

set -e

DOMAIN=${1:-""}   # Pass your domain as first arg: ./deploy.sh crm.fitmorphs.com
APP_DIR="/var/www/fitmorphs-crm"
REPO="https://github.com/varunnSingh24/FitMorphsLandingPageDark.git"
JWT_SECRET=$(openssl rand -base64 48)

echo "========================================"
echo "  FitMorphs CRM — Deployment Script"
echo "========================================"

# 1. System update
echo "[1/8] Updating system..."
apt-get update -qq && apt-get upgrade -y -qq

# 2. Install Node.js 18
echo "[2/8] Installing Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash - > /dev/null
apt-get install -y nodejs -qq

# 3. Install tools
echo "[3/8] Installing PM2, Nginx, Git..."
npm install -g pm2 -q
apt-get install -y nginx git certbot python3-certbot-nginx -qq

# 4. Clone repo
echo "[4/8] Cloning repository..."
rm -rf $APP_DIR
git clone $REPO $APP_DIR -q
cd $APP_DIR/crm

# 5. Install dependencies & build frontend
echo "[5/8] Installing dependencies and building frontend..."
npm run setup
npm run build --prefix client

# 6. Create .env
echo "[6/8] Creating environment config..."
cat > $APP_DIR/crm/server/.env << EOF
PORT=3001
JWT_SECRET=$JWT_SECRET
CLIENT_URL=http://${DOMAIN:-localhost}
NODE_ENV=production
EOF

if [ -n "$DOMAIN" ]; then
  sed -i "s|CLIENT_URL=.*|CLIENT_URL=https://$DOMAIN|" $APP_DIR/crm/server/.env
fi

# 7. Start with PM2
echo "[7/8] Starting app with PM2..."
cd $APP_DIR/crm/server
pm2 delete fitmorphs-api 2>/dev/null || true
pm2 start index.js --name "fitmorphs-api"
pm2 save
pm2 startup | tail -1 | bash

# 8. Configure Nginx
echo "[8/8] Configuring Nginx..."
SERVER_NAME=${DOMAIN:-"_"}

cat > /etc/nginx/sites-available/fitmorphs-crm << EOF
server {
    listen 80;
    server_name $SERVER_NAME;

    root $APP_DIR/crm/client/dist;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript;

    # React frontend
    location / {
        try_files \$uri \$uri/ /index.html;
        add_header Cache-Control "no-cache";
    }

    # Static assets — long cache
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # API proxy
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/fitmorphs-crm /etc/nginx/sites-enabled/
nginx -t && systemctl restart nginx

# SSL (only if domain provided)
if [ -n "$DOMAIN" ]; then
  echo ""
  echo "Getting SSL certificate for $DOMAIN..."
  certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@fitmorphs.com
fi

# Create update script
cat > /usr/local/bin/update-crm << 'EOF'
#!/bin/bash
cd /var/www/fitmorphs-crm
git pull
cd crm
npm install --prefix server
npm run build --prefix client
pm2 restart fitmorphs-api
echo "✅ CRM updated successfully"
EOF
chmod +x /usr/local/bin/update-crm

echo ""
echo "========================================"
echo "  ✅ FitMorphs CRM deployed!"
echo "========================================"
echo ""
if [ -n "$DOMAIN" ]; then
  echo "  🌐 URL:      https://$DOMAIN"
else
  echo "  🌐 URL:      http://$(curl -s ifconfig.me)"
fi
echo "  👤 Login:    admin@fitmorphs.com"
echo "  🔑 Password: admin123"
echo ""
echo "  ⚠️  IMPORTANT: Change the admin password immediately after first login!"
echo "  📦 To update later: run 'update-crm' from anywhere on the server"
echo ""
