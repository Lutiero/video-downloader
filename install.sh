#!/bin/sh
# Instala yt-dlp/ffmpeg e registra o helper de Native Messaging no Chrome e Firefox (macOS).
set -e
D=$(cd "$(dirname "$0")" && pwd)
CHROME_ID=hlnalpbbbfihckcldldfpcppijfhgmpc
FIREFOX_ID=video-downloader@local

brew install yt-dlp ffmpeg

# Launcher com python3 absoluto: o PATH do navegador não enxerga o Homebrew.
printf '#!/bin/sh\nexec "%s" "%s/host/host.py"\n' "$(command -v python3)" "$D" > "$D/host/run"
chmod +x "$D/host/run"

reg() { # $1 = dir, $2 = linha de permissão
  mkdir -p "$1"
  printf '{"name":"video_downloader","description":"Video Downloader","path":"%s/host/run","type":"stdio",%s}\n' "$D" "$2" > "$1/video_downloader.json"
}
reg "$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts" "\"allowed_origins\":[\"chrome-extension://$CHROME_ID/\"]"
reg "$HOME/Library/Application Support/Mozilla/NativeMessagingHosts" "\"allowed_extensions\":[\"$FIREFOX_ID\"]"

echo "Pronto. Chrome: chrome://extensions > Modo desenvolvedor > Carregar sem compactação > $D/extension"
echo "Firefox: about:debugging > Este Firefox > Carregar extensão temporária > $D/extension/manifest.json"
