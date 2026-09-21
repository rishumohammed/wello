#!/usr/bin/env bash
# ==============================================================================
# Wello Manual Server Deployment Script (Zero-Downtime Migration & Health Probing)
# ==============================================================================

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}       WELLO PRODUCTION MANUAL DEPLOYMENT PIPELINE    ${NC}"
echo -e "${BLUE}======================================================${NC}"

# Step 1: Check Environment File
if [ ! -f .env ]; then
    echo -e "${RED}[ERROR] .env file not found in current directory!${NC}"
    echo -e "${YELLOW}Please copy .env.example to .env and configure production secrets before deploying.${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] .env file found.${NC}"

# Step 2: Git Pull Latest Changes
echo -e "\n${BLUE}[1/6] Pulling latest updates from Git...${NC}"
git pull origin $(git rev-parse --abbrev-ref HEAD)

# Step 3: Pre-Deployment Database Snapshot
echo -e "\n${BLUE}[2/6] Performing pre-deployment database backup...${NC}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"

if docker compose ps -q mysql >/dev/null 2>&1 && [ -n "$(docker compose ps -q mysql)" ]; then
    BACKUP_FILE="$BACKUP_DIR/pre_deploy_backup_${TIMESTAMP}.sql.gz"
    echo -e "${YELLOW}Creating snapshot: $BACKUP_FILE ...${NC}"
    
    # Load DB credentials from .env
    DB_NAME=$(grep -E '^DB_NAME=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "wello")
    DB_USER=$(grep -E '^DB_USER=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "wello_user")
    DB_PASSWORD=$(grep -E '^DB_PASSWORD=' .env | cut -d '=' -f2- | tr -d '"' | tr -d "'" || echo "")
    
    docker compose exec -T mysql mysqldump -u"$DB_USER" -p"$DB_PASSWORD" --single-transaction --routines --triggers "$DB_NAME" | gzip > "$BACKUP_FILE"
    echo -e "${GREEN}[OK] Pre-deployment database backup created at $BACKUP_FILE${NC}"
else
    echo -e "${YELLOW}[SKIP] MySQL container is not running yet. Skipping pre-deploy DB snapshot.${NC}"
fi

# Step 4: Build and Restart Docker Containers
echo -e "\n${BLUE}[3/6] Building and starting updated containers...${NC}"
docker compose up -d --build --remove-orphans

# Step 5: Execute Database Migrations
echo -e "\n${BLUE}[4/6] Running Knex database migrations...${NC}"
# Wait for backend container to be responsive
sleep 5
docker compose exec -T backend npx knex migrate:latest --knexfile knexfile.cjs
echo -e "${GREEN}[OK] Database migrations completed successfully.${NC}"

# Step 6: Healthcheck Verification & Probe
echo -e "\n${BLUE}[5/6] Probing backend and system health endpoints...${NC}"
MAX_RETRIES=12
RETRY_COUNT=0
HEALTHY=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost/api/health || curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || echo "000")
    if [ "$HTTP_CODE" -eq 200 ]; then
        HEALTHY=1
        break
    fi
    echo -e "${YELLOW}Waiting for application healthcheck (Attempt $((RETRY_COUNT+1))/$MAX_RETRIES, status: $HTTP_CODE)...${NC}"
    sleep 3
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ $HEALTHY -eq 1 ]; then
    echo -e "${GREEN}[SUCCESS] Health check passed (HTTP 200).${NC}"
    echo -e "\n${BLUE}[6/6] Deployment finished successfully!${NC}"
    echo -e "${GREEN}Wello is live and serving traffic at http://localhost${NC}"
else
    echo -e "${RED}[FATAL] Health check failed after $MAX_RETRIES attempts!${NC}"
    echo -e "${YELLOW}Check container logs: docker compose logs -n 50 backend${NC}"
    exit 1
fi
