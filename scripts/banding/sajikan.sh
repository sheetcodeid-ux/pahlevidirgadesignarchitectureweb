#!/bin/bash
# Sajikan apps/web/dist di :4399.
#
# python3 -m http.server, BUKAN npx http-server: yang kedua membaca
# dist/_headers dan menyajikannya sebagai header sungguhan, jadi CSP produksi
# menolak localhost:8787 dan seluruh foto jadi kotak rusak tanpa satu pun
# galat di konsol (jebakan #28 di CLAUDE.md).
pkill -f "http.server 4399" 2>/dev/null
sleep 1
cd "$(dirname "$0")/../../apps/web/dist" || exit 1
nohup python3 -m http.server 4399 > /tmp/sajikan-kit.log 2>&1 &
sleep 2
curl -s -o /dev/null -w "dist: %{http_code}\n" http://127.0.0.1:4399/admin/kit/
