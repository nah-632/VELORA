#!/bin/bash
# Clean .next (the verify step runs `next build`, which breaks `next dev`), start, measure, shoot.
set -u
cd /workspaces/VELORA || exit 1
sh scripts/dev-server.sh stop >/dev/null 2>&1
pkill -f 'next dev' 2>/dev/null; pkill -f next-server 2>/dev/null
sleep 2
rm -rf .next
sh scripts/dev-server.sh start
sleep 10
curl -s -o /dev/null -w 'warmup=%{http_code}\n' -m 300 'http://localhost:3210/i/localProbeTokenAAAAAAAAAAAA'

cp /tmp/measure-gold.mjs ./m.tmp.mjs
node ./m.tmp.mjs localProbeTokenAAAAAAAAAAAA gold 2>&1 | head -4
rm -f ./m.tmp.mjs

cp /tmp/shoot-layer2.mjs ./s.tmp.mjs
node ./s.tmp.mjs localProbeTokenAAAAAAAAAAAA b1b 2>&1 | tail -3
rm -f ./s.tmp.mjs
ls -la /tmp/gold.png /tmp/b1b-sealed-ar.png /tmp/b1b-sealed-en.png 2>/dev/null