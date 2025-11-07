#!/bin/bash
# Script to enable remote access to Orthanc with authentication

echo "===== Orthanc Remote Access Configuration Fix ====="
echo ""
echo "This script will:"
echo "1. Enable RemoteAccessAllowed"
echo "2. Enable AuthenticationEnabled"
echo "3. Add RegisteredUsers credentials"
echo ""
echo "Default credentials will be: orthanc / orthanc"
echo ""
read -p "Do you want to continue? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

# Backup the original file
echo "Creating backup..."
sudo cp /etc/orthanc/orthanc.json /etc/orthanc/orthanc.json.backup.$(date +%Y%m%d_%H%M%S)

# Fix RemoteAccessAllowed
echo "Enabling RemoteAccessAllowed..."
sudo sed -i 's/"RemoteAccessAllowed" : false/"RemoteAccessAllowed" : true/g' /etc/orthanc/orthanc.json

# Uncomment and enable AuthenticationEnabled
echo "Enabling AuthenticationEnabled..."
sudo sed -i 's/\/\*\*\s*"AuthenticationEnabled" : false,\s*\*\*\//"AuthenticationEnabled" : true,/g' /etc/orthanc/orthanc.json
sudo sed -i 's/\*\*\s*"AuthenticationEnabled" : false,/"AuthenticationEnabled" : true,/g' /etc/orthanc/orthanc.json

# Add RegisteredUsers section after AuthenticationEnabled line if it doesn't exist
if ! grep -q "RegisteredUsers" /etc/orthanc/orthanc.json; then
    echo "Adding RegisteredUsers section..."
    sudo sed -i '/"AuthenticationEnabled"/a\
  "RegisteredUsers" : {\
    "orthanc" : "orthanc",\
    "admin" : "admin"\
  },' /etc/orthanc/orthanc.json
fi

echo ""
echo "✅ Configuration updated!"
echo ""
echo "Credentials:"
echo "  Username: orthanc  Password: orthanc"
echo "  Username: admin    Password: admin"
echo ""
echo "Restarting Orthanc service..."
sudo systemctl restart orthanc

echo ""
echo "Waiting for Orthanc to start..."
sleep 3

# Check if Orthanc is running
if systemctl is-active --quiet orthanc; then
    echo "✅ Orthanc is running!"
    echo ""
    echo "You can now access Orthanc from remote machines:"
    echo "  - Orthanc UI: http://$(hostname -I | awk '{print $1}'):8042"
    echo "  - OHIF Viewer: http://$(hostname -I | awk '{print $1}'):3000"
    echo ""
    echo "Use credentials: orthanc / orthanc"
else
    echo "❌ Orthanc failed to start. Check logs:"
    echo "   sudo journalctl -u orthanc -n 50"
fi


