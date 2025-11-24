#!/bin/bash

# 合并 Master 分支到 server_deployment 的自动化脚本
# 使用方法: ./merge_master.sh

set -e  # 遇到错误立即退出

echo "═══════════════════════════════════════════════════════"
echo "🔄 开始合并 Master 分支到 server_deployment"
echo "═══════════════════════════════════════════════════════"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# 检查当前分支
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT_BRANCH" != "server_deployment" ]; then
    echo -e "${RED}❌ 错误: 当前不在 server_deployment 分支${NC}"
    echo "请先切换到 server_deployment 分支: git checkout server_deployment"
    exit 1
fi

# 检查工作区是否干净
if ! git diff-index --quiet HEAD --; then
    echo -e "${YELLOW}⚠️  警告: 工作区有未提交的更改${NC}"
    echo "请先提交或暂存更改"
    read -p "是否继续? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建备份分支
BACKUP_BRANCH="backup/server_deployment_before_merge_$(date +%Y%m%d_%H%M%S)"
echo -e "${YELLOW}📦 创建备份分支: $BACKUP_BRANCH${NC}"
git branch "$BACKUP_BRANCH"
echo -e "${GREEN}✅ 备份分支已创建${NC}"
echo ""

# 获取最新的 master 分支
echo -e "${YELLOW}📥 获取最新的 master 分支...${NC}"
git fetch origin master
echo -e "${GREEN}✅ 获取完成${NC}"
echo ""

# 显示将要合并的提交
echo -e "${YELLOW}📋 Master 分支的新提交:${NC}"
git log --oneline server_deployment..origin/master | head -10
echo ""

# 确认合并
read -p "是否继续合并? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "合并已取消"
    exit 1
fi

# 执行合并（使用 --no-commit 以便审查）
echo -e "${YELLOW}🔄 开始合并...${NC}"
if git merge origin/master --no-commit --no-ff; then
    echo -e "${GREEN}✅ 合并成功，没有冲突${NC}"
else
    echo -e "${RED}❌ 合并遇到冲突${NC}"
    echo ""
    echo "冲突文件:"
    git diff --name-only --diff-filter=U
    echo ""
    echo "请手动解决冲突后运行:"
    echo "  git add <解决冲突的文件>"
    echo "  git commit -m 'Merge master branch: resolve conflicts'"
    exit 1
fi

# 显示更改统计
echo ""
echo -e "${YELLOW}📊 更改统计:${NC}"
git diff --stat --cached

# 确认提交
echo ""
read -p "是否提交合并? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    git commit -m "Merge master branch: Planning UI and Case Management improvements

- Enhance planning UI components
- Add case creation button and count functionality
- Improve patient name, MRN, and study date search
- Update WorkList and StudyList components
- Update planning backend service"
    echo -e "${GREEN}✅ 合并已提交${NC}"
else
    echo -e "${YELLOW}⚠️  合并已准备但未提交${NC}"
    echo "可以继续审查更改，然后运行:"
    echo "  git commit -m 'Merge master branch'"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 合并流程完成${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════${NC}"
