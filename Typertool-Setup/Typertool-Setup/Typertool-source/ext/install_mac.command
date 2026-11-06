#!/bin/bash
cd "$(dirname "$0")"
DEST="$HOME/Library/Application Support/Adobe/CEP/extensions/Typertool"

if pgrep -x "Adobe Photoshop" >/dev/null 2>&1 || pgrep -f "Adobe Photoshop" >/dev/null 2>&1; then
  echo "Photoshop dang mo: hay tat Photoshop truoc roi chay lai. / Photoshop is open: close it first."
  read -n 1 -s -r -p "Press any key..."
  exit 1
fi
if [ ! -f "Typertool/CSXS/manifest.xml" ]; then
  echo "Khong thay thu muc Typertool canh file nay. / The Typertool folder is not next to this file."
  read -n 1 -s -r -p "Press any key..."
  exit 1
fi

for v in 6 7 8 9 10 11 12; do
  defaults write com.adobe.CSXS.$v PlayerDebugMode 1
done

rm -rf "$HOME/Library/Application Support/Adobe/CEP/extensions/TypeRLite"  # old name of the panel
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R Typertool/. "$DEST"/

# the shortcut scripts go into every Photoshop Presets/Scripts folder (File > Scripts); may need sudo
COPIED=0
for d in /Applications/Adobe\ Photoshop*/Presets/Scripts; do
  if [ -d "$d" ] && cp Scripts/*.jsx "$d"/ 2>/dev/null; then COPIED=1; fi
done
echo
if [ "$COPIED" = "1" ]; then
  echo "Da chep script phim tat / Shortcut scripts copied: File > Scripts > Typertool - ..."
else
  echo "Chua chep duoc script phim tat. Chay lai bang sudo, hoac chep thu cong thu muc Scripts vao Photoshop/Presets/Scripts."
  echo "Shortcut scripts NOT copied: run this with sudo or copy the .jsx files of the Scripts folder into Photoshop/Presets/Scripts."
fi
echo
echo "Da cai xong / Installed."
echo "Mo Photoshop, vao: Window > Extensions > Typertool"
read -n 1 -s -r -p "Press any key..."
