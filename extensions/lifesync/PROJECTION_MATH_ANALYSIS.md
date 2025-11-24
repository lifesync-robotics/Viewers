# 🔍 工具投影数学验证

## 问题分析

用户提出了两个关键问题：
1. **不应在 3D viewport 上绘制投影** - 投影只对 2D 平面（MPR）有意义
2. **投影数学可能有问题** - 需要验证 3 个 MPR 平面上的投影正确性

## 问题 1：3D Viewport 过滤 ✅

### 当前问题
```typescript
if (viewport.type === 'stack') {
  return; // 只跳过 stack，但 3D viewport 也会被渲染！
}
```

### 视口类型
Cornerstone3D 有以下视口类型：
- `STACK`: 2D 图像栈（CT slices 等）
- `ORTHOGRAPHIC`: MPR 视图（Axial, Sagittal, Coronal）✅ 需要投影
- `VOLUME_3D`: 3D 渲染视图 ❌ 不需要投影

### 修复
```typescript
// Skip non-MPR viewports
if (viewport.type === 'stack') {
  return; // Skip stack viewports
}

// Check if this is a 3D viewport
const viewportClassName = viewport.constructor.name;
if (viewportClassName === 'VolumeViewport3D') {
  return; // Skip 3D viewports
}
```

## 问题 2：投影数学验证 🔍

### 当前实现
```typescript
// 简单地投影 3D 点到 2D
const originCanvas = viewport.worldToCanvas(origin);
const tipCanvas = viewport.worldToCanvas(toolTip);
// 画线连接两点
```

### 数学问题分析

**问题：这种方法在某些情况下不正确**

#### 场景 A：工具 Z 轴平行于视图平面
```
视图平面 (Axial - 俯视图)
─────────────────────────
         ↑
         │ 工具 Z 轴（垂直向上）
         │
         ● 工具原点
```
- `origin` 和 `tip` 都投影到平面上的**同一点**
- 画出的线长度为 0 ❌
- **预期：** 应该显示为点或圆，表示工具垂直于平面

#### 场景 B：工具部分在视图平面之外
```
         ● tip (在平面上方)
        /
       /
      /
─────●───────── 视图平面 (MPR slice)
    origin
```
- `worldToCanvas()` 可能返回 null 或无效值
- 需要处理点在平面外的情况

#### 场景 C：工具与平面成角度
```
             ● tip
            /
           /
          /
─────────●──────── 视图平面
       origin
```
- 这种情况 `worldToCanvas()` 可以工作
- 但投影的是 3D 线段的端点，不是真正的"投影"

### 正确的投影数学

#### MPR 平面定义
每个 MPR 视图都有：
- **平面法向量** `n` (viewPlaneNormal)
- **平面上的一点** (通常是 focalPoint)

**Axial (轴位):**
- 法向量: `n = [0, 0, 1]` (垂直向上/向下)
- 观察方向: 从上往下看（或从下往上）

**Sagittal (矢状):**
- 法向量: `n = [1, 0, 0]` (左右方向)
- 观察方向: 从侧面看

**Coronal (冠状):**
- 法向量: `n = [0, 1, 0]` (前后方向)
- 观察方向: 从前面或后面看

#### 正确的投影方法

**方法 1：检查工具是否与平面相交**
```typescript
// 1. 获取平面方程: n · (P - P0) = 0
const camera = viewport.getCamera();
const planeNormal = camera.viewPlaneNormal; // n
const planePoint = camera.focalPoint;       // P0

// 2. 计算工具线段与平面的交点
// 线段: P = origin + t * zAxis, t ∈ [0, extensionLength]
// 平面: n · (P - P0) = 0
//
// n · (origin + t * zAxis - P0) = 0
// n · (origin - P0) + t * (n · zAxis) = 0
// t = -[n · (origin - P0)] / (n · zAxis)

const originToPlane = vec3.subtract(vec3.create(), origin, planePoint);
const numerator = -vec3.dot(planeNormal, originToPlane);
const denominator = vec3.dot(planeNormal, zAxis);

if (Math.abs(denominator) < 0.001) {
  // 工具平行于平面
  // 检查原点是否在平面上
  if (Math.abs(numerator) < 1.0) {
    // 原点在平面上，显示为点
    const originCanvas = viewport.worldToCanvas(origin);
    drawPoint(originCanvas);
  } else {
    // 工具完全在平面外，不显示
    return;
  }
} else {
  const t = numerator / denominator;

  if (t < 0 || t > extensionLength) {
    // 交点在工具延长线之外
    // 可以选择：
    // A) 不显示（工具不穿过此平面）
    // B) 显示原点或端点（如果在平面附近）
    return;
  }

  // 计算交点
  const intersectionPoint = vec3.scaleAndAdd(
    vec3.create(),
    origin,
    zAxis,
    t
  );

  // 投影到 2D
  const intersectionCanvas = viewport.worldToCanvas(intersectionPoint);

  // 绘制：原点到交点的投影
  const originCanvas = viewport.worldToCanvas(origin);
  drawLine(originCanvas, intersectionCanvas);
}
```

**方法 2：投影整条线到平面**
```typescript
// 将 3D 线段投影到 2D 平面
// 投影公式: P_proj = P - (n · P) * n

function projectPointToPlane(point, planeNormal, planePoint) {
  const pointToPlane = vec3.subtract(vec3.create(), point, planePoint);
  const distance = vec3.dot(pointToPlane, planeNormal);
  const projected = vec3.scaleAndAdd(
    vec3.create(),
    point,
    planeNormal,
    -distance
  );
  return projected;
}

// 投影原点和端点
const originProjected = projectPointToPlane(origin, planeNormal, planePoint);
const tipProjected = projectPointToPlane(tip, planeNormal, planePoint);

// 转换为 2D 画布坐标
const originCanvas = viewport.worldToCanvas(originProjected);
const tipCanvas = viewport.worldToCanvas(tipProjected);

// 绘制投影线
drawLine(originCanvas, tipCanvas);
```

### 推荐方案

**混合方法：**
1. **首先检查工具与平面的关系**
   - 计算原点到平面的距离
   - 计算端点到平面的距离

2. **根据情况选择渲染方式**
   - 如果工具穿过平面 → 计算交点并绘制
   - 如果工具平行于平面且接近 → 投影整条线
   - 如果工具远离平面 → 不显示或显示为虚线

3. **添加视觉提示**
   - 实线：工具穿过平面
   - 虚线：工具投影（不在平面上）
   - 圆点：工具垂直于平面

### 当前实现的局限性

**`viewport.worldToCanvas()` 的行为：**
- 它将 3D 点投影到 2D 视图
- 但不考虑点是否在 MPR slice 平面上
- 可能产生误导性的可视化

**示例问题：**
```
实际情况：工具在 Axial 平面上方 5cm
worldToCanvas() 显示：工具看起来在平面上

用户误解：工具已经到达目标位置
实际情况：工具还差 5cm
```

### 需要实现的功能

1. ✅ 过滤 3D 视口
2. ⚠️ 计算工具-平面相交
3. ⚠️ 正确的平面投影数学
4. ⚠️ 视觉区分（实线 vs 虚线 vs 点）
5. ⚠️ 显示深度信息（距离平面多远）

## 下一步行动

### 立即修复（Phase 1）
1. ✅ 过滤 3D 视口 - 已实现
2. 添加平面相交计算
3. 区分"穿过平面"vs"投影到平面"

### 未来增强（Phase 2）
1. 显示深度指示器（+5mm / -5mm）
2. 虚线表示投影（不在平面上）
3. 颜色编码（绿色=在平面上，黄色=接近，灰色=远离）
4. 交互式深度调整

## 测试场景

### 测试 1：工具垂直于 Axial 平面
- 旋转工具使其 Z 轴垂直向上
- **预期 Axial:** 看到点，不是线
- **预期 Sagittal/Coronal:** 看到线

### 测试 2：工具穿过所有平面
- 工具倾斜 45 度
- **预期:** 所有三个视图都显示交点

### 测试 3：工具平行于平面
- 工具平行于 Axial 平面但在上方
- **预期 Axial:** 显示投影（虚线）或不显示
- **预期 Sagittal/Coronal:** 显示工具

### 测试 4：工具远离平面
- 工具在 Axial 平面下方 10cm
- **预期 Axial:** 不显示或显示为浅灰色投影
- **预期:** 添加深度标签 "-100mm"
