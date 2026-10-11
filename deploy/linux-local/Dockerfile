# Package the locally built Linux binary, including its customized frontend.
# Build in the extracted release package, not in deploy/linux-local itself.
ARG ALPINE_IMAGE=alpine:3.21
ARG POSTGRES_IMAGE=postgres:18-alpine

FROM ${POSTGRES_IMAGE} AS pg-client
FROM ${ALPINE_IMAGE}

LABEL org.opencontainers.image.source="https://github.com/bhr2625556394-alt/token"
LABEL org.opencontainers.image.description="token with locally customized frontend"

# Keep these dependencies aligned with the upstream runtime Dockerfile.
RUN apk add --no-cache \
    ca-certificates tzdata su-exec libpq zstd-libs lz4-libs \
    krb5-libs libldap libedit
COPY --from=pg-client /usr/local/bin/pg_dump /usr/local/bin/pg_dump
COPY --from=pg-client /usr/local/bin/psql /usr/local/bin/psql
COPY --from=pg-client /usr/local/lib/libpq.so.5* /usr/local/lib/

RUN addgroup -g 1000 token && \
    adduser -u 1000 -G token -s /bin/sh -D token
WORKDIR /app

# The app user may write data, but may not replace the customized executable.
COPY token /app/token
COPY --chown=token:token backend/resources /app/resources
COPY LICENSE NOTICE BUILD-INFO.txt /app/
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod 555 /app/token && chmod 755 /app/docker-entrypoint.sh && \
    chown root:root /app && chmod 755 /app && \
    mkdir -p /app/data && chown token:token /app/data

EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD wget -q -T 5 -O /dev/null http://localhost:8080/health || exit 1
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["/app/token"]
