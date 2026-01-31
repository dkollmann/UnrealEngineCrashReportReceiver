# Introduction 
This is a simple crash report receiver for Unreal Engine, based on node.js. It is set up to work with Azure Function Apps, but should be simple to adapt for other services.

The crash reporter basically connection works like this:
- CrashReporter/CheckReport - Quick check if service is available.
- CrashReporter/SubmitReport - The text the user entered in the crash report.
- For every attached file...
  - CrashReporter/UploadReportFile - Uploads one file that needs to be stored.
- CrashReporter/UploadComplete - Indicates that the crash reporter finished.

# Set up Azure
- Create a new Function
  - Select the Flex Consumption plan
  - You need to set up node.js / Javascript 12
  - 512MB is enough.
  - Pick a server region that is resonable for your customers to upload to.
  - You also need a storage, I chose hot since you want to fix things as they come in and then get rid of the crash reports again.
  - I enabled Insights to see logs and stuff.
- After this, you go to the storage you created and copy the connection string from "Data storage / Security + networking / Access keys", copy key1 Connection string.
- In your function, add a new environment variable "CrashReportStorageConnectionString", paste the value. Do not add it in the "Connection Strings" tab but the "Application Settings"!!
- Make sure that in the function's "Settings / Configuration", "HTTPS only" is disabled.

# Build Project
- This is a node.js project, so you need to install node.js version 12.
- Open the folder in Visual Studio Code.
- In the Terminal, run "npm install" in the checked out project, to get all the dependencies.
- In the Terminal, run "npm install -g azure-functions-core-tools@4 --unsafe-perm true" so you can test this locally if needed.
- Install these extensions...
  - Azure Functions - Needed to deploy to Azure
  - ESLint - Shows javascript errors. (Optional)
- Go to the new Azure tab on the left, the big "A" icon.
- Sign in to Azure.
- Open your subscription, go to "Function App" and you should find the function you created before. Right-click it and click "Deploy to Function App".
- Click "Deploy" in the window that will popup shortly.
- Sometimes you get a "no claims" error. Just restart Visual Studio Code.
- After this, on the Azure Function Overview page, there should no be the function "UnrealEngineCrashReportReceiver" be listed at the bottom.

# Set up Unreal
- In the DefaultEngine.ini, add these...

```[CrashReportClient]
DataRouterUrl=""
CrashReportReceiverIP=XXXXXXXXX.azurewebsites.net
CrashReportReceiverPort=443
```

- Replace XXXXXXXXX with your Azure domain which is in the top right of the overview of your function on the Azure website.
- Make sure inluding the crashreporter is enabled in the Unreal Project Settings.
- PAckage a build and test. You can use the console command "debug crash".

# Debug Crash Reporter
- For the crash reporter, use the DebugView tool from Microsoft.
- Run DebugView
- Cause the crash
- Clear the log
- Send the report
- Now DebugView shows you the results from the Crash Reporter.

# Debug Debug Crash Receiver Fucntion
- On the Azure Function Overviedw page, click on the "UnrealEngineCrashReportReceiver" function at the bottom.
- Switch to the "Invocations" tab.
- Each crash report will create multiple entries here. Refreshing it sometimes takes a minute or two for entries to show up.

# Investigate Crash Reports
- On the Azure website, ope nthe strorage you are uploading to.
- Makes sure you have rights to browse it...
  - Go to "Access Control" and "Role Assigment".
  - In the toolbar, click on "Add" and pick "Add Role Assignment".
  - Search for "Storage Blob Data Reader". Select it and click "Next".
  - Click "Select members" and the users you want to be able to brows the storage.
  - Click "Review and Assign".
- On th left go to "Storage browser / Blob containers / crashes".
