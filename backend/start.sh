#!/bin/bash

# USDT Bridge Relayer Startup Script

echo "==================================="
echo "USDT Bridge Relayer Service"
echo "==================================="
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please copy .env.example to .env and configure it."
    exit 1
fi

# Check if node_modules exists
if [ ! -d node_modules ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Create logs directory if it doesn't exist
mkdir -p logs

echo "✅ Starting relayer service..."
echo ""

# Start the relayer
npm start
