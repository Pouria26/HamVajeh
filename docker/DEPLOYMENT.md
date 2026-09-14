# HamVajeh Deployment & Operations Manual

This document outlines the deployment architecture, secure database handling, and operational procedures for running the HamVajeh production stack.

---

## 1. Architecture Overview

The production deployment consists of four orchestrated container services managed via Docker Compose:

1. **Frontend (`frontend`)**: React 19 PWA compiled to static assets and served by Nginx Alpine with Gzip compression and reverse proxy routing on `/api`.
2. **Backend (`backend`)**: Node.js 20 Express REST API with TypeScript, handling business logic, user rate limiting, and PostgreSQL queries.
3. **AI Assistant (`agent`)**: Python 3.12 FastAPI microservice providing linguistic analysis, sentence generation, and exercise explanations.
4. **Database (`postgres`)**: PostgreSQL 16 Alpine persisting data to the `backend_hamvajeh_pgdata` Docker volume.

---

## 2. Database Privacy & Security Policy

- **Zero Database Dumps in Repository**: All `.sql`, `.sql.gz`, and `docker/backups/` files are strictly excluded via `.gitignore`. The dataset (4,184 collocations and 20,920 sentence examples) is never committed or pushed to any remote repository.
- **Persistent Storage**: Data resides exclusively on your local Docker volume or your production server's persistent volume.

---

## 3. Server Deployment Workflow (VPS / Cloud)

When deploying to a fresh Linux VPS or cloud instance:

### Step 1: Clone the Repository
```bash
git clone <repository-url>
cd "Persian Collocation"
```

### Step 2: Configure Environment Variables
```bash
cp .env.production.example .env
# Edit .env to set your production credentials (e.g., GOOGLE_API_KEY, ADMIN_TOKEN):
nano .env
```

### Step 3: Transfer Database Seed (Direct & Secure)
Transfer the compressed database seed directly from your local machine to the server using SCP or SFTP (this avoids committing data to Git):
```bash
# Execute from your local development machine:
scp docker/postgres/init.sql.gz user@your-server-ip:/path/to/Persian\ Collocation/docker/postgres/
```
*(Alternatively, drag-and-drop `init.sql.gz` into `docker/postgres/` using WinSCP or FileZilla)*

### Step 4: Launch the Production Stack
```bash
docker compose -f docker-compose.prod.yml up -d --build
```
On first launch, PostgreSQL will automatically detect `init.sql.gz` in `/docker-entrypoint-initdb.d/`, uncompress it, and seed the full dataset with indexes.

---

## 4. Automated 24-Hour Backups (Cron Job)

To configure automated daily database backups on the production Linux server:

1. Ensure the backup script has executable permissions:
   ```bash
   chmod +x docker/scripts/backup.sh
   ```

2. Open crontab:
   ```bash
   crontab -e
   ```

3. Add the following scheduled job to run daily at 02:00 AM (keeps the last 14 days of backups automatically):
   ```cron
   0 2 * * * /path/to/Persian\ Collocation/docker/scripts/backup.sh >> /path/to/Persian\ Collocation/docker/backups/backup.log 2>&1
   ```

---

## 5. Routine Operations & Maintenance

### Checking Service Health
```bash
docker compose -f docker-compose.prod.yml ps
```

### Viewing Live Service Logs
```bash
docker compose -f docker-compose.prod.yml logs -f
```

### Stopping the Stack
```bash
docker compose -f docker-compose.prod.yml down
```
*(Volume data remains completely intact upon shutdown)*

### Manual Database Backup
- **Linux**:
  ```bash
  ./docker/scripts/backup.sh
  ```
- **Windows (PowerShell)**:
  ```powershell
  .\docker\scripts\backup.ps1
  ```
Backups are saved as compressed files to `docker/backups/` and excluded from Git.

### Database Restoration
- **Linux**:
  ```bash
  ./docker/scripts/restore.sh docker/backups/hamvajeh_backup_YYYYMMDD_HHMMSS.sql.gz
  ```
- **Windows (PowerShell)**:
  ```powershell
  .\docker\scripts\restore.ps1 -BackupFile .\docker\backups\hamvajeh_backup_YYYYMMDD_HHMMSS.sql.gz
  ```
