#!/bin/bash

# EC2 배포 스크립트
set -e

echo "🚀 Starting deployment..."

cd ~/3d-render

echo "📥 Pulling latest code..."
git pull origin main

echo "📦 Installing dependencies..."
npm install --legacy-peer-deps

echo "🔨 Building application..."
NODE_OPTIONS="--max-old-space-size=1024" npm run build

echo "🔄 Restarting PM2..."
pm2 restart 3d-render

echo "✅ Deployment complete!"
pm2 status
