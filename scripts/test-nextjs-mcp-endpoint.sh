#!/bin/bash
# Test script to verify Next.js MCP endpoint when dev server is running

echo "🔍 Testing Next.js MCP Endpoint Discovery"
echo "=========================================="
echo ""

CMS_PORT=4000
MCP_ENDPOINT="http://localhost:${CMS_PORT}/_next/mcp"

echo "1. Checking if CMS dev server is running on port ${CMS_PORT}..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:${CMS_PORT} > /dev/null 2>&1; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${CMS_PORT})
    if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
        echo "   ✅ Server is running (HTTP ${HTTP_CODE})"
        
        echo ""
        echo "2. Checking Next.js MCP endpoint..."
        if curl -s "${MCP_ENDPOINT}" > /dev/null 2>&1; then
            echo "   ✅ MCP endpoint is accessible"
            echo ""
            echo "3. Fetching MCP server info..."
            curl -s "${MCP_ENDPOINT}" | head -20
        else
            echo "   ❌ MCP endpoint not accessible"
            echo "   This is normal if Next.js < 16 or endpoint disabled"
        fi
    else
        echo "   ❌ Server not responding correctly (HTTP ${HTTP_CODE})"
    fi
else
    echo "   ❌ Dev server not running on port ${CMS_PORT}"
    echo ""
    echo "   To start it:"
    echo "   cd apps/cms && pnpm dev"
fi

echo ""
echo "=========================================="
echo ""
echo "📝 Next.js DevTools MCP Tools Available:"
echo "   • nextjs_index - Discover running servers"
echo "   • nextjs_call - Execute diagnostic tools"
echo "   • upgrade_nextjs_16 - Automated upgrade"
echo "   • enable_cache_components - Cache Components setup"
echo ""
