terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# VPC Configuration
resource "aws_vpc" "opencode" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "opencode-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "opencode" {
  vpc_id = aws_vpc.opencode.id

  tags = {
    Name = "opencode-igw"
  }
}

# Public Subnet
resource "aws_subnet" "public" {
  vpc_id                  = aws_vpc.opencode.id
  cidr_block              = "10.0.1.0/24"
  availability_zone       = "${var.aws_region}a"
  map_public_ip_on_launch = true

  tags = {
    Name = "opencode-public-subnet"
  }
}

# Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.opencode.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.opencode.id
  }

  tags = {
    Name = "opencode-public-rt"
  }
}

resource "aws_route_table_association" "public" {
  subnet_id      = aws_subnet.public.id
  route_table_id = aws_route_table.public.id
}

# Security Group
resource "aws_security_group" "opencode" {
  name_prefix = "opencode-"
  vpc_id      = aws_vpc.opencode.id

  ingress {
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 3000
    to_port     = 3000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "opencode-sg"
  }
}

# EC2 Instance
resource "aws_instance" "opencode" {
  ami                    = data.aws_ami.ubuntu.id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.public.id
  vpc_security_group_ids = [aws_security_group.opencode.id]
  key_name               = var.ssh_key_name

  root_block_device {
    volume_size = 50
    volume_type = "gp3"
  }

  user_data = templatefile("${path.module}/user-data.sh", {
    docker_compose_content = file("${path.module}/../../docker-compose.yml")
    env_content           = var.env_content
  })

  tags = {
    Name = "opencode-server"
  }
}

# Elastic IP
resource "aws_eip" "opencode" {
  domain   = "vpc"
  instance = aws_instance.opencode.id

  tags = {
    Name = "opencode-eip"
  }
}

# Data source for Ubuntu AMI
data "aws_ami" "ubuntu" {
  most_recent = true

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-22.04-amd64-server-*"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  owners = ["099720109477"] # Canonical
}

# Route53 DNS Record (optional)
resource "aws_route53_record" "opencode" {
  count   = var.domain_name != "" ? 1 : 0
  zone_id = data.aws_route53_zone.selected[0].zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.opencode.public_ip]
}

data "aws_route53_zone" "selected" {
  count = var.domain_name != "" ? 1 : 0
  name  = var.domain_name
}

# Variables
variable "aws_region" {
  description = "AWS region"
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 instance type"
  default     = "t3.large"
}

variable "ssh_key_name" {
  description = "Name of the SSH key pair"
}

variable "domain_name" {
  description = "Domain name for Route53 (optional)"
  default     = ""
}

variable "env_content" {
  description = "Content of the .env file"
  type        = string
  sensitive   = true
}

# Outputs
output "public_ip" {
  value = aws_eip.opencode.public_ip
}

output "public_dns" {
  value = aws_instance.opencode.public_dns
}

output "ssh_command" {
  value = "ssh -i ~/.ssh/${var.ssh_key_name}.pem ubuntu@${aws_eip.opencode.public_ip}"
}