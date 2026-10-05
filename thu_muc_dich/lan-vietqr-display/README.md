# LAN VietQR Display (iPhone control ↔ Android display)

## Android (Termux)
    pkg install nodejs unzip
    termux-setup-storage
    unzip ~/storage/downloads/lan-vietqr-display.zip && cd lan-vietqr-display
    node server/server.js            # if the IP isn't detected: LAN_IP=192.168.x.x node server/server.js
Open Chrome on the same phone: http://localhost:8787/display

## iPhone
First time: scan the QR on the Android screen with the Camera app (or open http://<android-ip>:8787/control and type the 6-digit code).
Afterwards: always open the SAME address; it reconnects automatically.

## Important
- Give the Android a fixed IP (DHCP reservation in the router). Browser storage is tied to the address, so a new IP = new origin = pairing is lost.
- No Internet needed; no external dependencies (npm install not required).
- Pairing data: server-data.json (Android) and IndexedDB (iPhone).
