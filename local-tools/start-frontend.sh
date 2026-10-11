#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/env.sh"
frontend_job="gui/${UID}/org.local.token.frontend"
if launchctl print "${frontend_job}" >/dev/null 2>&1; then
    launchctl kickstart "${frontend_job}"
    exit 0
fi
TOKEN_ROOT="${TOKEN_ROOT}" TOKEN_NODE="${TOKEN_NODE}" "${TOKEN_NODE}" - <<'NODE'
const fs = require('fs');
const root = process.env.TOKEN_ROOT;
const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const args = [process.env.TOKEN_NODE, `${root}/frontend/node_modules/vite/bin/vite.js`, '--host', '127.0.0.1', '--port', '3000', '--strictPort'];
fs.writeFileSync(`${root}/.dev/frontend.plist`, `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>org.local.token.frontend</string>
<key>ProgramArguments</key><array>${args.map(a => `<string>${escape(a)}</string>`).join('')}</array>
<key>WorkingDirectory</key><string>${escape(root)}/frontend</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>${escape(process.env.PATH)}</string></dict>
<key>RunAtLoad</key><true/>
<key>StandardOutPath</key><string>${escape(root)}/.dev/frontend.log</string>
<key>StandardErrorPath</key><string>${escape(root)}/.dev/frontend.log</string>
</dict></plist>\n`);
NODE
launchctl bootstrap "gui/${UID}" "${TOKEN_ROOT}/.dev/frontend.plist"
