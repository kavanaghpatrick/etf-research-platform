# ETF Research Platform - Production Deployment Guide

## Table of Contents
1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Environment Setup](#environment-setup)
4. [Deployment Process](#deployment-process)
5. [Post-Deployment Verification](#post-deployment-verification)
6. [Rollback Procedures](#rollback-procedures)
7. [Monitoring and Alerting](#monitoring-and-alerting)
8. [Troubleshooting](#troubleshooting)
9. [Security Considerations](#security-considerations)
10. [Maintenance Procedures](#maintenance-procedures)

## Overview

This guide provides comprehensive instructions for deploying the ETF Research Platform frontend to production. The platform is containerized using Docker and can be deployed to various cloud providers or on-premises infrastructure.

### Architecture Overview
- **Frontend**: Next.js 15 application
- **Web Server**: Nginx reverse proxy with caching
- **Container Runtime**: Docker with Docker Compose
- **Monitoring**: Sentry for error tracking, custom APM solution
- **CDN**: Configured for static asset delivery

## Prerequisites

### Required Tools
- Docker 20.10+ and Docker Compose 2.0+
- Node.js 20+ and npm 10+
- Git 2.30+
- SSL certificates for production domain
- Access to production infrastructure

### Required Access
- GitHub repository access
- Container registry credentials
- Production server SSH access
- Monitoring service credentials (Sentry, etc.)
- CDN management access

### Environment Variables
Ensure all required environment variables are configured in `.env.production`:
```bash
API_BASE_URL=https://api.etf-research.com
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
SENTRY_AUTH_TOKEN=your-sentry-auth-token
# ... see .env.example for complete list
```

## Environment Setup

### 1. Production Server Preparation

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create deployment directory
sudo mkdir -p /opt/etf-frontend
sudo chown $USER:$USER /opt/etf-frontend
```

### 2. SSL Certificate Setup

```bash
# Create SSL directory
mkdir -p nginx/ssl

# Copy certificates (example using Let's Encrypt)
sudo cp /etc/letsencrypt/live/etf-research.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/etf-research.com/privkey.pem nginx/ssl/key.pem
sudo chmod 600 nginx/ssl/*
```

### 3. Clone Repository

```bash
cd /opt/etf-frontend
git clone https://github.com/your-org/etf-research-platform.git .
cd frontend
```

## Deployment Process

### Automated Deployment

The recommended approach is to use the automated deployment script:

```bash
# Make script executable
chmod +x scripts/deployment/deploy.sh

# Run deployment
./scripts/deployment/deploy.sh
```

### Manual Deployment Steps

If you need to deploy manually:

#### 1. Pre-deployment Checks
```bash
# Run tests
npm ci
npm run test:ci

# Security audit
npm audit --production

# Build verification
npm run build
```

#### 2. Build Docker Image
```bash
# Build with production configuration
docker-compose -f docker-compose.yml build --no-cache

# Tag image with version
docker tag etf-research-frontend:latest etf-research-frontend:$(date +%Y%m%d-%H%M%S)
```

#### 3. Deploy Application
```bash
# Stop current deployment
docker-compose down

# Start new deployment
docker-compose up -d

# View logs
docker-compose logs -f
```

### CI/CD Deployment

For automated deployments via GitHub Actions:

1. Push to main branch triggers production deployment
2. Monitor deployment progress in GitHub Actions tab
3. Deployment requires approval for production environment

## Post-Deployment Verification

### 1. Health Checks

```bash
# Run health check script
./scripts/deployment/health-check.sh

# Manual health check
curl -f https://etf-research.com/api/health
```

### 2. Smoke Tests

```bash
# Run smoke tests against production
npm run test:e2e -- --grep "@smoke" --env PRODUCTION_URL=https://etf-research.com
```

### 3. Performance Verification

```bash
# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://etf-research.com

# Verify CDN caching
curl -I https://etf-research.com/_next/static/chunks/main.js | grep -i cache
```

### 4. Security Verification

```bash
# Check security headers
curl -I https://etf-research.com | grep -E "(Content-Security-Policy|Strict-Transport-Security|X-Frame-Options)"

# SSL certificate check
openssl s_client -connect etf-research.com:443 -servername etf-research.com < /dev/null | openssl x509 -noout -dates
```

## Rollback Procedures

### Automated Rollback

The deployment script includes automatic rollback on failure:

```bash
# Rollback is triggered automatically if deployment fails
# Manual rollback can be initiated:
docker-compose down
docker load < /var/backups/etf-frontend/[backup-name].tar.gz
docker-compose up -d
```

### Manual Rollback Steps

1. **Identify the issue**
   ```bash
   docker-compose logs --tail=100
   ```

2. **Stop current deployment**
   ```bash
   docker-compose down
   ```

3. **Restore previous version**
   ```bash
   # List available backups
   ls -la /var/backups/etf-frontend/

   # Restore specific backup
   docker load < /var/backups/etf-frontend/etf-frontend-20250713-120000.tar.gz
   ```

4. **Start previous version**
   ```bash
   docker-compose up -d
   ```

5. **Verify rollback**
   ```bash
   ./scripts/deployment/health-check.sh
   ```

## Monitoring and Alerting

### 1. Application Monitoring

- **Sentry**: Error tracking and performance monitoring
  - Dashboard: https://sentry.io/organizations/your-org/projects/etf-frontend/
  - Alerts configured for error rate > 5%

- **Custom APM**: Application performance metrics
  - Metrics sent to monitoring endpoint
  - Web Vitals tracking (LCP, FID, CLS)
  - API response time monitoring

### 2. Infrastructure Monitoring

- **Docker Health Checks**: Container health status
  ```bash
  docker-compose ps
  ```

- **Nginx Metrics**: Request rates, cache hit ratios
  ```bash
  curl http://localhost/nginx-status
  ```

### 3. Alerting Rules

Alerts are configured for:
- High error rate (>5%)
- Slow API responses (>1s p95)
- High memory usage (>80%)
- Container down
- SSL certificate expiration (<30 days)

### 4. Viewing Logs

```bash
# Application logs
docker-compose logs -f frontend

# Nginx logs
docker-compose logs -f nginx

# All services
docker-compose logs -f

# Structured logs (production)
tail -f /var/log/etf-deployment.log
```

## Troubleshooting

### Common Issues and Solutions

#### 1. Container Won't Start
```bash
# Check logs
docker-compose logs frontend

# Common causes:
# - Missing environment variables
# - Port conflicts
# - Insufficient memory

# Solutions:
# - Verify .env.production file
# - Check port availability: netstat -tulpn | grep 3000
# - Increase memory limits in docker-compose.yml
```

#### 2. Health Check Failures
```bash
# Debug health endpoint
docker-compose exec frontend curl http://localhost:3000/api/health

# Check container health
docker inspect etf-research-frontend | jq '.[0].State.Health'
```

#### 3. Performance Issues
```bash
# Check resource usage
docker stats

# Review cache hit rates
docker-compose exec nginx cat /var/log/nginx/access.log | grep "HIT\|MISS" | tail -20

# Check for memory leaks
docker-compose exec frontend node -e "console.log(process.memoryUsage())"
```

#### 4. SSL/TLS Issues
```bash
# Verify certificate
openssl s_client -connect etf-research.com:443 -servername etf-research.com

# Check Nginx SSL configuration
docker-compose exec nginx nginx -t
```

### Debug Mode

Enable debug logging:
```bash
# Set in .env.production
LOG_LEVEL=debug

# Restart services
docker-compose restart
```

## Security Considerations

### 1. Pre-deployment Security Checklist
- [ ] All dependencies updated and audited
- [ ] Environment variables properly secured
- [ ] SSL certificates valid and not expiring
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] CORS properly configured
- [ ] CSP policy implemented

### 2. Runtime Security
- Containers run as non-root user
- Read-only root filesystem where possible
- Network policies restrict container communication
- Secrets managed via environment variables
- Regular security scanning with Trivy

### 3. Security Monitoring
- Failed authentication attempts logged
- Suspicious request patterns detected
- Rate limiting enforced
- Security headers validated
- Regular penetration testing scheduled

## Maintenance Procedures

### 1. Regular Updates

#### Weekly Tasks
- Review error logs and metrics
- Check for security updates
- Verify backup integrity
- Review alerting thresholds

#### Monthly Tasks
- Update dependencies
- Rotate logs
- Review and update security policies
- Performance optimization review

### 2. Backup Procedures

Automated backups are created before each deployment:
```bash
# Manual backup
docker save etf-research-frontend:latest | gzip > backup-$(date +%Y%m%d-%H%M%S).tar.gz

# Restore from backup
docker load < backup-20250713-120000.tar.gz
```

### 3. Certificate Renewal

For Let's Encrypt certificates:
```bash
# Renew certificates
sudo certbot renew

# Copy to application
sudo cp /etc/letsencrypt/live/etf-research.com/fullchain.pem nginx/ssl/cert.pem
sudo cp /etc/letsencrypt/live/etf-research.com/privkey.pem nginx/ssl/key.pem

# Restart Nginx
docker-compose restart nginx
```

### 4. Scaling Procedures

#### Horizontal Scaling
```yaml
# In docker-compose.yml, add replicas
services:
  frontend:
    deploy:
      replicas: 3
```

#### Vertical Scaling
```yaml
# Increase resource limits
services:
  frontend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 1G
```

## Emergency Contacts

- **On-call Engineer**: Use PagerDuty rotation
- **Infrastructure Team**: infrastructure@etf-research.com
- **Security Team**: security@etf-research.com
- **Escalation**: CTO / VP Engineering

## Appendix

### A. Environment Variables Reference

See `.env.production` and `.env.example` for complete list of environment variables.

### B. Useful Commands

```bash
# View real-time metrics
docker stats

# Export logs
docker-compose logs > deployment-logs-$(date +%Y%m%d).log

# Clean up old images
docker image prune -a --filter "until=168h"

# Backup database (if applicable)
docker-compose exec db pg_dump -U postgres etf_db > backup.sql
```

### C. Infrastructure as Code

For cloud deployments, use provided Terraform/CloudFormation templates in the `infrastructure/` directory.

### D. Compliance

Ensure deployments comply with:
- GDPR requirements
- SOC 2 controls
- Industry-specific regulations

---

**Last Updated**: July 13, 2025  
**Version**: 1.0  
**Maintained by**: Platform Engineering Team