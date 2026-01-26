#!/bin/bash

# Staging Deployment Script
# This script handles deploying to staging environment for performance testing

set -e

echo "🚀 Starting staging deployment..."

# Load environment variables
if [ -f ".env.staging" ]; then
    export $(cat .env.staging | xargs)
fi

# Build the application
echo "📦 Building application..."
pnpm build

# Deploy to staging (customize based on your platform)
echo "🌐 Deploying to staging..."

# Example deployment commands (customize for your platform):
# For Vercel:
# npx vercel --prod=false

# For Railway:
# railway deploy

# For Render:
# Add your Render deployment logic

# For custom deployment:
# rsync -avz dist/ user@staging-server:/var/www/html/

# For Docker:
# docker build -t myapp:staging .
# docker tag myapp:staging registry.example.com/myapp:staging
# docker push registry.example.com/myapp:staging

echo "⏳ Waiting for staging deployment to be ready..."
sleep 30

# Health check
echo "🔍 Performing health check..."
MAX_ATTEMPTS=10
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    echo "Health check attempt $ATTEMPT/$MAX_ATTEMPTS..."

    if curl -f -s "$STAGING_URL/api/health" > /dev/null 2>&1; then
        echo "✅ Staging deployment successful!"
        echo "🌐 Staging URL: $STAGING_URL"
        exit 0
    fi

    sleep 10
    ((ATTEMPT++))
done

echo "❌ Staging deployment failed - health check unsuccessful"
exit 1