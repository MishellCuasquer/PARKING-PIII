# Verificación E2E de aislamiento multitenant — ParkingApp
# Re-ejecutable: usa un sufijo por corrida para códigos/dni/emails/placa.
$ErrorActionPreference = 'Stop'
$BaseUrl = 'http://localhost:8000'
$S = (Get-Date).ToString('mmss')  # sufijo corto por corrida
$pass = 0; $fail = 0

function Check($nombre, $cond) {
    if ($cond) { $script:pass++; Write-Host "[OK]   $nombre" -ForegroundColor Green }
    else { $script:fail++; Write-Host "[FAIL] $nombre" -ForegroundColor Red }
}

function Login($u, $p) {
    Invoke-RestMethod "$BaseUrl/api/auth/login" -Method Post -ContentType 'application/json' `
        -Body (@{username = $u; password = $p } | ConvertTo-Json)
}

# PS 5.1 devuelve $null para un JSON [] — @($null).Count sería 1, este helper cuenta bien
function CountOf($x) {
    if ($null -eq $x) { return 0 }
    return @($x).Count
}

Write-Host "== 1. Login superadmin y creación de tenants (sufijo $S) =="
$sa = Login 'superadmin' 'superadmin123'
Check "superadmin sin tenant en login" ($null -eq $sa.tenantId)
$HSA = @{ Authorization = "Bearer $($sa.token)" }

$tA = Invoke-RestMethod "$BaseUrl/api/tenants" -Method Post -Headers $HSA -ContentType 'application/json' `
    -Body (@{nombre = "Parqueadero Norte $S"; codigo = "NORTE$S" } | ConvertTo-Json)
$tB = Invoke-RestMethod "$BaseUrl/api/tenants" -Method Post -Headers $HSA -ContentType 'application/json' `
    -Body (@{nombre = "Parqueadero Sur $S"; codigo = "SUR$S" } | ConvertTo-Json)
Check "tenants NORTE y SUR creados" ($tA.id -and $tB.id)

$pub = Invoke-RestMethod "$BaseUrl/api/tenants/publicos"
Check "lista pública de tenants disponible" ($pub.Count -ge 3)

Write-Host "`n== 2. Registro público con tenant y promoción a ADMIN =="
$dniA = "17$S" + '0001'; $dniB = "17$S" + '0002'
$uA = Invoke-RestMethod "$BaseUrl/api/users" -Method Post -ContentType 'application/json' `
    -Body (@{dni = $dniA; firstName = 'Nora'; lastName = 'Norte'; email = "nora$S@norte.ec"; phone = "099$S" + '001'; tenantId = $tA.id } | ConvertTo-Json)
$uB = Invoke-RestMethod "$BaseUrl/api/users" -Method Post -ContentType 'application/json' `
    -Body (@{dni = $dniB; firstName = 'Saul'; lastName = 'Sur'; email = "saul$S@sur.ec"; phone = "099$S" + '002'; tenantId = $tB.id } | ConvertTo-Json)
Check "registro con tenant OK" ($uA.username -and $uB.username)

# misma persona (mismo dni/email/phone) en otro tenant debe permitirse
$dup = Invoke-RestMethod "$BaseUrl/api/users" -Method Post -ContentType 'application/json' `
    -Body (@{dni = $dniA; firstName = 'Nora'; lastName = 'Norte'; email = "nora$S@norte.ec"; phone = "099$S" + '001'; tenantId = $tB.id } | ConvertTo-Json)
Check "misma persona registrable en otro tenant" ($null -ne $dup.username)

# registro anónimo sin tenant → 400
try {
    Invoke-RestMethod "$BaseUrl/api/users" -Method Post -ContentType 'application/json' `
        -Body (@{dni = "17$S" + '0009'; firstName = 'Sin'; lastName = 'Tenant'; email = "sin$S@t.ec"; phone = "099$S" + '009' } | ConvertTo-Json) | Out-Null
    Check "registro sin tenant rechazado (400)" $false
} catch { Check "registro sin tenant rechazado (400)" ($_.Exception.Response.StatusCode.value__ -eq 400) }

$roles = Invoke-RestMethod "$BaseUrl/api/roles" -Headers $HSA
$adminRoleId = ($roles | Where-Object { $_.name -eq 'ADMIN' }).id
Invoke-RestMethod "$BaseUrl/api/users/$($uA.id)/roles/$adminRoleId" -Method Post -Headers $HSA | Out-Null
Invoke-RestMethod "$BaseUrl/api/users/$($uB.id)/roles/$adminRoleId" -Method Post -Headers $HSA | Out-Null
Check "usuarios promovidos a ADMIN por superadmin" $true

Write-Host "`n== 3. Login por tenant =="
$loginA = Login $uA.username $dniA
$loginB = Login $uB.username $dniB
Check "token NORTE trae su tenantId" ($loginA.tenantId -eq $tA.id)
Check "token SUR trae su tenantId" ($loginB.tenantId -eq $tB.id)
Check "tenantNombre en login" ($loginA.tenantNombre -eq "Parqueadero Norte $S")
$HA = @{ Authorization = "Bearer $($loginA.token)" }
$HB = @{ Authorization = "Bearer $($loginB.token)" }

Write-Host "`n== 4. Aislamiento de zonas =="
$zonaA = Invoke-RestMethod "$BaseUrl/api/zonas" -Method Post -Headers $HA -ContentType 'application/json' `
    -Body (@{nombre = "Zona Norte VIP $S"; capacidad = 3; tipo = 'VIP'; crearEspaciosAutomaticamente = $true } | ConvertTo-Json)
Check "zona creada en NORTE" ($null -ne $zonaA.id)
$zonasB = Invoke-RestMethod "$BaseUrl/api/zonas" -Headers $HB
Check "SUR no ve zonas de NORTE" ((CountOf $zonasB) -eq 0)
$zonasAnon = Invoke-RestMethod "$BaseUrl/api/zonas"
Check "anónimo (monitoreo) ve todas las zonas" ((CountOf $zonasAnon) -ge 1)

Write-Host "`n== 5. Aislamiento de vehículos + placa repetida entre tenants =="
$placa = "NVA-$S"  # formato requerido ABC-1234
$vehBody = @{tipo = 'auto'; datos = @{placa = $placa; marca = 'Kia'; modelo = 'Rio'; color = 'Rojo'; anio = 2022; clasificacion = 'Gasolina'; numeroPuertas = 4; CapacidadMaletero = 300 } } | ConvertTo-Json -Depth 4
Invoke-RestMethod "$BaseUrl/vehiculos" -Method Post -Headers $HA -ContentType 'application/json' -Body $vehBody | Out-Null
$vehsB = Invoke-RestMethod "$BaseUrl/vehiculos" -Headers $HB
Check "SUR no ve vehículos de NORTE" ((CountOf $vehsB) -eq 0)
try {
    Invoke-RestMethod "$BaseUrl/vehiculos/placa/$placa" -Headers $HB | Out-Null
    Check "placa de NORTE invisible para SUR (404)" $false
} catch { Check "placa de NORTE invisible para SUR (404)" ($_.Exception.Response.StatusCode.value__ -eq 404) }
$vehA = Invoke-RestMethod "$BaseUrl/vehiculos/placa/$placa" -Headers $HA
Check "NORTE sí ve su placa" ($vehA.placa -eq $placa)
$dup2 = Invoke-RestMethod "$BaseUrl/vehiculos" -Method Post -Headers $HB -ContentType 'application/json' -Body $vehBody
Check "misma placa registrable en SUR (unique por tenant)" ($dup2.placa -eq $placa)

Write-Host "`n== 6. Aislamiento de tickets =="
$dniCli = "17$S" + '0055'
Invoke-RestMethod "$BaseUrl/api/personas" -Method Post -Headers $HA -ContentType 'application/json' `
    -Body (@{dni = $dniCli; firstName = 'Cliente'; middleName = ''; lastName = 'Norte'; email = "c$S@norte.ec"; phone = "099$S" + '055'; nationality = 'EC' } | ConvertTo-Json) | Out-Null
# Asignar sin @(): IRM ya devuelve Object[]; envolverlo lo anidaría en un array de 1
$espaciosA = Invoke-RestMethod "$BaseUrl/api/espacios" -Headers $HA
$espA = $espaciosA | Where-Object { $_.estado -eq 'DISPONIBLE' } | Select-Object -First 1
$tk = Invoke-RestMethod "$BaseUrl/tickets" -Method Post -Headers $HA -ContentType 'application/json' `
    -Body (@{placa = $placa; dni = $dniCli; idEspacio = $espA.id } | ConvertTo-Json)
Check "ticket emitido en NORTE" ($null -ne $tk.id)
Check "ticket lleva tenantId de NORTE" ($tk.tenantId -eq $tA.id)
$tksB = Invoke-RestMethod "$BaseUrl/tickets" -Headers $HB
Check "SUR no ve tickets de NORTE" ((CountOf $tksB) -eq 0)
$espaciosA2 = Invoke-RestMethod "$BaseUrl/api/espacios" -Headers $HA
$espA2 = $espaciosA2 | Where-Object { $_.estado -eq 'DISPONIBLE' } | Select-Object -First 1
try {
    Invoke-RestMethod "$BaseUrl/tickets" -Method Post -Headers $HB -ContentType 'application/json' `
        -Body (@{placa = $placa; dni = $dniCli; idEspacio = $espA2.id } | ConvertTo-Json) | Out-Null
    Check "SUR no puede usar espacio de NORTE (400)" $false
} catch { Check "SUR no puede usar espacio de NORTE (400)" ($_.Exception.Response.StatusCode.value__ -eq 400) }

Write-Host "`n== 6b. Mis empresas y cambio de contexto (mismo dueño) =="
# Nora tiene cuenta en NORTE y (por el registro duplicado) también en SUR
$empresasA = Invoke-RestMethod "$BaseUrl/api/auth/empresas" -Headers $HA
Check "la persona ve sus 2 empresas (mismo email+dni)" ((CountOf $empresasA) -eq 2)

# Login con correo: el mismo correo tiene una cuenta por empresa (usernames distintos)
$loginMail = Login "nora$S@norte.ec" $dniA
Check "login con correo (dueño multi-empresa) emite token" ($null -ne $loginMail.token)
$HMail = @{ Authorization = "Bearer $($loginMail.token)" }
$empresasMail = Invoke-RestMethod "$BaseUrl/api/auth/empresas" -Headers $HMail
Check "tras login con correo se listan sus 2 empresas" ((CountOf $empresasMail) -eq 2)
$switch = Invoke-RestMethod "$BaseUrl/api/auth/cambiar-empresa" -Method Post -Headers $HA -ContentType 'application/json' `
    -Body (@{tenantId = $tB.id } | ConvertTo-Json)
Check "cambiar-empresa emite token del otro tenant" ($switch.tenantId -eq $tB.id)
$HSw = @{ Authorization = "Bearer $($switch.token)" }
$vehSw = Invoke-RestMethod "$BaseUrl/vehiculos/placa/$placa" -Headers $HSw
Check "con el nuevo token ve los datos de la otra empresa" ($vehSw.placa -eq $placa)
try {
    Invoke-RestMethod "$BaseUrl/api/auth/cambiar-empresa" -Method Post -Headers $HA -ContentType 'application/json' `
        -Body (@{tenantId = '00000000-0000-0000-0000-000000000001' } | ConvertTo-Json) | Out-Null
    Check "cambiar a empresa ajena rechazado (404)" $false
} catch { Check "cambiar a empresa ajena rechazado (404)" ($_.Exception.Response.StatusCode.value__ -eq 404) }

Write-Host "`n== 6c. Duplicado sin exposición de información =="
# Registrar la MISMA persona otra vez en la MISMA empresa: debe fallar con mensaje
# genérico, sin revelar que existe en otras empresas
try {
    Invoke-RestMethod "$BaseUrl/api/users" -Method Post -ContentType 'application/json' `
        -Body (@{dni = $dniA; firstName = 'Nora'; lastName = 'Norte'; email = "nora$S@norte.ec"; phone = "099$S" + '001'; tenantId = $tA.id } | ConvertTo-Json) | Out-Null
    Check "duplicado en la misma empresa rechazado" $false
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    $stream = $_.Exception.Response.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $body = $reader.ReadToEnd()
    Check "duplicado en la misma empresa rechazado" ($sc -ge 400 -and $sc -lt 500)
    Check "el error no menciona otras empresas" (($body -notmatch 'Sur') -and ($body -notmatch $tB.id))
}

Write-Host "`n== 6d. SSE del panel de espacios =="
$sseFile = Join-Path $env:TEMP "sse-espacios-$S.txt"
$curlProc = Start-Process curl.exe -ArgumentList '-N', '-s', '-m', '10', "$BaseUrl/api/espacios/stream" `
    -RedirectStandardOutput $sseFile -PassThru -WindowStyle Hidden
Start-Sleep -Seconds 2
Invoke-RestMethod "$BaseUrl/api/espacios/$($espA2.id)/reservar" -Method Put -Headers $HA | Out-Null
Wait-Process -Id $curlProc.Id -ErrorAction SilentlyContinue
$sseContent = if (Test-Path $sseFile) { Get-Content $sseFile -Raw } else { '' }
Check "evento SSE recibido al cambiar un espacio" ($sseContent -match 'event:\s*espacio')
Check "el evento SSE trae el idTenant para filtrar" ($sseContent -match $tA.id)

Write-Host "`n== 7. Aislamiento de usuarios =="
$usersA = Invoke-RestMethod "$BaseUrl/api/users" -Headers $HA
$usersSA = Invoke-RestMethod "$BaseUrl/api/users" -Headers $HSA
Check "admin NORTE solo ve usuarios de su tenant" ((CountOf ($usersA | Where-Object { $_.tenantId -ne $tA.id })) -eq 0)
Check "superadmin ve todos los usuarios" ((CountOf $usersSA) -gt (CountOf $usersA))

Write-Host "`n== 8. Redis con namespace de tenant =="
$keys = @(docker exec parking-redis redis-cli KEYS "t:*")
Check "claves Redis con prefijo t:{tenantId}" ($keys.Count -ge 1)

Write-Host "`n== 9. Auditoría por empresa (RabbitMQ -> ms-audit) =="
# Los eventos viajan por RabbitMQ de forma asíncrona: se les da unos segundos
$eventosNorte = $null
for ($i = 0; $i -lt 6; $i++) {
    Start-Sleep -Seconds 3
    $audit = Invoke-RestMethod "$BaseUrl/api/audit"
    $eventosNorte = @($audit | Where-Object { $_.tenantId -eq $tA.id })
    if ((CountOf $eventosNorte) -ge 1) { break }
}
Check "los eventos de auditoria llegan a ms-audit" ((CountOf $audit) -ge 1)
Check "hay eventos con el tenantId de NORTE" ((CountOf $eventosNorte) -ge 1)

Write-Host "`n===================="
Write-Host "PASS: $pass  FAIL: $fail"
if ($fail -gt 0) { exit 1 }
