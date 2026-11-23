#!/usr/bin/env bash
# Wyrd-OS watchdog for an Orble box: suspends the box through Orble's Self API when the Wyrd-OS server says nothing
# is going on. Runs as the system user wyrd-wd, the only user the firewall (guard.sh) lets reach 169.254.77.77.
# Fails safe: any error reading /activity keeps the box awake.
set -uo pipefail
: "${OPERATOR_URL:=http://127.0.0.1:3001}"   # the operator API, published on loopback only
: "${IDLE_MIN:=15}"          # minutes since lastUsedAt before the box may sleep
: "${DUE_MARGIN_MIN:=10}"    # stay awake when a routine or job is due within this many minutes
: "${WAKE_GRACE_MIN:=5}"     # after a wake, stay awake at least this long (whoever woke it may not count as use)
: "${INTERVAL_S:=60}"
: "${IDLE_CHECKS:=2}"        # consecutive idle answers needed before suspending
SELF=http://169.254.77.77
log() { echo "$(date -u +%FT%TZ) $*"; }
iso() { date -u -d "$1" +%s 2>/dev/null; }

awake_since=$(date +%s); last=$awake_since; idle_count=0
# Memory survives a suspend, so a resume shows up as the wall clock jumping. Ticks of 5 s catch any suspend over 20 s.
tick() { local until=$(( $(date +%s) + INTERVAL_S )) t
  while :; do
    t=$(date +%s)
    if (( t - last > 20 )); then log "woke (gap $((t - last))s)"; awake_since=$t; idle_count=0; last=$t; return; fi
    last=$t; (( t >= until )) && return
    sleep 5
  done; }
log "start idle=${IDLE_MIN}m margin=${DUE_MARGIN_MIN}m grace=${WAKE_GRACE_MIN}m every ${INTERVAL_S}s"
while :; do
  now=$(date +%s)
  a=$(curl -fsS -m 10 -H "Authorization: Bearer ${OPERATOR_TOKEN}" "$OPERATOR_URL/api/operator/v1/activity") || {
    log "activity unreadable: staying awake"; idle_count=0; tick; continue; }
  busy=$(jq -r .busy <<<"$a"); used=$(jq -r '.lastUsedAt // empty' <<<"$a"); due=$(jq -r '.nextDueAt // empty' <<<"$a")
  why=""
  [ "$busy" = true ] && why="busy: $(jq -r '.reasons | join(",")' <<<"$a")"
  [ -z "$why" ] && (( now - awake_since < WAKE_GRACE_MIN * 60 )) && why="woke $(( (now - awake_since) / 60 ))m ago"
  [ -z "$why" ] && [ -n "$used" ] && (( now - $(iso "$used") < IDLE_MIN * 60 )) && why="used $(( (now - $(iso "$used")) / 60 ))m ago"
  [ -z "$why" ] && [ -n "$due" ] && (( $(iso "$due") - now < DUE_MARGIN_MIN * 60 )) && why="due at $due"
  if [ -n "$why" ]; then
    [ "$idle_count" -gt 0 ] && log "awake: $why"; idle_count=0
  else
    idle_count=$((idle_count + 1))
    log "idle ($idle_count/$IDLE_CHECKS) lastUsedAt=${used:-none} nextDueAt=${due:-none}"
    if (( idle_count >= IDLE_CHECKS )); then
      # Nothing outside wakes the box for nextDueAt on Orble yet: say so, so a missed routine is explained.
      [ -n "$due" ] && log "note: nothing wakes this box at $due; that routine runs at the next wake"
      log "suspending: $(curl -fsS -m 150 -X POST "$SELF/orble/suspend" || echo failed)"
      idle_count=0
    fi
  fi
  tick
done
