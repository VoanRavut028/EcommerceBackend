#requires -RunAsAdministrator

$ErrorActionPreference = "Stop"

$serviceName = "MongoDB"
$configPath = "C:\Program Files\MongoDB\Server\8.2\bin\mongod.cfg"
$projectRoot = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $projectRoot ".env"
$backupPath = "$configPath.codex-backup-$(Get-Date -Format 'yyyyMMdd-HHmmss')"

if (-not (Test-Path -LiteralPath $configPath)) {
  throw "MongoDB config was not found at $configPath"
}
if (-not (Test-Path -LiteralPath $envPath)) {
  throw "Project .env was not found at $envPath"
}

$service = Get-Service -Name $serviceName -ErrorAction Stop
$config = [System.IO.File]::ReadAllText($configPath)

if ($config -match '(?m)^\s*replSetName:\s*(?<name>[^\s#]+)') {
  if ($Matches.name -ne "rs0") {
    throw "MongoDB already uses replica set '$($Matches.name)'. Script stopped without changing it."
  }
} elseif ($config -match '(?m)^#replication:\s*$') {
  Copy-Item -LiteralPath $configPath -Destination $backupPath
  $config = [regex]::Replace(
    $config,
    '(?m)^#replication:\s*$',
    "replication:`r`n  replSetName: rs0",
    1
  )
  [System.IO.File]::WriteAllText(
    $configPath,
    $config,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Host "MongoDB config updated. Backup: $backupPath"
} else {
  throw "Could not find the commented replication section; config was not changed."
}

if ($service.Status -eq "Running") {
  Restart-Service -Name $serviceName
} else {
  Start-Service -Name $serviceName
}

$deadline = (Get-Date).AddSeconds(45)
do {
  Start-Sleep -Seconds 2
  $service = Get-Service -Name $serviceName
} while ($service.Status -ne "Running" -and (Get-Date) -lt $deadline)

if ($service.Status -ne "Running") {
  throw "MongoDB service did not reach the Running state. Check the MongoDB log before retrying."
}

$mongosh = (Get-Command mongosh.exe -ErrorAction Stop).Source
$mongoUri = "mongodb://127.0.0.1:27017/admin"
$initializeReplicaSet = @'
const hello = db.hello();
if (!hello.setName) {
  printjson(rs.initiate({ _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] }));
} else if (hello.setName !== "rs0") {
  throw new Error("MongoDB is already in replica set " + hello.setName);
} else {
  print("Replica set rs0 is already initialized.");
}
'@
& $mongosh $mongoUri --quiet --eval $initializeReplicaSet
if ($LASTEXITCODE -ne 0) {
  throw "Could not initialize replica set rs0. MongoDB config was updated and the original config backup is available."
}

$checkReplicaSet = 'const h=db.hello(); print(JSON.stringify({setName:h.setName??null,isWritablePrimary:h.isWritablePrimary??false}));'
$deadline = (Get-Date).AddSeconds(45)
$replicaReady = $false
do {
  Start-Sleep -Seconds 2
  $result = & $mongosh $mongoUri --quiet --eval $checkReplicaSet
  if ($LASTEXITCODE -eq 0) {
    try {
      $state = $result | ConvertFrom-Json
      $replicaReady = $state.setName -eq "rs0" -and $state.isWritablePrimary
    } catch {
      $replicaReady = $false
    }
  }
} while (-not $replicaReady -and (Get-Date) -lt $deadline)

if (-not $replicaReady) {
  throw "Replica set rs0 did not become primary within 45 seconds. Check the MongoDB service and log."
}

$envText = [System.IO.File]::ReadAllText($envPath)
$envPattern = '(?m)^(\s*MONGODB_URL\s*=\s*)([^\r\n]*)'
$envRegex = [regex]::new($envPattern)
if (-not $envRegex.IsMatch($envText)) {
  throw "MONGODB_URL was not found in .env; replica set is ready, but update the connection string manually with ?replicaSet=rs0."
}

$evaluator = [System.Text.RegularExpressions.MatchEvaluator]{
  param($match)
  $rawValue = $match.Groups[2].Value.Trim()
  $quote = ""
  if ($rawValue.Length -ge 2 -and (($rawValue[0] -eq '"' -and $rawValue[-1] -eq '"') -or ($rawValue[0] -eq "'" -and $rawValue[-1] -eq "'"))) {
    $quote = [string]$rawValue[0]
    $rawValue = $rawValue.Substring(1, $rawValue.Length - 2)
  }
  if ($rawValue -notmatch '^mongodb://(localhost|127\.0\.0\.1)(:\d+)?/') {
    throw "MONGODB_URL is not a local mongodb:// URI; replica set is ready, but update the connection string manually."
  }
  $rawValue = [regex]::Replace($rawValue, '([?&])replicaSet=[^&]*', '')
  $separator = if ($rawValue.Contains('?')) { '&' } else { '?' }
  return $match.Groups[1].Value + $quote + $rawValue + $separator + 'replicaSet=rs0' + $quote
}

$updatedEnv = $envRegex.Replace($envText, $evaluator, 1)
[System.IO.File]::WriteAllText($envPath, $updatedEnv, [System.Text.UTF8Encoding]::new($false))

Write-Host "Local MongoDB replica set rs0 is ready and MONGODB_URL now includes replicaSet=rs0."
Write-Host "Restart your API server and retry checkout."
