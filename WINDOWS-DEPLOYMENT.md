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

### 4. Optional: Create Environment Variables File
Create `.env` file for Docker Compose variables:
```
# SSL Certificate paths
SSL_PATH=./ssl
ENV_FILE=./env.local
LOGS_PATH=./logs

# Database settings (if using database service)
DB_NAME=neomir
DB_USER=neomir
DB_PASSWORD=your-secure-database-password
DB_DATA_PATH=./data/postgres
```

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

### 3. Performance Monitoring
```powershell
# Monitor Docker containers
docker-compose top

# Monitor system resources
Get-Counter "\Processor(_Total)\% Processor Time", "\Memory\Available MBytes"

# Monitor Docker logs with PowerShell
docker-compose logs -f --tail=100 neomir-hana-gateway
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

# Backup application data (if using database)
docker-compose exec database pg_dump -U $env:DB_USER $env:DB_NAME > ".\backups\database_backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
``` 