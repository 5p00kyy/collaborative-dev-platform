#!/bin/bash

# ============================================
# Platform Setup Script
# ============================================

set -e

echo "🚀 Collaborative Dev Platform - Setup Script"
echo "=============================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    echo "Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed${NC}"
    echo "Please install Docker Compose from https://docs.docker.com/compose/install/"
    exit 1
fi

echo -e "${GREEN}✅ Docker is installed${NC}"
echo ""

# Check for .env file
if [ ! -f "docker/.env" ]; then
    echo -e "${YELLOW}⚙️  Creating .env file from template...${NC}"
    cp docker/.env.example docker/.env
    
    # Generate random secrets
    JWT_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change_this_jwt_secret_in_production")
    JWT_REFRESH_SECRET=$(openssl rand -hex 32 2>/dev/null || echo "change_this_refresh_secret_in_production")
    DB_PASSWORD=$(openssl rand -hex 16 2>/dev/null || echo "change_this_db_password")
    
    # Update .env with generated secrets
    sed -i "s/your_jwt_secret_key_change_this_in_production/$JWT_SECRET/g" docker/.env 2>/dev/null || \
        sed -i '' "s/your_jwt_secret_key_change_this_in_production/$JWT_SECRET/g" docker/.env
    sed -i "s/your_refresh_secret_change_this_in_production/$JWT_REFRESH_SECRET/g" docker/.env 2>/dev/null || \
        sed -i '' "s/your_refresh_secret_change_this_in_production/$JWT_REFRESH_SECRET/g" docker/.env
    sed -i "s/your_secure_password_here/$DB_PASSWORD/g" docker/.env 2>/dev/null || \
        sed -i '' "s/your_secure_password_here/$DB_PASSWORD/g" docker/.env
    
    echo -e "${GREEN}✅ .env file created with random secrets${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

echo ""
echo "📦 Installing backend dependencies..."
cd backend
npm install --silent
cd ..
echo -e "${GREEN}✅ Dependencies installed${NC}"

echo ""
echo "🐳 Starting Docker containers..."
cd docker
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

echo ""
echo "📊 Running database migration..."
cd ../backend
npm run migrate

echo ""
echo "🌱 Seeding database with demo data..."
npm run seed

cd ..

echo ""
echo -e "${GREEN}✅ Setup completed successfully!${NC}"
echo ""
echo "=============================================="
echo "🎉 Platform is ready!"
echo "=============================================="
echo ""
echo "📍 Access points:"
echo "   Frontend: http://localhost:8080"
echo "   Backend:  http://localhost:3000"
echo "   API Docs: http://localhost:3000/api"
echo ""
echo "👥 Demo credentials:"
echo "   Email:    admin@demo.com"
echo "   Password: Demo123!"
echo ""
echo "📝 Useful commands:"
echo "   Stop:    cd docker && docker-compose down"
echo "   Logs:    cd docker && docker-compose logs -f"
echo "   Restart: cd docker && docker-compose restart"
echo ""
