#!/bin/bash
# Local Build & Test Script for IIS Deployment
# Runs Node.js server locally to verify it works before IIS deployment
# Usage: ./scripts/iis/test-local-server.sh

set -e

echo "========================================"
echo "Local Server Test for IIS Deployment"
echo "========================================"
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Check if Node.js is installed
echo -e "${CYAN}[1/5] Checking Node.js installation...${NC}"
if ! command -v node &> /dev/null; then
    echo -e "${RED}ERROR: Node.js is not installed${NC}"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js $NODE_VERSION found${NC}"
echo ""

# Navigate to frontend directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
FRONTEND_DIR="$REPO_ROOT/src/frontend"

if [ ! -d "$FRONTEND_DIR" ]; then
    echo -e "${RED}ERROR: Frontend directory not found at $FRONTEND_DIR${NC}"
    exit 1
fi

# Check if .next/standalone exists
echo -e "${CYAN}[2/5] Checking for build output...${NC}"
if [ ! -d "$FRONTEND_DIR/.next/standalone" ]; then
    echo -e "${YELLOW}⚠ Build output not found. Running build...${NC}"
    cd "$FRONTEND_DIR"
    npm ci
    npm run build
    cd "$SCRIPT_DIR"
fi
echo -e "${GREEN}✓ Build output found at $FRONTEND_DIR/.next/standalone${NC}"
echo ""

# Check environment variables
echo -e "${CYAN}[3/5] Checking environment variables...${NC}"
REQUIRED_VARS=(
    "AUTH_URL"
    "AUTH_SECRET"
    "AUTH_MICROSOFT_ENTRA_ID_ID"
    "AUTH_MICROSOFT_ENTRA_ID_SECRET"
    "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID"
)

MISSING_VARS=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo -e "${YELLOW}⚠ Missing environment variables:${NC}"
    for var in "${MISSING_VARS[@]}"; do
        echo -e "${YELLOW}  - $var${NC}"
    done
    echo ""
    echo -e "${YELLOW}Set these before running:${NC}"
    echo "  export AUTH_URL='https://localhost/auth'"
    echo "  export AUTH_SECRET='<random-secret>'"
    echo "  export AUTH_MICROSOFT_ENTRA_ID_ID='<your-entra-id>'"
    echo "  export AUTH_MICROSOFT_ENTRA_ID_SECRET='<your-secret>'"
    echo "  export AUTH_MICROSOFT_ENTRA_ID_TENANT_ID='<your-tenant-id>'"
    echo ""
    read -p "Continue anyway? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
else
    echo -e "${GREEN}✓ All required environment variables are set${NC}"
fi
echo ""

# Verify Node dependencies
echo -e "${CYAN}[4/5] Checking Node dependencies...${NC}"
cd "$FRONTEND_DIR/.next/standalone/src/frontend"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ Installing dependencies...${NC}"
    cd "$FRONTEND_DIR/.next/standalone"
    npm ci --production
    cd "$FRONTEND_DIR/.next/standalone/src/frontend"
fi
echo -e "${GREEN}✓ Dependencies ready${NC}"
echo ""

# Start the server
echo -e "${CYAN}[5/5] Starting Node.js server...${NC}"
echo ""
if [ -f "server.js" ]; then
  cp -f server.js server.cjs
fi
echo -e "${YELLOW}Server starting on http://localhost:3000${NC}"
echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
echo ""
echo "Logs:"
echo "====="

NODE_ENV=production node server.cjs
