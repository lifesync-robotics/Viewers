#!/bin/bash
# 检查开发服务器状态和错误的脚本

echo "=== 检查端口 3000 状态 ==="
if lsof -ti:3000 > /dev/null 2>&1; then
    echo "✅ 端口 3000 已被占用"
    echo "占用进程："
    lsof -ti:3000 | xargs ps -p
else
    echo "❌ 端口 3000 未被占用 - 服务器未运行"
fi

echo ""
echo "=== 检查开发服务器进程 ==="
if pgrep -f "webpack.*serve" > /dev/null; then
    echo "✅ 找到 webpack dev server 进程"
    pgrep -f "webpack.*serve" | xargs ps -p
else
    echo "❌ 未找到 webpack dev server 进程"
fi

echo ""
echo "=== 检查最近的错误日志 ==="
if [ -f "ohif.log" ]; then
    echo "最后 20 行日志："
    tail -20 ohif.log
else
    echo "未找到 ohif.log 文件"
fi

echo ""
echo "=== 如何查看实时错误 ==="
echo "1. 在终端运行: cd /home/mv/github/Viewers && yarn dev:viewer"
echo "2. 查看浏览器控制台: 按 F12 -> Console 标签"
echo "3. 查看终端输出: 所有编译错误会显示在终端"
