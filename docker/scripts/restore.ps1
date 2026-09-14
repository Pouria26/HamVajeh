# HamVajeh PostgreSQL Restore Script (Windows / PowerShell)
# Usage: .\docker\scripts\restore.ps1 -BackupFile .\docker\backups\hamvajeh_backup_20260914_124603.sql.gz

[CmdletBinding()]
param (
    [Parameter(Mandatory = $true)]
    [string]$BackupFile,
    [string]$ContainerName = "hamvajeh-postgres-prod",
    [string]$DbUser = "hamvajeh",
    [string]$DbName = "hamvajeh"
)

$ErrorActionPreference = "Stop"

if (!(Test-Path $BackupFile)) {
    Write-Error "ERROR: Backup file '$BackupFile' does not exist!"
    exit 1
}

Write-Host "WARNING: This will restore database '$DbName' from '$BackupFile'." -ForegroundColor Yellow
$confirmation = Read-Host "Are you sure you want to proceed? (y/N)"
if ($confirmation -notmatch "^[Yy]$") {
    Write-Host "Restore cancelled."
    exit 0
}

Write-Host "Restoring database..." -ForegroundColor Cyan

if ($BackupFile.EndsWith(".gz")) {
    $tempSql = [System.IO.Path]::ChangeExtension($BackupFile, ".temp.sql")
    $sourceStream = [System.IO.File]::OpenRead($BackupFile)
    $gzipStream = New-Object System.IO.Compression.GZipStream($sourceStream, [System.IO.Compression.CompressionMode]::Decompress)
    $destStream = [System.IO.File]::Create($tempSql)
    $gzipStream.CopyTo($destStream)
    $destStream.Dispose()
    $gzipStream.Dispose()
    $sourceStream.Dispose()

    Get-Content $tempSql -Raw | docker exec -i $ContainerName psql -U $DbUser -d $DbName
    Remove-Item $tempSql -Force -ErrorAction SilentlyContinue
} else {
    Get-Content $BackupFile -Raw | docker exec -i $ContainerName psql -U $DbUser -d $DbName
}

Write-Host "Restore completed successfully!" -ForegroundColor Green
