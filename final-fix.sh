#!/bin/bash
set -e

echo "===== FINAL FIX: Enable Orthanc Remote Access ====="
echo ""

# Restore working backup
echo "Step 1: Restoring working configuration..."
sudo cp /etc/orthanc/orthanc.json.backup.20251107_122642 /etc/orthanc/orthanc.json

# Use sed with very specific patterns to avoid breaking JSON
echo "Step 2: Enabling RemoteAccessAllowed..."
sudo sed -i '0,/"RemoteAccessAllowed" : false/s//"RemoteAccessAllowed" : true/' /etc/orthanc/orthanc.json

# Validate JSON
echo "Step 3: Validating JSON syntax..."
if python3 -c "import json; json.load(open('/etc/orthanc/orthanc.json'))" 2>/dev/null; then
    echo "✅ JSON is valid"
else
    echo "❌ JSON is invalid! Restoring backup..."
    sudo cp /etc/orthanc/orthanc.json.backup.20251107_122642 /etc/orthanc/orthanc.json
    echo "Backup restored. Remote access NOT enabled."
    exit 1
fi

echo "Step 4: Restarting Orthanc..."
sudo systemctl daemon-reload
sudo systemctl restart orthanc

sleep 3

echo ""
echo "Step 5: Checking status..."
if systemctl is-active --quiet orthanc; then
    echo "✅ SUCCESS! Orthanc is running!"
    echo ""
    echo "Remote access is now enabled (NO authentication required)"
    echo ""
    echo "You can access Orthanc from other machines at:"
    echo "  http://$(hostname -I | awk '{print $1}'):8042"
    echo ""
    echo "Note: Authentication is still commented out in the config."
    echo "For basic testing without passwords, this works for now."
else
    echo "❌ Failed! Restoring backup..."
    sudo cp /etc/orthanc/orthanc.json.backup.20251107_122642 /etc/orthanc/orthanc.json
    sudo systemctl restart orthanc
    echo "Backup restored."
fi


