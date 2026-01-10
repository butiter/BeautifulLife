@echo off
setlocal

set /p API_KEY=请输入 API Key: 
set "OPENAI_API_KEY=%API_KEY%"

echo 安装依赖...
npm --prefix server install
npm --prefix client install

echo 启动后端与前端...
start "BeautifulLife Server" cmd /k "npm --prefix server run dev"
start "BeautifulLife Client" cmd /k "npm --prefix client run dev"

endlocal
