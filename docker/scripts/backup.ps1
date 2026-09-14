# HamVajeh PostgreSQL Automated Backup Script (Windows / PowerShell)
# Usage: .\docker\scripts\backup.ps1

[CmdletBinding()]
param (
    [string]$ContainerName = "hamvajeh-postgres-prod",
    [string]$DbUser = "hamvajeh",
    [string]$DbName = "hamvajeh",
    [int]$RetentionDays = 14
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = (Get-Item "$scriptDir\..\..").FullName
$backupDir = Join-Path $projectRoot "docker\backups"

if (!(Test-Path $backupDir)) {
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$sqlTempFile = Join-Path $backupDir "hamvajeh_backup_${timestamp}.sql"
$backupFile = Join-Path $backupDir "hamvajeh_backup_${timestamp}.sql.gz"

Write-Host "[$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))] Starting database backup for '$DbName' from container '$ContainerName'..." -ForegroundColor Cyan

# Check if container is running
$runningContainers = docker ps --format '{{.Names}}'
if ($runningContainers -notcontains $ContainerName) {
    Write-Error "ERROR: Container '$ContainerName' is not running!"
    exit 1
}

# Run pg_dump
docker exec $ContainerName pg_dump -U $DbUser -d $DbName --clean --if-exists > $sqlTempFile

# Compress to .sql.gz using .NET GZipStream
$sourceFile = [System.IO.File]::OpenRead($sqlTempFile)
$destFile = [System.IO.File]::Create($backupFile)
$gzipStream = New-Object System.IO.Compression.GZipStream($destFile, [System.IO.Compression.CompressionLevel]::Optimal)
$sourceFile.CopyTo($gzipStream)
$gzipStream.Dispose()
$destFile.Dispose()
$sourceFile.Dispose()

# Remove uncompressed temp file
Remove-Item $sqlTempFile -Force -ErrorAction SilentlyContinue

$size = (Get-Item $backupFile).Length / 1MB
Write-Host "[$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))] Backup created: $backupFile ($([math]::Round($size, 2)) MB)" -ForegroundColor Green

# Retention policy: remove older backups
$cutoffDate = (Get-Date).AddDays(-$RetentionDays)
Get-ChildItem -Path $backupDir -Filter "hamvajeh_backup_*.sql.gz" | Where-Object { $_.LastWriteTime -lt $cutoffDate } | ForEach-Object {
    Write-Host "Removing old backup: $($_.FullName)" -ForegroundColor Yellow
    Remove-Item $_.FullName -Force
}

Write-Host "[$((Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ'))] Backup completed successfully." -ForegroundColor Green
