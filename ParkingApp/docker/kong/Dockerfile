# Imagen propia del API Gateway.
#
# Kong corre en modo DB-less: toda la configuración (servicios, rutas, plugins,
# consumidores JWT) vive en kong.yml y se hornea dentro de la imagen. Así el
# gateway es inmutable y reproducible: la misma imagen enruta igual en
# docker-compose que en Kubernetes, sin ConfigMaps que se puedan desincronizar.
FROM kong:3.6

# El proceso corre como el usuario `kong` (sin privilegios); se copia como root
# y se devuelve el control a `kong` al final.
USER root

COPY App/kong.yml /kong/declarative/kong.yml
RUN chown kong:kong /kong/declarative/kong.yml

ENV KONG_DATABASE=off \
    KONG_DECLARATIVE_CONFIG=/kong/declarative/kong.yml \
    KONG_PROXY_ACCESS_LOG=/dev/stdout \
    KONG_ADMIN_ACCESS_LOG=/dev/stdout \
    KONG_PROXY_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_ERROR_LOG=/dev/stderr \
    KONG_ADMIN_LISTEN=0.0.0.0:8001 \
    # El DNS embebido de Docker/CoreDNS responde SERVFAIL a las consultas SRV y
    # Kong pierde ~4s por request reintentándolas (el SSE muere por timeout).
    # Solo registros A/CNAME + cache de 60s = resolución instantánea.
    KONG_DNS_ORDER=LAST,A,CNAME \
    KONG_DNS_VALID_TTL=60

USER kong

EXPOSE 8000 8001

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD kong health || exit 1
