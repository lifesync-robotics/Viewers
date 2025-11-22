# 🔍 Instrument Projection Mode 问题诊断

## 用户报告
```
The problem still exist.
✅ Mode can be changed during navigation
Current: camera-follow ✓
```

## 问题分析

### 用户看到的状态：
- UI 显示：`Current: camera-follow ✓`
- 这意味着 `actualNavigationMode === 'camera-follow'`
- checkmark (✓) 表示 `actualNavigationMode === navigationMode`
- 所以用户选择的是 camera-follow 模式，而不是 instrument-projection

### 可能的情况：

#### 情况 1：用户实际上选的是 camera-follow（最可能）
- UI 单选按钮选中的是 "📹 Camera Follow"
- 系统行为正常 - 相机跟随工具移动
- 用户期望看到的是 instrument-projection 模式

#### 情况 2：模式切换失败
- 用户点击了 "🎯 Instrument Projection"
- 但模式没有切换成功
- `actualNavigationMode` 仍然是 'camera-follow'

#### 情况 3：模式被覆盖
- 用户切换到 instrument-projection
- 但在某个地方被重置回 camera-follow

## 需要确认的问题

1. **用户当前选择的模式是什么？**
   - 请确认 UI 中哪个单选按钮被选中
   - 📹 Camera Follow 还是 🎯 Instrument Projection？

2. **用户期望看到什么行为？**
   - 如果选择 Camera Follow：相机应该跟随工具移动 ✅（当前行为）
   - 如果选择 Instrument Projection：相机应该固定，只显示投影线

3. **用户是否看到控制台日志？**
   - 点击 Instrument Projection 时应该看到：
     ```
     🔄 [TrackingPanel] Setting navigation mode to: instrument-projection
     🔄 Switching navigation mode: camera-follow → instrument-projection
     🎯🎯🎯 Instrument Projection mode activated
     ```

4. **第一次跟踪更新时的日志？**
   - 应该看到：
     ```
     🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED
     ```
   - 还是：
     ```
     📹 Camera Follow mode active
     ```

## 诊断步骤

### 步骤 1：验证当前模式
在浏览器控制台执行：
```javascript
window.__navigationController?.getNavigationMode()
// 应该返回: "camera-follow" 或 "instrument-projection"
```

### 步骤 2：手动切换到 Instrument Projection
在浏览器控制台执行：
```javascript
window.__navigationController?.setNavigationMode('instrument-projection', false, true)
// 观察控制台日志
```

### 步骤 3：验证模式是否生效
观察：
1. 相机是否停止移动？
2. 是否看到红色投影线？
3. 控制台是否显示 `🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED`？

### 步骤 4：检查 localStorage
在浏览器控制台执行：
```javascript
localStorage.getItem('lifesync_navigation_mode')
// 应该返回: "camera-follow" 或 "instrument-projection"
```

## 可能的解决方案

### 如果模式切换成功但行为不对：

#### 问题：相机状态未保存
**检查：**
```javascript
// 在控制台中，当 Instrument Projection 模式激活后
// 应该看到日志中有 "Saved camera states for X viewports"
```

**修复：** 已实施后备机制，在第一次跟踪更新时保存

#### 问题：投影线未显示
**检查：**
- DOM 中是否有 `.tool-projection-overlay` 元素？
- SVG overlay 是否正确创建？

### 如果模式切换失败：

#### 问题：NavigationController 未初始化
**检查：**
```javascript
window.__navigationController
// 应该返回对象，而不是 undefined
```

**修复：** 已在 TrackingPanel 的 useEffect 中提前初始化

#### 问题：模式实例未创建
**检查：**
```javascript
window.__navigationController?._initializeModes()
// 内部应该创建 'camera-follow' 和 'instrument-projection' 实例
```

## 下一步行动

请提供以下信息：

1. **UI 截图** - 显示哪个单选按钮被选中
2. **控制台完整日志** - 从点击 Instrument Projection 到第一次跟踪更新
3. **浏览器控制台命令输出：**
   ```javascript
   window.__navigationController?.getNavigationMode()
   localStorage.getItem('lifesync_navigation_mode')
   ```

这将帮助我精确定位问题所在。
