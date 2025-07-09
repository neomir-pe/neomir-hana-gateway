# Windows Server Deployment Guide

## Prerequisites

1. **Install Docker Engine on Windows Server:**
```powershell
# Install Docker via PowerShell (Run as Administrator)
Invoke-WebRequest -UseBasicParsing "https://raw.githubusercontent.com/microsoft/Windows-Containers/Main/helpful_tools/Install-DockerCE/install-docker-ce.ps1" -o install-docker-ce.ps1
.\install-docker-ce.ps1

# Install Docker Compose
Invoke-WebRequest "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-windows-x86_64.exe" -UseBasicParsing -OutFile $Env:ProgramFiles\Docker\docker-compose.exe
```

2. **Restart Docker Service:**
```powershell
Restart-Service docker
```

## Setup Instructions

### 1. Create Required Directories
```powershell
# Navigate to your project directory
cd C:\path\to\neomir-hana-gateway

# Create required directories
New-Item -ItemType Directory -Force -Path ".\ssl"
New-Item -ItemType Directory -Force -Path ".\logs"
```

### 2. Create Environment Configuration File
Create `env.local` file in your project root:
```
# SAP HANA Configuration
HANA_HOST=your-hana-server
HANA_PORT=30015
HANA_USER=your-username
HANA_PASSWORD=your-password
HANA_DATABASE=your-database

# Application Configuration
PORT=80
SSL_PORT=443
LOG_LEVEL=info

# Add your other application-specific variables here
```

### 3. SSL Certificates (if using HTTPS)
Place your SSL certificates in the `ssl` directory:
- `ssl/certificate.crt`
- `ssl/private.key`
- `ssl/ca-bundle.crt` (if needed)

```
# SSL Certificate paths
SSL_PATH=./ssl
ENV_FILE=./env.local
LOGS_PATH=./logs


## Deployment Commands

### Deploy Application
```powershell
# Build and start the application
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f neomir-hana-gateway

# Stop application
docker-compose down
```

### Maintenance Commands
```powershell
# Update application (pull latest changes and rebuild)
git pull
docker-compose down
docker-compose up -d --build

# View resource usage
docker stats neomir-hana-gateway

# Clean up unused Docker resources
docker system prune -f
```

## Automated Updates with Watchtower

The deployment now includes Watchtower for automated container updates:

### Features
- **Automatic Updates**: Checks for new images every hour by default
- **Selective Monitoring**: Only monitors the neomir-hana-gateway container
- **Clean Deployment**: Removes old images after successful updates
- **Rolling Updates**: Updates containers one by one to minimize downtime
- **Health Checks**: Respects container health checks during updates

### Watchtower Management Commands
```powershell
# Check Watchtower status
docker-compose ps watchtower

# View Watchtower logs
docker-compose logs -f watchtower

# Trigger immediate update check
docker-compose exec watchtower watchtower --run-once

# Stop Watchtower temporarily
docker-compose stop watchtower

# Restart Watchtower
docker-compose start watchtower

# Remove Watchtower completely
docker-compose rm watchtower
```

### Configuration Options

You can customize Watchtower behavior by modifying the environment variables in `compose.yaml`:

```yaml
environment:
  WATCHTOWER_POLL_INTERVAL: 3600  # Update check interval in seconds (1 hour)
  WATCHTOWER_CLEANUP: "true"      # Remove old images after update
  WATCHTOWER_DEBUG: "false"       # Enable debug logging
  WATCHTOWER_ROLLING_RESTART: "true"  # Update containers one by one
```

### Windows Docker Desktop Considerations

If using Docker Desktop on Windows, you may need to adjust the Docker socket path:
```yaml
volumes:
  # Use this for Docker Desktop
  - //./pipe/docker_engine:/var/run/docker.sock
  # Or this for standard Docker Engine
  - /var/run/docker.sock:/var/run/docker.sock
```

### Monitoring Update Activity

Create a PowerShell script to monitor Watchtower activity:
```powershell
# monitor-watchtower.ps1
Write-Host "Monitoring Watchtower activity..."
docker-compose logs -f watchtower | Select-String "Updated\|Updating\|Stopped\|Started"
```

## Windows Server Specific Optimizations

### 1. Windows Firewall Configuration
```powershell
# Allow Docker ports through Windows Firewall
New-NetFirewallRule -DisplayName "Docker HTTP" -Direction Inbound -Protocol TCP -LocalPort 80 -Action Allow
New-NetFirewallRule -DisplayName "Docker HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow
```

### 2. Windows Service Integration (Optional)
To run Docker Compose as a Windows Service, you can use tools like:
- **NSSM (Non-Sucking Service Manager)**
- **Windows Task Scheduler**

Example with Task Scheduler:
```powershell
# Create a scheduled task to start on boot
$action = New-ScheduledTaskAction -Execute "docker-compose" -Argument "up -d" -WorkingDirectory "C:\path\to\neomir-hana-gateway"
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "Neomir HANA Gateway" -Action $action -Trigger $trigger -Settings $settings -RunLevel Highest
```


## Troubleshooting

### Common Issues

1. **Port Already in Use:**
```powershell
# Check what's using the port
netstat -ano | findstr :80
# Kill the process if needed
taskkill /PID <process_id> /F
```

2. **Docker Service Not Running:**
```powershell
# Start Docker service
Start-Service docker
# Set to start automatically
Set-Service docker -StartupType Automatic
```

3. **Volume Mount Issues:**
Make sure paths exist and Docker has access to them:
```powershell
# Check if directories exist
Test-Path ".\ssl"
Test-Path ".\logs"
Test-Path ".\env.local"
```

4. **Memory Issues:**
Adjust resource limits in `compose.yaml` based on your Windows Server specs.

## Security Considerations

1. **Run with least privileges**
2. **Keep Docker updated**
3. **Use strong passwords in environment files**
4. **Regularly backup your configuration files**
5. **Monitor logs for security issues**

## Backup Strategy

```powershell
# Backup configuration files
Copy-Item "compose.yaml" ".\backups\compose.yaml.backup"
Copy-Item "env.local" ".\backups\env.local.backup"
Copy-Item "ssl" ".\backups\ssl" -Recurse
