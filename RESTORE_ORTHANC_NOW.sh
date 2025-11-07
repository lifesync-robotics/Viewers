#!/bin/bash
echo "===== EMERGENCY RESTORE OF ORTHANC ====="
echo ""
echo "Restoring original working configuration..."

# Restore the earliest backup (the working one)
sudo cp /etc/orthanc/orthanc.json.backup.20251107_122642 /etc/orthanc/orthanc.json

echo "Reloading systemd daemon..."
sudo systemctl daemon-reload

echo "Restarting Orthanc..."
sudo systemctl restart orthanc

sleep 3

echo ""
echo "Checking status..."
if systemctl is-active --quiet orthanc; then
    echo "✅ SUCCESS! Orthanc is running again!"
    echo ""
    echo "Test it:"
    echo "  curl http://localhost:8042/system"
else
    echo "❌ Orthanc still failed. Showing status:"
    sudo systemctl status orthanc --no-pager -l
fi


