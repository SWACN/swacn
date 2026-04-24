#!/bin/bash
set -e

echo "==============================================="
echo " Installing SWACN CLI (Linux / macOS)"
echo "==============================================="

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

echo "Detected Platform: $OS_TARGET ($ARCH_TARGET)"
echo "Fetching latest release from $REPO..."

# Get the latest release from GitHub API
LATEST_RELEASE_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | grep "browser_download_url" | grep "$ASSET_NAME" | cut -d '"' -f 4)

if [ -z "$LATEST_RELEASE_URL" ]; then
    echo "Error: Could not find release asset for $ASSET_NAME."
    echo "Please check https://github.com/$REPO/releases"
    exit 1
fi

echo "Downloading from: $LATEST_RELEASE_URL"

INSTALL_DIR="$HOME/.local/bin"
mkdir -p "$INSTALL_DIR"
DEST="$INSTALL_DIR/swacn"

curl -# -L -o "$DEST" "$LATEST_RELEASE_URL"
chmod +x "$DEST"

echo "Successfully installed swacn to $DEST"

# Check if PATH contains ~/.local/bin
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo "==============================================="
    echo " ACTION REQUIRED: Add $INSTALL_DIR to your PATH"
    echo "==============================================="
    echo "Depending on your shell, run one of the following:"
    echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.bashrc"
    echo "  echo 'export PATH=\"\$HOME/.local/bin:\$PATH\"' >> ~/.zshrc"
    echo "Then restart your terminal or run 'source ~/.zshrc'."
else
    echo "Installation complete! Try running 'swacn' in your terminal."
fi
