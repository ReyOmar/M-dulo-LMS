#!/bin/bash

# Quick test script to verify deployment preparation works

set -e

echo "🧪 Testing deployment preparation script..."
echo ""

# Set environment variable to disable packing for quick test
export PACK_NODE_MODULES=false

# Run the preparation script
bash .devcontainer/scripts/prepare_deployment.sh

echo ""
echo "✅ Script completed successfully!"
echo ""
echo "Checking results:"
echo ""

# Check if deployment directory exists
if [ -d "deployment" ]; then
    echo "✓ deployment/ directory created"

    # Check API
    if [ -d "deployment/api/dist" ]; then
        echo "✓ API built (dist/ exists)"
    else
        echo "✗ API build missing"
    fi

    if [ -d "deployment/api/node_modules" ]; then
        echo "✓ API node_modules exists"
    else
        echo "✗ API node_modules missing"
    fi

    # Check Client
    if [ -d "deployment/client/.next" ]; then
        echo "✓ Client built (.next/ exists)"
    else
        echo "✗ Client build missing"
    fi

    if [ -d "deployment/client/node_modules" ]; then
        echo "✓ Client node_modules exists"
    else
        echo "✗ Client node_modules missing"
    fi

    # Check ZIP
    if [ -f "deployment/deployment.zip" ]; then
        echo "✓ deployment.zip created"
        SIZE=$(du -h deployment/deployment.zip | cut -f1)
        echo "  Size: $SIZE"
    else
        echo "✗ deployment.zip missing"
    fi
else
    echo "✗ deployment/ directory not created"
    exit 1
fi

echo ""
echo "🎉 Test completed!"
