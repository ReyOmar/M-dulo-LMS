#!/bin/bash

# Verification script for deployment package
# This checks that the deployment package is ready for cPanel

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

DEPLOYMENT_DIR="deployment"
ERRORS=0
WARNINGS=0

print_header() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
    ((ERRORS++))
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if deployment directory exists
check_deployment_exists() {
    print_header "Checking deployment directory"

    if [ ! -d "$DEPLOYMENT_DIR" ]; then
        print_error "Deployment directory not found: $DEPLOYMENT_DIR"
        echo "  Run: bash .devcontainer/scripts/prepare_deployment.sh"
        exit 1
    fi
    print_success "Deployment directory exists"
}

# Check API structure
check_api() {
    print_header "Checking API (Backend)"

    local api_dir="$DEPLOYMENT_DIR/api"

    if [ ! -d "$api_dir" ]; then
        print_error "API directory not found"
        return
    fi
    print_success "API directory exists"

    # Check essential files
    [ -f "$api_dir/package.json" ] && print_success "package.json exists" || print_error "package.json missing"
    [ -d "$api_dir/dist" ] && print_success "dist/ directory exists (compiled code)" || print_error "dist/ directory missing - build may have failed"

    # Check node_modules (either directory or tarball)
    if [ -d "$api_dir/node_modules" ]; then
        print_success "node_modules/ exists (extracted)"
    elif [ -f "$api_dir/node_modules.tar.gz" ]; then
        print_success "node_modules.tar.gz exists (packed for cPanel)"
        [ -f "$api_dir/extract-node-modules.sh" ] && print_success "extract-node-modules.sh exists" || print_warning "extraction script missing"
    else
        print_error "node_modules missing (neither directory nor tarball)"
    fi

    # Check Prisma
    [ -d "$api_dir/prisma" ] && print_success "prisma/ directory exists" || print_warning "prisma/ directory missing"
    [ -d "$api_dir/generated/prisma" ] && print_success "Prisma client generated" || print_error "Prisma client missing"

    # Check for main entry point
    if [ -f "$api_dir/dist/main.js" ]; then
        print_success "Entry point exists: dist/main.js"
    else
        print_error "Entry point missing: dist/main.js"
    fi

    # Check node_modules size
    if [ -d "$api_dir/node_modules" ]; then
        local size=$(du -sh "$api_dir/node_modules" 2>/dev/null | cut -f1 || echo "?")
        print_info "node_modules size: $size"
    fi

    # Check for development artifacts (should not exist)
    [ ! -d "$api_dir/src" ] && print_success "src/ removed (good)" || print_warning "src/ still exists (not critical)"
    [ ! -d "$api_dir/test" ] && print_success "test/ removed (good)" || print_warning "test/ still exists (not critical)"

    # Check for critical native binaries
    check_binary "$api_dir/node_modules/bcrypt" "bcrypt"
    check_binary "$api_dir/node_modules/@prisma/client" "Prisma Client"
    check_binary "$api_dir/node_modules/.prisma" "Prisma engines"
}

# Check Client structure
check_client() {
    print_header "Checking Client (Frontend)"

    local client_dir="$DEPLOYMENT_DIR/client"

    if [ ! -d "$client_dir" ]; then
        print_error "Client directory not found"
        return
    fi
    print_success "Client directory exists"

    # Check essential files
    [ -f "$client_dir/package.json" ] && print_success "package.json exists" || print_error "package.json missing"
    [ -d "$client_dir/.next" ] && print_success ".next/ directory exists (built)" || print_error ".next/ directory missing - build may have failed"

    # Check node_modules (either directory or tarball)
    if [ -d "$client_dir/node_modules" ]; then
        print_success "node_modules/ exists (extracted)"
    elif [ -f "$client_dir/node_modules.tar.gz" ]; then
        print_success "node_modules.tar.gz exists (packed for cPanel)"
        [ -f "$client_dir/extract-node-modules.sh" ] && print_success "extract-node-modules.sh exists" || print_warning "extraction script missing"
    else
        print_error "node_modules missing (neither directory nor tarball)"
    fi

    [ -d "$client_dir/public" ] && print_success "public/ directory exists" || print_warning "public/ directory missing"

    # Check for server file
    if [ -f "$client_dir/server.js" ]; then
        print_success "Custom server.js exists"
    elif [ -f "$client_dir/.next/standalone/server.js" ]; then
        print_success "Next.js standalone server exists"
    else
        print_warning "No server.js found - using Next.js default"
    fi

    # Check node_modules size if packed
    if [ -f "$client_dir/node_modules.tar.gz" ]; then
        local size=$(du -sh "$client_dir/node_modules.tar.gz" 2>/dev/null | cut -f1 || echo "?")
        print_info "node_modules.tar.gz size: $size"
    elif [ -d "$client_dir/node_modules" ]; then
        local size=$(du -sh "$client_dir/node_modules" 2>/dev/null | cut -f1 || echo "?")
        print_info "node_modules size: $size"
    fi    # Check for development artifacts
    [ ! -d "$client_dir/src" ] && print_success "src/ removed (good)" || print_warning "src/ still exists (not critical for Next.js)"
}

# Check for native binaries
check_binary() {
    local module_path="$1"
    local module_name="$2"

    if [ -d "$module_path" ]; then
        # Look for .node files (native binaries)
        local node_files=$(find "$module_path" -name "*.node" 2>/dev/null | wc -l)
        local so_files=$(find "$module_path" -name "*.so" 2>/dev/null | wc -l)

        if [ "$node_files" -gt 0 ] || [ "$so_files" -gt 0 ]; then
            print_success "$module_name has native binaries ($node_files .node, $so_files .so)"

            # Check if they're Linux binaries
            local first_binary=$(find "$module_path" -name "*.node" -o -name "*.so" 2>/dev/null | head -1)
            if [ -n "$first_binary" ]; then
                if file "$first_binary" | grep -q "ELF.*x86-64"; then
                    print_success "$module_name binaries are Linux x86-64 (correct)"
                else
                    print_error "$module_name binaries may not be Linux compatible!"
                fi
            fi
        fi
    fi
}

# Check deployment zip
check_zip() {
    print_header "Checking ZIP file"

    local zip_file="$DEPLOYMENT_DIR/deployment.zip"

    if [ ! -f "$zip_file" ]; then
        print_error "deployment.zip not found"
        return
    fi
    print_success "deployment.zip exists"

    # Check size
    if command -v du &> /dev/null; then
        local size=$(du -h "$zip_file" 2>/dev/null | cut -f1 || echo "?")
        print_info "ZIP size: $size"

        # Warn if too large
        local size_mb=$(du -m "$zip_file" 2>/dev/null | cut -f1 || echo "0")
        if [ "$size_mb" -gt 500 ]; then
            print_warning "ZIP is quite large (${size_mb}MB) - upload may take time"
        fi
    fi

    # Check contents
    if command -v unzip &> /dev/null; then
        local has_api=$(unzip -l "$zip_file" | grep -c "api/" || echo "0")
        local has_client=$(unzip -l "$zip_file" | grep -c "client/" || echo "0")

        [ "$has_api" -gt 0 ] && print_success "ZIP contains api/" || print_error "ZIP missing api/"
        [ "$has_client" -gt 0 ] && print_success "ZIP contains client/" || print_error "ZIP missing client/"
    fi
}

# Check for sensitive files
check_sensitive() {
    print_header "Checking for sensitive files"

    # Files that should NOT be in deployment
    local sensitive_patterns=(
        ".env.development"
        ".env.local"
        ".env.test"
        "id_rsa"
        "id_ed25519"
        ".pem"
        "private.key"
    )

    local found_sensitive=false

    for pattern in "${sensitive_patterns[@]}"; do
        local found=$(find "$DEPLOYMENT_DIR" -name "$pattern" 2>/dev/null)
        if [ -n "$found" ]; then
            print_warning "Found sensitive file: $found"
            found_sensitive=true
        fi
    done

    if [ "$found_sensitive" = false ]; then
        print_success "No sensitive development files found"
    fi

    # Check for .env files (info only)
    local env_files=$(find "$DEPLOYMENT_DIR" -name ".env" -o -name ".env.production" 2>/dev/null)
    if [ -n "$env_files" ]; then
        print_info "Found .env files (remember to configure with production values):"
        echo "$env_files" | while read -r file; do
            echo "    $file"
        done
    else
        print_warning "No .env files found - you'll need to create them on the server"
    fi
}

# Check package.json scripts
check_scripts() {
    print_header "Checking package.json scripts"

    # API
    if [ -f "$DEPLOYMENT_DIR/api/package.json" ]; then
        if grep -q '"start"' "$DEPLOYMENT_DIR/api/package.json"; then
            print_success "API has 'start' script"
            local start_cmd=$(grep '"start"' "$DEPLOYMENT_DIR/api/package.json" | sed 's/.*"start": "\(.*\)".*/\1/')
            print_info "API start command: $start_cmd"
        else
            print_warning "API missing 'start' script"
        fi
    fi

    # Client
    if [ -f "$DEPLOYMENT_DIR/client/package.json" ]; then
        if grep -q '"start"' "$DEPLOYMENT_DIR/client/package.json"; then
            print_success "Client has 'start' script"
            local start_cmd=$(grep '"start"' "$DEPLOYMENT_DIR/client/package.json" | sed 's/.*"start": "\(.*\)".*/\1/')
            print_info "Client start command: $start_cmd"
        else
            print_warning "Client missing 'start' script"
        fi
    fi
}

# Main execution
main() {
    echo ""
    print_header "DEPLOYMENT PACKAGE VERIFICATION"
    echo ""

    check_deployment_exists
    check_api
    check_client
    check_zip
    check_sensitive
    check_scripts

    echo ""
    print_header "VERIFICATION SUMMARY"

    if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}✓ Perfect! Deployment package is ready${NC}"
        echo ""
        echo "You can now:"
        echo "  1. Upload deployment/deployment.zip to cPanel"
        echo "  2. Follow the instructions in docs/deploy/CPANEL-DEPLOYMENT.md"
    elif [ $ERRORS -eq 0 ]; then
        echo -e "${YELLOW}⚠ Package is OK but has $WARNINGS warning(s)${NC}"
        echo ""
        echo "Review warnings above, but package should work."
    else
        echo -e "${RED}✗ Found $ERRORS error(s) and $WARNINGS warning(s)${NC}"
        echo ""
        echo "Please fix errors before deploying:"
        echo "  Re-run: bash .devcontainer/scripts/prepare_deployment.sh"
        exit 1
    fi

    echo ""
}

main
