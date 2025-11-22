# 🐛 投影不显示的紧急修复

## 问题
用户报告："I can't see the instrument projection now"

## 根本原因

在修复投影数学时，我更改了箭头标记的 ID 格式：

**之前：**
```typescript
line.setAttribute('marker-end', `url(#arrowhead-${viewportId})`);
// 创建 marker ID: `arrowhead-${viewportId}`
```

**修复后：**
```typescript
// 创建两种 marker ID:
// - `arrowhead-solid-${viewportId}` (实线)
// - `arrowhead-dashed-${viewportId}` (虚线)

// 但线条仍使用旧 ID:
line.setAttribute('marker-end', `url(#arrowhead-${viewportId})`); // ❌ 找不到！
```

**结果：** 箭头标记未找到 → SVG 线条可能未正确渲染 → 投影不显示

## 可能的其他原因

### 1. 严格的相交算法
新的算法更严格：
- 平行阈值：`|denominator| < 0.001`
- 距离阈值：`1mm` (平行时), `5mm` (交点外时)

**可能情况：** 工具位置不满足任何显示条件 → 被清除

### 2. 错误处理
```typescript
} catch (error) {
  console.warn(`⚠️ Error rendering projection on ${viewport.id}:`, error);
  this._clearViewportProjection(viewport.id); // 清除投影
}
```

如果有任何错误 → 投影被清除

## 修复

### 修复 1：箭头标记 ID 匹配 ✅
```typescript
if (isDashed) {
  line.setAttribute('marker-end', `url(#arrowhead-dashed-${viewportId})`);
} else {
  line.setAttribute('marker-end', `url(#arrowhead-solid-${viewportId})`);
}
```

### 临时回退选项
如果问题仍然存在，可以暂时回退到简单投影：
```typescript
// 临时：使用简单 worldToCanvas 投影
const originCanvas = viewport.worldToCanvas(origin);
const tipCanvas = viewport.worldToCanvas(tipPoint);
this._drawProjectionLine(svgElement, viewport.id, originCanvas, tipCanvas, false);
```

## 调试步骤

### 步骤 1：检查控制台错误
```javascript
// 打开浏览器控制台，查找：
⚠️ Error rendering projection on mpr-axial-viewport: ...
```

### 步骤 2：检查 SVG 元素
```javascript
// 在控制台执行：
document.querySelectorAll('.tool-projection-overlay').forEach(svg => {
  console.log('SVG:', svg);
  console.log('Children:', svg.children.length);
  console.log('Lines:', svg.querySelectorAll('line').length);
});
```

### 步骤 3：检查工具位置
```javascript
// 在 handleTrackingUpdate 中添加日志
console.log('Tool position:', position);
console.log('Tool Z-axis:', toolRepresentation.zAxis);
console.log('Extension length:', toolRepresentation.extensionLength);
```

### 步骤 4：检查平面相交
```javascript
// 在 _renderProjectionOnViewport 中添加临时日志
console.log('Viewport:', viewport.id);
console.log('Plane normal:', planeNormal);
console.log('Denominator:', denominator);
console.log('t:', t);
console.log('Tool length:', toolLength);
```

## 预期修复后的行为

### 如果工具穿过平面
- ✅ 绿色实线
- ✅ 红色十字在交点
- ✅ 蓝色圆点在原点
- ✅ 绿色箭头

### 如果工具平行于平面（接近）
- ✅ 橙色虚线
- ✅ 蓝色圆点在原点
- ✅ 橙色箭头

### 如果工具远离平面
- ✅ 不显示（正常）

## 如果修复仍然无效

可能需要完全回退到之前的简单版本：

```typescript
// 回退到简单投影（临时）
private _renderProjectionOnViewport(
  viewport: any,
  origin: number[],
  tipPoint: number[],
  zAxis: number[]
): void {
  try {
    // 简单投影 - 总是显示
    const originCanvas = viewport.worldToCanvas(origin as [number, number, number]);
    const tipCanvas = viewport.worldToCanvas(tipPoint as [number, number, number]);

    if (!this._isValidCanvasPoint(originCanvas) || !this._isValidCanvasPoint(tipCanvas)) {
      this._clearViewportProjection(viewport.id);
      return;
    }

    const svgElement = this._getOrCreateSVGOverlay(viewport);
    this._drawProjectionLine(svgElement, viewport.id, originCanvas, tipCanvas, false);
    this._drawOriginCircle(svgElement, viewport.id, originCanvas);

  } catch (error) {
    console.warn(`⚠️ Error rendering projection on ${viewport.id}:`, error);
  }
}
```

## 下一步

1. ✅ 修复箭头标记 ID - 已实施
2. ⏳ 测试是否恢复显示
3. ⏳ 如果仍无效 - 添加详细日志
4. ⏳ 如需要 - 提供回退补丁
