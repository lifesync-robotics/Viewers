# 如何查看改进后的配准标记（Fiducial Mark）页面

## 前置要求

1. **Node.js 和 Yarn** 已安装
2. **Python 3** 已安装（用于 gRPC 服务器）
3. **DICOM 数据**（用于测试）

## 步骤 1: 启动 Registration gRPC 服务器

Registration Panel 需要连接到后端 gRPC 服务器才能正常工作。

```bash
# 在 AsclepiusPrototype 目录下
cd /Users/ronaldtse/development/LifeSyncRobotics/AsclepiusPrototype/05_Registration

# 启动 gRPC 服务器（端口 5002）
./start_registration_server.sh

# 或者手动启动：
python registration_server_grpc.py
```

**验证服务器是否运行：**
- 服务器应该显示：`Registration gRPC server listening on port 5002`
- 检查端口：`lsof -i :5002`

## 步骤 2: 启动 SyncForge API 服务器

Registration Panel 通过 REST API 与 gRPC 服务器通信。

```bash
# 在 AsclepiusPrototype 目录下
cd /Users/ronaldtse/development/LifeSyncRobotics/AsclepiusPrototype/00_SyncForgeAPI

# 启动 Node.js API 服务器（端口 3001）
npm start
# 或
node api/server.js
```

**验证 API 是否运行：**
- 访问：`http://localhost:3001/api/health`
- 应该返回：`{"status":"ok"}`

## 步骤 3: 启动 OHIF Viewer

```bash
# 在 Viewers 目录下
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers

# 安装依赖（如果还没有安装）
yarn install --frozen-lockfile

# 启动开发服务器
yarn start
# 或
yarn dev
```

**等待编译完成：**
- 通常需要 1-2 分钟
- 看到 `webpack compiled successfully` 表示成功
- 默认地址：`http://localhost:3000`

## 步骤 4: 在浏览器中打开 OHIF Viewer

1. **打开浏览器**，访问：`http://localhost:3000`

2. **加载 DICOM 研究**：
   - 使用 OHIF 的默认数据源，或
   - 加载你自己的 DICOM 文件

3. **打开 Registration Panel**：
   - 在左侧面板区域，找到 **"Registration"** 标签
   - 点击打开 Registration Panel
   - 或者使用工具栏中的 Registration 图标

## 步骤 5: 使用 Registration Panel

### 查看改进的功能：

1. **API 连接状态**：
   - 顶部显示 API 连接状态（绿色 = 已连接，红色 = 未连接）
   - 如果显示未连接，检查 gRPC 和 API 服务器是否运行

2. **标签页切换**：
   - **Manual Fiducial**：手动标记配准点
   - **Auto (Phantom)**：自动配准（使用 Phantom）

3. **手动配准流程**：
   - 点击 **"🚀 Start Session"** 开始配准会话
   - 点击 **"📥 Load Template"** 加载已保存的模板（如果有）
   - 在 viewport 中定位到解剖标志位置
   - 点击 **"📍 Add Fiducial at Crosshair"** 添加配准点
   - 点击 **"💾 Save Template"** 保存当前配置
   - 点击 **"✏️ Edit"** 编辑配准点信息
   - 点击 **"🎯 Jump"** 跳转到配准点位置
   - 点击 **"🗑️ Delete"** 删除配准点

4. **UI 改进**：
   - ✅ 加载状态指示器（按钮上的 spinner）
   - ✅ 成功/错误消息提示（自动消失）
   - ✅ 编辑对话框（点击 Edit 按钮）
   - ✅ 状态颜色编码（蓝色=默认，绿色=已捕获）
   - ✅ 流畅的动画效果

## 故障排除

### 问题 1: API 未连接

**症状**：面板顶部显示红色 "API Disconnected"

**解决方案**：
```bash
# 检查 gRPC 服务器
ps aux | grep registration_server_grpc.py

# 检查 API 服务器
curl http://localhost:3001/api/health

# 重启服务器
cd /Users/ronaldtse/development/LifeSyncRobotics/AsclepiusPrototype/05_Registration
./start_registration_server.sh
```

### 问题 2: 面板不显示

**症状**：找不到 Registration Panel

**解决方案**：
- 检查浏览器控制台是否有错误
- 确认 `extensions/lifesync` 已正确编译
- 尝试刷新页面（Cmd+R 或 Ctrl+R）

### 问题 3: 无法添加 Fiducial

**症状**：点击 "Add Fiducial" 没有反应

**解决方案**：
- 确保已启动配准会话（点击 "Start Session"）
- 确保 viewport 中有活动的 crosshair
- 检查浏览器控制台的错误信息

### 问题 4: 编译错误

**症状**：`yarn start` 失败

**解决方案**：
```bash
# 清理并重新安装
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
yarn clean
yarn install --frozen-lockfile
yarn start
```

## 快速启动脚本

创建一个快速启动脚本：

```bash
#!/bin/bash
# start_registration_demo.sh

echo "🚀 Starting Registration Panel Demo..."

# 启动 gRPC 服务器（后台）
cd /Users/ronaldtse/development/LifeSyncRobotics/AsclepiusPrototype/05_Registration
python registration_server_grpc.py &
GRPC_PID=$!

# 启动 API 服务器（后台）
cd /Users/ronaldtse/development/LifeSyncRobotics/AsclepiusPrototype/00_SyncForgeAPI
node api/server.js &
API_PID=$!

# 等待服务器启动
sleep 3

# 启动 OHIF Viewer
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
yarn start

# 清理（Ctrl+C 时）
trap "kill $GRPC_PID $API_PID" EXIT
```

## 测试功能清单

- [ ] API 连接状态显示正常
- [ ] 可以启动配准会话
- [ ] 可以加载/保存模板
- [ ] 可以在 crosshair 位置添加 fiducial
- [ ] 可以编辑 fiducial 信息
- [ ] 可以跳转到 fiducial 位置
- [ ] 可以删除 fiducial
- [ ] 加载状态指示器正常工作
- [ ] 成功/错误消息正常显示
- [ ] 编辑对话框正常打开和关闭

## 下一步

完成基本测试后，可以：
1. 测试自动配准功能（Phantom）
2. 测试配准计算功能（需要 tracker 数据）
3. 测试多系列配准
4. 测试配准结果保存和加载
