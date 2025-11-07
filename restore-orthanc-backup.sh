#!/bin/bash
# Restore Orthanc configuration from backup

BACKUP_FILE="/etc/orthanc/orthanc.json.backup.20251107_122642"

echo "===== Restoring Orthanc Configuration ====="
echo ""
echo "This will restore from: $BACKUP_FILE"
echo ""
read -p "Continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo "Restoring configuration..."
sudo cp "$BACKUP_FILE" /etc/orthanc/orthanc.json

echo "Restarting Orthanc..."
sudo systemctl restart orthanc

sleep 2

if systemctl is-active --quiet orthanc; then
    echo "✅ Orthanc restored and running!"
else
    echo "❌ Orthanc still not running. Manual intervention needed."
fi


