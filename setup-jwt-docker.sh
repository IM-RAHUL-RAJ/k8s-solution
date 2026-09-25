#!/usr/bin/env bash

# Setup script to configure JWT_SECRET for Docker services on Linux VM
# Usage: ./setup-jwt-docker.sh <username> <vm-ip>

set -euo pipefail

USERNAME="${1:-ec2-user}"
VM_IP="${2:-10.8.76.150}"
JWT_SECRET="security-secret-for-etp-capstone-team2-2026"

echo "🔐 Setting up JWT_SECRET for Docker services"
echo ""
echo "Target VM: $USERNAME@$VM_IP"
echo "JWT_SECRET: $JWT_SECRET"
echo ""

# Step 1: Create .env file on Linux VM
echo "📝 Step 1: Creating .env file on Linux VM..."
ssh "$USERNAME@$VM_IP" "cat > .env << 'EOF'
JWT_SECRET=$JWT_SECRET
DB_NAME=springboot_db
DB_USER=postgres
DB_PASSWORD=postgres
POSTGRES_PORT=5432
TRADE_API_PORT=8084
EXECUTOR_PORT=8085
AUTH_PORT=8081
JWT_ISSUER=auth-service
EOF
"
echo "✓ .env file created"
echo ""

# Step 2: Stop existing containers if running
echo "🛑 Step 2: Stopping existing containers (if any)..."
ssh "$USERNAME@$VM_IP" "docker-compose down 2>/dev/null || true"
echo "✓ Containers stopped"
echo ""

# Step 3: Start services with JWT_SECRET
echo "🚀 Step 3: Starting Docker services..."
ssh "$USERNAME@$VM_IP" "docker-compose --profile platform up -d"
echo "✓ Services started"
echo ""

# Step 4: Verify JWT_SECRET is set in containers
echo "✅ Step 4: Verifying JWT_SECRET in containers..."
echo ""
echo "JWT_SECRET in 'backend' (Trade API) container:"
ssh "$USERNAME@$VM_IP" "docker-compose exec -T backend env | grep JWT_SECRET || echo '  ✗ Not set'"
echo ""
echo "JWT_SECRET in 'auth-service' container:"
ssh "$USERNAME@$VM_IP" "docker-compose exec -T auth-service env | grep JWT_SECRET || echo '  ✗ Not set'"
echo ""

# Step 5: Wait for services to be healthy
echo "⏳ Step 5: Waiting for services to be healthy..."
sleep 10
echo "✓ Services should be ready"
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Setup complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Start Auth Service locally:"
echo "   npm start"
echo ""
echo "2. Run integration tests:"
echo "   ./integration-test.sh"
echo ""
echo "Useful Docker commands:"
echo "  View logs: ssh $USERNAME@$VM_IP 'docker-compose logs backend'"
echo "  Stop services: ssh $USERNAME@$VM_IP 'docker-compose down'"
echo "  Restart services: ssh $USERNAME@$VM_IP 'docker-compose up -d'"
echo ""
