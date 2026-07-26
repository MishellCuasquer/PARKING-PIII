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

## Despliegue

```bash
# 1. Prerrequisitos en el clúster
#    - Ingress controller nginx
#    - metrics-server (para los HPA)
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml

# 2. Aplicar todo
kubectl apply -f k8s/

# 3. Esperar a que la infraestructura esté lista antes que los microservicios
kubectl -n parqueadero rollout status statefulset/postgres
kubectl -n parqueadero rollout status statefulset/rabbitmq

# 4. Estado general
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
