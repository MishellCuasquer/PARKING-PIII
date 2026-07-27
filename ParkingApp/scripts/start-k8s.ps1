# Levanta el entorno de Kubernetes (minikube) de ParkingApp desde cero:
# Docker Desktop -> minikube -> pods listos -> tunel hacia el Ingress.
#
# Uso: clic derecho sobre este archivo -> "Ejecutar con PowerShell"
#      (o abrir PowerShell aqui y correr: .\scripts\start-k8s.ps1)
#
# La ultima ventana (el port-forward) se queda corriendo a proposito:
# ciérrala solo cuando termines de usar https://parqueadero.espe.edu.ec:8443

Write-Host "1. Verificando Docker Desktop..." -ForegroundColor Cyan
$dockerReady = $false
$attempts = 0
while (-not $dockerReady -and $attempts -lt 30) {
    try {
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { $dockerReady = $true }
    } catch {}
    if (-not $dockerReady) {
        if ($attempts -eq 0) {
            $dockerDesktop = "C:\Program Files\Docker\Docker\Docker Desktop.exe"
            if (Test-Path $dockerDesktop) {
                Write-Host "   Abriendo Docker Desktop..."
                Start-Process $dockerDesktop
            }
        }
        Write-Host "   Esperando a Docker Desktop... ($attempts/30)"
        Start-Sleep -Seconds 5
        $attempts++
    }
}
if (-not $dockerReady) {
    Write-Host "Docker Desktop no respondio a tiempo. Abrelo manualmente y vuelve a correr este script." -ForegroundColor Red
    exit 1
}
Write-Host "   Docker Desktop listo" -ForegroundColor Green

Write-Host "`n2. Iniciando minikube..." -ForegroundColor Cyan
minikube start
if ($LASTEXITCODE -ne 0) {
    Write-Host "minikube no pudo iniciar. Revisa el error de arriba." -ForegroundColor Red
    exit 1
}

Write-Host "`n3. Esperando a que los pods de 'parqueadero' esten listos (puede tardar 1-2 min)..." -ForegroundColor Cyan
kubectl -n parqueadero wait --for=condition=Ready pods --all --timeout=300s

Write-Host "`n4. Estado final de los pods:" -ForegroundColor Cyan
kubectl -n parqueadero get pods

Write-Host "`n5. Abriendo el tunel hacia el Ingress..." -ForegroundColor Cyan
Write-Host "   NO cierres esta ventana mientras uses la app." -ForegroundColor Yellow
Write-Host "   Cuando veas 'Forwarding from 127.0.0.1:8443', entra a:" -ForegroundColor Yellow
Write-Host "   https://parqueadero.espe.edu.ec:8443`n" -ForegroundColor Green
kubectl port-forward -n ingress-nginx svc/ingress-nginx-controller 8443:443 8080:80
