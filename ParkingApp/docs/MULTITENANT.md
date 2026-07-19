# Multitenancy (SaaS) en ParkingApp

Cada **tenant** es una empresa/parqueadero. Los datos de negocio (usuarios, personas,
zonas, espacios, vehículos, tickets, auditoría) están aislados por la columna
`tenant_id` / `tenantId` y el claim `tenantId` del JWT.

## Modelo

- **Tenant** vive en `ms-usuarios-roles-auth` (tabla `tenants`). CRUD en `/api/tenants`
  (solo `SUPER_ADMIN`); `GET /api/tenants/publicos` es público y alimenta el selector
  del registro.
- El tenant de un usuario se guarda en `person.id_tenant`. El login lo incluye como
  claim `tenantId` en el JWT y lo devuelve en la respuesta (`tenantId`, `tenantNombre`).
- Cuentas **globales** (sin tenant): `superadmin/superadmin123` (rol `SUPER_ADMIN`,
  gestiona empresas y puede promover al primer ADMIN de cada una) y `service`
  (rol `SERVICE`, llamadas entre microservicios).
- Tenant semilla: **Parqueadero Default** con UUID fijo
  `00000000-0000-0000-0000-000000000001` (código `DEFAULT`); `admin`, `operador` y
  `cliente` pertenecen a él.

## Unicidad por tenant (no global)

| Tabla | Antes | Ahora |
|---|---|---|
| `person` | dni, email, phone únicos globales | únicos **por tenant** — la misma persona puede registrarse en dos parqueaderos |
| `zona` | nombre, codigo únicos globales | únicos **por tenant** |
| `vehiculo` | placa única global | única **por tenant** — el mismo carro puede estar en varios parqueaderos |

`username` sigue siendo único global (el login no necesita selector de empresa).

## Llamadas entre servicios

La cuenta `service` no tiene tenant. `ms-tickets` propaga el header `X-Tenant-Id`
con el tenant del usuario original; `ms-vehiculos` y `ms-zonas-espacios` solo
aceptan ese header cuando el token tiene rol `SERVICE` (para usuarios normales
manda siempre el claim del JWT, que no es falsificable).

## Caché Redis

Las claves llevan namespace de tenant para que dos empresas no colisionen:
`t:{tenantId}:vehiculo:{placa}`, `t:{tenantId}:espacio:{id}`, `t:{tenantId}:persona:{dni}`.

## Endpoints públicos (dashboard de monitoreo)

`GET /api/zonas` y `GET /api/espacios` **sin token** devuelven todo (vista global
del monitoreo en `localhost:8090`). Con token devuelven solo el tenant del caller.

## Migración de datos

La estrategia oficial es empezar con volúmenes frescos:

```powershell
docker compose down -v
docker compose up -d --build
```

Motivo: `ddl-auto=update` (Hibernate) crea las columnas nuevas pero **no elimina**
los índices únicos viejos (`person.dni`, `zona.nombre`, etc.). Si necesitas conservar
datos, aplica este SQL manual antes de levantar:

```sql
-- Postgres usuarios_db (nombres reales: consultarlos con \d person)
ALTER TABLE person DROP CONSTRAINT IF EXISTS <uk_dni>;
ALTER TABLE person DROP CONSTRAINT IF EXISTS <uk_email>;
ALTER TABLE person DROP CONSTRAINT IF EXISTS <uk_phone>;
UPDATE person SET id_tenant = '00000000-0000-0000-0000-000000000001' WHERE id_tenant IS NULL;

-- MySQL zonas_espacios (nombres reales: SHOW INDEX FROM Zona)
ALTER TABLE Zona DROP INDEX <idx_nombre>, DROP INDEX <idx_codigo>;
UPDATE Zona SET id_tenant = '00000000-0000-0000-0000-000000000001' WHERE id_tenant IS NULL;
UPDATE Espacio SET id_tenant = '00000000-0000-0000-0000-000000000001' WHERE id_tenant IS NULL;

-- Postgres vehiculos_db / tickets_db (TypeORM synchronize sí ajusta constraints)
UPDATE vehiculo SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
UPDATE "Tickets" SET "tenantId" = '00000000-0000-0000-0000-000000000001' WHERE "tenantId" IS NULL;
```

(El `DataInitializer` de usuarios también hace backfill automático de las persons
sin tenant hacia el tenant default al arrancar.)

## Mismo dueño con varias empresas (pantalla "Mis empresas")

Una misma persona (identificada por **email + cédula**) puede registrarse en varias
empresas. La pantalla **Mis empresas** (`/mis-empresas`) lista sus empresas y al
seleccionar una, la sesión cambia a esa empresa sin re-login:

- `GET /api/auth/empresas` — empresas donde la persona autenticada tiene cuenta.
- `POST /api/auth/cambiar-empresa {tenantId}` — emite un token para la cuenta en
  esa empresa; si no tiene cuenta ahí devuelve 404 sin revelar información.

**Login con correo**: `POST /api/auth/login` acepta username **o email**. Como el
mismo correo puede tener una cuenta por empresa (usernames distintos), el backend
prueba la contraseña contra cada cuenta de ese correo y entra con la que coincida
(`findAllByPersonEmailWithRole`, orden estable por username). Tras el login, si la
persona tiene cuenta en **más de una empresa**, el frontend la lleva primero a
**Mis empresas** para elegir a cuál entrar; con una sola empresa va directo al
dashboard. La empresa actual tiene botón "Continuar".

Los duplicados dentro de la misma empresa devuelven **409 con mensaje genérico**
("El email ya existe") sin mencionar en qué otras empresas está registrada la
persona — no hay exposición de información entre tenants.

## Panel de espacios en tiempo real (SSE)

`GET /api/espacios/stream` es un stream **Server-Sent Events**: cada cambio de
estado de un espacio (crear, ocupar, reservar, liberar, eliminar) se empuja a los
clientes conectados. Cada evento incluye `idTenant` y la página de Espacios solo
atiende los de la empresa del usuario. Piezas involucradas:

- `ms-zonas-espacios`: `sse/EspacioEventos.java` (emisores) + endpoint en
  `EspacioControlador` con `X-Accel-Buffering: no`.
- Kong: ruta dedicada `espacios-stream-route` con `response_buffering: false`
  (sin esto Kong bufferiza la respuesta y los eventos no llegan).
- Frontend: `EspaciosPage` abre un `EventSource` y muestra el indicador
  🟢 conectado (SSE); `nginx.conf` tiene un location sin buffering para el stream.

## Demo rápida de aislamiento

1. Login `superadmin/superadmin123` → crear empresas `NORTE` y `SUR` en la página **Empresas**.
2. Registrarse en `/register` eligiendo cada empresa; con superadmin promover cada
   usuario a `ADMIN` (módulo Usuarios).
3. Login con cada admin en dos ventanas: zonas, vehículos y tickets creados en NORTE
   no aparecen en SUR (y viceversa). La misma placa se puede registrar en ambas.
4. Seeder por empresa: `SEED_USER=<adminEmpresa> SEED_PASSWORD=<clave> npm run seed:tickets`.
