# 🐍 Tracking Server - Quick Reference

## 🔄 **Restart Tracking Server**

```bash
# Method 1: One-liner (stop + start)
pkill -f tracking_server.py && cd /home/asclepius/github/Viewers && python3 tracking_server.py &

# Method 2: Step by step
pkill -f tracking_server.py       # Stop
cd /home/asclepius/github/Viewers  # Go to directory
python3 tracking_server.py &       # Start in background
```

---

## 🛑 **Stop Tracking Server**

```bash
pkill -f tracking_server.py
```

---

## ▶️ **Start Tracking Server**

```bash
cd /home/asclepius/github/Viewers
python3 tracking_server.py &
```

**Note:** The `&` at the end runs it in the background.

---

## 🔍 **Check If Server Is Running**

### **Method 1: Check Port**

```bash
netstat -tln | grep 8765
# or
ss -tln | grep 8765
```

**Expected output:**
```
tcp        0      0 127.0.0.1:8765          0.0.0.0:*               LISTEN
```

### **Method 2: Check Process**

```bash
ps aux | grep tracking_server.py
```

**Expected output:**
```
asclepius  12345  0.0  0.1  123456  7890 ?  S  10:30  0:00 python3 tracking_server.py
```

---

## 📊 **View Server Logs**

### **Real-time Logs:**

```bash
tail -f tracking_server.log
```

**Press `Ctrl+C` to stop viewing**

### **Last 50 Lines:**

```bash
tail -n 50 tracking_server.log
```

---

## 🧪 **Test Server Connection**

### **Method 1: Using Python**

```python
# Create test_connection.py:
import asyncio
import websockets

async def test():
    try:
        async with websockets.connect('ws://localhost:8765') as ws:
            print('✅ Connected to tracking server!')
            await ws.send('{"command": "ping"}')
            response = await ws.recv()
            print(f'Response: {response}')
    except Exception as e:
        print(f'❌ Connection failed: {e}')

asyncio.run(test())
```

Run: `python3 test_connection.py`

### **Method 2: Using Browser Console**

Open OHIF, press F12, run:

```javascript
const ws = new WebSocket('ws://localhost:8765');

ws.onopen = () => {
  console.log('✅ Connected to tracking server!');
  ws.send(JSON.stringify({ command: 'ping' }));
};

ws.onmessage = (event) => {
  console.log('📨 Response:', JSON.parse(event.data));
  ws.close();
};

ws.onerror = (error) => {
  console.error('❌ Connection failed:', error);
};
```

---

## ⚙️ **Modify Server Settings**

Edit `/home/asclepius/github/Viewers/tracking_server.py`:

### **Change Motion Range:**

```python
# Line ~60 (linear motion)
z = self.center[2] + math.sin(self.t * 0.5) * 50
#                                             ↑
#                                        Change this (mm)

# Examples:
z = self.center[2] + math.sin(self.t * 0.5) * 20   # ±20mm (smaller)
z = self.center[2] + math.sin(self.t * 0.5) * 100  # ±100mm (larger)
```

### **Change Motion Speed:**

```python
# Line ~60
z = self.center[2] + math.sin(self.t * 0.5) * 50
#                                      ↑
#                                 Change this

# Examples:
z = self.center[2] + math.sin(self.t * 0.3) * 50  # Slower
z = self.center[2] + math.sin(self.t * 0.8) * 50  # Faster
```

### **Change Port:**

```python
# Line ~270
server = await websockets.serve(
    handle_client,
    "localhost",
    8765,  # ← Change port here
    ...
)
```

**After editing, restart the server!**

---

## 🚨 **Troubleshooting**

### **Server Won't Stop:**

```bash
# Force kill all Python processes (careful!)
killall python3

# Or find PID and kill specifically:
ps aux | grep tracking_server.py
kill -9 <PID>
```

### **Port Already in Use:**

```bash
# Find what's using port 8765
lsof -i :8765

# Kill that process
kill -9 <PID>
```

### **Server Crashes Immediately:**

```bash
# Check for syntax errors
python3 -m py_compile tracking_server.py

# Run in foreground to see errors (remove &)
python3 tracking_server.py
```

### **OHIF Can't Connect:**

1. **Check server is running:**
   ```bash
   netstat -tln | grep 8765
   ```

2. **Check firewall:**
   ```bash
   sudo ufw status
   ```

3. **Check OHIF console for errors:**
   - Open OHIF
   - Press F12
   - Look for WebSocket connection errors

---

## 📋 **Quick Status Check**

```bash
# All-in-one status check
echo "🔍 Tracking Server Status:"
echo ""
echo "Port 8765:"
netstat -tln | grep 8765 || echo "  ❌ Not listening"
echo ""
echo "Process:"
ps aux | grep tracking_server.py | grep -v grep || echo "  ❌ Not running"
echo ""
echo "Recent log:"
tail -n 3 tracking_server.log 2>/dev/null || echo "  ⚠️ No log file"
```

---

## 🔄 **Auto-Restart on Boot (Optional)**

### **Using systemd:**

Create `/etc/systemd/system/tracking-server.service`:

```ini
[Unit]
Description=OHIF Tracking Server
After=network.target

[Service]
Type=simple
User=asclepius
WorkingDirectory=/home/asclepius/github/Viewers
ExecStart=/usr/bin/python3 /home/asclepius/github/Viewers/tracking_server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

Enable:
```bash
sudo systemctl enable tracking-server
sudo systemctl start tracking-server
sudo systemctl status tracking-server
```

---

## 📝 **Available Commands Summary**

| Action | Command |
|--------|---------|
| **Start** | `python3 tracking_server.py &` |
| **Stop** | `pkill -f tracking_server.py` |
| **Restart** | `pkill -f tracking_server.py && python3 tracking_server.py &` |
| **Check status** | `netstat -tln \| grep 8765` |
| **View logs** | `tail -f tracking_server.log` |
| **Check process** | `ps aux \| grep tracking_server.py` |

---

## 🎯 **After Restart:**

✅ Server is now running with latest code changes
✅ Ready to accept WebSocket connections on `ws://localhost:8765`
✅ OHIF can connect when you click "Real-time Navigation"

---

**Status:** ✅ Server restarted and running on port 8765!
