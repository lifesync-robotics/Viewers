# 强制刷新 Registration Panel V2

## 问题诊断

如果看不到新的 Registration Panel（两个标签页：Workflow Control 和 Template Editor），请按以下步骤操作：

## 步骤 1: 检查 Webpack 编译状态

1. 查看运行 `yarn start` 的终端窗口
2. 应该看到类似这样的输出：
   ```
   webpack 5.95.0 compiled with X warnings in XXXX ms
   ```
3. 如果看到编译错误，请修复后再继续

## 步骤 2: 强制触发 Webpack 重新编译

在终端中运行：
```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
touch extensions/lifesync/src/components/Registration/RegistrationPanelContainer.tsx
touch extensions/lifesync/src/components/Registration/RegistrationWorkflowPanel.tsx
touch extensions/lifesync/src/components/Registration/FiducialTemplateEditorPanel.tsx
```

这会触发 webpack 重新编译这些文件。

## 步骤 3: 硬刷新浏览器

### Chrome/Edge (Mac):
- 按 `Cmd + Shift + R`
- 或按 `Cmd + Option + R`

### Chrome/Edge (Windows/Linux):
- 按 `Ctrl + Shift + R`
- 或按 `Ctrl + F5`

### Firefox (Mac):
- 按 `Cmd + Shift + R`

### Firefox (Windows/Linux):
- 按 `Ctrl + Shift + R`
- 或按 `Ctrl + F5`

### Safari:
- 按 `Cmd + Option + E` (清空缓存)
- 然后按 `Cmd + R` (刷新)

## 步骤 4: 清除浏览器缓存（如果硬刷新不起作用）

### Chrome/Edge:
1. 打开开发者工具 (F12 或 Cmd+Option+I)
2. 右键点击刷新按钮
3. 选择 "清空缓存并硬性重新加载"

### Firefox:
1. 打开开发者工具 (F12)
2. 在 Network 标签页中，勾选 "Disable cache"
3. 刷新页面

## 步骤 5: 检查浏览器控制台

1. 打开浏览器开发者工具 (F12)
2. 查看 Console 标签页
3. 检查是否有以下日志：
   ```
   ✅ [Registration] Got DICOM UIDs:
   ```
4. 检查是否有任何错误信息

## 步骤 6: 验证组件是否正确加载

在浏览器控制台中运行：
```javascript
// 检查 React 组件树
document.querySelector('.registration-panel-container')
```

如果返回 `null`，说明组件没有渲染。

## 步骤 7: 检查文件是否正确

运行以下命令验证文件存在：
```bash
cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
ls -la extensions/lifesync/src/components/Registration/RegistrationPanelContainer.tsx
ls -la extensions/lifesync/src/components/Registration/RegistrationWorkflowPanel.tsx
ls -la extensions/lifesync/src/components/Registration/FiducialTemplateEditorPanel.tsx
```

所有文件都应该存在且最近修改时间应该是今天。

## 步骤 8: 重启 Webpack 开发服务器（最后手段）

如果以上步骤都不起作用：

1. 在运行 `yarn start` 的终端中按 `Ctrl + C` 停止服务器
2. 清除 webpack 缓存：
   ```bash
   cd /Users/ronaldtse/development/LifeSyncRobotics/Viewers
   rm -rf platform/app/.webpack-cache
   rm -rf node_modules/.cache
   ```
3. 重新启动：
   ```bash
   yarn start
   ```
4. 等待编译完成
5. 硬刷新浏览器

## 预期结果

刷新后，你应该看到：

1. **Registration Panel 标题**: "📋 Registration"
2. **两个标签页**:
   - "Workflow Control" (默认激活)
   - "Template Editor"
3. **Workflow Control 标签页内容**:
   - API Connection 状态
   - Registration Method 选择（Manual Point-based / Auto）
   - Template 加载按钮
   - Start Registration Session 按钮
   - DICOM Information 显示
4. **Template Editor 标签页内容**:
   - Template Management 按钮（Create New / Open Existing）
   - Add Fiducial 按钮
   - Fiducial 列表
   - Save Template 按钮

## 如果仍然看不到更新

1. 检查 `getPanelModule.tsx` 是否正确导入：
   ```typescript
   import RegistrationPanelContainer from '../components/Registration/RegistrationPanelContainer';
   ```

2. 检查 panel 注册：
   ```typescript
   {
     name: 'registration-panel',
     label: 'Registration',
     component: (props) => (
       <RegistrationPanelContainer
         servicesManager={servicesManager}
         commandsManager={commandsManager}
         extensionManager={extensionManager}
         {...props}
       />
     ),
   }
   ```

3. 检查浏览器网络标签页，确认新的 JavaScript 文件已加载

4. 尝试使用无痕/隐私模式打开浏览器

