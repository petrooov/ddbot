#!/bin/zsh
cd "${0:A:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if ! command -v node >/dev/null; then
  echo 'Pro spuštění je potřeba Node.js.'
  read
  exit 1
fi
if curl -fsS --max-time 2 http://127.0.0.1:4317/api/state >/dev/null; then
  echo 'Aplikace už běží na http://127.0.0.1:4317'
  read
  exit 0
fi
echo 'Otevři http://127.0.0.1:4317. Toto okno nech běžet po dobu čekání na předprodej.'
caffeinate -i node src/server.js
