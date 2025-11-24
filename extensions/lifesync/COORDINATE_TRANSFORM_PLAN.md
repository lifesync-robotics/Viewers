# 🧭 坐标转换增强计划：rMd 矩阵自动构建

## 📋 背景

### 当前状态
- ✅ `CoordinateTransformer` 类已存在
- ✅ 支持 4x4 rMd 矩阵（Register → DICOM）
- ✅ 支持逆矩阵 inv(rMd)（DICOM → Register）
- ⚠️ **问题**：rMd 矩阵需要手动从 `case.json` 加载

### 目标
**从 DICOM 元数据自动构建 rMd 矩阵**，无需手动配置。

---

## 🎯 需求分析

### rMd 矩阵组成

```
rMd = [ R | T ]    4x4 矩阵
      [ 0 | 1 ]

其中:
- R (3x3): 旋转矩阵 (当前应为单位矩阵 I)
- T (3x1): 平移向量 (DICOM ImagePositionPatient)
```

### 当前假设
1. **旋转部分 = 单位矩阵**（Register 和 DICOM 坐标系方向一致）
2. **平移部分 = ImagePositionPatient**（DICOM 图像原点位置）

### 数学表达式

```
rMd = [ 1  0  0  Tx ]
      [ 0  1  0  Ty ]
      [ 0  0  1  Tz ]
      [ 0  0  0  1  ]

其中 [Tx, Ty, Tz] = ImagePositionPatient (0020,0032)
```

---

## 🏗️ 架构设计

### 方案 1：在 `CoordinateTransformer` 中增加自动构建功能 ✅ **推荐**

**优点**:
- 单一职责：`CoordinateTransformer` 负责所有坐标转换
- 向后兼容：保留手动 `loadTransform()` 方法
- 灵活性：支持自动和手动两种模式

**实现**:

```typescript
// CoordinateTransformer.ts

/**
 * 从 DICOM 元数据自动构建 rMd 矩阵
 * 假设：Register 和 DICOM 坐标系方向一致（旋转 = 单位矩阵）
 *
 * @param imagePositionPatient - DICOM 标签 (0020,0032)
 * @returns 4x4 rMd 矩阵
 */
public buildRMdFromDICOM(imagePositionPatient: [number, number, number]): void {
  const [tx, ty, tz] = imagePositionPatient;

  // 构建 rMd 矩阵：旋转 = I，平移 = ImagePositionPatient
  this.rMd = [
    [1, 0, 0, tx],
    [0, 1, 0, ty],
    [0, 0, 1, tz],
    [0, 0, 0, 1]
  ];

  this.invRMd = this._invertMatrix4x4(this.rMd);
  this.isIdentity = this._isIdentityMatrix(this.rMd);

  console.log('🔄 rMd matrix auto-built from DICOM ImagePositionPatient:', imagePositionPatient);
  console.log('   rMd (register → DICOM):', this.rMd);
  console.log('   inv(rMd) (DICOM → register):', this.invRMd);
}

/**
 * 从当前加载的 viewport 自动提取 ImagePositionPatient 并构建 rMd
 */
public async buildRMdFromViewport(servicesManager: any): Promise<boolean> {
  try {
    const renderingEngine = getRenderingEngine('OHIFCornerstoneRenderingEngine');
    if (!renderingEngine) {
      console.error('❌ RenderingEngine not available');
      return false;
    }

    const viewports = renderingEngine.getViewports();
    const viewport = viewports[0]; // 使用第一个 viewport

    if (!viewport) {
      console.error('❌ No viewport available');
      return false;
    }

    // 从 viewport 提取 ImagePositionPatient
    const imagePositionPatient = this._extractImagePositionPatient(viewport);

    if (!imagePositionPatient) {
      console.error('❌ Failed to extract ImagePositionPatient from viewport');
      return false;
    }

    // 构建 rMd 矩阵
    this.buildRMdFromDICOM(imagePositionPatient);
    return true;

  } catch (error) {
    console.error('❌ Error building rMd from viewport:', error);
    return false;
  }
}

/**
 * 从 viewport 提取 ImagePositionPatient
 */
private _extractImagePositionPatient(viewport: any): [number, number, number] | null {
  // 方法 1: 从 Volume 获取（推荐）
  if (viewport.type !== 'stack') {
    const imageData = viewport.getImageData?.();
    if (imageData) {
      const origin = imageData.getOrigin();
      return [origin[0], origin[1], origin[2]];
    }
  }

  // 方法 2: 从 metadata 获取
  const imageId = viewport.getCurrentImageId?.();
  if (imageId) {
    const { metaData } = require('@cornerstonejs/core');
    const imagePlaneModule = metaData.get('imagePlaneModule', imageId);

    if (imagePlaneModule && imagePlaneModule.imagePositionPatient) {
      const ipp = imagePlaneModule.imagePositionPatient;
      return [ipp[0], ipp[1], ipp[2]];
    }
  }

  return null;
}
```

---

## 📍 集成点

### 1. **NavigationController 初始化时自动构建**

```typescript
// navigationController.ts

constructor(servicesManager: any) {
  this.servicesManager = servicesManager;
  this.coordinateTransformer = new CoordinateTransformer();

  // ... 其他初始化代码 ...

  // 自动构建 rMd 矩阵
  this._initializeCoordinateTransform();
}

private async _initializeCoordinateTransform(): Promise<void> {
  console.log('🔄 Initializing coordinate transform...');

  // 尝试自动从 viewport 构建
  const success = await this.coordinateTransformer.buildRMdFromViewport(
    this.servicesManager
  );

  if (success) {
    console.log('✅ Coordinate transform initialized from DICOM metadata');
  } else {
    console.warn('⚠️ Failed to auto-build rMd, using identity transform');
    // 使用单位矩阵作为后备
    this.coordinateTransformer.loadTransform([
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1]
    ]);
  }
}
```

### 2. **暴露 UI 控制（可选）**

在 `TrackingPanel.tsx` 中添加一个按钮：

```typescript
<button onClick={handleRefreshCoordinateTransform}>
  🔄 刷新坐标转换
</button>

const handleRefreshCoordinateTransform = async () => {
  const controller = await ensureController();
  if (controller) {
    await controller.refreshCoordinateTransform();
  }
};
```

---

## 🔍 如何获取 ImagePositionPatient

### 位置 1: Volume Viewports（推荐）✅

```typescript
const imageData = viewport.getImageData();
const origin = imageData.getOrigin(); // [x, y, z] in mm
```

**来源**: VTK 的 `vtkImageData` 对象
**优点**: 直接、快速、适用于 MPR 视图

### 位置 2: Cornerstone Metadata API ✅

```typescript
import { metaData } from '@cornerstonejs/core';

const imageId = viewport.getCurrentImageId();
const imagePlaneModule = metaData.get('imagePlaneModule', imageId);
const imagePositionPatient = imagePlaneModule.imagePositionPatient; // [x, y, z]
```

**来源**: DICOM 标签 (0020,0032) - Image Position (Patient)
**优点**: 标准、准确、符合 DICOM 规范

### 位置 3: DicomMetadataStore（后备）

```typescript
const { dicomMetadataStore } = servicesManager.services;
const instances = dicomMetadataStore.getSeriesByUID(seriesInstanceUID);
const firstInstance = instances[0];
const imagePositionPatient = firstInstance.ImagePositionPatient;
```

---

## ✅ 实施步骤

### Phase 1: 增强 CoordinateTransformer ✨
- [ ] 添加 `buildRMdFromDICOM()` 方法
- [ ] 添加 `buildRMdFromViewport()` 方法
- [ ] 添加 `_extractImagePositionPatient()` 私有方法
- [ ] 添加单元测试

### Phase 2: 集成到 NavigationController
- [ ] 在构造函数中调用 `_initializeCoordinateTransform()`
- [ ] 添加 `refreshCoordinateTransform()` 公共方法
- [ ] 添加错误处理和日志

### Phase 3: UI 集成（可选）
- [ ] 在 TrackingPanel 添加"刷新坐标"按钮
- [ ] 显示当前 rMd 矩阵状态
- [ ] 添加手动覆盖选项

### Phase 4: 测试
- [ ] 测试自动构建 rMd 矩阵
- [ ] 验证坐标转换的正确性
- [ ] 测试投影在 MPR 视图的准确性

---

## 🧪 验证方法

### 测试 1: 检查 rMd 矩阵

```javascript
// 在浏览器控制台
window.__navigationController.coordinateTransformer.getTransform()
// 应该输出:
// {
//   rMd: [[1,0,0,Tx], [0,1,0,Ty], [0,0,1,Tz], [0,0,0,1]],
//   invRMd: [[1,0,0,-Tx], [0,1,0,-Ty], [0,0,1,-Tz], [0,0,0,1]]
// }
```

### 测试 2: 验证坐标转换

```javascript
// Register 坐标
const rPos = [100, 200, 300];

// 转换到 DICOM 坐标
const dPos = window.__navigationController.coordinateTransformer.registerToDICOM(rPos);

console.log('Register:', rPos);
console.log('DICOM:', dPos);
// dPos 应该 = [rPos[0] + Tx, rPos[1] + Ty, rPos[2] + Tz]
```

### 测试 3: 验证投影正确性

1. 启动 Instrument Projection 模式
2. 检查投影线是否正确显示在 MPR 视图上
3. 旋转/平移视图，投影应该保持正确

---

## 📝 注意事项

### 1. **多个 Series 的情况**
- 当前实现使用第一个 viewport 的 ImagePositionPatient
- 如果加载了多个 series，可能需要选择参考 series

### 2. **ImagePositionPatient 的含义**
- DICOM 标签 (0020,0032)
- 定义：图像左上角像素中心在患者坐标系中的位置
- 单位：毫米 (mm)
- 坐标系：DICOM 患者坐标系（RAS: Right, Anterior, Superior）

### 3. **旋转矩阵的未来扩展**
- 当前假设：Register 和 DICOM 方向一致（R = I）
- 未来：如果需要旋转，可以从 ImageOrientationPatient (0020,0037) 构建
- ImageOrientationPatient 包含两个方向向量（行方向和列方向）

### 4. **与 case.json 的兼容性**
- 保留手动 `loadTransform()` 方法
- 如果 case.json 提供 rMd，则优先使用
- 自动构建作为后备方案

---

## 🔄 未来增强

### 1. **支持 ImageOrientationPatient**

```typescript
public buildRMdFromDICOMFull(
  imagePositionPatient: [number, number, number],
  imageOrientationPatient: [number, number, number, number, number, number]
): void {
  const [rowX, rowY, rowZ, colX, colY, colZ] = imageOrientationPatient;

  // 构建旋转矩阵 R
  // Row = [rowX, rowY, rowZ]
  // Col = [colX, colY, colZ]
  // Normal = Row × Col (cross product)

  // ... 实现完整的 rMd 构建 ...
}
```

### 2. **支持注册点对齐**

```typescript
public buildRMdFromRegistration(
  registerPoints: number[][],
  dicomPoints: number[][]
): void {
  // 使用 ICP 或 Procrustes 算法计算最佳拟合的 rMd
  // ... 实现点云配准 ...
}
```

### 3. **支持多个坐标系**

```typescript
// tMpr: Tracker → Patient Reference
// prMr: Patient Reference → Register
// rMd: Register → DICOM

// 完整变换链：tMpr * prMr * rMd
```

---

## 📊 总结

| 功能 | 当前状态 | 目标状态 |
|------|---------|---------|
| rMd 矩阵支持 | ✅ 手动加载 | ✅ 自动构建 |
| ImagePositionPatient | ⚠️ 可获取但未使用 | ✅ 自动提取和使用 |
| 坐标转换 | ✅ 可用 | ✅ 自动化 |
| 投影数学 | ✅ 已实现 | ✅ 使用正确坐标系 |

---

## 🎯 下一步行动

1. **实现 `buildRMdFromViewport()` 方法**
2. **集成到 NavigationController 初始化流程**
3. **测试验证坐标转换正确性**
4. **文档化并提交代码**

---

**作者**: AI Assistant
**日期**: 2025-11-22
**版本**: 1.0
