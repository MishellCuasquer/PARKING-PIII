# Despliegue en Kubernetes — ParkingApp SaaS Multitenant

Manifiestos de la plataforma completa: 5 microservicios, frontend, dashboard de
monitoreo, API Gateway (Kong), broker (RabbitMQ), caché (Redis) y las dos bases
de datos (PostgreSQL y MySQL).

## Orden de aplicación

Los archivos están numerados para que `kubectl apply -f k8s/` los aplique en el
orden correcto (kubectl los procesa alfabéticamente):

| Archivo | Contenido |
|---|---|
| `00-namespace.yaml` | Namespace `parqueadero` |
| `01-configmap.yaml` | Variables no sensibles compartidas |
| `02-secrets.yaml` | Credenciales (**sustituir en producción**) |
| `10-postgres.yaml` | PostgreSQL + PVC 5Gi + init de las 4 BD |
| `11-mysql-zonas.yaml` | MySQL de zonas/espacios + PVC 5Gi |
| `12-redis.yaml` | Redis (caché de vehículos y tickets) + PVC 1Gi |
| `13-rabbitmq.yaml` | RabbitMQ + PVC 2Gi |
| `20-kong.yaml` | API Gateway (2 réplicas) |
| `30`–`34` | ms-usuarios, ms-zonas-espacios, ms-vehiculos, ms-tickets, ms-audit |
| `40-frontend.yaml` | SPA React + nginx |
| `41-monitoreo.yaml` | Dashboard estático de ocupación |
| `50-ingress.yaml` | `parqueadero.espe.edu.ec` → frontend (TLS) |
| `51-ingress-api.yaml` | `api.parqueadero.espe.edu.ec` → Kong (TLS) |
| `60-hpa.yaml` | Escalado horizontal por microservicio |

## Cuánta memoria pide todo esto

Antes de desplegar conviene mirar la suma, porque es la causa habitual de que
el clúster se quede "colgado": los pods no fallan, se quedan en `Pending`
peleándose por memoria y el nodo se arrastra.

| Componente | Réplicas | Request | Total |
|---|---:|---:|---:|
| postgres | 1 | 256Mi | 256Mi |
| mysql-zonas | 1 | 512Mi | 512Mi |
| redis | 1 | 64Mi | 64Mi |
| rabbitmq | 1 | 256Mi | 256Mi |
| kong | 2 | 256Mi | 512Mi |
| ms-usuarios | 2 | 512Mi | 1024Mi |
| ms-zonas-espacios | 1 | 512Mi | 512Mi |
| ms-vehiculos | 2 | 192Mi | 384Mi |
| ms-tickets | 2 | 192Mi | 384Mi |
| ms-audit | 2 | 192Mi | 384Mi |
| frontend | 2 | 64Mi | 128Mi |
| monitoreo | 1 | 32Mi | 32Mi |
| **Total** | | | **≈ 4.4 Gi** |

Y eso es solo `requests`: hay que sumarle `kube-system`. **Un nodo de 4 GB no
llega.** Para un portátil, arranca minikube con margen y usa el perfil ligero:

```powershell
minikube start --memory=6144 --cpus=4
```

## Despliegue

Usa el script, que aplica los manifiestos **por fases** y espera a que cada
capa esté lista antes de seguir. Aplicar todo de golpe es lo que satura el
nodo.

```powershell
# Perfil ligero: 1 réplica por componente y sin HPA (≈2.8 Gi). Recomendado en local.
.\k8s\desplegar.ps1 -Ligero

# Despliegue completo (réplicas y HPA como en los manifiestos)
.\k8s\desplegar.ps1
```

> **Apaga antes Docker Compose.** Los dos entornos compiten por la misma
> memoria de la VM de Docker/WSL: `docker compose -f ParkingApp/docker-compose.yml down`.

Si prefieres hacerlo a mano, el orden es el mismo que sigue el script:

```bash
# 1. Prerrequisitos en el clúster
#    - Ingress controller nginx
#    - metrics-server (para los HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 2. Namespace y configuración
kubectl apply -f k8s/00-namespace.yaml -f k8s/01-configmap.yaml -f k8s/02-secrets.yaml

# 3. Bases de datos, esperando a cada una
kubectl apply -f k8s/10-postgres.yaml
kubectl -n parqueadero rollout status statefulset/postgres
kubectl apply -f k8s/11-mysql-zonas.yaml
kubectl -n parqueadero rollout status statefulset/mysql-zonas

# 4. Redis y RabbitMQ
kubectl apply -f k8s/12-redis.yaml -f k8s/13-rabbitmq.yaml
kubectl -n parqueadero rollout status statefulset/rabbitmq

# 5. Microservicios, gateway y web (ver el script para el detalle)
# 6. Estado general
kubectl -n parqueadero get pods,svc,ingress,hpa
```

El pipeline `.github/workflows/deploy-k8s.yml` hace exactamente esto de forma
semiautomatizada (se dispara a mano con *Run workflow*, o solo, tras un push a
`main` que toque `k8s/`).

## Secrets en producción

`02-secrets.yaml` trae las credenciales de desarrollo (las mismas del
`docker-compose.yml`) para que un clúster local funcione sin pasos extra.
**En un clúster real no se aplica ese archivo**: se crea el Secret fuera de git.

```bash
kubectl -n parqueadero create secret generic parqueadero-secrets \
  --from-literal=DB_USER=postgres \
  --from-literal=DB_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=POSTGRES_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=MYSQL_USER=root \
  --from-literal=MYSQL_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=MYSQL_ROOT_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=RABBITMQ_USER=admin \
  --from-literal=RABBITMQ_PASSWORD="$(openssl rand -base64 24)" \
  --from-literal=JWT_SECRET="$(openssl rand -base64 48)" \
  --from-literal=SERVICE_USERNAME=service \
  --from-literal=SERVICE_PASSWORD="$(openssl rand -base64 24)" \
  --dry-run=client -o yaml | kubectl apply -f -
```

> `DB_PASSWORD` y `POSTGRES_PASSWORD` deben coincidir (una es la que usa el
> servidor al inicializarse y la otra la que usan los clientes), igual que
> `MYSQL_PASSWORD` y `MYSQL_ROOT_PASSWORD`.

> Si cambias `JWT_SECRET` hay que regenerar la imagen de Kong: el secreto de
> validación está en `ParkingApp/App/kong.yml`, dentro de la credencial del
> consumidor `parqueadero-usuarios`.

## Decisiones de diseño que conviene conocer

**Un namespace, no uno por tenant.** El aislamiento entre empresas es lógico
(columna `tenant_id` + claim del JWT). Un namespace por tenant obligaría a
redesplegar la aplicación cada vez que entra una empresa nueva, justo lo
contrario del requisito de escalabilidad SaaS.

**`zonas-espacios` corre con 1 sola réplica y no tiene HPA.** Los emisores SSE
viven en memoria del pod (`sse/EspacioEventos.java`); con dos réplicas, un
cliente conectado al pod A no vería los cambios que procesa el pod B. Para
escalarlo hay que mover antes el fan-out a Redis pub/sub o dar a cada instancia
su propia cola de RabbitMQ.

**Las bases de datos son StatefulSet con 1 réplica.** Escalarlas replicando
pods no funciona: todas montarían el mismo PVC `ReadWriteOnce`. El escalado
horizontal del enunciado aplica a los microservicios (`60-hpa.yaml`).

**Sondas TCP, no HTTP.** Los microservicios no exponen `/actuator/health` ni un
`/health` propio, y cualquier ruta real devolvería 401 detrás del filtro JWT,
dejando los pods eternamente *not ready*.

**Kong en modo DB-less.** Rutas, plugins y credenciales JWT vienen horneados en
la imagen desde `ParkingApp/App/kong.yml`. Cambiar una ruta = reconstruir la
imagen y `kubectl rollout restart deployment/kong`.

**La outbox de auditoría es segura con varias réplicas.** Cada productor
(usuarios, vehículos, tickets, zonas) guarda el evento en su tabla
`outbox_event` y un barrido periódico publica lo pendiente. Ese barrido toma
las filas con `SELECT ... FOR UPDATE SKIP LOCKED` dentro de una transacción:
sin ese bloqueo, los dos pods de `ms-tickets` leerían el mismo lote y
publicarían cada evento por duplicado. Con SKIP LOCKED cada pod se lleva un
lote distinto en lugar de esperarse.

**`ms-audit` sí escala a 2 réplicas.** Son consumidores en competencia sobre la
misma cola: RabbitMQ reparte los mensajes y cada uno se procesa una sola vez.

## Verificación tras el despliegue

```bash
# Todos los pods en Running
kubectl -n parqueadero get pods

# Kong ve sus rutas y plugins
kubectl -n parqueadero exec deploy/kong -- curl -s localhost:8001/routes | head

# El rate limiting responde (cabeceras X-RateLimit-*)
curl -sI https://api.parqueadero.espe.edu.ec/api/zonas | grep -i ratelimit

# El gateway rechaza tráfico sin token en las rutas protegidas
curl -s -o /dev/null -w '%{http_code}\n' https://api.parqueadero.espe.edu.ec/tickets   # 401

# La cola de auditoría se está drenando
kubectl -n parqueadero exec rabbitmq-0 -- rabbitmqctl list_queues name messages
```

## Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| Pods `ImagePullBackOff` | Las imágenes de GHCR son privadas | `kubectl -n parqueadero create secret docker-registry ghcr --docker-server=ghcr.io --docker-username=<user> --docker-password=<PAT>` y añadir `imagePullSecrets` |
| El SSE se corta cada 60s | Falta la anotación `proxy-read-timeout` | Está en `50-ingress.yaml`; comprobar que el Ingress controller es nginx |
| `usuarios` en `CrashLoopBackOff` | Postgres aún inicializando | Es transitorio: Spring reintenta. Si persiste, revisar `DB_PASSWORD` vs `POSTGRES_PASSWORD` |
| HPA en `<unknown>/70%` | Falta metrics-server | Aplicar el manifiesto de metrics-server |
| 401 en todo tras cambiar el JWT | Kong sigue con el secreto viejo | Reconstruir la imagen de Kong y `rollout restart` |
