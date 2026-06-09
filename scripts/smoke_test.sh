#!/usr/bin/env bash
# Smoke test: parallel ticket creation (requires running API)
set -euo pipefail
BASE="${TEST_API_URL:-http://127.0.0.1:8080}"
CONCURRENCY="${1:-50}"

CAT=$(curl -sf "$BASE/v1/categories" | python3 -c "import sys,json; print(json.load(sys.stdin)[0]['id'])")

echo "Creating $CONCURRENCY tickets..."
START=$(date +%s%N)
for i in $(seq 1 "$CONCURRENCY"); do
  (
    curl -sf -X POST "$BASE/v1/tickets" \
      -H "Content-Type: application/json" \
      -d "{\"row_label\":\"ряд\",\"desk_label\":\"$i\",\"category_id\":\"$CAT\",\"description\":\"smoke $i\"}" \
      > /dev/null
  ) &
done
wait
END=$(date +%s%N)
MS=$(( (END - START) / 1000000 ))
echo "Done in ${MS}ms ($CONCURRENCY tickets)"

TOTAL=$(curl -sf "$BASE/health")
echo "health: $TOTAL"
