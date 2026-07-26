# Imagen propia del broker de mensajes.
#
# Deliberadamente NO se precarga un definitions.json con la topología: cada
# microservicio declara (assert) su exchange, su cola y su binding al arrancar
# —`exchange_audit` (topic), `queue_audit` con dead-letter hacia
# `exchange_audit.dlx` y la cola `queue_audit.dlq`—, así que precargarla solo
# duplicaría la fuente de verdad. Además, un definitions.json con la sección
# `users` desactiva RABBITMQ_DEFAULT_USER/PASS y dejaría las credenciales
# hardcodeadas en la imagen en vez de venir del Secret de Kubernetes.
FROM rabbitmq:3-management

# rabbitmq_prometheus expone /metrics en el puerto 15692: sin él no hay forma de
# ver la profundidad de `queue_audit`, que es la señal de que la auditoría se
# está quedando atrás respecto a los eventos que publican los microservicios.
RUN rabbitmq-plugins enable --offline rabbitmq_management rabbitmq_prometheus

COPY docker/rabbitmq/rabbitmq.conf /etc/rabbitmq/rabbitmq.conf

EXPOSE 5672 15672 15692

HEALTHCHECK --interval=15s --timeout=10s --start-period=60s --retries=6 \
  CMD rabbitmq-diagnostics -q ping || exit 1
