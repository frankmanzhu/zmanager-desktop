#!/bin/sh
set -e

if command -v update-mime-database >/dev/null 2>&1; then
  update-mime-database /usr/share/mime >/dev/null 2>&1 || true
fi

if command -v update-desktop-database >/dev/null 2>&1; then
  update-desktop-database /usr/share/applications >/dev/null 2>&1 || true
fi

if command -v gtk-update-icon-cache >/dev/null 2>&1; then
  gtk-update-icon-cache -q -t -f /usr/share/icons/hicolor >/dev/null 2>&1 || true
fi

reload_nautilus_extensions() {
  if ! command -v pgrep >/dev/null 2>&1 || ! pgrep -x nautilus >/dev/null 2>&1; then
    return
  fi

  if command -v loginctl >/dev/null 2>&1 && command -v runuser >/dev/null 2>&1; then
    loginctl list-users --no-legend 2>/dev/null | while read -r uid user _rest; do
      if [ -n "$uid" ] && [ -n "$user" ] && [ -S "/run/user/$uid/bus" ]; then
        if pgrep -u "$uid" -x nautilus >/dev/null 2>&1; then
          runuser -u "$user" -- env \
            "DBUS_SESSION_BUS_ADDRESS=unix:path=/run/user/$uid/bus" \
            "XDG_RUNTIME_DIR=/run/user/$uid" \
            nautilus -q >/dev/null 2>&1 || true
        fi
      fi
    done
    sleep 1
  fi

  if command -v pkill >/dev/null 2>&1; then
    pkill -x nautilus >/dev/null 2>&1 || true
  fi
}

reload_nautilus_extensions || true
