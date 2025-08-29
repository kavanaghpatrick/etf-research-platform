#!/bin/bash

# ETF Research Platform - Development Server Manager
# This script helps manage backend and frontend servers properly

set -e

PROJECT_ROOT="/Users/patrickkavanagh/etf-research-platform"
BACKEND_PORT=8000
FRONTEND_PORT=3000

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i :$port > /dev/null 2>&1; then
        echo -e "${RED}Port $port is in use${NC}"
        lsof -i :$port
        return 0
    else
        echo -e "${GREEN}Port $port is free${NC}"
        return 1
    fi
}

# Function to show server status
status() {
    echo -e "${YELLOW}=== Server Status ===${NC}"
    echo -e "${YELLOW}Backend (Port $BACKEND_PORT):${NC}"
    check_port $BACKEND_PORT
    echo
    echo -e "${YELLOW}Frontend (Port $FRONTEND_PORT):${NC}"
    check_port $FRONTEND_PORT
    echo
    echo -e "${YELLOW}All Node/Python processes:${NC}"
    ps aux | grep -E "(node|uvicorn|python.*main)" | grep -v grep || echo "No relevant processes found"
}

# Function to kill servers
kill_servers() {
    echo -e "${YELLOW}Killing existing servers...${NC}"
    pkill -f "next dev" 2>/dev/null || echo "No Next.js dev server to kill"
    pkill -f "uvicorn.*main" 2>/dev/null || echo "No uvicorn server to kill"
    sleep 2
    echo -e "${GREEN}Servers killed${NC}"
}

# Function to start backend
start_backend() {
    echo -e "${YELLOW}Starting backend server...${NC}"
    cd "$PROJECT_ROOT/api"
    if [ ! -d "venv" ]; then
        echo -e "${RED}Virtual environment not found. Please run: python3 -m venv venv && source venv/bin/activate && pip install -r requirements.txt${NC}"
        exit 1
    fi
    
    source venv/bin/activate
    python -m uvicorn main:app --reload --port $BACKEND_PORT &
    BACKEND_PID=$!
    echo -e "${GREEN}Backend started with PID: $BACKEND_PID${NC}"
    
    # Wait for backend to start
    sleep 3
    if curl -s http://localhost:$BACKEND_PORT/health > /dev/null; then
        echo -e "${GREEN}Backend health check passed${NC}"
    else
        echo -e "${RED}Backend health check failed${NC}"
    fi
}

# Function to start frontend
start_frontend() {
    echo -e "${YELLOW}Starting frontend server...${NC}"
    cd "$PROJECT_ROOT/frontend"
    npm run dev &
    FRONTEND_PID=$!
    echo -e "${GREEN}Frontend started with PID: $FRONTEND_PID${NC}"
    
    # Wait for frontend to start
    sleep 5
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null; then
        echo -e "${GREEN}Frontend is responding${NC}"
    else
        echo -e "${RED}Frontend is not responding yet (may take a moment)${NC}"
    fi
}

# Function to start both servers
start_all() {
    kill_servers
    start_backend
    start_frontend
    echo -e "${GREEN}=== Both servers started ===${NC}"
    echo -e "${GREEN}Backend: http://localhost:$BACKEND_PORT${NC}"
    echo -e "${GREEN}Frontend: http://localhost:$FRONTEND_PORT${NC}"
    echo -e "${GREEN}Monte Carlo: http://localhost:$FRONTEND_PORT/monte-carlo${NC}"
}

# Function to test endpoints
test_endpoints() {
    echo -e "${YELLOW}=== Testing Endpoints ===${NC}"
    
    echo -e "${YELLOW}Backend health:${NC}"
    curl -s http://localhost:$BACKEND_PORT/health | jq . || echo "Backend not responding"
    
    echo -e "${YELLOW}Frontend home:${NC}"
    if curl -s http://localhost:$FRONTEND_PORT > /dev/null; then
        echo -e "${GREEN}Frontend is responding${NC}"
    else
        echo -e "${RED}Frontend not responding${NC}"
    fi
    
    echo -e "${YELLOW}Monte Carlo page:${NC}"
    if curl -s http://localhost:$FRONTEND_PORT/monte-carlo > /dev/null; then
        echo -e "${GREEN}Monte Carlo page is responding${NC}"
    else
        echo -e "${RED}Monte Carlo page not responding${NC}"
    fi
}

# Main command handling
case "$1" in
    "status")
        status
        ;;
    "kill")
        kill_servers
        ;;
    "start-backend")
        start_backend
        ;;
    "start-frontend")
        start_frontend
        ;;
    "start"|"start-all")
        start_all
        ;;
    "test")
        test_endpoints
        ;;
    "restart")
        kill_servers
        start_all
        ;;
    *)
        echo -e "${YELLOW}Usage: $0 {status|kill|start-backend|start-frontend|start|test|restart}${NC}"
        echo
        echo -e "${YELLOW}Commands:${NC}"
        echo -e "  status        - Show current server status"
        echo -e "  kill          - Kill all servers"
        echo -e "  start-backend - Start only backend server"
        echo -e "  start-frontend- Start only frontend server"
        echo -e "  start         - Start both servers"
        echo -e "  test          - Test all endpoints"
        echo -e "  restart       - Kill and restart all servers"
        exit 1
        ;;
esac