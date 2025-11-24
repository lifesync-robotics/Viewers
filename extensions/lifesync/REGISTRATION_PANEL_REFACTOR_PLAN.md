# Registration Panel 重构计划

## 目标

将现有的 Registration Panel 重构为两个独立的面板：
1. **自动配准面板** (Phantom-based Registration) - 通过加载 phantom 配置进行自动配准
2. **手动配准面板** (Manual Fiducial Registration) - 类似 Planning Panel，用于添加/编辑/删除 fiducial 点

## 当前状态分析

### 现有组件

1. **RegistrationPanel** (`lifesync/src/components/Registration/RegistrationPanel.tsx`)
   - 当前是单一面板，混合了手动和自动配准功能
   - 使用 `registrationService` 进行状态管理
   - 已有基本的 fiducial 列表显示

2. **ScrewManagementPanel** (`lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx`)
   - 参考实现：展示了如何管理 3D 对象（screws）
   - 功能包括：添加、编辑、删除、保存、加载
   - 使用 viewport state 和 3D model rendering

3. **FiducialMarkerTool** (`cornerstone/src/tools/FiducialMarkerTool.ts`)
   - 已存在的工具，可以绘制 3D 点标记
   - 支持在 MPR 视图中显示
   - 使用 `addFiducialAtCrosshair` 工具在交叉线位置添加点

### 现有工具和服务

- `FiducialMarkerTool` - 3D 点绘制工具
- `addFiducialAtCrosshair` - 在交叉线位置添加 fiducial
- `registrationService` - 配准服务（需要更新以支持 series-centric API）
- `measurementService` - 测量服务（用于管理 fiducial annotations）

## 架构设计

### 组件结构

```
lifesync/src/components/Registration/
├── RegistrationPanelContainer.tsx      # 主容器，包含两个子面板的切换
├── AutoRegistrationPanel.tsx           # 自动配准面板（Phantom）
├── ManualRegistrationPanel.tsx         # 手动配准面板（Fiducial）
├── FiducialList.tsx                    # Fiducial 列表组件（可复用）
├── FiducialItem.tsx                    # Fiducial 项组件
├── PhantomConfigDialog.tsx             # Phantom 配置对话框
└── RegistrationPanel.css               # 样式文件
```

### 数据流

```
ManualRegistrationPanel
    ↓
FiducialList (显示 fiducials)
    ↓
FiducialItem (单个 fiducial，支持编辑/删除)
    ↓
FiducialMarkerTool (3D 渲染)
    ↓
measurementService (管理 annotations)
    ↓
registrationService (API 调用)
    ↓
Registration API (series-centric)
```

## 详细实现计划

### Phase 1: 组件重构和分离

#### 1.1 创建 RegistrationPanelContainer

**文件**: `lifesync/src/components/Registration/RegistrationPanelContainer.tsx`

**功能**:
- 提供标签页或切换按钮，在两个面板之间切换
- 管理当前选中的配准方法（auto/manual）
- 共享状态管理（series_instance_uid, case_id）

**UI 设计**:
```
┌─────────────────────────────────────┐
│  Registration                       │
├─────────────────────────────────────┤
│  [Auto] [Manual]  ← 标签页切换      │
├─────────────────────────────────────┤
│                                     │
│  (当前选中的面板内容)                │
│                                     │
└─────────────────────────────────────┘
```

#### 1.2 创建 AutoRegistrationPanel

**文件**: `lifesync/src/components/Registration/AutoRegistrationPanel.tsx`

**功能**:
- Phantom 配置选择（Medtronic_StealthStation, BrainLab_ExacTrac, etc.）
- Phantom 类型选择（3D_O_Arm, CT_Phantom）
- 加载 phantom 配置
- 启动自动配准
- 显示配准进度和结果

**UI 组件**:
- Phantom 选择下拉菜单
- 配置参数输入（marker 数量、间距等）
- "Load Phantom" 按钮
- "Start Auto Registration" 按钮
- 配准状态显示（loading, success, error）

#### 1.3 创建 ManualRegistrationPanel

**文件**: `lifesync/src/components/Registration/ManualRegistrationPanel.tsx`

**参考**: `ScrewManagementPanel.tsx` 的结构

**功能**:
- 初始化配准会话（使用 series_instance_uid）
- 加载已保存的 fiducial template
- 添加 fiducial 点（通过交叉线位置）
- 编辑 fiducial 点（位置、标签）
- 删除 fiducial 点
- 保存 fiducial template
- 启动配准计算
- 显示配准结果和质量指标

**UI 组件**:
- "Start Registration Session" 按钮
- "Load Template" 按钮
- "Save Template" 按钮
- Fiducial 列表（FiducialList 组件）
- "Add Fiducial at Crosshair" 按钮
- "Compute Registration" 按钮
- 配准质量显示

### Phase 2: Fiducial 管理组件

#### 2.1 创建 FiducialList

**文件**: `lifesync/src/components/Registration/FiducialList.tsx`

**功能**:
- 显示所有 fiducial 点的列表
- 支持选择当前 fiducial（高亮显示）
- 支持点击跳转到 fiducial 位置
- 显示 fiducial 状态（pending, captured, validated）

**Props**:
```typescript
interface FiducialListProps {
  fiducials: Fiducial[];
  selectedFiducialId?: string;
  onSelectFiducial: (fiducialId: string) => void;
  onEditFiducial: (fiducialId: string) => void;
  onDeleteFiducial: (fiducialId: string) => void;
  onJumpToFiducial: (fiducialId: string) => void;
}
```

#### 2.2 创建 FiducialItem

**文件**: `lifesync/src/components/Registration/FiducialItem.tsx`

**功能**:
- 显示单个 fiducial 的信息
- 支持编辑（内联编辑或对话框）
- 支持删除（带确认）
- 显示 DICOM 和 Tracker 位置
- 显示质量指标

**UI 设计**:
```
┌─────────────────────────────────────┐
│ F1  [✓]  C7 Spinous Process        │
│      [Edit] [Delete]                │
│ DICOM: [10.5, 20.3, -150.2]        │
│ Tracker: [15.2, 25.7, -145.8]      │
│ Quality: 0.95                       │
└─────────────────────────────────────┘
```

### Phase 3: 3D 点绘制集成

#### 3.1 使用 FiducialMarkerTool

**集成点**:
- 在 ManualRegistrationPanel 中激活 FiducialMarkerTool
- 使用 `addFiducialAtCrosshair` 在交叉线位置添加点
- 同步 fiducial annotations 和 panel 状态

**实现步骤**:
1. 在 panel 中添加 "Add Fiducial" 按钮
2. 点击按钮时，激活 FiducialMarkerTool
3. 使用交叉线位置作为 fiducial 位置
4. 创建 FiducialMarker annotation
5. 更新 panel 状态和 API

#### 3.2 同步 Annotation 和 Panel 状态

**挑战**:
- FiducialMarker annotations 存储在 measurementService
- Panel 需要管理 fiducial 数据（包括 tracker 位置）
- 需要双向同步

**解决方案**:
- 使用 `measurementService` 管理 annotations
- 使用 `registrationService` 管理 fiducial 数据（包括 tracker 位置）
- 通过 event subscription 同步状态

### Phase 4: API 集成更新

#### 4.1 更新 RegistrationService

**文件**: `lifesync/src/services/RegistrationService.ts` (如果存在) 或创建新服务

**需要更新的方法**:
- `startRegistration(seriesUID, method, options)` - 使用 series-centric API
- `saveFiducials(seriesUID, fiducials, caseId?)` - 保存 template
- `loadFiducials(seriesUID, caseId?)` - 加载 template
- `addFiducial(seriesUID, fiducial)` - 添加单个 fiducial
- `updateFiducial(seriesUID, fiducialId, updates)` - 更新 fiducial
- `deleteFiducial(seriesUID, fiducialId)` - 删除 fiducial
- `computeRegistration(seriesUID, sessionId)` - 计算配准
- `getRegistrationStatus(seriesUID)` - 获取状态

#### 4.2 API 端点映射

```
ManualRegistrationPanel → API
├── Start Session → POST /api/registration/series/{seriesUID}/start
├── Save Template → POST /api/registration/series/{seriesUID}/fiducials
├── Load Template → GET /api/registration/series/{seriesUID}/fiducials
├── Add Fiducial → (通过 Save Template 更新)
├── Update Fiducial → (通过 Save Template 更新)
├── Delete Fiducial → (通过 Save Template 更新)
└── Compute → POST /api/registration/series/{seriesUID}/compute (待实现)

AutoRegistrationPanel → API
├── Load Phantom → (配置本地或从 API)
└── Start Auto → POST /api/registration/series/{seriesUID}/start (method=PHANTOM_AUTO)
```

### Phase 5: UI/UX 改进

#### 5.1 视觉设计

**参考 Planning Panel**:
- 类似的布局和样式
- 一致的按钮样式和颜色
- 类似的列表项设计

**颜色方案**:
- Fiducial 点：蓝色（默认），绿色（已捕获），红色（错误）
- 按钮：主要操作（蓝色），次要操作（灰色），危险操作（红色）

#### 5.2 交互流程

**手动配准流程**:
1. 用户打开 Manual Registration Panel
2. 点击 "Start Session" → 创建新的配准会话
3. 可选：点击 "Load Template" → 加载已保存的 fiducial 模板
4. 在 viewport 中定位到要标记的位置
5. 点击 "Add Fiducial at Crosshair" → 添加 fiducial 点
6. 重复步骤 4-5，添加更多 fiducial 点
7. 可选：编辑或删除 fiducial 点
8. 点击 "Save Template" → 保存当前 fiducial 配置
9. 在 OR 中捕获 tracker 位置（通过 Tracking Panel）
10. 点击 "Compute Registration" → 计算配准变换
11. 查看配准质量和结果

**自动配准流程**:
1. 用户打开 Auto Registration Panel
2. 选择 Phantom 类型和配置
3. 点击 "Load Phantom" → 加载 phantom 配置
4. 点击 "Start Auto Registration" → 启动自动配准
5. 等待配准完成
6. 查看配准结果

## 文件清单

### 需要创建的文件

1. `lifesync/src/components/Registration/RegistrationPanelContainer.tsx`
2. `lifesync/src/components/Registration/AutoRegistrationPanel.tsx`
3. `lifesync/src/components/Registration/ManualRegistrationPanel.tsx`
4. `lifesync/src/components/Registration/FiducialList.tsx`
5. `lifesync/src/components/Registration/FiducialItem.tsx`
6. `lifesync/src/components/Registration/PhantomConfigDialog.tsx`
7. `lifesync/src/components/Registration/types.ts` (TypeScript 类型定义)

### 需要修改的文件

1. `lifesync/src/components/Registration/RegistrationPanel.tsx` → 重构或删除
2. `lifesync/src/components/Registration/index.ts` → 更新导出
3. `lifesync/src/panels/getPanelModule.tsx` → 更新 panel 注册
4. `lifesync/src/services/RegistrationService.ts` → 创建或更新（如果不存在）

### 需要参考的文件

1. `lifesync/src/components/ScrewManagement/ScrewManagementPanel.tsx` - 参考结构
2. `cornerstone/src/tools/FiducialMarkerTool.ts` - 3D 点绘制工具
3. `cornerstone/src/utils/addFiducialAtCrosshair.ts` - 添加 fiducial 工具

## 实施步骤

### Step 1: 准备阶段
- [ ] 创建类型定义文件 (`types.ts`)
- [ ] 创建基础组件结构
- [ ] 设置样式文件

### Step 2: 容器和面板框架
- [ ] 创建 `RegistrationPanelContainer`
- [ ] 创建 `AutoRegistrationPanel` 框架
- [ ] 创建 `ManualRegistrationPanel` 框架
- [ ] 实现面板切换功能

### Step 3: Manual Panel 核心功能
- [ ] 实现会话初始化
- [ ] 实现 fiducial 列表显示
- [ ] 实现添加 fiducial（使用 FiducialMarkerTool）
- [ ] 实现编辑 fiducial
- [ ] 实现删除 fiducial
- [ ] 实现保存/加载 template

### Step 4: Auto Panel 功能
- [ ] 实现 Phantom 配置选择
- [ ] 实现自动配准启动
- [ ] 实现状态显示

### Step 5: API 集成
- [ ] 更新 RegistrationService
- [ ] 集成 series-centric API
- [ ] 实现错误处理

### Step 6: UI/UX 优化
- [ ] 样式优化
- [ ] 交互优化
- [ ] 错误提示和确认对话框

### Step 7: 测试和调试
- [ ] 单元测试
- [ ] 集成测试
- [ ] 用户测试

## 技术细节

### Fiducial 数据结构

```typescript
interface Fiducial {
  point_id: string;              // "F1", "F2", etc.
  label: string;                 // "C7 Spinous Process"
  anatomical_landmark?: string;  // "C7_spinous"
  dicom_position_mm: [number, number, number];  // DICOM coordinates
  dicom_voxel_coords?: [number, number, number]; // Voxel coordinates
  tracker_position_mm?: [number, number, number]; // Tracker coordinates (captured in OR)
  quality_score?: number;        // 0.0 - 1.0
  stability_mm?: number;         // Tracking stability
  status: 'pending' | 'captured' | 'validated';
  source: 'template' | 'intraop';
  placed_by?: string;
  placed_at?: number;            // Unix timestamp
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
}
```

### 状态管理

```typescript
interface ManualRegistrationState {
  sessionId: string | null;
  seriesInstanceUID: string | null;
  caseId: string | null;
  status: 'idle' | 'loading_template' | 'collecting_points' | 'computing' | 'completed' | 'error';
  fiducials: Fiducial[];
  selectedFiducialId: string | null;
  templateId: string | null;
  registrationResult: RegistrationResult | null;
}
```

### 与 MeasurementService 集成

```typescript
// 添加 fiducial annotation
const annotation = {
  toolName: 'FiducialMarker',
  data: {
    handles: {
      points: [[x, y, z]]  // World coordinates
    },
    label: 'F1'
  },
  metadata: {
    FrameOfReferenceUID: frameOfReferenceUID,
    referencedImageId: imageId
  }
};

measurementService.addMeasurement(element, annotation);
```

## 注意事项

1. **Series-centric API**: 所有 API 调用必须使用 `series_instance_uid` 而不是 `case_id`
2. **状态同步**: 确保 panel 状态和 measurementService annotations 保持同步
3. **错误处理**: 提供清晰的错误提示和恢复机制
4. **性能**: 大量 fiducial 点时的渲染性能优化
5. **用户体验**: 提供清晰的视觉反馈和操作确认

## 后续扩展

1. **配准质量可视化**: 显示 FRE, TRE 等指标
2. **配准历史**: 显示多次配准尝试的历史记录
3. **配准验证**: 添加验证点和验证流程
4. **批量操作**: 支持批量编辑/删除 fiducial
5. **导入/导出**: 支持导入/导出 fiducial 配置
