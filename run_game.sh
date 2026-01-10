#!/usr/bin/env bash
set -euo pipefail

read -r -p "请输入 API Key: " API_KEY
export OPENAI_API_KEY="$API_KEY"

echo "安装依赖..."
npm --prefix server install
npm --prefix client install

echo "启动后端与前端..."
trap 'kill 0' EXIT
npm --prefix server run dev &
npm --prefix client run dev
