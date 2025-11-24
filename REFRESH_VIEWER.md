# 如何确保 OHIF Viewer 已刷新

## 方法 1: 硬刷新浏览器（最简单）

### Mac:
- **Chrome/Edge**: `Cmd + Shift + R` 或 `Cmd + Option + R`
- **Firefox**: `Cmd + Shift + R`
- **Safari**: `Cmd + Option + E` (清空缓存) 然后 `Cmd + R`

### Windows/Linux:
- **Chrome/Edge**: `Ctrl + Shift + R` 或 `Ctrl + F5`
- **Firefox**: `Ctrl + Shift + R` 或 `Ctrl + F5`
- **Safari**: `Ctrl + F5`

### 或者使用开发者工具:
1. 打开开发者工具 (F12 或 `Cmd/Ctrl + Option + I`)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载" (Empty Cache and Hard Reload)

## 方法 2: 检查开发服务器状态

### 检查服务器是否运行:
```bash
# 检查端口 3000 是否被占用
lsof -ti:3000

# 或者检查进程
ps aux | grep webpack
```

### 如果服务器没有运行，启动它:
```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
yarn start
```

### 等待编译完成:
- 查看终端输出，应该看到:
  ```
  webpack compiled successfully
  ```
- 或者:
  ```
  Compiled successfully!
  ```

## 方法 3: 清除浏览器缓存

### Chrome/Edge:
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载"

### 或者手动清除:
1. `Cmd/Ctrl + Shift + Delete`
2. 选择 "缓存的图片和文件"
3. 时间范围选择 "全部时间"
4. 点击 "清除数据"

## 方法 4: 使用无痕/隐私模式

打开无痕窗口测试，确保没有缓存干扰:
- **Chrome/Edge**: `Cmd/Ctrl + Shift + N`
- **Firefox**: `Cmd/Ctrl + Shift + P`
- **Safari**: `Cmd + Shift + N`

## 方法 5: 重启开发服务器

如果以上方法都不行，重启开发服务器:

```bash
# 1. 停止当前服务器 (在运行服务器的终端按 Ctrl+C)

# 2. 清理构建缓存
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
yarn clean

# 3. 重新启动
yarn start
```

## 方法 6: 检查编译输出

在运行 `yarn start` 的终端中，你应该看到:

```
✅ 编译成功:
- 没有错误 (errors: 0)
- 可能有警告 (warnings)，但通常不影响运行

❌ 如果有错误:
- 查看错误信息
- 修复错误后，webpack 会自动重新编译
```

## 方法 7: 验证文件已更新

检查文件修改时间，确保代码已保存:

```bash
# 检查 RegistrationPanelContainer 的修改时间
ls -la extensions/lifesync/src/components/Registration/RegistrationPanelContainer.tsx

# 检查 getPanelModule 的修改时间
ls -la extensions/lifesync/src/panels/getPanelModule.tsx
```

## 方法 8: 检查浏览器控制台

1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签
3. 检查是否有错误:
   - ❌ 红色错误 = 需要修复
   - ⚠️ 黄色警告 = 通常可以忽略
4. 查看 Network 标签，确认文件已重新加载

## 快速检查清单

- [ ] 开发服务器正在运行 (`yarn start`)
- [ ] 终端显示 "webpack compiled successfully"
- [ ] 浏览器已硬刷新 (`Cmd/Ctrl + Shift + R`)
- [ ] 浏览器控制台没有红色错误
- [ ] 可以看到 "Manual Fiducial" 和 "Auto (Phantom)" 标签页

## 如果仍然看不到更新

1. **完全重启**:
   ```bash
   # 停止服务器
   # 在终端按 Ctrl+C

   # 清理并重启
   cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
   yarn clean
   yarn start
   ```

2. **检查文件是否正确**:
   ```bash
   # 确认导入的是 RegistrationPanelContainer
   grep "RegistrationPanelContainer" extensions/lifesync/src/panels/getPanelModule.tsx
   ```

3. **检查浏览器缓存**:
   - 使用无痕模式测试
   - 或完全清除浏览器缓存

4. **查看编译日志**:
   - 检查终端中的 webpack 输出
   - 确认没有编译错误

## 验证更新是否生效

打开 Registration Panel 后，你应该看到:

1. ✅ 顶部有 "📋 Registration" 标题
2. ✅ 有两个标签页: "Manual Fiducial" 和 "Auto (Phantom)"
3. ✅ 在 "Manual Fiducial" 标签下:
   - "📋 Fiducial Template Management" 区域（最顶部）
   - "📍 Add Fiducial Points" 区域
   - "✏️ Edit Fiducials" 区域

如果看到这些，说明更新已生效！
