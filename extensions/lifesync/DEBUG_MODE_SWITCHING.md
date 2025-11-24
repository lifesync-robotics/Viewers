# 导航模式切换调试指南

## 问题描述
用户报告：点击 Instrument Projection 模式后启动导航，模式会回退到 Camera Following 模式，即使日志显示模式已切换。

## 调试步骤

### 1. 检查模式切换日志

在浏览器控制台中，按以下顺序查找日志：

#### 点击 Instrument Projection 模式时：
```
🔄 [TrackingPanel] Setting navigation mode to: instrument-projection
🔄 Switching navigation mode: camera-follow → instrument-projection
   Exiting previous mode: camera-follow
   Entering new mode: instrument-projection
🎯🎯🎯 Instrument Projection mode activated
   Extension length: 100mm (10cm)
   Viewport cameras will remain fixed - only projection will update
   Found X viewports on mode enter
   ✅ Saved camera states for X viewports  <-- 检查这个数字是否为 0
✅ Navigation mode changed successfully: camera-follow → instrument-projection
   Current mode: instrument-projection
```

**关键点：**
- 如果 `Found 0 viewports on mode enter`，说明视口未初始化
- 相机状态保存数量应该 >= 3（Axial, Sagittal, Coronal）

#### 点击 Start Navigation 时：
```
🧭 [startNavigation] Starting navigation mode: circular
🎯 [startNavigation] Tracking mode: simulation
🔄 [startNavigation] Orientation tracking: DISABLED ❌
📹 [startNavigation] Navigation mode: instrument-projection  <-- 检查这里
🔧 [startNavigation] Using existing NavigationController instance
📹 [startNavigation] Setting navigation mode to: instrument-projection
   Current mode before setting: instrument-projection
   Mode after setting: instrument-projection
   ✅ Mode successfully set to: instrument-projection
```

#### 第一次跟踪更新时：
```
🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED
   This confirms Instrument Projection mode is active!
   Cameras will remain FIXED - only projection updates
📸 [Instrument Projection] Saving camera states on first tracking update...  <-- 如果出现这个，说明 onModeEnter 时没保存成功
   ✅ Saved camera states for X viewports
📍 [Instrument Projection] Initial position: [x, y, z]
   ✅ Cameras are fixed - only projection will update
   Saved camera states for X viewports
```

### 2. 检查可能的问题

#### 问题 A：视口未初始化
**症状：** `Found 0 viewports on mode enter`
**原因：** NavigationController 在视口加载前就被初始化
**解决方案：** 代码已包含后备机制 - 在第一次跟踪更新时保存相机状态

#### 问题 B：模式被覆盖
**症状：** `startNavigation` 后模式变回 camera-follow
**原因：** localStorage 中保存的是旧模式，构造函数读取后覆盖
**解决方案：** 代码已添加 `force=true` 参数强制重新进入模式

#### 问题 C：相机状态未保存
**症状：** 相机仍然移动
**原因：** `savedCameraStates.size === 0`
**解决方案：** 在 `handleTrackingUpdate` 中检查并延迟保存

### 3. 验证解决方案

打开浏览器控制台，按顺序执行：

1. **选择 Instrument Projection 模式**
2. **查看日志** - 确认：
   - `Found X viewports on mode enter` (X > 0)
   - `Saved camera states for X viewports` (X >= 3)
3. **点击 Start Navigation**
4. **查看日志** - 确认：
   - `Navigation mode: instrument-projection`
   - `Mode successfully set to: instrument-projection`
5. **观察第一次跟踪更新** - 确认：
   - `🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED`
   - 相机不移动
   - 可以看到投影线（红色）

### 4. 如果仍然失败

尝试以下诊断命令（在控制台中）：

```javascript
// 检查当前模式
window.__navigationController?.getNavigationMode()

// 检查保存的相机状态数量
// (需要先进入 Instrument Projection 模式)

// 强制重新进入 Instrument Projection 模式
window.__navigationController?.setNavigationMode('instrument-projection', false, true)

// 检查视口数量
const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine')
const viewports = renderingEngine?.getViewports() || []
console.log('Viewports:', viewports.length)
viewports.forEach(vp => {
  console.log(`  ${vp.id}: type=${vp.type}`)
})
```

## 预期行为

### Instrument Projection 模式：
- ✅ 相机位置固定不动
- ✅ 可以看到红色投影线（工具的 Z 轴）
- ✅ 投影线随工具姿态变化
- ✅ 投影线起点有蓝色圆点（工具原点）
- ✅ 投影线终点有箭头

### Camera Following 模式：
- ✅ 相机跟随工具移动
- ✅ 无投影线
- ✅ 工具始终保持在视野中心

## 代码修复总结

已实施的修复：

1. **onModeEnter** 中检查视口数量，如果为 0 则延迟保存
2. **handleTrackingUpdate** 中检查 `savedCameraStates.size`，如果为 0 则立即保存
3. **setNavigationMode** 添加 `force` 参数，允许强制重新进入同一模式
4. **startNavigation** 使用 `force=true` 确保模式正确设置
5. **_saveCameraStates** 不清空现有状态，渐进式保存
6. **_restoreCameraStates** 每次更新都恢复相机状态，彻底锁定

## 相关文件

- `InstrumentProjectionMode.ts` - 投影模式实现
- `navigationController.ts` - 模式管理器
- `commandsModule.ts` - 启动导航命令
- `TrackingPanel.tsx` - UI 控制面板
