# 🎯 Instrument Projection Mode - 动态投影规格

## 新规格 (Updated Specification)

### 核心特性

**相机行为：**
- ✅ **相机自由** - 用户可以平移、缩放、旋转视口
- ✅ **不锁定相机** - 移除所有相机状态保存和恢复逻辑
- ✅ **完全交互** - 保持 OHIF Viewer 的所有视口操作功能

**投影行为：**
- ✅ **动态投影** - 投影根据工具 3D 坐标和当前视口状态实时更新
- ✅ **自动适应** - 无论相机如何移动，投影始终正确显示
- ✅ **实时渲染** - 使用 `viewport.worldToCanvas()` 进行 3D→2D 转换

### 工作原理

#### 1. 投影计算流程

```
工具 3D 坐标 (World Space)
    ↓
viewport.worldToCanvas() ← 使用当前相机状态
    ↓
2D 画布坐标 (Canvas/Screen Space)
    ↓
SVG 渲染 (Overlay)
```

#### 2. 关键组件

**InstrumentProjectionMode:**
- 不保存相机状态
- 不恢复相机位置
- 每次跟踪更新时调用 `ToolProjectionRenderer.updateProjection()`

**ToolProjectionRenderer:**
- 获取当前视口列表
- 对每个视口：
  1. 计算工具原点 (origin) 和终点 (tip) 的 3D 坐标
  2. 使用 `viewport.worldToCanvas()` 转换为 2D
  3. 在 SVG overlay 上绘制投影线
- 每次调用都使用**当前**相机状态进行投影

#### 3. 动态更新机制

```typescript
// 每次跟踪更新 (20 Hz)
handleTrackingUpdate(position, orientation, matrix) {
  // 提取工具表示（3D 世界坐标）
  const toolRep = {
    origin: [x, y, z],           // 工具原点
    zAxis: [dx, dy, dz],         // Z 轴方向（归一化）
    extensionLength: 100         // 延长线长度 (mm)
  };
  
  // 更新投影 - ToolProjectionRenderer 会：
  // 1. 获取当前所有视口
  // 2. 对每个视口使用**当前相机状态**进行投影
  // 3. 更新 SVG overlay
  toolProjectionRenderer.updateProjection(toolRep);
}
```

**关键：** 每次更新都重新调用 `viewport.worldToCanvas()`，确保投影使用最新的相机状态。

#### 4. 用户交互场景

**场景 A：用户平移视口**
```
1. 用户拖动视口 → 相机 focalPoint 改变
2. 下一次跟踪更新触发
3. worldToCanvas() 使用新的 focalPoint 计算
4. 投影位置自动更新到正确位置
```

**场景 B：用户缩放视口**
```
1. 用户滚轮缩放 → 相机 parallelScale 改变
2. 下一次跟踪更新触发
3. worldToCanvas() 使用新的 scale 计算
4. 投影大小自动调整
```

**场景 C：用户旋转视口**
```
1. 用户旋转视口 → 相机 viewUp 改变
2. 下一次跟踪更新触发
3. worldToCanvas() 使用新的 viewUp 计算
4. 投影角度自动更新
```

### 实现细节

#### 移除的代码
```typescript
// ❌ 已移除 - 不再需要
private savedCameraStates: Map<string, any>;
private _saveCameraStates(): void { ... }
private _restoreCameraStates(): void { ... }
```

#### 保留的代码
```typescript
// ✅ 保留 - 核心投影逻辑
private toolProjectionRenderer: ToolProjectionRenderer;

handleTrackingUpdate(position, orientation, matrix) {
  const toolRep = this._extractToolRepresentation(position, matrix);
  this.toolProjectionRenderer.updateProjection(toolRep);
  // 不操作相机 - 让用户自由控制
}
```

#### ToolProjectionRenderer 实现
```typescript
updateProjection(toolRep: ToolRepresentation): void {
  const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
  const viewports = renderingEngine.getViewports();
  
  viewports.forEach(viewport => {
    // 计算 3D 终点
    const tipPointWorld = vec3.create();
    vec3.scaleAndAdd(
      tipPointWorld,
      vec3.fromValues(...toolRep.origin),
      vec3.fromValues(...toolRep.zAxis),
      toolRep.extensionLength
    );
    
    // 🔑 关键：使用当前相机状态进行投影
    const originCanvas = viewport.worldToCanvas(toolRep.origin);
    const tipCanvas = viewport.worldToCanvas(tipPointWorld);
    
    // 渲染 SVG
    this._drawProjectionLine(svg, originCanvas, tipCanvas);
    this._drawOriginCircle(svg, originCanvas);
    this._drawArrowhead(svg, originCanvas, tipCanvas);
  });
}
```

### 性能考虑

**更新频率：**
- 跟踪数据：100 Hz 输入
- UI 渲染：20 Hz 节流
- 投影计算：每次渲染时执行

**计算成本：**
- `worldToCanvas()`: O(1) 矩阵变换
- SVG 更新: DOM 操作，浏览器优化
- 总体开销：可忽略（<1ms per viewport）

### 对比：两种模式

| 特性 | Camera Following | Instrument Projection |
|------|------------------|----------------------|
| 相机控制 | 自动跟随工具 | 用户自由控制 ✅ |
| 视口操作 | 受限（自动移动） | 完全交互 ✅ |
| 工具可视化 | 保持在中心 | SVG 投影线 |
| 用户体验 | 被动观察 | 主动探索 ✅ |
| 适用场景 | 自动导航 | 手动规划/检查 |

### 测试验证

#### 测试步骤 1：基本投影
1. 选择 Instrument Projection 模式
2. 启动导航
3. **预期：** 看到红色投影线，蓝色原点标记

#### 测试步骤 2：平移视口
1. 在 Instrument Projection 模式下
2. 使用鼠标中键平移视口
3. **预期：** 投影线跟随视口移动，保持在正确的 3D 位置

#### 测试步骤 3：缩放视口
1. 在 Instrument Projection 模式下
2. 使用滚轮缩放视口
3. **预期：** 投影线大小随缩放调整，但 3D 位置不变

#### 测试步骤 4：旋转工具
1. 在 Instrument Projection 模式下
2. 移动/旋转工具
3. **预期：** 投影线方向和位置实时更新

#### 测试步骤 5：多视口
1. 查看 Axial, Sagittal, Coronal 三个视口
2. **预期：** 每个视口显示正确的投影（不同角度）

### 调试日志

**预期日志（模式激活）：**
```
🎯🎯🎯 Instrument Projection mode activated
   Extension length: 100mm (10cm)
   📹 Camera is FREE - user can pan/zoom/rotate viewports
   📐 Projection will dynamically update based on viewport state
   🔍 Found 3 viewports on mode enter
   🎯 Instrument Projection mode is now active and ready
```

**预期日志（跟踪更新）：**
```
🎯🎯🎯 [Instrument Projection Mode] HANDLE TRACKING UPDATE CALLED
   This confirms Instrument Projection mode is active!
   📹 Camera is FREE - projection updates dynamically with viewport changes
📍 [Instrument Projection] Initial position: [x, y, z]
   📐 Projection will update based on tool position and viewport state
```

**预期日志（周期性）：**
```
🎯 [Instrument Projection] Mode active
   Tool position: [x, y, z]
   Z-axis: [dx, dy, dz]
   Update count: 100
   📐 Dynamic projection based on viewport state
```

### 总结

**关键改进：**
1. ❌ 移除相机锁定 → ✅ 相机自由
2. ✅ 保持动态投影 → 自动适应视口变化
3. ✅ 更好的用户体验 → 完全交互式

**实现原理：**
- 基于 `viewport.worldToCanvas()` 的实时 3D→2D 投影
- 每次更新使用**当前**相机状态
- SVG overlay 独立于相机状态

**适用场景：**
- 术前规划：自由查看不同角度
- 术中导航：在固定视图中观察工具投影
- 多工具跟踪：同时显示多个投影（未来扩展）

