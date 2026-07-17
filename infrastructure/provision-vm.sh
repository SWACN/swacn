#!/bin/bash
# provision-vm.sh
# Provision a cheap Azure Standard_B1s VM for SWACN hosting.

# Exit immediately if a command exits with a non-zero status
set -e

# Default variables
RESOURCE_GROUP="swacn-rg"
LOCATION="${1:-koreacentral}"
VM_NAME="swacn-vm"
VM_SIZE="Standard_B2ats_v2"
IMAGE="Ubuntu2204"
ADMIN_USER="azureuser"

echo "=== SWACN Azure Provisioning Script ==="
echo "This script will create a resource group, provision a Standard_B2ats_v2 Ubuntu VM,"
echo "and configure the network firewall rules for HTTP, HTTPS, and SSH."
echo ""
echo "Configuration:"
echo "  Resource Group:  $RESOURCE_GROUP"
echo "  Location:        $LOCATION"
echo "  VM Name:         $VM_NAME"
echo "  VM Size:         $VM_SIZE (~$6.86/month)"
echo "  OS Image:        $IMAGE (Ubuntu 22.04 LTS)"
echo "  Admin User:      $ADMIN_USER"
echo ""

# Check if Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI ('az') is not installed. Please install it first:"
    echo "https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check if logged in
echo "Checking Azure authentication status..."
if ! az account show &> /dev/null; then
    echo "Error: You are not logged in to Azure. Please run 'az login' first."
    exit 1
fi

# Create Resource Group
echo "Creating Resource Group '$RESOURCE_GROUP' in '$LOCATION'..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

# Create VM
echo "Provisioning VM '$VM_NAME' (this may take a few minutes)..."
az vm create \
  --resource-group "$RESOURCE_GROUP" \
  --name "$VM_NAME" \
  --image "$IMAGE" \
  --size "$VM_SIZE" \
  --admin-username "$ADMIN_USER" \
  --generate-ssh-keys

# Open Ports
echo "Opening firewall ports for HTTP (80) and HTTPS (443)..."
az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --port 80 --priority 1010
az vm open-port --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --port 443 --priority 1020

# Get public IP
echo "Retrieving VM details..."
PUBLIC_IP=$(az vm show --show-details --resource-group "$RESOURCE_GROUP" --name "$VM_NAME" --query publicIps --output tsv)

echo ""
echo "=== Provisioning Complete! ==="
echo "Your Azure VM is now running."
echo "Public IP: $PUBLIC_IP"
echo "Admin User: $ADMIN_USER"
echo ""
echo "To connect to your VM, run:"
echo "  ssh $ADMIN_USER@$PUBLIC_IP"
echo ""
echo "Next Steps:"
echo "1. Point your domain (e.g. swacn.com) to $PUBLIC_IP using your DNS provider."
echo "2. SSH into the VM and run the setup steps detailed in 'azure_deployment.md'."
