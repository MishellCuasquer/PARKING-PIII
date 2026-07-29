<#
.SYNOPSIS
    Despliega ParkingApp en Kubernetes por fases, esperando entre cada una.

.DESCRIPTION
    Aplicar todo de golpe con `kubectl apply -f k8s/` pide ~4.4 Gi solo en
    `requests` y deja los pods en Pending peleandose por la memoria: el cluster
    se arrastra y parece colgado. Este script los levanta por capas y espera a
    que cada una este lista antes de seguir.

    El perfil ligero (-Ligero) baja a 1 replica los componentes que la admiten
    y omite los HPA. Es el modo recomendado para demostrar en un portatil.

.PARAMETER Ligero
    1 replica por componente y sin HPA. Baja el consumo de ~4.4 Gi a ~2.8 Gi.

.PARAMETER SaltarIngress
    No aplica los Ingress (util si no hay ingress-controller instalado).

.EXAMPLE
    .\desplegar.ps1 -Ligero
#>
param(
    [switch]$Ligero,
    [switch]$SaltarIngress
)

$ErrorActionPreference = 'Stop'
$K  = $PSScriptRoot
$NS = 'parqueadero'

function Paso($texto) { Write-Host "`n=== $texto ===" -ForegroundColor Cyan }

function Esperar($tipo, $nombre, $segundos = 300) {
    Write-Host "  esperando $tipo/$nombre ..." -ForegroundColor DarkGray
    kubectl -n $NS rollout status "$tipo/$nombre" --timeout="${segundos}s"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  $tipo/$nombre no quedo listo. Diagnostico:" -ForegroundColor Yellow
        kubectl -n $NS get pods -l "app=$nombre"
        kubectl -n $NS describe pod -l "app=$nombre" | Select-String -Pattern "Events:" -Context 0,15
        throw "$tipo/$nombre no alcanzo el estado Ready"
    }
}

# --- Comprobacion previa: memoria del nodo -----------------------------------
Paso "Comprobando el cluster"
kubectl cluster-info | Select-Object -First 1
if ($LASTEXITCODE -ne 0) { throw "No hay conexion con el cluster. Arranca minikube primero: minikube start --memory=6144 --cpus=4" }

$alocable = kubectl get nodes -o jsonpath='{.items[0].status.allocatable.memory}'
Write-Host "  memoria asignable del nodo: $alocable"
Write-Host "  requests del despliegue: ~4.4Gi (completo) / ~2.8Gi (-Ligero)" -ForegroundColor DarkGray

# --- Fase 0: namespace y configuracion ---------------------------------------
Paso "Fase 0 - namespace, ConfigMap y Secrets"
kubectl apply -f "$K\00-namespace.yaml"
kubectl apply -f "$K\01-configmap.yaml"
kubectl apply -f "$K\02-secrets.yaml"

# --- Fase 1: bases de datos (las mas pesadas, de una en una) -----------------
Paso "Fase 1 - bases de datos"
kubectl apply -f "$K\10-postgres.yaml"
Esperar statefulset postgres
kubectl apply -f "$K\11-mysql-zonas.yaml"
Esperar statefulset mysql-zonas

# --- Fase 2: infraestructura de apoyo ----------------------------------------
Paso "Fase 2 - Redis y RabbitMQ"
kubectl apply -f "$K\12-redis.yaml"
kubectl apply -f "$K\13-rabbitmq.yaml"
Esperar statefulset rabbitmq

# --- Fase 3: microservicios, de uno en uno -----------------------------------
Paso "Fase 3 - microservicios"
$servicios = @(
    @{ archivo = '30-ms-usuarios';       deploy = 'ms-usuarios' },
    @{ archivo = '31-ms-zonas-espacios'; deploy = 'ms-zonas-espacios' },
    @{ archivo = '32-ms-vehiculos';      deploy = 'ms-vehiculos' },
    @{ archivo = '33-ms-tickets';        deploy = 'ms-tickets' },
    @{ archivo = '34-ms-audit';          deploy = 'ms-audit' }
)
foreach ($s in $servicios) {
    kubectl apply -f "$K\$($s.archivo).yaml"
    # ms-zonas-espacios ya viene con 1 replica: los emisores SSE viven en memoria
    # del pod y con dos replicas un cliente no veria los cambios del otro.
    if ($Ligero -and $s.deploy -ne 'ms-zonas-espacios') {
        kubectl -n $NS scale "deployment/$($s.deploy)" --replicas=1 | Out-Null
    }
    Esperar deployment $s.deploy
}

# --- Fase 4: gateway y capa web ----------------------------------------------
Paso "Fase 4 - Kong, frontend y monitoreo"
kubectl apply -f "$K\20-kong.yaml"
if ($Ligero) { kubectl -n $NS scale deployment/kong --replicas=1 | Out-Null }
Esperar deployment kong
kubectl apply -f "$K\40-frontend.yaml"
kubectl apply -f "$K\41-monitoreo.yaml"
if ($Ligero) { kubectl -n $NS scale deployment/frontend --replicas=1 | Out-Null }

# --- Fase 5: ingress ----------------------------------------------------------
if (-not $SaltarIngress) {
    Paso "Fase 5 - Ingress"
    kubectl apply -f "$K\50-ingress.yaml"
    kubectl apply -f "$K\51-ingress-api.yaml"
}

# --- Fase 6: HPA (solo con metrics-server y sin perfil ligero) ---------------
if (-not $Ligero) {
    Paso "Fase 6 - HPA"
    kubectl top nodes 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) {
        kubectl apply -f "$K\60-hpa.yaml"
    } else {
        Write-Host "  metrics-server no disponible: se omiten los HPA" -ForegroundColor Yellow
        Write-Host "  (minikube addons enable metrics-server)" -ForegroundColor DarkGray
    }
}

# --- Resumen -----------------------------------------------------------------
Paso "Estado final"
kubectl -n $NS get pods -o wide
kubectl -n $NS get svc,ingress

Write-Host "`nListo. Anade a hosts (como administrador):" -ForegroundColor Green
Write-Host "  127.0.0.1  parqueadero.espe.edu.ec"
Write-Host "  127.0.0.1  api.parqueadero.espe.edu.ec"
Write-Host "`nY reejecuta los escenarios apuntando al gateway del cluster." -ForegroundColor Green
