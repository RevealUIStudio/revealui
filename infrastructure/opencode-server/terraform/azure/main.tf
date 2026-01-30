terraform {
  required_version = ">= 1.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
}

provider "azurerm" {
  features {}
}

# Resource Group
resource "azurerm_resource_group" "opencode" {
  name     = "opencode-rg"
  location = var.azure_region
}

# Virtual Network
resource "azurerm_virtual_network" "opencode" {
  name                = "opencode-vnet"
  address_space       = ["10.0.0.0/16"]
  location            = azurerm_resource_group.opencode.location
  resource_group_name = azurerm_resource_group.opencode.name
}

# Subnet
resource "azurerm_subnet" "opencode" {
  name                 = "opencode-subnet"
  resource_group_name  = azurerm_resource_group.opencode.name
  virtual_network_name = azurerm_virtual_network.opencode.name
  address_prefixes     = ["10.0.1.0/24"]
}

# Public IP
resource "azurerm_public_ip" "opencode" {
  name                = "opencode-public-ip"
  resource_group_name = azurerm_resource_group.opencode.name
  location            = azurerm_resource_group.opencode.location
  allocation_method   = "Static"
  sku                 = "Standard"
}

# Network Security Group
resource "azurerm_network_security_group" "opencode" {
  name                = "opencode-nsg"
  location            = azurerm_resource_group.opencode.location
  resource_group_name = azurerm_resource_group.opencode.name

  security_rule {
    name                       = "SSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTP"
    priority                   = 110
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "HTTPS"
    priority                   = 120
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  security_rule {
    name                       = "API"
    priority                   = 130
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "3000"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }
}

# Network Interface
resource "azurerm_network_interface" "opencode" {
  name                = "opencode-nic"
  location            = azurerm_resource_group.opencode.location
  resource_group_name = azurerm_resource_group.opencode.name

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.opencode.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.opencode.id
  }
}

# Associate NSG with NIC
resource "azurerm_network_interface_security_group_association" "opencode" {
  network_interface_id      = azurerm_network_interface.opencode.id
  network_security_group_id = azurerm_network_security_group.opencode.id
}

# Virtual Machine
resource "azurerm_linux_virtual_machine" "opencode" {
  name                  = "opencode-server"
  resource_group_name   = azurerm_resource_group.opencode.name
  location              = azurerm_resource_group.opencode.location
  size                  = var.vm_size
  admin_username        = "ubuntu"
  network_interface_ids = [azurerm_network_interface.opencode.id]

  admin_ssh_key {
    username   = "ubuntu"
    public_key = file(var.ssh_public_key_path)
  }

  os_disk {
    caching              = "ReadWrite"
    storage_account_type = "StandardSSD_LRS"
    disk_size_gb         = 50
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "0001-com-ubuntu-server-jammy"
    sku       = "22_04-lts-gen2"
    version   = "latest"
  }

  custom_data = base64encode(templatefile("${path.module}/user-data.sh", {
    docker_compose_content = file("${path.module}/../../docker-compose.yml")
    env_content           = var.env_content
  }))
}

# Variables
variable "azure_region" {
  description = "Azure Region"
  default     = "East US"
}

variable "vm_size" {
  description = "Azure VM Size"
  default     = "Standard_B2s"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key"
  default     = "~/.ssh/id_rsa.pub"
}

variable "env_content" {
  description = "Content of the .env file"
  type        = string
  sensitive   = true
}

# Outputs
output "public_ip" {
  value = azurerm_public_ip.opencode.ip_address
}

output "vm_name" {
  value = azurerm_linux_virtual_machine.opencode.name
}

output "ssh_command" {
  value = "ssh ubuntu@${azurerm_public_ip.opencode.ip_address}"
}