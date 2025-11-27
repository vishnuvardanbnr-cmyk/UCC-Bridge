#!/bin/bash

# ============================================
# USDT Bridge Frontend - Automated Deployment
# ============================================
# Deploy Next.js frontend to swap.ucchain.org
# Run this script on your VPS as root or with sudo

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# PRE-CONFIGURED SETTINGS
FRONTEND_NAME="usdt-bridge-frontend"
FRONTEND_DIR="/var/www/$FRONTEND_NAME"
DOMAIN="swap.ucchain.org"
EMAIL="usdtrains@gmail.com"

# Logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
}

# Check if running as root or with sudo
check_permissions() {
    if [[ $EUID -ne 0 ]]; then
        error "This script must be run as root or with sudo"
        exit 1
    fi
}

# Install Node.js if not present
install_nodejs() {
    log "Checking Node.js installation..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        info "Node.js installed: $(node --version)"
    else
        info "Node.js already installed: $(node --version)"
    fi
}

# Create frontend directory
create_frontend_directory() {
    log "Creating frontend directory..."
    mkdir -p "$FRONTEND_DIR"
    chown -R www-data:www-data "$FRONTEND_DIR"
}

# Clone repository
clone_repository() {
    log "Cloning repository..."
    if [[ -d "$FRONTEND_DIR/.git" ]]; then
        info "Repository already exists, pulling latest changes..."
        cd "$FRONTEND_DIR"
        git pull origin master
    else
        git clone https://github.com/vishnuvardanbnr-cmyk/UCC-Bridge.git "$FRONTEND_DIR"
        cd "$FRONTEND_DIR"
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing frontend dependencies..."
    npm install
}

# Create production environment file
create_env_file() {
    log "Creating production environment file..."
    cat > .env.local << EOF
# Production Environment Variables
NEXT_PUBLIC_RELAYER_URL=https://bridge.ucchain.org
EOF
}

# Build the application
build_application() {
    log "Building Next.js application..."
    npm run build
    info "Build completed successfully"
}

# Configure Nginx for frontend
configure_nginx() {
    log "Configuring Nginx for frontend..."

    # Create Nginx configuration
    cat > /etc/nginx/sites-available/$FRONTEND_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' https://bridge.ucchain.org http: https: data: blob: 'unsafe-inline' 'unsafe-eval'" always;

    # Root directory
    root $FRONTEND_DIR/out;
    index index.html;

    # Handle Next.js routing
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # API proxy to backend (if needed)
    location /api/ {
        proxy_pass https://bridge.ucchain.org;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 86400;
    }

    # Static assets with caching
    location /_next/static/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Logs
    access_log /var/log/nginx/${FRONTEND_NAME}.access.log;
    error_log /var/log/nginx/${FRONTEND_NAME}.error.log;
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/$FRONTEND_NAME /etc/nginx/sites-enabled/

    # Test configuration
    nginx -t
    systemctl reload nginx
}

# Setup SSL certificate
setup_ssl() {
    log "Setting up SSL certificate for frontend..."
    certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive
    log "SSL certificate installed!"
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    ufw allow 'Nginx Full'
    ufw --force reload
    info "Firewall configured"
}

# Display completion message
show_completion() {
    echo
    echo "========================================"
    echo "🎉 FRONTEND DEPLOYMENT COMPLETE!"
    echo "========================================"
    echo
    info "Your USDT Bridge frontend is now running at:"
    info "  HTTP:  http://$DOMAIN"
    info "  HTTPS: https://$DOMAIN"
    echo
    info "Key Features:"
    info "  ✅ Next.js production build"
    info "  ✅ Static file serving"
    info "  ✅ SSL certificate"
    info "  ✅ API proxy to backend"
    info "  ✅ Optimized caching"
    echo
    info "Test your frontend:"
    info "  curl -I https://$DOMAIN"
    echo
    info "Monitoring commands:"
    info "  sudo nginx -t                 # Test config"
    info "  sudo systemctl reload nginx   # Reload nginx"
    info "  tail -f /var/log/nginx/${FRONTEND_NAME}.error.log"
    echo
    log "Frontend deployment completed successfully! 🚀"
}

# Main deployment function
main() {
    log "Starting USDT Bridge Frontend Deployment..."
    log "Domain: $DOMAIN"
    log "Email: $EMAIL"

    check_permissions
    install_nodejs
    create_frontend_directory
    clone_repository
    install_dependencies
    create_env_file
    build_application
    configure_nginx
    configure_firewall
    setup_ssl

    show_completion
}

# Run main function
main "$@"