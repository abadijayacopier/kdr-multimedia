FROM alpine:3.20

RUN apk add --no-cache ffmpeg nodejs npm

WORKDIR /app
COPY server/srt-relay.js /app/server/srt-relay.js

CMD ["node", "/app/server/srt-relay.js"]
