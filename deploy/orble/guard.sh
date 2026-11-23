#!/usr/bin/env bash
# Only the watchdog container (WD_IP, its fixed address on the app's network) may reach 169.254.77.77: Orble's Self
# API, whose suspend/fork/delete need no login, and the account's secret proxy. The box itself (root included) and
# every other container are refused. Orble's kernel has no `owner` match, so the line is drawn by address, not user.
# Checks every minute and puts back what's missing, so a Docker restart that rebuilds its chains leaves no lasting gap.
set -uo pipefail
M=169.254.77.77; WD_IP=${WD_IP:-172.30.77.77}; IPT=iptables-legacy   # the box's iptables is the legacy one
has() { $IPT -C "$@" 2>/dev/null; }
apply() {
  has OUTPUT -d $M -j REJECT || $IPT -I OUTPUT 1 -d $M -j REJECT
  $IPT -N DOCKER-USER 2>/dev/null
  # Order matters: the watchdog's ACCEPT first, then the REJECT for every other container.
  if ! { [ "$($IPT -S DOCKER-USER | sed -n 2p)" = "-A DOCKER-USER -s $WD_IP/32 -d $M/32 -j ACCEPT" ] &&
         [ "$($IPT -S DOCKER-USER | sed -n 3p)" = "-A DOCKER-USER -d $M/32 -j REJECT --reject-with icmp-port-unreachable" ]; }; then
    while has DOCKER-USER -s $WD_IP -d $M -j ACCEPT; do $IPT -D DOCKER-USER -s $WD_IP -d $M -j ACCEPT; done
    while has DOCKER-USER -d $M -j REJECT; do $IPT -D DOCKER-USER -d $M -j REJECT; done
    $IPT -I DOCKER-USER 1 -d $M -j REJECT
    $IPT -I DOCKER-USER 1 -s $WD_IP -d $M -j ACCEPT
    echo "$(date -u +%FT%TZ) applied"
  fi
}
while :; do apply; sleep "${GUARD_EVERY_S:-60}"; done
