# 🔧 投影渲染错误的快速回退方案

如果错误仍然持续，使用此简单版本替换 `_renderProjectionOnViewport` 方法：

```typescript
/**
 * SIMPLE FALLBACK VERSION - Always shows projection without complex math
 */
private _renderProjectionOnViewport(
  viewport: any,
  origin: number[],
  tipPoint: number[],
  zAxis: number[]
): void {
  try {
    // Simple projection - just draw the line, no plane intersection math
    const originCanvas = viewport.worldToCanvas(origin as [number, number, number]);
    const tipCanvas = viewport.worldToCanvas(tipPoint as [number, number, number]);

    if (!this._isValidCanvasPoint(originCanvas) || !this._isValidCanvasPoint(tipCanvas)) {
      this._clearViewportProjection(viewport.id);
      return;
    }

    const svgElement = this._getOrCreateSVGOverlay(viewport);
    if (!svgElement) {
      console.warn(`⚠️ Could not create SVG overlay for ${viewport.id}`);
      return;
    }

    // Draw simple green line (no complex intersection logic)
    this._drawProjectionLine(svgElement, viewport.id, originCanvas, tipCanvas, false);
    this._drawOriginCircle(svgElement, viewport.id, originCanvas);

  } catch (error) {
    console.error(`❌ Error in simple projection for ${viewport.id}:`, error);
    console.error('Stack:', error.stack);
  }
}
```

## 使用说明

1. 打开 `ToolProjectionRenderer.ts`
2. 找到 `_renderProjectionOnViewport` 方法（约第 89-218 行）
3. 用上面的简单版本替换整个方法
4. 保存并刷新浏览器

这个简单版本：
- ✅ 没有复杂的平面相交数学
- ✅ 总是显示投影（如果点有效）
- ✅ 更少出错机会
- ❌ 不区分"穿过平面" vs "投影"
- ❌ 可能在某些角度显示不准确

但至少能看到投影！

