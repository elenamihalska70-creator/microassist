$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$repo = (Resolve-Path (Join-Path $root '../..')).Path
$container = 'microassist-paid-at-' + [guid]::NewGuid().ToString('N').Substring(0,12)
$image = 'postgres@sha256:2d2b8998d31037bf721cfdf764d76ba74171b4fab3431b7f72c27c56ddbdf9e3'
$log = Join-Path $root 'postgres-results.txt'
$records = [ordered]@{success=$false;cleanupVerified=$false;image=$image;remoteAccess=$false;cases=@()}
Set-Content $log 'Synthetic PostgreSQL only; no linked configuration or credentials.'
function Invoke-LocalDocker([string[]]$Arguments, [switch]$ExpectFailure) {
  $old = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  $output = & docker @Arguments 2>&1
  $code = $LASTEXITCODE
  $ErrorActionPreference = $old
  $output | ForEach-Object { Add-Content $log $_.ToString().TrimEnd() }
  if ($ExpectFailure) {
    if ($code -eq 0 -or ($output -join "`n") -notmatch 'ERROR:') { throw 'Expected explicit SQL failure' }
  } elseif ($code -ne 0) { throw ('Docker failed: ' + ($Arguments -join ' ')) }
  return $output
}
function Sql([string]$Db, [string]$Statement) {
  Invoke-LocalDocker -Arguments @('exec',$container,'timeout','25s','psql','-X','-U','postgres','-d',$Db,'-v','ON_ERROR_STOP=1','-c',$Statement) | Out-Null
}
try {
  Invoke-LocalDocker -Arguments @('run','-d','--pull=never','--name',$container,'--label','microassist.validation=paid-at','--network','none','--tmpfs','/var/lib/postgresql/data:rw,size=268435456','--memory','384m','--cpus','1','-e','POSTGRES_HOST_AUTH_METHOD=trust',$image) | Out-Null
  $inspection = (& docker inspect $container | Out-String | ConvertFrom-Json)[0]
  if ($inspection.HostConfig.NetworkMode -ne 'none' -or @($inspection.Mounts | Where-Object Type -ne 'tmpfs').Count -gt 0 -or $inspection.HostConfig.PortBindings.Count -gt 0) { throw 'Isolation failed' }
  $records.isolation = 'network=none; no published ports; tmpfs only; no host mounts'
  $ready=$false
  for($i=0;$i -lt 40;$i++) {
    & docker exec $container pg_isready -U postgres *> $null
    if ($LASTEXITCODE -eq 0) {$ready=$true;break}
    Start-Sleep -Milliseconds 250
  }
  if (!$ready) {throw 'Postgres not ready'}
  $copies = @{
    'setup.sql'=(Join-Path $root 'setup.sql')
    'verify.sql'=(Join-Path $root 'verify.sql')
    'migration.sql'=(Join-Path $repo 'supabase/migrations/20261022221124_add_invoice_paid_at_guarded.sql')
  }
  $records.hashes=@{}
  foreach ($name in $copies.Keys) {
    Invoke-LocalDocker -Arguments @('cp',$copies[$name],($container + ':/tmp/' + $name)) | Out-Null
    $hash=(Get-FileHash $copies[$name]).Hash
    $copyHash=((& docker exec $container sha256sum ('/tmp/'+$name)) -split '\s+')[0].ToUpperInvariant()
    if ($hash -ne $copyHash) {throw 'SQL copy hash mismatch'}
    $records.hashes[$name]=$hash
  }
  foreach($file in @('setup.sql')) {
    Invoke-LocalDocker -Arguments @('exec',$container,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f',('/tmp/'+$file)) | Out-Null
  }
  # Clone a synthetic baseline; never replay the gate against the linked project.
  $cases = [ordered]@{
    missing_gate='DROP POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices'
    permissive_gate='DROP POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices; CREATE POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices FOR INSERT TO anon, authenticated WITH CHECK(false)'
    wrong_roles='ALTER POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices TO authenticated'
    extra_role='ALTER POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices TO anon, authenticated, postgres'
    wrong_check='ALTER POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices WITH CHECK(true)'
    wrong_command='DROP POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices; CREATE POLICY lot_10_3b_6d_4_deny_browser_invoice_insert ON invoices AS RESTRICTIVE FOR UPDATE TO anon, authenticated USING(false) WITH CHECK(false)'
    disabled_rls='ALTER TABLE invoices DISABLE ROW LEVEL SECURITY'
    existing_paid_at='ALTER TABLE invoices ADD COLUMN paid_at text'
    schema_drift='ALTER TABLE invoices ALTER COLUMN status TYPE varchar(30)'
    user_id_not_null='ALTER TABLE invoices ALTER COLUMN user_id SET NOT NULL'
    user_id_wrong_type='DO $$ BEGIN EXECUTE format(''DROP POLICY %I ON invoices'', (SELECT polname FROM pg_policy WHERE polrelid=''invoices''::regclass AND polpermissive)); END $$; ALTER TABLE invoices ALTER COLUMN user_id TYPE text USING user_id::text'
  }
  foreach ($case in $cases.Keys) {
    Sql 'template1' ('CREATE DATABASE '+$case+' TEMPLATE postgres')
    Sql $case $cases[$case]
    Invoke-LocalDocker -Arguments @('exec',$container,'timeout','25s','psql','-X','-U','postgres','-d',$case,'-v','ON_ERROR_STOP=1','-f','/tmp/migration.sql') -ExpectFailure | Out-Null
    Sql $case "SELECT assert_true((SELECT count(*)=2 FROM invoices), 'failed migration preserves rows'); SELECT assert_true((SELECT count(*) FROM pg_attribute WHERE attrelid='invoices'::regclass AND attname='paid_at' AND NOT attisdropped) = $(if($case -eq 'existing_paid_at'){1}else{0}), 'failed migration rolls back schema')"
    $records.cases += $case
  }
  Invoke-LocalDocker -Arguments @('exec',$container,'timeout','25s','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','/tmp/migration.sql') | Out-Null
  Invoke-LocalDocker -Arguments @('exec',$container,'timeout','25s','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','/tmp/verify.sql') | Out-Null
  $records.cases += 'valid_application_and_owner_isolation'
  Invoke-LocalDocker -Arguments @('exec',$container,'timeout','25s','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-f','/tmp/migration.sql') -ExpectFailure | Out-Null
  $records.cases += 'reapplication_rejected'
  $records.success=$true
} finally {
  $existing = & docker ps -aq --filter ('name=^/'+$container+'$')
  if ($existing) {
    $label=((& docker inspect $container | Out-String | ConvertFrom-Json)[0]).Config.Labels.'microassist.validation'
    if ($label -ne 'paid-at') {throw 'Unexpected cleanup target'}
    Invoke-LocalDocker -Arguments @('rm','-f',$container) | Out-Null
  }
  $records.cleanupVerified = !(& docker ps -aq --filter ('name=^/'+$container+'$'))
  $records | ConvertTo-Json -Depth 8 | Set-Content (Join-Path $root 'results.json')
}
if (!$records.success -or !$records.cleanupVerified) {throw 'Validation incomplete'}
Write-Output 'POSTGRES_VALIDATION_PASSED; CLEANUP_VERIFIED'
