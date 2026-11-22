#!/usr/bin/env bash
# Keep Android tool failures visible in the check annotations as well as logs.
# This is used only for SDK/Gradle commands that do not receive credentials.
set -uo pipefail
log=$(mktemp)
trap 'rm -f "$log"' EXIT
"$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}
if [ "$status" -ne 0 ]; then
  python3 - "$log" <<'PY'
import pathlib, sys
message = '\n'.join(pathlib.Path(sys.argv[1]).read_text(errors='replace').splitlines()[-100:])
message = message.replace('%', '%25').replace('\r', '%0D').replace('\n', '%0A')
print('::error title=Android tool failed::' + message)
PY
fi
exit "$status"
