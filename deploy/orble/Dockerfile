FROM debian:trixie-slim
RUN apt-get update && apt-get install -y --no-install-recommends iptables curl jq ca-certificates && rm -rf /var/lib/apt/lists/*
COPY guard.sh watchdog.sh /usr/local/bin/
