#!/bin/bash

# ============================================
# USDT Bridge Backend - Automated Deployment
# ============================================
# Run this script on your VPS as root or with sudo
# Usage: chmod +x deploy-bridge.sh && ./deploy-bridge.sh

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="usdt-bridge"
APP_DIR="/var/www/$APP_NAME"
DOMAIN=""  # Will be prompted
EMAIL=""   # Will be prompted

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

# Get user input
get_user_input() {
    echo
    echo "========================================"
    echo "USDT Bridge Deployment Configuration"
    echo "========================================"

    read -p "Enter your domain name (e.g., bridge.yourdomain.com): " DOMAIN
    if [[ -z "$DOMAIN" ]]; then
        error "Domain is required"
        exit 1
    fi

    read -p "Enter your email for SSL certificates: " EMAIL
    if [[ -z "$EMAIL" ]]; then
        warn "Email not provided - SSL certificate will not be automatic"
    fi

    echo
    info "Configuration:"
    info "  Domain: $DOMAIN"
    info "  Email: $EMAIL"
    info "  App Directory: $APP_DIR"
    echo

    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Deployment cancelled"
        exit 0
    fi
}

# Update system
update_system() {
    log "Updating system packages..."
    apt update && apt upgrade -y
}

# Install Node.js 18
install_nodejs() {
    log "Installing Node.js 18..."
    if ! command -v node &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
    else
        info "Node.js already installed: $(node --version)"
    fi
}

# Install PM2
install_pm2() {
    log "Installing PM2 process manager..."
    if ! command -v pm2 &> /dev/null; then
        npm install -g pm2
    else
        info "PM2 already installed"
    fi
}

# Install Nginx
install_nginx() {
    log "Installing Nginx..."
    if ! command -v nginx &> /dev/null; then
        apt install -y nginx
        systemctl enable nginx
    else
        info "Nginx already installed"
    fi
}

# Install Certbot for SSL
install_certbot() {
    log "Installing Certbot for SSL certificates..."
    if [[ -n "$EMAIL" ]]; then
        snap install core; snap refresh core
        snap install --classic certbot
        ln -sf /snap/bin/certbot /usr/bin/certbot
    else
        warn "Skipping Certbot installation (no email provided)"
    fi
}

# Create application directory
create_app_directory() {
    log "Creating application directory..."
    mkdir -p "$APP_DIR"
    chown -R www-data:www-data "$APP_DIR"
}

# Clone repository
clone_repository() {
    log "Cloning repository..."
    if [[ -d "$APP_DIR/.git" ]]; then
        info "Repository already exists, pulling latest changes..."
        cd "$APP_DIR"
        git pull origin master
    else
        git clone https://github.com/vishnuvardanbnr-cmyk/UCC-Bridge.git "$APP_DIR"
        cd "$APP_DIR"
    fi
}

# Install dependencies
install_dependencies() {
    log "Installing backend dependencies..."
    cd "$APP_DIR/backend"
    npm install --production
}

# Create environment file
create_env_file() {
    log "Setting up environment configuration..."
    cd "$APP_DIR/backend"

    if [[ ! -f ".env" ]]; then
        cat > .env << EOF
# USDT Bridge Backend Configuration
# IMPORTANT: Replace these with your actual values

# Relayer wallet (REQUIRED - with admin access to bridge contracts)
RELAYER_PRIVATE_KEY=your_private_key_here_replace_this

# RPC Endpoints
BSC_RPC_URL=https://bsc-dataseed.binance.org
UC_RPC_URL=https://rpc.mainnet.ucchain.org

# Contract Addresses (Mainnet)
BSC_BRIDGE_ADDRESS=0xE4363F8FbD39FB0930772644Ebd14597e5756986
UC_BRIDGE_ADDRESS=0x0eAf708770c97152A2369CC28e356FBaA87e7E42
BSC_USDT_ADDRESS=0x55d398326f99059fF775485246999027B3197955
UC_USDT_ADDRESS=0x45643aB553621e611984Ff34633adf8E18dA2d55

# Chain IDs
BSC_CHAIN_ID=56
UC_CHAIN_ID=1137

# Server Configuration
PORT=3002
LOG_LEVEL=info

# Security Note: Never commit this file to version control
EOF

        warn "Environment file created with placeholder values"
        warn "You MUST edit $APP_DIR/backend/.env and replace:"
        warn "  - RELAYER_PRIVATE_KEY with your actual private key"
        warn "  - Any other values as needed"
        echo
        info "Press Enter after you've configured the .env file..."
        read -p ""
    else
        info "Environment file already exists"
    fi
}

# Create PM2 ecosystem file
create_pm2_config() {
    log "Creating PM2 configuration..."
    cd "$APP_DIR/backend"

    cat > ecosystem.config.js << EOF
module.exports = {
  apps: [{
    name: 'usdt-bridge-relayer',
    script: 'src/index.js',
    cwd: '$APP_DIR/backend',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3002
    },
    error_file: '/var/log/pm2/usdt-bridge-error.log',
    out_file: '/var/log/pm2/usdt-bridge-out.log',
    log_file: '/var/log/pm2/usdt-bridge.log',
    time: true,
    watch: false,
    max_memory_restart: '1G',
    restart_delay: 4000,
    autorestart: true
  }]
};
EOF
}

# Configure Nginx
configure_nginx() {
    log "Configuring Nginx..."

    # Create Nginx configuration
    cat > /etc/nginx/sites-available/$APP_NAME << EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Proxy to backend
    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://localhost:3002/health;
        access_log off;
    }

    # Logs
    access_log /var/log/nginx/${APP_NAME}.access.log;
    error_log /var/log/nginx/${APP_NAME}.error.log;
}
EOF

    # Enable site
    ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
    rm -f /etc/nginx/sites-enabled/default

    # Test configuration
    nginx -t
    systemctl reload nginx
}

# Setup SSL certificate
setup_ssl() {
    if [[ -n "$EMAIL" ]]; then
        log "Setting up SSL certificate..."
        certbot --nginx -d $DOMAIN -d www.$DOMAIN --email $EMAIL --agree-tos --non-interactive
        log "SSL certificate installed!"
    else
        warn "Skipping SSL setup (no email provided)"
        warn "You can manually run: certbot --nginx -d $DOMAIN"
    fi
}

# Start application
start_application() {
    log "Starting application with PM2..."
    cd "$APP_DIR/backend"

    # Stop any existing instance
    pm2 delete $APP_NAME 2>/dev/null || true

    # Start new instance
    pm2 start ecosystem.config.js
    pm2 save

    # Setup PM2 startup script
    pm2 startup
    pm2 save

    log "Application started!"
    info "PM2 Status:"
    pm2 status
}

# Configure firewall
configure_firewall() {
    log "Configuring firewall..."
    ufw --force enable
    ufw allow ssh
    ufw allow 'Nginx Full'
    ufw --force reload
    info "Firewall configured"
}

# Create log directories
create_log_dirs() {
    log "Creating log directories..."
    mkdir -p /var/log/pm2
    chown -R www-data:www-data /var/log/pm2
}

# Display completion message
show_completion() {
    echo
    echo "========================================"
    echo "🎉 DEPLOYMENT COMPLETE!"
    echo "========================================"
    echo
    info "Your USDT Bridge backend is now running at:"
    info "  HTTP:  http://$DOMAIN"
    if [[ -n "$EMAIL" ]]; then
        info "  HTTPS: https://$DOMAIN"
    fi
    echo
    info "API Endpoints:"
    info "  Health: http://$DOMAIN/health"
    info "  Process Deposit: http://$DOMAIN/api/process-deposit"
    info "  Process Withdrawal: http://$DOMAIN/api/process-withdrawal"
    info "  Transaction Hashes: http://$DOMAIN/api/tx-hashes"
    echo
    warn "IMPORTANT: You must edit the .env file:"
    warn "  sudo nano $APP_DIR/backend/.env"
    warn "  Replace RELAYER_PRIVATE_KEY with your actual private key"
    echo
    info "Monitoring commands:"
    info "  pm2 status                    # Check app status"
    info "  pm2 logs usdt-bridge-relayer  # View logs"
    info "  pm2 restart usdt-bridge-relayer # Restart app"
    info "  sudo nginx -t && sudo systemctl reload nginx  # Reload nginx"
    echo
    info "Next steps:"
    info "1. Edit the .env file with your private key"
    info "2. Test the API: curl http://$DOMAIN/health"
    info "3. Update your frontend to use: https://$DOMAIN"
    info "4. Monitor logs for any issues"
    echo
    log "Deployment completed successfully! 🚀"
}

# Main deployment function
main() {
    log "Starting USDT Bridge Backend Deployment..."

    check_permissions
    get_user_input

    update_system
    install_nodejs
    install_pm2
    install_nginx
    install_certbot

    create_app_directory
    create_log_dirs
    clone_repository
    install_dependencies
    create_env_file
    create_pm2_config

    configure_nginx
    configure_firewall
    start_application
    setup_ssl

    show_completion
}

# Run main function
main "$@"