import * as fs from 'node:fs';
import * as path from 'node:path';
import * as aws from '@pulumi/aws';
import * as pulumi from '@pulumi/pulumi';

// Configuration
const config = new pulumi.Config();
const awsRegion = config.get('awsRegion') || 'us-east-1';
const instanceType = config.get('instanceType') || 't3.large';
const keyName = config.require('sshKeyName');
const domainName = config.get('domainName');
const envFilePath = config.require('envFilePath');

// Read environment file
const _envContent = fs.readFileSync(envFilePath, 'utf-8');
const dockerComposeContent = fs.readFileSync(
  path.join(__dirname, '../../docker-compose.yml'),
  'utf-8',
);

// VPC
const vpc = new aws.ec2.Vpc('opencode-vpc', {
  cidrBlock: '10.0.0.0/16',
  enableDnsHostnames: true,
  enableDnsSupport: true,
  tags: { Name: 'opencode-vpc' },
});

// Internet Gateway
const igw = new aws.ec2.InternetGateway('opencode-igw', {
  vpcId: vpc.id,
  tags: { Name: 'opencode-igw' },
});

// Public Subnet
const subnet = new aws.ec2.Subnet('opencode-subnet', {
  vpcId: vpc.id,
  cidrBlock: '10.0.1.0/24',
  availabilityZone: pulumi.interpolate`${awsRegion}a`,
  mapPublicIpOnLaunch: true,
  tags: { Name: 'opencode-subnet' },
});

// Route Table
const routeTable = new aws.ec2.RouteTable('opencode-rt', {
  vpcId: vpc.id,
  routes: [{ cidrBlock: '0.0.0.0/0', gatewayId: igw.id }],
  tags: { Name: 'opencode-rt' },
});

const _routeTableAssoc = new aws.ec2.RouteTableAssociation('opencode-rta', {
  subnetId: subnet.id,
  routeTableId: routeTable.id,
});

// Security Group
const sg = new aws.ec2.SecurityGroup('opencode-sg', {
  vpcId: vpc.id,
  description: 'Security group for OpenCode server',
  ingress: [
    { protocol: 'tcp', fromPort: 22, toPort: 22, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 80, toPort: 80, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 443, toPort: 443, cidrBlocks: ['0.0.0.0/0'] },
    { protocol: 'tcp', fromPort: 3000, toPort: 3000, cidrBlocks: ['0.0.0.0/0'] },
  ],
  egress: [{ protocol: '-1', fromPort: 0, toPort: 0, cidrBlocks: ['0.0.0.0/0'] }],
  tags: { Name: 'opencode-sg' },
});

// AMI lookup
const ami = aws.ec2.getAmi({
  mostRecent: true,
  filters: [
    { name: 'name', values: ['ubuntu/images/hvm-ssd/ubuntu-24.04-amd64-server-*'] },
    { name: 'virtualization-type', values: ['hvm'] },
  ],
  owners: ['099720109477'], // Canonical
});

// User data script
const userData = pulumi.interpolate`#!/bin/bash
# Update system
apt-get update && apt-get upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker ubuntu

# Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# Setup directory
mkdir -p /opt/opencode-server

# Write docker-compose.yml
cat > /opt/opencode-server/docker-compose.yml << 'EOFCOMPOSE'
${dockerComposeContent}
EOFCOMPOSE

# Write .env file
chown -R ubuntu:ubuntu /opt/opencode-server
chmod 600 /opt/opencode-server/.env

# Start services
cd /opt/opencode-server
docker-compose up -d
`;

// EC2 Instance
const instance = new aws.ec2.Instance('opencode-server', {
  ami: ami.then((a) => a.id),
  instanceType: instanceType,
  subnetId: subnet.id,
  vpcSecurityGroupIds: [sg.id],
  keyName: keyName,
  userData: userData,
  rootBlockDevice: {
    volumeSize: 50,
    volumeType: 'gp3',
  },
  tags: { Name: 'opencode-server' },
});

// Elastic IP
const eip = new aws.ec2.Eip('opencode-eip', {
  domain: 'vpc',
  instance: instance.id,
  tags: { Name: 'opencode-eip' },
});

// Route53 DNS (optional)
if (domainName) {
  const zone = aws.route53.getZone({ name: domainName });
  const _dnsRecord = new aws.route53.Record('opencode-dns', {
    zoneId: zone.then((z) => z.zoneId),
    name: domainName,
    type: 'A',
    ttl: 300,
    records: [eip.publicIp],
  });
}

// Exports
export const publicIp = eip.publicIp;
export const publicDns = instance.publicDns;
export const sshCommand = pulumi.interpolate`ssh -i ~/.ssh/${keyName}.pem ubuntu@${eip.publicIp}`;
export const instanceId = instance.id;
