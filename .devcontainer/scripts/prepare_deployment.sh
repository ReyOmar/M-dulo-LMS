#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_SOURCE_DIR="apps/api"
CLIENT_SOURCE_DIR="apps/client"
TEMP_DIR="deployment"
ZIP_FILE_NAME="deployment.zip"
NODE_ENV="production"

# Control whether to overwrite existing .env files in destination
# Default: false (do not overwrite). Set OVERWRITE_ENV=true to force overwrite.
# Set to false by default to avoid accidental overwrites on sensitive hosts
# such as cPanel where .env files are delicate.
OVERWRITE_ENV="${OVERWRITE_ENV:-false}"

# cPanel optimization: Pack node_modules to reduce inode usage
# Set to "true" to create compressed node_modules archives (recommended for shared hosting)
PACK_NODE_MODULES="${PACK_NODE_MODULES:-false}"

# Functions
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate source directories exist
validate_directories() {
    if [ ! -d "$API_SOURCE_DIR" ]; then
        print_error "API source directory not found: $API_SOURCE_DIR"
        exit 1
    fi

    if [ ! -d "$CLIENT_SOURCE_DIR" ]; then
        print_error "Client source directory not found: $CLIENT_SOURCE_DIR"
        exit 1
    fi

    print_success "Source directories validated"
}

# Clean and create directories
setup_directories() {
    print_status "Setting up directories..."

    # Clean up existing deployment directory if it exists
    if [ -d "$TEMP_DIR" ]; then
        print_warning "Removing existing deployment directory: $TEMP_DIR"
        rm -rf "$TEMP_DIR"
    fi

    # Create the deployment directory
    mkdir -p "$TEMP_DIR"

    print_success "Deployment directory ready"
}

# Process API project
process_api() {
    print_status "Processing API project..."
    API_DEST_PATH="$TEMP_DIR/api"

    cp -R "$API_SOURCE_DIR" "$API_DEST_PATH"
    print_success "API copied to $API_DEST_PATH"

    # Build API project
    build_project "$API_DEST_PATH" "API"

    # Install production dependencies only (with Linux binaries)
    install_production_deps "$API_DEST_PATH" "API"

    # Remove other unnecessary files/folders
    remove_unnecessary_files "$API_DEST_PATH"
}

# Process Client project
process_client() {
    print_status "Processing Client project..."
    CLIENT_DEST_PATH="$TEMP_DIR/client"

    cp -R "$CLIENT_SOURCE_DIR" "$CLIENT_DEST_PATH"
    print_success "Client copied to $CLIENT_DEST_PATH"

    # Build Client project
    build_project "$CLIENT_DEST_PATH" "Client"

    # Install production dependencies only (with Linux binaries)
    install_production_deps "$CLIENT_DEST_PATH" "Client"

    # Remove other unnecessary files/folders
    remove_unnecessary_files "$CLIENT_DEST_PATH"
}

# Build project function
build_project() {
    local project_path="$1"
    local project_name="$2"

    print_status "Building $project_name project..."

    # Check if package.json exists
    if [ ! -f "$project_path/package.json" ]; then
        print_warning "No package.json found in $project_name, skipping build"
        return 0
    fi

    # Change to project directory
    pushd "$project_path" > /dev/null

    # Always install dependencies to ensure dev dependencies are available
    print_status "Installing dependencies for $project_name..."
    if [ -d "node_modules" ]; then
        rm -rf node_modules
    fi
    if NODE_ENV=development npm ci; then
        print_success "Dependencies installed for $project_name"
    else
        print_error "Failed to install dependencies for $project_name"
        popd > /dev/null
        exit 1
    fi

    # Check if build script exists in package.json
    if npm run 2>/dev/null | grep -q "build"; then
        print_status "Running build for $project_name..."
        if NODE_ENV=production npm run build; then
            print_success "Build completed for $project_name"
        else
            print_error "Build failed for $project_name"
            popd > /dev/null
            exit 1
        fi
    else
        print_warning "No build script found in $project_name package.json, skipping build"
    fi

    # Return to original directory
    popd > /dev/null
}

# Install production dependencies with Linux binaries
install_production_deps() {
    local project_path="$1"
    local project_name="$2"

    print_status "Installing production dependencies for $project_name (Linux binaries)..."

    pushd "$project_path" > /dev/null

    # Remove existing node_modules to ensure clean install
    if [ -d "node_modules" ]; then
        print_status "Removing development node_modules..."
        rm -rf node_modules
    fi

    # Install only production dependencies
    # --omit=dev excludes devDependencies
    # --platform=linux ensures Linux binaries for native modules
    # --arch=x64 for 64-bit Linux (most common for cPanel)
    print_status "Running: npm ci --omit=dev --platform=linux --arch=x64 --ignore-scripts"

    if NODE_ENV=production npm ci --omit=dev --platform=linux --arch=x64 --ignore-scripts; then
        print_success "Production dependencies installed for $project_name"

        # Display size of node_modules
        if command -v du &> /dev/null; then
            local size=$(du -sh node_modules 2>/dev/null | cut -f1)
            local count=$(find node_modules -type f 2>/dev/null | wc -l)
            print_status "node_modules size: $size ($count files)"
        fi

        # Pack node_modules if enabled (recommended for cPanel)
        if [ "$PACK_NODE_MODULES" = "true" ]; then
            pack_node_modules "$project_path" "$project_name"
        fi
    else
        print_error "Failed to install production dependencies for $project_name"
        popd > /dev/null
        exit 1
    fi

    popd > /dev/null
}

# Pack node_modules to reduce inode usage on cPanel
pack_node_modules() {
    local project_path="$1"
    local project_name="$2"

    print_status "Packing node_modules for $project_name (cPanel optimization)..."

    # NOTE: We're already in the project directory from install_production_deps
    # So we don't need to cd again

    if [ ! -d "node_modules" ]; then
        print_warning "No node_modules to pack"
        return 0
    fi

    # Create a tarball of node_modules
    print_status "Creating node_modules.tar.gz..."
    if tar -czf node_modules.tar.gz node_modules/; then
        print_success "node_modules packed successfully"

        # Display sizes
        if command -v du &> /dev/null; then
            local original_size=$(du -sh node_modules 2>/dev/null | cut -f1)
            local packed_size=$(du -sh node_modules.tar.gz 2>/dev/null | cut -f1)
            print_status "Original: $original_size → Packed: $packed_size"
        fi

        # Create extraction script
        create_extraction_script "$(pwd)" "$project_name"

        # Remove node_modules directory to save space and inodes
        print_status "Removing unpacked node_modules (will be extracted on server)..."
        rm -rf node_modules
        print_success "node_modules directory removed (tarball kept)"
    else
        print_error "Failed to pack node_modules"
        return 1
    fi
}

# Create script to extract node_modules on server
create_extraction_script() {
    local project_path="$1"
    local project_name="$2"

    print_status "Creating extraction script for $project_name..."

    cat > "$project_path/extract-node-modules.sh" << 'EXTRACT_SCRIPT'
#!/bin/bash
# Script to extract node_modules on cPanel server
# Run this ONCE after uploading to cPanel

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}  Extracting node_modules${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

if [ ! -f "node_modules.tar.gz" ]; then
    echo -e "${RED}✗ Error: node_modules.tar.gz not found${NC}"
    echo "  Make sure you're running this script from the project directory"
    exit 1
fi

if [ -d "node_modules" ]; then
    echo -e "${YELLOW}⚠ node_modules already exists${NC}"
    read -p "Do you want to overwrite it? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Extraction cancelled"
        exit 0
    fi
    echo -e "${BLUE}Removing existing node_modules...${NC}"
    rm -rf node_modules
fi

echo -e "${BLUE}Extracting node_modules.tar.gz...${NC}"
if tar -xzf node_modules.tar.gz; then
    echo -e "${GREEN}✓ node_modules extracted successfully${NC}"

    # Optional: Remove tarball after extraction to save space
    read -p "Remove node_modules.tar.gz to save space? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f node_modules.tar.gz
        echo -e "${GREEN}✓ Tarball removed${NC}"
    else
        echo -e "${YELLOW}⚠ Tarball kept (you can delete it manually later)${NC}"
    fi

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Extraction complete!${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Configure your .env file"
    echo "2. Start the application from cPanel"
else
    echo -e "${RED}✗ Extraction failed${NC}"
    exit 1
fi
EXTRACT_SCRIPT

    chmod +x "$project_path/extract-node-modules.sh"
    print_success "Created extract-node-modules.sh"
}

# Remove unnecessary files and folders
remove_unnecessary_files() {
    local project_path="$1"

    print_status "Cleaning unnecessary files from $(basename "$project_path")..."

    # Files and folders that are safe to remove (NOT needed for production)
    local items_to_remove=(
        ".git"
        ".gitignore"
        ".gitattributes"
        ".env.example"
        ".env.local"
        ".env.development"
        ".env.test"
        ".env"
        ".DS_Store"
        "Thumbs.db"
        "*.log"
        ".vscode"
        ".idea"
        "coverage"
        ".nyc_output"
        ".cache"
        ".temp"
        ".tmp"
        "README.md"
        "CHANGELOG.md"
        "LICENSE"
        ".eslintrc*"
        ".prettierrc*"
        "jest.config.*"
        "vitest.config.*"
        "cypress"
        "cypress.config.*"
        "__tests__"
        "tests"
        "test"
        "spec"
        "*.test.js"
        "*.spec.js"
        "*.test.ts"
        "*.spec.ts"
        ".github"
        "docker-compose*.yml"
        "Dockerfile*"
        ".dockerignore"
        "nodemon.json"
        ".swcrc"
        "nest-cli.json"
        "tsconfig.json"
        "tsconfig.build.json"
        "webpack.config.*"
        "rollup.config.*"
        "vite.config.*"
    )

    # IMPORTANT: Files we KEEP (essential for cPanel execution):
    # - package.json (CRITICAL - needed for Node.js app setup in cPanel)
    # - package-lock.json (ensures consistent dependency versions)
    # - node_modules/ (CRITICAL - contains all runtime dependencies with Linux binaries)
    # - .env.production (production environment variables)
    # - .env (if it contains production vars)
    # - dist/ or build/ folders (compiled code)
    # - .next/ folder (for Next.js)
    # - public/ folder (static assets)
    # - prisma/ folder (for API - schema and migrations)
    # - generated/ folder (for API - Prisma client)
    # - server.js, index.js, app.js, main.js (entry points)

    for item in "${items_to_remove[@]}"; do
        find "$project_path" -name "$item" -type f -delete 2>/dev/null || true
        find "$project_path" -name "$item" -type d -exec rm -rf {} + 2>/dev/null || true
    done

    print_success "Cleanup completed for $(basename "$project_path") - Essential files preserved"
}

# Create zip file
create_zip() {
    local zip_path="$TEMP_DIR/$ZIP_FILE_NAME"

    print_status "Creating zip file: $zip_path"

    # Remove existing zip if it exists
    if [ -f "$zip_path" ]; then
        print_warning "Removing existing zip file"
        rm -f "$zip_path"
    fi

    # Create zip inside the deployment directory
    (cd "$TEMP_DIR" && zip -r "$ZIP_FILE_NAME" api client -x "*.DS_Store" "Thumbs.db")

    # Get file size
    if command -v du &> /dev/null; then
        local file_size=$(du -h "$zip_path" | cut -f1)
        print_success "Zip file created: $zip_path (Size: $file_size)"
    else
        print_success "Zip file created: $zip_path"
    fi
}

# Display summary
display_summary() {
    local zip_path="$TEMP_DIR/$ZIP_FILE_NAME"
    local total_size="N/A"

    # Calculate total size
    if command -v du &> /dev/null; then
        total_size=$(du -h "$zip_path" 2>/dev/null | cut -f1 || echo "N/A")
    fi

    echo ""
    echo "=================================================="
    print_success "DEPLOYMENT PACKAGE READY FOR CPANEL"
    echo "=================================================="
    echo "📦 ZIP File: $zip_path"
    echo "� Size: $total_size"
    echo "🗂️  Contents:"
    echo "   - api/ (NestJS backend with node_modules)"
    echo "   - client/ (Next.js frontend with node_modules)"
    echo ""
    echo "✅ What's included:"
    echo "   ✓ Built/compiled code (dist/, .next/)"
    echo "   ✓ Production node_modules with Linux binaries"
    echo "   ✓ Prisma client generated"
    echo "   ✓ All runtime dependencies"
    echo "   ✓ Essential config files"
    echo ""
    echo "� What's excluded:"
    echo "   ✗ Development dependencies"
    echo "   ✗ Source TypeScript files"
    echo "   ✗ Test files and configs"
    echo "   ✗ Git history"
    echo ""
    echo "=================================================="
    echo "📋 DEPLOYMENT STEPS FOR CPANEL:"
    echo "=================================================="
    echo ""
    echo "1. Upload to cPanel:"
    echo "   - Go to File Manager"
    echo "   - Upload $ZIP_FILE_NAME"
    echo "   - Extract in your domain directory"
    echo ""

    if [ "$PACK_NODE_MODULES" = "true" ]; then
        echo "2. EXTRACT node_modules (CRITICAL STEP!):"
        echo "   Via cPanel Terminal or SSH, run these commands:"
        echo "   $ cd ~/api && bash extract-node-modules.sh"
        echo "   $ cd ~/client && bash extract-node-modules.sh"
        echo ""
        echo "   WARNING: This step is REQUIRED!"
        echo "   The tarball format prevents cPanel from auto-deleting node_modules"
        echo "   Keep the .tar.gz files as backup"
        echo ""
        local step=3
    else
        local step=2
    fi

    echo "$step. Configure API (apps/api):"
    echo "   - Setup Node.js App in cPanel"
    echo "   - Node.js version: 20.x or higher"
    echo "   - Application root: /home/your_user/api"
    echo "   - Application URL: api.yourdomain.com (or /api)"
    echo "   - Application startup file: dist/main.js"
    echo "   - Create .env file with production variables:"
    echo "     * DATABASE_URL"
    echo "     * JWT_SECRET"
    echo "     * CORS_ORIGIN"
    echo "     * PESV_UPLOADS_DIR"
    echo "     * etc."
    echo ""
    echo "3. Run Prisma migrations (via SSH or cPanel terminal):"
    echo "   cd ~/api"
    echo "   node_modules/.bin/prisma migrate deploy"
    echo ""
    echo "4. Configure Client (apps/client):"
    echo "   - Setup Node.js App in cPanel"
    echo "   - Node.js version: 20.x or higher"
    echo "   - Application root: /home/your_user/client"
    echo "   - Application URL: yourdomain.com"
    echo "   - Application startup file: server.js (or .next/standalone/server.js)"
    echo "   - Create .env file with:"
    echo "     * NEXT_PUBLIC_API_URL"
    echo "     * Other public env vars"
    echo ""
    echo "5. Start both applications from cPanel Node.js interface"
    echo ""
    echo "=================================================="
    echo "WARNING - IMPORTANT NOTES:"
    echo "=================================================="

    if [ "$PACK_NODE_MODULES" = "true" ]; then
        echo "* node_modules is PACKED as .tar.gz to prevent cPanel deletion"
        echo "* You MUST extract it using: bash extract-node-modules.sh"
        echo "* Keep the .tar.gz as backup in case cPanel deletes node_modules"
        echo "* If node_modules gets deleted, just re-run the extraction script"
        echo ""
    fi

    echo "* Do NOT run 'npm install' on the server (binaries already correct)"
    echo "* If you need to update deps, rebuild locally and re-upload"
    echo "* Make sure your .env files have correct production values"
    echo "* Prisma migrations must be run after upload"
    echo "* Check cPanel error logs if apps don't start"
    echo "=================================================="
}

# Main execution
main() {
    echo "🚀 Starting cPanel Deployment Preparation"
    echo "=========================================="

    validate_directories
    setup_directories
    process_api
    process_client
    create_zip
    display_summary
}

# Run main function
main
