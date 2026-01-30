terraform {
  required_version = ">= 1.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 4.0"
    }
  }
}

provider "google" {
  project = var.gcp_project_id
  region  = var.gcp_region
}

# VPC Network
resource "google_compute_network" "opencode" {
  name                    = "opencode-vpc"
  auto_create_subnetworks = false
}

# Subnet
resource "google_compute_subnetwork" "opencode" {
  name          = "opencode-subnet"
  ip_cidr_range = "10.0.0.0/24"
  network       = google_compute_network.opencode.id
  region        = var.gcp_region
}

# Firewall Rules
resource "google_compute_firewall" "opencode" {
  name    = "opencode-firewall"
  network = google_compute_network.opencode.name

  allow {
    protocol = "tcp"
    ports    = ["22", "80", "443", "3000"]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = ["opencode-server"]
}

# Static IP
resource "google_compute_address" "opencode" {
  name   = "opencode-static-ip"
  region = var.gcp_region
}

# Compute Instance
resource "google_compute_instance" "opencode" {
  name         = "opencode-server"
  machine_type = var.machine_type
  zone         = "${var.gcp_region}-a"
  tags         = ["opencode-server"]

  boot_disk {
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2204-lts"
      size  = 50
      type  = "pd-ssd"
    }
  }

  network_interface {
    network    = google_compute_network.opencode.id
    subnetwork = google_compute_subnetwork.opencode.id

    access_config {
      nat_ip = google_compute_address.opencode.address
    }
  }

  metadata = {
    ssh-keys = "ubuntu:${file(var.ssh_public_key_path)}"
    user-data = templatefile("${path.module}/user-data.sh", {
      docker_compose_content = file("${path.module}/../../docker-compose.yml")
      env_content           = var.env_content
    })
  }

  # Startup script
  metadata_startup_script = file("${path.module}/startup.sh")
}

# DNS Record (optional)
resource "google_dns_record_set" "opencode" {
  count        = var.domain_name != "" ? 1 : 0
  name         = "${var.domain_name}."
  type         = "A"
  ttl          = 300
  managed_zone = data.google_dns_managed_zone.selected[0].name
  rrdatas      = [google_compute_address.opencode.address]
}

data "google_dns_managed_zone" "selected" {
  count = var.domain_name != "" ? 1 : 0
  name  = var.dns_zone_name
}

# Variables
variable "gcp_project_id" {
  description = "GCP Project ID"
}

variable "gcp_region" {
  description = "GCP Region"
  default     = "us-central1"
}

variable "machine_type" {
  description = "GCP Machine Type"
  default     = "e2-standard-2"
}

variable "ssh_public_key_path" {
  description = "Path to SSH public key"
  default     = "~/.ssh/id_rsa.pub"
}

variable "domain_name" {
  description = "Domain name for DNS (optional)"
  default     = ""
}

variable "dns_zone_name" {
  description = "DNS zone name in Cloud DNS (optional)"
  default     = ""
}

variable "env_content" {
  description = "Content of the .env file"
  type        = string
  sensitive   = true
}

# Outputs
output "public_ip" {
  value = google_compute_address.opencode.address
}

output "instance_name" {
  value = google_compute_instance.opencode.name
}

output "ssh_command" {
  value = "gcloud compute ssh opencode-server --zone=${var.gcp_region}-a"
}