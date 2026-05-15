# IIS Deployment Quick Start

## Overview

This directory now contains everything needed to deploy and test the ATTG Analytics Dashboard web app on **Windows IIS** instead of Azure App Service.

## Files Created

| File | Purpose |
|------|---------|
| [src/frontend/web.config](../../src/frontend/web.config) | IIS configuration for Node.js routing and IISNode handler mapping |
| [scripts/iis/IIS_DEPLOYMENT_GUIDE.md](./IIS_DEPLOYMENT_GUIDE.md) | Complete step-by-step deployment guide (recommended reading) |
| [scripts/iis/deploy-to-iis.ps1](./deploy-to-iis.ps1) | Automated PowerShell deployment script (recommended) |
| [scripts/iis/test-local-server.bat](./test-local-server.bat) | Windows batch script to test app locally before IIS deployment |
| [scripts/iis/test-local-server.sh](./test-local-server.sh) | Bash script for WSL/Linux environments |

## Quick Start (5 Minutes)

### Option 1: Automated Deployment (Recommended)

**Prerequisites:**
- Windows 10/11 Pro or Windows Server 2016+
- IIS 10.0+ installed
- IISNode installed (download from https://github.com/azure/iisnode/releases)
- Node.js 24.x installed
- App already built locally (`npm run build` in `src/frontend`)

**Steps:**

1. **Open PowerShell as Administrator:**
   ```powershell
   # Navigate to repo root
   cd C:\Repos\BTS-ATTG-ANALYTICS-DASHBOARD-ATTGANALYTICSDASHBOARD
   ```

2. **Run the deployment script:**
   ```powershell
   .\scripts\iis\deploy-to-iis.ps1 `
     -EntraIdId "your-app-client-id" `
     -EntraIdSecret "your-app-client-secret" `
     -EntraIdTenantId "your-tenant-id"
   ```

3. **Configure environment variables in IIS:**
   - Open **IIS Manager** (`inetmgr`)
   - Navigate to **Application Pools** → **AttDashboardPool** → **Advanced Settings**
   - Find **Environment Variables** section
   - Add these variables:
     ```
       AUTH_URL=http://localhost
     AUTH_SECRET=<generate-with-openssl-rand-base64-32>
     AUTH_MICROSOFT_ENTRA_ID_ID=<your-app-id>
     AUTH_MICROSOFT_ENTRA_ID_SECRET=<your-app-secret>
     AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<your-tenant-id>
     NODE_ENV=production
     ```

4. **Start the website:**
   - In IIS Manager, right-click **AttDashboard** → **Start**

5. **Test:**
   - Open browser: `http://localhost/`
   - You should be redirected to Microsoft Entra ID login page

### Option 2: Manual Deployment (Full Control)

Follow the detailed steps in [IIS_DEPLOYMENT_GUIDE.md](./IIS_DEPLOYMENT_GUIDE.md).

## Expected IIS Folder Layout

After deployment, the target IIS folder should look like this:

```text
C:\inetpub\wwwroot\att-dashboard\
|-- .next\
|   |-- server\
|   `-- static\
|-- node_modules\
|-- server.cjs
|-- package.json
|-- web.config
|-- public\ (optional)
`-- iisnode\
```

Notes:
- `.next/server` is copied from standalone output.
- `.next/static` is copied from `src/frontend/.next/static`.
- `server.cjs` is generated from `server.js` for IISNode compatibility.

## Testing Before IIS

Before deploying to IIS, test the app locally to ensure it runs:

```batch
REM Windows Command Prompt
.\scripts\iis\test-local-server.bat
```

Or in WSL/Linux:
```bash
./scripts/iis/test-local-server.sh
```

Manual PowerShell fallback:
```powershell
# Set environment variables first
$env:AUTH_URL = "http://localhost:3000"
$env:AUTH_SECRET = "test-secret-key"
$env:AUTH_MICROSOFT_ENTRA_ID_ID = "your-app-id"
$env:AUTH_MICROSOFT_ENTRA_ID_SECRET = "your-app-secret"
$env:AUTH_MICROSOFT_ENTRA_ID_TENANT_ID = "your-tenant-id"

# Run the test script
cd .\src\frontend\.next\standalone\src\frontend
$env:NODE_ENV = "production"
Copy-Item .\server.js .\server.cjs -Force
node server.cjs
```

The app will start on `http://localhost:3000`.

## Troubleshooting

### "Node.exe exited with error code 1"
Check IISNode logs:
```powershell
Get-ChildItem "C:\inetpub\wwwroot\att-dashboard\iisnode" -Recurse | Get-Content -Tail 50
```

### "404 Not Found" for all routes
Verify:
1. IIS URL Rewrite module is installed
2. web.config exists in app folder
3. Check IIS logs: `C:\inetpub\logs\LogFiles\W3SVC1\`

### Application pool crashes
Check Windows Event Viewer:
- **Event Viewer** → **Windows Logs** → **Application**
- Look for errors from IIS/IISNode

### Port already in use
Change the port in IIS Manager or PowerShell:
```powershell
Import-Module WebAdministration

# List bindings
Get-WebBinding -Name "AttDashboard"

# Remove old binding
Remove-WebBinding -Name "AttDashboard" -BindingInformation "*:80:localhost" -Protocol http

# Add new binding (e.g., port 8000)
New-WebBinding -Name "AttDashboard" -Protocol http -IPAddress "*" -Port 8000 -HostHeader "localhost"
```

## Environment Variables Reference

| Variable | Example | Notes |
|----------|---------|-------|
| `AUTH_URL` | `https://yourdomain.com` | Base URL for authentication callbacks (no `/auth` suffix) |
| `AUTH_SECRET` | Use `openssl rand -base64 32` | Session encryption key (must be same on all instances) |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | `12345678-...` | Azure Entra ID App Registration Client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | `...` | Client Secret from App Registration |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | `87654321-...` | Azure Entra ID Tenant ID |
| `NODE_ENV` | `production` | Set to `production` for IIS |

## IIS Performance Tuning

```powershell
# Increase recycling interval
$poolPath = "IIS:\AppPools\AttDashboardPool"
Set-ItemProperty -Path $poolPath -Name "recycling.periodicRestart.time" -Value ([TimeSpan]::FromHours(48))

# Increase memory limit
Set-ItemProperty -Path $poolPath -Name "recycling.periodicRestart.privateMemory" -Value 1048576

# Always running
Set-ItemProperty -Path $poolPath -Name "startMode" -Value "AlwaysRunning"
```

## Entra Redirect URI Checklist

For local IIS sign-in, add these redirect URIs to the app registration:
- `http://localhost/api/auth/callback/microsoft-entra-id`
- `http://localhost:80/api/auth/callback/microsoft-entra-id` (optional fallback)

## Monitoring

Enable Application Initialization to keep the app warm:

```powershell
# In web.config, add:
# <applicationInitialization>
#   <add initializationPage="/api/health" hostName="localhost" />
# </applicationInitialization>
```

## Next Steps

1. ✅ Deploy to local IIS
2. ✅ Test authentication redirect to Entra ID
3. ✅ Verify dashboard loads after login
4. 📊 Set up monitoring with Application Insights
5. 🔒 Obtain SSL certificate (Let's Encrypt or CA) and configure HTTPS
6. 🚀 Deploy to production IIS server

## Support

- **Detailed Guide**: See [IIS_DEPLOYMENT_GUIDE.md](./IIS_DEPLOYMENT_GUIDE.md)
- **IISNode Issues**: [github.com/azure/iisnode/issues](https://github.com/azure/iisnode/issues)
- **Next.js Docs**: [nextjs.org/docs](https://nextjs.org/docs)
- **IIS Docs**: [learn.microsoft.com/iis](https://learn.microsoft.com/en-us/iis/)

## Summary

| Step | Command/Tool | Status |
|------|--------------|--------|
| Install IIS | Windows Features Manager | ⚙️ Manual |
| Install IISNode | Download `.msi` from GitHub | ⚙️ Manual |
| Build app | `npm run build` | ✅ Done locally |
| Deploy | `scripts/iis/deploy-to-iis.ps1` | ✅ Automated |
| Test | `scripts/iis/test-local-server.bat` | ✅ Ready |
| Configure | IIS Manager GUI | ⚙️ Manual (5 min) |
| Verify | Browser to `http://localhost/` | ✅ Easy |
