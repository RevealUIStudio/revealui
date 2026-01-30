#!/bin/bash
# User data script for AWS EC2 OpenCode server

set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Docker
apt-get install -y docker.io docker-compose-plugin
systemctl enable docker
systemctl start docker

# Install additional tools
apt-get install -y git curl htop jq unzip

# Create opencode user
useradd -m -s /bin/bash opencode || true
usermod -aG docker opencode

# Setup directory
mkdir -p /opt/opencode-server
chown -R opencode:opencode /opt/opencode-server

# Write docker-compose.yml
cat > /opt/opencode-server/docker-compose.yml << 'EOFCOMPOSE'
${docker_compose_content}
EOFCOMPOSE

# Write .env file
cat > /opt/opencode-server/.env << 'EOFENV'
${env_content}
EOFENV

chmod 600 /opt/opencode-server/.env
chown opencode:opencode /opt/opencode-server/.env

# Install OpenCode server files
cd /opt/opencode-server

# Pull and start services
docker compose pull
docker compose up -d

# Install CloudWatch agent for monitoring (optional)
if [ ! -z "$${CW_AGENT_INSTALL}" ]; then
  wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
  dpkg -i -E ./amazon-cloudwatch-agent.deb
  /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl -a fetch-config -m ec2 -s -c ssm:AmazonCloudWatch-Config
fi

# Setup log rotation
cat > /etc/logrotate.d/opencode << 'EOF'
/var/lib/docker/containers/*/*.log {
  rotate 7
  daily
  compress
  size=100M
  missingok
  delaycompress
  copytruncate
}
EOF

# Setup auto-updates
apt-get install -y unattended-upgrades

# Reboot if needed
if [ -f /var/run/reboot-required ]; then
  shutdown -r +1 "Rebooting after updates"
fi

echo "OpenCode server setup complete!"