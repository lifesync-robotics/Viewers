# 强制刷新 Registration Panel

如果 Registration Panel 没有更新，请按以下步骤操作：

## 方法 1: 强制触发 Webpack 重新编译

```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers

# 触摸关键文件以触发重新编译
touch extensions/lifesync/src/panels/getPanelModule.tsx
touch extensions/lifesync/src/components/Registration/RegistrationPanelContainer.tsx
touch extensions/lifesync/src/components/Registration/ManualRegistrationPanel.tsx

# 等待 webpack 重新编译（查看终端输出）
# 应该看到 "webpack compiled successfully"
```

## 方法 2: 完全重启 OHIF Viewer

```bash
# 1. 停止当前的 webpack 进程
# 在运行 yarn start 的终端按 Ctrl+C

# 2. 清理构建缓存
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
yarn clean

# 3. 重新启动
yarn start
```

## 方法 3: 清除浏览器缓存并硬刷新

### Chrome/Edge:
1. 打开开发者工具 (F12)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载" (Empty Cache and Hard Reload)

### 或者使用快捷键:
- Mac: `Cmd + Shift + R`
- Windows/Linux: `Ctrl + Shift + R`

### 或者使用无痕模式:
- 打开无痕窗口 (`Cmd/Ctrl + Shift + N`)
- 访问 `http://localhost:3000`

## 方法 4: 检查编译错误

查看运行 `yarn start` 的终端，检查是否有：
- ❌ 编译错误 (errors)
- ⚠️ 警告 (warnings) - 通常可以忽略

如果有错误，修复后再刷新。

## 方法 5: 验证代码是否正确

```bash
# 检查导入是否正确
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
grep "RegistrationPanelContainer" extensions/lifesync/src/panels/getPanelModule.tsx

# 应该看到:
# import RegistrationPanelContainer from '../components/Registration/RegistrationPanelContainer';
# <RegistrationPanelContainer
```

## 方法 6: 检查文件是否存在

```bash
# 确认文件存在
ls -la extensions/lifesync/src/components/Registration/RegistrationPanelContainer.tsx
ls -la extensions/lifesync/src/components/Registration/ManualRegistrationPanel.tsx

# 应该看到文件存在且最近修改过
```

## 验证更新是否生效

刷新后，打开 Registration Panel，你应该看到：

1. ✅ 顶部有 "📋 Registration" 标题
2. ✅ 有两个标签页: "Manual Fiducial" 和 "Auto (Phantom)"
3. ✅ 在 "Manual Fiducial" 标签下，最顶部有:
   - "📋 Fiducial Template Management" 区域
   - "📍 Add Fiducial Points" 区域
   - "✏️ Edit Fiducials" 区域

## 如果仍然看不到更新

1. **检查浏览器控制台 (F12)**
   - 查看 Console 标签是否有错误
   - 查看 Network 标签，确认文件已重新加载

2. **检查 webpack 编译状态**
   - 查看终端输出
   - 确认没有编译错误
   - 等待 "webpack compiled successfully"

3. **完全重启所有服务**
   ```bash
   cd /Users/ronaldtse/development/LifeSyncRobotics/AsclepiusPrototype
   ./stop_all_services.sh
   sleep 3
   ./start_all_services.sh
   ```

4. **检查文件修改时间**
   ```bash
   ls -lt extensions/lifesync/src/components/Registration/*.tsx | head -5
   ```
   确认文件最近被修改过

## 快速检查清单

- [ ] Webpack 正在运行 (`yarn start`)
- [ ] 终端显示 "webpack compiled successfully"
- [ ] 浏览器已硬刷新 (`Cmd/Ctrl + Shift + R`)
- [ ] 浏览器控制台没有红色错误
- [ ] 可以看到 "Manual Fiducial" 和 "Auto (Phantom)" 标签页
- [ ] 可以看到 "📋 Fiducial Template Management" 区域在顶部
