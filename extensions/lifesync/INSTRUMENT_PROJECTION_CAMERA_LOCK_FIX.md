# 🔍 Instrument Projection Mode "回退"问题的根本原因

## 问题诊断结果

### 确认的状态（从用户的控制台输出）：
```
1. NavigationController 存在: true ✅
2. 当前模式: instrument-projection ✅
3. localStorage 中保存的模式: instrument-projection ✅
4. 可用模式: ['camera-follow', 'instrument-projection'] ✅
```

**结论：模式切换成功，没有"回退"到 camera-follow**

## 问题的真正原因

用户描述的"回退到 camera 模式"实际上是指：
- **模式名称**是 `instrument-projection` ✅
- **但行为**像 `camera-follow`（相机仍在移动）❌

这不是模式切换问题，而是 **InstrumentProjectionMode 的相机锁定机制失败了**。

## 发现的Bug 🐛

### Bug #1：`viewport.setCamera()` 参数错误

**位置：** `InstrumentProjectionMode.ts` 第 246-250 行

**错误代码：**
```typescript
vp.setCamera({
  focalPoint: savedState.focalPoint,
  position: savedState.position,
  viewUp: savedState.viewUp,
}, false); // ❌ 错误！setCamera 不接受第二个参数
```

**问题：**
- Cornerstone3D 的 `viewport.setCamera()` 只接受一个参数（camera object）
- 传入第二个参数 `false` 会导致调用失败
- 相机状态恢复失败 → 相机继续移动

**修复：**
```typescript
vp.setCamera({
  focalPoint: savedState.focalPoint,
  position: savedState.position,
  viewUp: savedState.viewUp,
}); // ✅ 正确
```

### Bug #2：可能的相机状态未保存

如果 `savedCameraStates.size === 0`，相机锁定不会生效。

**检查方法：**
在浏览器控制台执行：
```javascript
const mode = window.__navigationController?.currentMode;
console.log('相机状态数量:', mode?.savedCameraStates?.size);
mode?.savedCameraStates?.forEach((state, id) => {
  console.log(`  ${id}:`, state.focalPoint);
});
```

**预期输出：**
```
相机状态数量: 3
  mpr-axial-viewport: [0, 0, 0]
  mpr-sagittal-viewport: [0, 0, 0]
  mpr-coronal-viewport: [0, 0, 0]
```

**如果输出 `相机状态数量: 0`：**
- 说明相机状态保存失败
- 相机无法被锁定
- 需要进一步调试

## 修复内容

### 修复 1：移除无效的第二个参数 ✅

**文件：** `InstrumentProjectionMode.ts`

**更改：**
- 移除 `vp.setCamera({...}, false)` 中的 `false` 参数
- 只在相机移动时才恢复（优化性能）
- 增强日志输出，显示相机移动距离

**修复后的代码：**
```typescript
private _restoreCameraStates(): void {
  if (this.savedCameraStates.size === 0) {
    if (this.updateCount <= 5) {
      console.warn('⚠️ [Instrument Projection] No saved camera states yet');
    }
    return;
  }

  const viewports = this.getViewports();

  viewports.forEach(vp => {
    if (!vp || vp.type === 'stack') {
      return;
    }

    const savedState = this.savedCameraStates.get(vp.id);
    if (!savedState) {
      // Late-arriving viewport - save its state now
      try {
        const camera = vp.getCamera();
        this.savedCameraStates.set(vp.id, {
          focalPoint: [...camera.focalPoint],
          position: [...camera.position],
          viewUp: [...camera.viewUp],
        });
        if (this.updateCount <= 5) {
          console.log(`📸 [Instrument Projection] Saved camera state for ${vp.id} (late)`);
        }
      } catch (error) {
        // Ignore
      }
      return;
    }

    try {
      const camera = vp.getCamera();

      // Check if camera has moved from saved state
      const focalPointDiff = Math.sqrt(
        Math.pow(camera.focalPoint[0] - savedState.focalPoint[0], 2) +
        Math.pow(camera.focalPoint[1] - savedState.focalPoint[1], 2) +
        Math.pow(camera.focalPoint[2] - savedState.focalPoint[2], 2)
      );

      // Only restore if camera has moved (to avoid unnecessary updates)
      if (focalPointDiff > 0.01) {
        // CRITICAL: Restore camera to saved state to keep it fixed
        vp.setCamera({
          focalPoint: savedState.focalPoint,
          position: savedState.position,
          viewUp: savedState.viewUp,
        });

        // DO NOT call vp.render() here - it will be called automatically

        if (this.updateCount <= 10 || this.updateCount % 100 === 0) {
          console.warn(`⚠️ [Instrument Projection] Camera moved by ${focalPointDiff.toFixed(2)}mm on ${vp.id}, restored to fixed position`);
        }
      }
    } catch (error) {
      if (this.updateCount <= 5) {
        console.warn(`⚠️ [Instrument Projection] Error restoring camera for ${vp.id}:`, error);
      }
    }
  });
}
```

## 验证修复

### 步骤 1：重新加载应用
刷新浏览器页面以加载修复后的代码。

### 步骤 2：选择 Instrument Projection 模式
在 UI 中选择 🎯 Instrument Projection

### 步骤 3：启动导航
点击 "Start Navigation"

### 步骤 4：观察日志
应该看到：
```
🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED
   This confirms Instrument Projection mode is active!
   Cameras will remain FIXED - only projection updates
📸 [Instrument Projection] Saving camera states on first tracking update...
📸 Saved camera state for mpr-axial-viewport: {...}
📸 Saved camera state for mpr-sagittal-viewport: {...}
📸 Saved camera state for mpr-coronal-viewport: {...}
   ✅ Saved camera states for 3 viewports
📍 [Instrument Projection] Initial position: [x, y, z]
   ✅ Cameras are fixed - only projection will update
```

### 步骤 5：检查相机是否移动
- ✅ **预期：** 相机完全静止，视图不变
- ✅ **预期：** 可以看到红色投影线随工具姿态变化
- ❌ **不应该：** 相机跟随工具移动

### 步骤 6：如果看到相机移动警告
控制台应该显示：
```
⚠️ [Instrument Projection] Camera moved by X.XXmm on mpr-axial-viewport, restored to fixed position
```

这表示：
- ✅ 检测到相机移动
- ✅ 立即恢复到固定位置
- ✅ 相机锁定机制正常工作

## 如果问题仍然存在

### 诊断命令 1：检查相机状态
```javascript
const mode = window.__navigationController?.currentMode;
console.log('=== 相机状态诊断 ===');
console.log('1. 模式名称:', mode?.getModeName?.());
console.log('2. 保存的相机状态数量:', mode?.savedCameraStates?.size);
console.log('3. 更新计数:', mode?.updateCount);

if (mode?.savedCameraStates) {
  mode.savedCameraStates.forEach((state, vpId) => {
    console.log(`4. ${vpId}:`, {
      focalPoint: state.focalPoint,
      position: state.position
    });
  });
}
console.log('===================');
```

### 诊断命令 2：手动恢复相机
```javascript
const mode = window.__navigationController?.currentMode;
if (mode && mode._restoreCameraStates) {
  mode._restoreCameraStates();
  console.log('✅ 手动调用相机恢复');
}
```

### 诊断命令 3：检查 ToolProjectionRenderer
```javascript
const mode = window.__navigationController?.currentMode;
console.log('=== 投影渲染器诊断 ===');
console.log('1. ToolProjectionRenderer 存在:', !!mode?.toolProjectionRenderer);
console.log('2. SVG 覆盖层数量:', mode?.toolProjectionRenderer?.projectionSVGElements?.size);

// 检查 DOM 中的 SVG
const svgs = document.querySelectorAll('.tool-projection-overlay');
console.log('3. DOM 中的 SVG 数量:', svgs.length);
svgs.forEach((svg, i) => {
  console.log(`   SVG ${i}: children=${svg.children.length}`);
});
console.log('========================');
```

## 总结

**原因：**
- `vp.setCamera({...}, false)` 参数错误导致相机恢复失败
- 相机继续移动，表现得像 camera-follow 模式

**修复：**
- 移除无效的第二个参数
- 优化：只在相机移动时才恢复
- 增强日志以便调试

**验证：**
- 重新加载应用
- 选择 Instrument Projection 模式
- 观察相机是否静止
- 检查是否看到投影线

**如果仍有问题：**
- 执行诊断命令
- 提供完整的控制台日志
- 检查是否看到 "Camera moved by X.XXmm, restored" 警告
