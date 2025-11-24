#!/usr/bin/env python3
"""
Real-time Tracking Server for OHIF Navigation
Simulates a surgical tracking system that sends position/orientation at 20Hz
"""

import asyncio
import json
import math
import time
from datetime import datetime
import websockets
from typing import Set

# Store connected clients
connected_clients: Set = set()

# Tracking state
tracking_active = False
tracking_mode = "circular"  # circular, linear, random


class TrackingSimulator:
    """Simulates a tracking device sending position and orientation"""

    def __init__(self):
        self.t = 0  # Time parameter
        # Origin starts at [0, 0, -150] for simulation mode
        self.center = [0, 0, -150]  # Origin in patient coordinates (mm)
        self.radius = 50  # Movement radius in mm
        self.speed = 0.5  # Rotation speed

    def get_circular_path(self):
        """Simulate circular motion in axial plane"""
        angle = self.t * self.speed
        x = self.center[0] + self.radius * math.cos(angle)
        y = self.center[1] + self.radius * math.sin(angle)
        z = self.center[2] + math.sin(self.t * 0.2) * 20  # Slight up/down

        # Orientation (normal vector pointing towards center)
        nx = -math.cos(angle)
        ny = -math.sin(angle)
        nz = -0.1

        self.t += 0.05  # Increment for next frame

        return {
            "position": [x, y, z],
            "orientation": [nx, ny, nz],
            "timestamp": time.time(),
            "frame_id": int(self.t * 20)
        }

    def get_linear_path(self):
        """Simulate linear motion along axial (Z) axis"""
        # Oscillate along Z axis (axial - superior/inferior direction)
        x = self.center[0]
        y = self.center[1]
        z = self.center[2] + math.sin(self.t * 0.5) * 50  # ±50mm range

        # Orientation points along movement direction
        nx = 0
        ny = 0
        nz = math.cos(self.t * 0.5)  # Points up/down

        self.t += 0.05

        return {
            "position": [x, y, z],
            "orientation": [nx, ny, nz],
            "timestamp": time.time(),
            "frame_id": int(self.t * 20)
        }

    def get_linear_sagittal(self):
        """Simulate linear motion along sagittal (X) axis - left/right"""
        x = self.center[0] + math.sin(self.t * 0.5) * 50  # ±50mm range
        y = self.center[1]
        z = self.center[2]

        # Orientation points left/right
        nx = math.cos(self.t * 0.5)
        ny = 0
        nz = 0

        self.t += 0.05

        return {
            "position": [x, y, z],
            "orientation": [nx, ny, nz],
            "timestamp": time.time(),
            "frame_id": int(self.t * 20)
        }

    def get_linear_coronal(self):
        """Simulate linear motion along coronal (Y) axis - anterior/posterior"""
        x = self.center[0]
        y = self.center[1] + math.sin(self.t * 0.5) * 50  # ±50mm range
        z = self.center[2]

        # Orientation points forward/backward
        nx = 0
        ny = math.cos(self.t * 0.5)
        nz = 0

        self.t += 0.05

        return {
            "position": [x, y, z],
            "orientation": [nx, ny, nz],
            "timestamp": time.time(),
            "frame_id": int(self.t * 20)
        }

    def get_random_walk(self):
        """Simulate random walk (jittery motion)"""
        import random

        # Small random movements
        dx = random.uniform(-2, 2)
        dy = random.uniform(-2, 2)
        dz = random.uniform(-1, 1)

        self.center[0] += dx
        self.center[1] += dy
        self.center[2] += dz

        # Random orientation changes
        nx = random.uniform(-1, 1)
        ny = random.uniform(-1, 1)
        nz = random.uniform(-0.5, 0.5)

        # Normalize
        mag = math.sqrt(nx*nx + ny*ny + nz*nz)
        if mag > 0:
            nx, ny, nz = nx/mag, ny/mag, nz/mag

        self.t += 0.05

        return {
            "position": self.center.copy(),
            "orientation": [nx, ny, nz],
            "timestamp": time.time(),
            "frame_id": int(self.t * 20)
        }

    def get_tracking_data(self, mode="circular"):
        """Get tracking data based on mode

        Modes:
        - circular: Circular motion in axial plane
        - linear: Linear motion along Z axis (axial/superior-inferior)
        - linear_sagittal: Linear motion along X axis (left-right)
        - linear_coronal: Linear motion along Y axis (anterior-posterior)
        - random: Random walk
        """
        if mode == "circular":
            return self.get_circular_path()
        elif mode == "linear":
            return self.get_linear_path()  # Axial (Z axis)
        elif mode == "linear_sagittal":
            return self.get_linear_sagittal()  # X axis
        elif mode == "linear_coronal":
            return self.get_linear_coronal()  # Y axis
        elif mode == "random":
            return self.get_random_walk()
        else:
            return self.get_circular_path()


simulator = TrackingSimulator()


async def broadcast_tracking_data():
    """Broadcast tracking data to all connected clients at 20Hz"""
    global tracking_active

    print("🔄 Starting tracking broadcast loop (20Hz)")

    while True:
        if tracking_active and connected_clients:
            # Get simulated tracking data
            data = simulator.get_tracking_data(tracking_mode)

            # Add metadata
            message = {
                "type": "tracking_update",
                "data": data,
                "mode": tracking_mode,
                "active": tracking_active
            }

            # Broadcast to all connected clients (with error handling)
            if connected_clients:
                # Create a copy to avoid modification during iteration
                clients_copy = connected_clients.copy()
                for client in clients_copy:
                    try:
                        await client.send(json.dumps(message))
                    except Exception as e:
                        # Remove disconnected clients
                        print(f"⚠️  Client send failed, removing: {e}")
                        connected_clients.discard(client)

        # 20Hz = 50ms interval
        await asyncio.sleep(0.05)


async def handle_client(websocket):
    """Handle individual client connection"""
    global tracking_active, tracking_mode

    client_id = f"{websocket.remote_address[0]}:{websocket.remote_address[1]}"
    print(f"✅ Client connected: {client_id}")

    # Register client
    connected_clients.add(websocket)

    # Send welcome message
    await websocket.send(json.dumps({
        "type": "connection",
        "status": "connected",
        "server": "OHIF Tracking Server v1.0",
        "update_rate": "20Hz",
        "timestamp": time.time()
    }))

    try:
        async for message in websocket:
            try:
                data = json.loads(message)
                cmd = data.get("command")

                if cmd == "start_tracking":
                    tracking_active = True
                    mode = data.get("mode", "circular")
                    tracking_mode = mode
                    simulator.t = 0  # Reset time
                    print(f"▶️  Tracking started (mode: {mode})")

                    await websocket.send(json.dumps({
                        "type": "response",
                        "command": "start_tracking",
                        "status": "started",
                        "mode": tracking_mode
                    }))

                elif cmd == "stop_tracking":
                    tracking_active = False
                    print("⏸️  Tracking stopped")

                    await websocket.send(json.dumps({
                        "type": "response",
                        "command": "stop_tracking",
                        "status": "stopped"
                    }))

                elif cmd == "set_mode":
                    tracking_mode = data.get("mode", "circular")
                    print(f"🔄 Tracking mode changed to: {tracking_mode}")

                    await websocket.send(json.dumps({
                        "type": "response",
                        "command": "set_mode",
                        "mode": tracking_mode
                    }))

                elif cmd == "set_center":
                    # Set center point from DICOM coordinates
                    center = data.get("position", [0, 0, -150])
                    simulator.center = center
                    print(f"📍 Center set to: {center}")

                    await websocket.send(json.dumps({
                        "type": "response",
                        "command": "set_center",
                        "center": center
                    }))

                elif cmd == "ping":
                    await websocket.send(json.dumps({
                        "type": "pong",
                        "timestamp": time.time()
                    }))

            except json.JSONDecodeError:
                print(f"⚠️  Invalid JSON received: {message}")
            except Exception as e:
                print(f"❌ Error processing message: {e}")

    except websockets.exceptions.ConnectionClosed:
        print(f"🔌 Client disconnected: {client_id}")
    finally:
        connected_clients.discard(websocket)
        print(f"👋 Client removed: {client_id} (Total: {len(connected_clients)})")


async def main():
    """Start WebSocket server and tracking broadcast loop"""
    print("=" * 60)
    print("🚀 OHIF Real-time Tracking Server")
    print("=" * 60)
    print(f"📡 WebSocket Server: ws://localhost:8765")
    print(f"🔄 Update Rate: 20Hz (50ms intervals)")
    print(f"📊 Tracking Modes: circular, linear, random")
    print("=" * 60)
    print()

    # Start WebSocket server with longer keep-alive settings
    server = await websockets.serve(
        handle_client,
        "localhost",
        8765,
        ping_interval=20,  # Send ping every 20 seconds
        ping_timeout=10,   # Wait 10 seconds for pong
        close_timeout=10   # Wait 10 seconds for clean close
    )

    print("✅ Server started successfully")
    print("⏳ Waiting for OHIF client connections...")
    print()

    # Start tracking broadcast loop
    broadcast_task = asyncio.create_task(broadcast_tracking_data())

    # Keep server running
    await asyncio.Future()  # Run forever


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n\n🛑 Server stopped by user")
    except Exception as e:
        print(f"\n❌ Server error: {e}")
