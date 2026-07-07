# Notificaciones de CI a Telegram

El workflow `.github/workflows/notify-telegram.yml` ya está listo pero no se
activa hasta que existan los secretos `TELEGRAM_BOT_TOKEN` y
`TELEGRAM_CHAT_ID` en el repositorio de GitHub. Sin esos secretos, el job se
salta automáticamente (no rompe el pipeline).

## 1. Crear el bot con @BotFather

1. En Telegram, abre una conversación con `@BotFather`.
2. Envía `/newbot` y sigue las instrucciones (nombre y username del bot).
3. BotFather responde con un token con este formato:
   `123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`. Ese es tu
   `TELEGRAM_BOT_TOKEN`.

## 2. Agregar el bot al grupo de desarrolladores

1. Abre el grupo de Telegram donde están los desarrolladores.
2. Agrega el bot como miembro del grupo.
3. Dale permisos para enviar mensajes (no necesita ser admin).

## 3. Obtener el chat_id del grupo

1. Envía cualquier mensaje al grupo (con el bot ya agregado).
2. Visita en el navegador:
   `https://api.telegram.org/bot<TU_TOKEN>/getUpdates`
3. Busca en la respuesta JSON el campo `"chat":{"id": -100XXXXXXXXXX, ...}`.
   Ese número (incluyendo el signo negativo si lo tiene) es tu
   `TELEGRAM_CHAT_ID`.

## 4. Configurar los secretos en GitHub

En el repositorio: **Settings → Secrets and variables → Actions → New
repository secret**.

- `TELEGRAM_BOT_TOKEN`: el token de BotFather.
- `TELEGRAM_CHAT_ID`: el chat_id obtenido en el paso 3.

Una vez configurados, el siguiente push o pull request a `main`/`master`
disparará automáticamente una notificación al grupo con el resultado del
build/tests (Java y Node) y del análisis de SonarCloud.
