# IIS Deployment Guide for ATTG Analytics Dashboard

## Prerequisites

1. **Windows Server 2016+** or **Windows 10/11 Pro/Enterprise**
2. **IIS 10.0+** with the following features enabled:
   - Static Content
   - Default Document
   - URL Rewrite (download and install if not present)
   - Application Initialization (recommended)
3. **IISNode** (download and install): https://github.com/azure/iisnode/releases
4. **Node.js 24.x+** installed on the Windows machine
5. **Visual C++ Redistributable** (required by IISNode)

---

## Step 1: Install Required IIS Components

### On Windows Server (PowerShell as Administrator):
```powershell
# Install IIS features
Install-WindowsFeature -Name Web-Server, Web-Static-Content, Web-Default-Doc, Web-Dir-Browsing -IncludeManagementTools

# Install URL Rewrite (download and run the installer manually from:
# https://www.iis.net/downloads/microsoft/url-rewrite
```

### On Windows 10/11 (PowerShell as Administrator):
```powershell
# Enable IIS and required features
Enable-WindowsOptionalFeature -Online -FeatureName IIS-WebServerCore, IIS-WebServer, IIS-CommonHttpFeatures, IIS-StaticContent, IIS-DefaultDocument, IIS-URLRewrite
```

### Install IISNode:
1. Download the latest stable IISNode release from: https://github.com/azure/iisnode/releases
2. Choose the appropriate version (x86 or x64) matching your system
3. Run the `.msi` installer
4. Accept the default installation path
5. Verify installation: Check that directories exist at `C:\Program Files\iisnode` (or `Program Files (x86)` for 32-bit)

### If IIS says a section is locked

If browsing the site shows:

`This configuration section cannot be used at this path... locked at a parent level`

unlock the required sections in IIS Manager:

1. Open **IIS Manager** as Administrator.
2. Select the **server name** in the left tree, not the site.
3. Open **Feature Delegation**.
4. Set these to **Read/Write**:
   - **Handler Mappings**
   - **Request Filtering**
   - **HTTP Response Headers**
   - **URL Rewrite**
5. If needed, open **Configuration Editor** and verify these sections are not locked:
   - `system.webServer/handlers`
   - `system.webServer/rewrite`
   - `system.webServer/security/requestFiltering`
   - `system.webServer/httpProtocol`

You can also unlock them from an elevated command prompt:

```powershell
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config /section:system.webServer/handlers
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config /section:system.webServer/rewrite
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config /section:system.webServer/security/requestFiltering
& "$env:windir\system32\inetsrv\appcmd.exe" unlock config /section:system.webServer/httpProtocol
```

---

## Step 2: Prepare the Application for Deployment

### Build the Standalone Output:
```bash
cd src/frontend
npm ci
npm run build
```

This creates `.next/standalone/` directory. In this repository layout, the generated entrypoint is:

`src/frontend/.next/standalone/src/frontend/server.js`

Because `.next/standalone/package.json` can be `"type": "module"`, run `server.cjs` for IIS/Node runtime.

The deployment content should come from:
- `.next/standalone/src/frontend/server.js` (copied to `server.cjs` in deploy folder)
- `.next/standalone/src/frontend/.next/`
- `.next/static/` (copied into site root `.next/static`)
- `.next/standalone/src/frontend/package.json`
- `.next/standalone/node_modules/`
- `src/frontend/public/`

### Optional Local Preflight (Before IIS)

Run one of the helper scripts from the repository root to validate the standalone server:

```batch
REM Windows Command Prompt
.\scripts\iis\test-local-server.bat
```

```bash
# WSL/Linux
./scripts/iis/test-local-server.sh
```

### Copy the Deployment Files:
Create a folder (e.g., `C:\inetpub\wwwroot\att-dashboard\`) and copy:
```
C:\inetpub\wwwroot\att-dashboard\
├── .next/
│   ├── server/
│   └── static/
├── node_modules/
├── server.cjs
├── package.json
├── web.config              ← copy from src/frontend/web.config
├── public/
└── iisnode/                ← runtime logs
```

---

## Step 3: Set Environment Variables

You must set the following environment variables for the app to start. Choose one method:

### **Method A: Set in IIS App Pool (Recommended)**

1. Open **Internet Information Services (IIS) Manager** (inetmgr)
2. Left sidebar → **Application Pools**
3. Right-click the app pool for att-dashboard → **Advanced Settings**
4. Scroll down to **Environment Variables** (if not visible, click "..." on the right)
5. Add the following variables:
   ```
   AUTH_URL=http://localhost
   AUTH_SECRET=<random-secret-key>  # Generate with: openssl rand -base64 32
   AUTH_MICROSOFT_ENTRA_ID_ID=<your-entra-id-app-client-id>
   AUTH_MICROSOFT_ENTRA_ID_SECRET=<your-entra-id-client-secret>
   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<your-entra-id-tenant-id>
   NODE_ENV=production
   ```

### **Method B: Create a .env.local File in the App Root**
   ```bash
   # In C:\inetpub\wwwroot\att-dashboard\
   # Create file: .env.local
   AUTH_URL=http://localhost
   AUTH_SECRET=<random-secret-key>
   AUTH_MICROSOFT_ENTRA_ID_ID=<your-entra-id-app-client-id>
   AUTH_MICROSOFT_ENTRA_ID_SECRET=<your-entra-id-client-secret>
   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<your-entra-id-tenant-id>
   NODE_ENV=production
   ```

### **Method C: appcmd (advanced)**

```powershell
$appcmd = "$env:windir\system32\inetsrv\appcmd.exe"
& $appcmd set config -section:system.applicationHost/applicationPools "/[name='AttDashboardPool'].environmentVariables.[name='AUTH_URL',value='http://localhost']" /commit:apphost
```

---

## Step 4: Configure IIS Website and Application Pool

### Create Application Pool:

1. Open **IIS Manager** (inetmgr)
2. Right-click **Application Pools** → **Add Application Pool**
3. Fill in:
   - **Name**: `AttDashboardPool`
   - **.NET CLR version**: `No Managed Code`
   - **Managed pipeline mode**: `Integrated`
4. Click **OK**
5. Right-click `AttDashboardPool` → **Advanced Settings**:
   - **Enable 32-Bit Applications**: `False`
   - **Identity**: `ApplicationPoolIdentity` (or a custom user with read permissions to the app folder)
   - **Start Mode**: `Always Running` (recommended for lower startup latency)
   - **Idle Time-out**: `0` (to prevent app from unloading)
   - **Maximum Worker Processes**: `1` (for Node.js)

### Create Website:

1. Right-click **Sites** → **Add Website**
2. Fill in:
   - **Site name**: `AttDashboard`
   - **Application pool**: `AttDashboardPool`
   - **Physical path**: `C:\inetpub\wwwroot\att-dashboard\`
   - **Binding**: 
     - Type: `http`, IP: `All Unassigned`, Port: `80`
     - (Add HTTPS binding later with SSL certificate)
3. Click **OK**

### Set Folder Permissions:

The IIS App Pool identity must have **Read** access to the app folder:

```powershell
# In PowerShell as Administrator
$appPath = "C:\inetpub\wwwroot\att-dashboard"
$poolIdentity = "IIS AppPool\AttDashboardPool"

# Grant Read and List permissions
icacls $appPath /grant "${poolIdentity}:(OI)(CI)(RX)" /T /C
icacls $appPath /grant "${poolIdentity}:(OI)(CI)R" /T /C
```

---

## Step 5: Test the Application

### Start the Site:

1. In IIS Manager, right-click the **AttDashboard** site → **Start**
2. Check that the site status shows **Started** (green circle)

### Check Logs:

IISNode logs are written to `logs` directory (relative to app root). Check:
```
C:\inetpub\wwwroot\att-dashboard\iisnode\
```

Configured in web.config: `logDirectory="iisnode"`

### Browse to the App:

1. Open a web browser
2. Navigate to: `http://localhost/` (or your configured hostname)
3. You should see:
   - Initial page load
   - Authentication redirect to Microsoft Entra ID login page
   - After login, the dashboard

### Test API Endpoints:

```powershell
# Test a simple API endpoint
Invoke-WebRequest -Uri "http://localhost/api/health"

# Check server logs
Get-Content "C:\inetpub\wwwroot\att-dashboard\logs\*" -Tail 20
```

### Enable IIS Request Logging:

1. Right-click **AttDashboard** site → **Edit Site** (or double-click)
2. Select **Logging** feature
3. Set:
   - **Log Format**: `W3C`
   - **Log Directory**: `C:\inetpub\logs\LogFiles\`
4. Click **Apply**

---

## Step 6: Configure HTTPS (SSL)

### Generate or Obtain SSL Certificate:

**Self-signed (Development):**
```powershell
# In PowerShell as Administrator
New-SelfSignedCertificate -DnsName "localhost", "att-dashboard.local" -CertStoreLocation "cert:\LocalMachine\My" -FriendlyName "AttDashboard Dev Cert"
```

**Production:** Purchase from a CA (DigiCert, Let's Encrypt via certbot, etc.)

### Bind HTTPS in IIS:

1. In IIS Manager, right-click **AttDashboard** → **Edit Bindings**
2. Click **Add**:
   - **Type**: `https`
   - **IP address**: `All Unassigned`
   - **Port**: `443`
   - **SSL certificate**: Select your certificate from the dropdown
3. Click **OK**
4. (Optional) Add an HTTP → HTTPS redirect rule:
   - Uncomment the "HTTP to HTTPS" rule in `web.config`

### Update AUTH_URL:

Change `AUTH_URL` environment variable to HTTPS:
```
AUTH_URL=https://att-dashboard.local
```

---

## Step 7: Troubleshooting

### Issue: "Node.exe exited with error code 1"

**Cause**: Missing environment variables or Node.js module not found.

**Fix**:
1. Check that `AUTH_*` environment variables are set
2. Verify `node_modules` is deployed
3. Check IISNode logs: `C:\inetpub\wwwroot\att-dashboard\iisnode\`

```bash
# Or manually test the server:
cd C:\inetpub\wwwroot\att-dashboard
node server.cjs
```

### Issue: "404 Not Found" for all routes

**Cause**: URL Rewrite rules not working or IISHandler not configured.

**Fix**:
1. Verify **URL Rewrite** is installed: Features → URL Rewrite (icon appears)
2. Verify **web.config** handler: `<add name="iisnode" path="server.cjs" ...>`
3. Check IIS logs: `C:\inetpub\logs\LogFiles\W3SVC1\`

### Issue: "Access Denied" errors

**Cause**: App Pool identity doesn't have read permissions.

**Fix**:
```powershell
icacls "C:\inetpub\wwwroot\att-dashboard" /grant "IIS AppPool\AttDashboardPool:(OI)(CI)(RX)" /T /C
```

### Issue: Application pool crashes or recycles

**Cause**: Out-of-memory, uncaught exception, or Node.js crash.

**Fix**:
1. Check **Application Event Viewer**: Admin tools → Event Viewer → Application
2. Check IISNode logs with more detail
3. Enable Failed Request Tracing (uncomment in web.config)
4. Increase app pool memory limits:
   - Right-click App Pool → **Advanced Settings**
   - **Memory limit** (e.g., 2048 MB)

### Issue: "Cannot find module" errors

**Cause**: Dependencies not installed or path mismatch.

**Fix**:
```bash
# On the deployment server:
cd C:\inetpub\wwwroot\att-dashboard

# Install Node dependencies
npm install --production

# Or use ci for exact versions:
npm ci --production
```

---

## Step 8: Performance and Security Recommendations

### Enable Application Initialization (Keep App Warm):

1. Install the **Application Initialization** IIS feature
2. Edit **AttDashboard** site → **Application Settings** → **Enable**
3. Optionally add a warmup request:
   - Edit `web.config`:
   ```xml
   <applicationInitialization>
     <add initializationPage="/api/health" hostName="localhost" />
   </applicationInitialization>
   ```

### Configure Recycling:

Right-click **AttDashboardPool** → **Advanced Settings**:
- **Regular Time Interval**: `1740` minutes (29 hours) - prevent memory leaks
- **Private Memory Limit**: `512` MB (adjust based on load)

### Monitor with AppInitialization + Health Check:

Ensure your app exports a `/api/health` or similar endpoint that returns `200 OK`.

### Entra Redirect URIs:

For local IIS login, ensure the Entra app registration includes:
- `http://localhost/api/auth/callback/microsoft-entra-id`
- `http://localhost:80/api/auth/callback/microsoft-entra-id` (optional fallback)

---

## Deployment Checklist

- [ ] IISNode installed and verified
- [ ] URL Rewrite installed and verified
- [ ] Application Pool created with correct settings
- [ ] Website created and bound to correct physical path
- [ ] Folder permissions set (App Pool identity can read)
- [ ] Environment variables set (AUTH_* secrets)
- [ ] `web.config` copied to app root directory
- [ ] `npm run build` completed locally; `.next/standalone` exists
- [ ] All files copied to IIS folder (server.cjs, .next, node_modules, public, etc.)
- [ ] Site started; status shows "Started"
- [ ] Test in browser: `http://localhost` → redirects to Entra ID login → dashboard loads
- [ ] HTTPS configured (if production)
- [ ] Firewall allows inbound traffic on port 80/443
- [ ] Application pool recycling and memory policies configured

---

## Command Reference

```powershell
# Check if IISNode is installed
Test-Path "C:\Program Files\iisnode"

# Restart IIS
iisreset /restart

# Restart specific app pool
& "$env:windir\system32\inetsrv\appcmd.exe" recycle apppool /apppool.name:AttDashboardPool

# View IISNode logs
Get-ChildItem "C:\inetpub\wwwroot\att-dashboard\iisnode" | Select-Object -Last 5 | Get-Content

# Test Node.js manually
& "C:\Program Files\nodejs\node.exe" --version
```

---

## Next Steps

1. **Deploy to Staging IIS**: Test the full chain (build → copy → IIS → browser)
2. **Load Testing**: Use Apache JMeter or Locust to validate performance
3. **Monitoring**: Set up Windows Event Log alerts or Application Insights integration
4. **CI/CD**: Automate deployment with GitHub Actions or Azure DevOps (PowerShell scripts to copy files to IIS)
