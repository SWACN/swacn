#!/bin/bash
set -e

# Terminal colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
BOLD='\033[1m'

echo -e "${CYAN}${BOLD}"
echo "   _____ _      __ ___   _________   __"
echo "  / ___/| | /| / // _ | / ___/ |/ /"
echo "  \__ \ | |/ |/ // __ |/ /__ /    / "
echo " ___/ / |__/|__//_/ |_|\___//_/|_/  "
echo "                                      "
echo "  SWACN CLI Installer (Linux/macOS)   "
echo -e "${NC}"
# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_TARGET="linux";;
    Darwin*)    OS_TARGET="macos";;
    *)          echo "Unsupported OS: ${OS}"; exit 1;;
esac

# Detect Architecture
ARCH="$(uname -m)"
case "${ARCH}" in
    x86_64)  ARCH_TARGET="x86_64";;
    amd64)   ARCH_TARGET="x86_64";;
    arm64)   ARCH_TARGET="arm64";;
    aarch64) ARCH_TARGET="arm64";;
    *)       echo "Unsupported architecture: ${ARCH}"; exit 1;;
esac

# Map to GitHub Release asset name
if [ "$OS_TARGET" = "linux" ] && [ "$ARCH_TARGET" = "arm64" ]; then
    echo "Warning: Linux arm64 is currently built via source or not natively provided in standard release."
    echo "Falling back to x86_64, which may fail."
fi

ASSET_NAME="swacn-${OS_TARGET}-${ARCH_TARGET}"
REPO="karthikeyjoshi/swacn"

echo -e "${BOLD}Platform:${NC} $OS_TARGET ($ARCH_TARGET)"
echo -e "${BOLD}Fetching latest release...${NC}"

# Get the latest release from GitHub API
LATEST_RELEASE_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url" | grep "$ASSET_NAME" | cut -d '"' -f 4)

if [ -z "$LATEST_RELEASE_URL" ]; then
    echo -e "${RED}Error: Could not find release asset for $ASSET_NAME.${NC}"
    echo -e "Please check https://github.com/$REPO/releases"
    exit 1
fi

echo -e "${CYAN}Downloading from GitHub...${NC}"

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"
DEST="$INSTALL_DIR/swacn"

curl -# -L -o "$DEST" "$LATEST_RELEASE_URL"
chmod +x "$DEST"

echo -e "${GREEN}✔ Successfully installed swacn to $DEST${NC}"

# Check if PATH contains ~/.local/bin
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${YELLOW}Adding $INSTALL_DIR to your PATH...${NC}"
    
    # Update bashrc
    if [ -f "$HOME/.bashrc" ]; then
        if ! grep -q "$INSTALL_DIR" "$HOME/.bashrc"; then
            echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$HOME/.bashrc"
        fi
    fi

    # Update zshrc
    if [ -f "$HOME/.zshrc" ]; then
        if ! grep -q "$INSTALL_DIR" "$HOME/.zshrc"; then
            echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$HOME/.zshrc"
        fi
    fi

    echo ""
    echo -e "${YELLOW}╭──────────────────────────────────────────╮${NC}"
    echo -e "${YELLOW}│  ${BOLD}ACTION REQUIRED: Restart your terminal${NC}${YELLOW}  │${NC}"
    echo -e "${YELLOW}╰──────────────────────────────────────────╯${NC}"
    echo "Your shell configuration has been automatically updated."
    echo "Please open a NEW terminal window or run:"
    echo -e "  ${CYAN}source ~/.bashrc${NC}  (or ~/.zshrc)"
    echo ""
else
    echo ""
    echo -e "${GREEN}${BOLD}Installation complete!${NC} Try running '${CYAN}swacn${NC}' in your terminal."
    echo ""
fi
