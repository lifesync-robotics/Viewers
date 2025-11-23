#!/bin/bash

# Force refresh Registration Panel by touching files to trigger webpack recompilation

echo "🔄 强制触发 Registration Panel 重新编译..."
echo ""

cd "$(dirname "$0")"

# Touch all Registration Panel files
echo "📝 更新文件时间戳..."
touch extensions/lifesync/src/components/Registration/RegistrationPanelContainer.tsx
touch extensions/lifesync/src/components/Registration/RegistrationWorkflowPanel.tsx
touch extensions/lifesync/src/components/Registration/FiducialTemplateEditorPanel.tsx
touch extensions/lifesync/src/components/Registration/types.ts
touch extensions/lifesync/src/components/Registration/RegistrationPanel.css
touch extensions/lifesync/src/panels/getPanelModule.tsx

echo "✅ 文件已更新"
echo ""
echo "📋 请执行以下操作："
echo "1. 查看运行 'yarn start' 的终端，等待 webpack 重新编译"
echo "2. 看到 'webpack compiled successfully' 后"
echo "3. 在浏览器中硬刷新："
echo "   - Mac: Cmd + Shift + R"
echo "   - Windows/Linux: Ctrl + Shift + R"
echo ""
echo "🔍 如果仍然看不到更新，请检查："
echo "   - 浏览器控制台是否有错误"
echo "   - Webpack 编译是否有错误"
echo "   - 尝试清除浏览器缓存或使用无痕模式"
