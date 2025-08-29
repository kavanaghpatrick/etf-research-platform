#!/bin/bash

# Health check script for ETF Research Platform

set -euo pipefail

# Configuration
HEALTH_ENDPOINT="${HEALTH_ENDPOINT:-http://localhost:3000/api/health}"
TIMEOUT="${TIMEOUT:-5}"
MAX_RETRIES="${MAX_RETRIES:-3}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check health endpoint
check_health() {
    local retry=0
    local status
    
    while [[ $retry -lt $MAX_RETRIES ]]; do
        echo -n "Checking health endpoint (attempt $((retry + 1))/$MAX_RETRIES)... "
        
        if status=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout "$TIMEOUT" "$HEALTH_ENDPOINT"); then
            if [[ "$status" == "200" ]]; then
                echo -e "${GREEN}OK${NC}"
                return 0
            else
                echo -e "${YELLOW}HTTP $status${NC}"
            fi
        else
            echo -e "${RED}Failed${NC}"
        fi
        
        ((retry++))
        if [[ $retry -lt $MAX_RETRIES ]]; then
            sleep 2
        fi
    done
    
    return 1
}

# Check Docker containers
check_containers() {
    echo -n "Checking Docker containers... "
    
    if docker-compose ps 2>/dev/null | grep -q "etf-research-frontend.*Up.*healthy"; then
        echo -e "${GREEN}OK${NC}"
        return 0
    else
        echo -e "${RED}Not healthy${NC}"
        return 1
    fi
}

# Check memory usage
check_memory() {
    echo -n "Checking memory usage... "
    
    local container_name="etf-research-frontend"
    local memory_limit=512 # MB
    
    if docker stats --no-stream --format "{{.MemUsage}}" "$container_name" 2>/dev/null | grep -q "MiB"; then
        local usage=$(docker stats --no-stream --format "{{.MemUsage}}" "$container_name" | awk '{print $1}' | sed 's/MiB//')
        
        if (( $(echo "$usage < $memory_limit" | bc -l) )); then
            echo -e "${GREEN}OK (${usage}MB / ${memory_limit}MB)${NC}"
            return 0
        else
            echo -e "${RED}High (${usage}MB / ${memory_limit}MB)${NC}"
            return 1
        fi
    else
        echo -e "${YELLOW}Unable to check${NC}"
        return 0
    fi
}

# Main health check
main() {
    echo "Running health checks for ETF Research Platform..."
    echo "================================================"
    
    local failed=0
    
    check_health || ((failed++))
    check_containers || ((failed++))
    check_memory || ((failed++))
    
    echo "================================================"
    
    if [[ $failed -eq 0 ]]; then
        echo -e "${GREEN}All health checks passed!${NC}"
        exit 0
    else
        echo -e "${RED}$failed health check(s) failed!${NC}"
        exit 1
    fi
}

main "$@"