#!/bin/bash

# ETF Research Platform - Production Deployment Script
# This script handles the deployment process with rollback capabilities

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
DEPLOYMENT_LOG="/var/log/etf-deployment.log"
BACKUP_DIR="/var/backups/etf-frontend"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$DEPLOYMENT_LOG"
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if running as appropriate user
    if [[ $EUID -eq 0 ]]; then
        error "This script should not be run as root!"
        exit 1
    fi
    
    # Check required commands
    local required_commands=("docker" "docker-compose" "git" "npm")
    for cmd in "${required_commands[@]}"; do
        if ! command -v "$cmd" &> /dev/null; then
            error "Required command '$cmd' not found!"
            exit 1
        fi
    done
    
    # Check environment file
    if [[ ! -f "$PROJECT_ROOT/.env.production" ]]; then
        error "Production environment file not found!"
        exit 1
    fi
    
    log "Prerequisites check passed."
}

# Create backup
create_backup() {
    log "Creating backup..."
    
    local backup_name="etf-frontend-$(date +'%Y%m%d-%H%M%S')"
    local backup_path="$BACKUP_DIR/$backup_name"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup current deployment
    if docker images | grep -q "etf-research-frontend"; then
        docker save etf-research-frontend:latest | gzip > "$backup_path.tar.gz"
        log "Docker image backed up to $backup_path.tar.gz"
    fi
    
    # Keep only last 5 backups
    ls -t "$BACKUP_DIR"/*.tar.gz 2>/dev/null | tail -n +6 | xargs -r rm
    
    echo "$backup_name" > "$PROJECT_ROOT/.last_backup"
}

# Run pre-deployment checks
pre_deployment_checks() {
    log "Running pre-deployment checks..."
    
    cd "$PROJECT_ROOT"
    
    # Run tests
    log "Running tests..."
    npm run test:ci || {
        error "Tests failed!"
        exit 1
    }
    
    # Check security
    log "Running security audit..."
    npm audit --production --audit-level=high || {
        warn "Security vulnerabilities found. Review before proceeding."
    }
    
    # Build verification
    log "Verifying build..."
    npm run build || {
        error "Build failed!"
        exit 1
    }
    
    log "Pre-deployment checks passed."
}

# Deploy application
deploy_application() {
    log "Starting deployment..."
    
    cd "$PROJECT_ROOT"
    
    # Pull latest changes
    log "Pulling latest changes..."
    git pull origin main
    
    # Install dependencies
    log "Installing dependencies..."
    npm ci --production
    
    # Build Docker image
    log "Building Docker image..."
    docker-compose -f docker-compose.yml build --no-cache
    
    # Stop current deployment
    log "Stopping current deployment..."
    docker-compose down
    
    # Start new deployment
    log "Starting new deployment..."
    docker-compose up -d
    
    # Wait for health check
    log "Waiting for application to be healthy..."
    local max_attempts=30
    local attempt=0
    
    while [[ $attempt -lt $max_attempts ]]; do
        if docker-compose ps | grep -q "healthy"; then
            log "Application is healthy!"
            break
        fi
        
        sleep 10
        ((attempt++))
    done
    
    if [[ $attempt -eq $max_attempts ]]; then
        error "Application failed health check!"
        rollback
        exit 1
    fi
}

# Verify deployment
verify_deployment() {
    log "Verifying deployment..."
    
    # Check if containers are running
    if ! docker-compose ps | grep -q "Up"; then
        error "Containers are not running!"
        return 1
    fi
    
    # Check application endpoint
    local app_url="http://localhost:3000/api/health"
    if ! curl -f -s "$app_url" > /dev/null; then
        error "Application health check failed!"
        return 1
    fi
    
    # Run smoke tests
    log "Running smoke tests..."
    cd "$PROJECT_ROOT"
    npm run test:e2e -- --grep "@smoke" || {
        error "Smoke tests failed!"
        return 1
    }
    
    log "Deployment verification passed!"
    return 0
}

# Rollback deployment
rollback() {
    error "Rolling back deployment..."
    
    if [[ -f "$PROJECT_ROOT/.last_backup" ]]; then
        local backup_name=$(cat "$PROJECT_ROOT/.last_backup")
        local backup_path="$BACKUP_DIR/$backup_name.tar.gz"
        
        if [[ -f "$backup_path" ]]; then
            log "Restoring from backup: $backup_name"
            
            # Stop current deployment
            docker-compose down
            
            # Restore backup
            gunzip -c "$backup_path" | docker load
            
            # Start previous version
            docker-compose up -d
            
            log "Rollback completed."
        else
            error "Backup file not found!"
        fi
    else
        error "No backup information found!"
    fi
}

# Post-deployment tasks
post_deployment() {
    log "Running post-deployment tasks..."
    
    # Clear CDN cache
    log "Clearing CDN cache..."
    # Add CDN cache clearing command here
    
    # Update monitoring
    log "Updating monitoring..."
    # Add monitoring update command here
    
    # Send notification
    log "Sending deployment notification..."
    # Add notification command here
    
    log "Post-deployment tasks completed."
}

# Main deployment flow
main() {
    log "Starting ETF Research Platform deployment..."
    
    check_prerequisites
    create_backup
    pre_deployment_checks
    
    if deploy_application; then
        if verify_deployment; then
            post_deployment
            log "Deployment completed successfully!"
            exit 0
        else
            error "Deployment verification failed!"
            rollback
            exit 1
        fi
    else
        error "Deployment failed!"
        rollback
        exit 1
    fi
}

# Handle interrupts
trap 'error "Deployment interrupted!"; rollback; exit 1' INT TERM

# Run main function
main "$@"