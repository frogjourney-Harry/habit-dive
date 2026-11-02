#!/bin/sh
# 推上線前執行：幫 index.html 裡的 css、js 加上新的版本號（?v=時間），讓瀏覽器一定載入最新的檔案，不會用到快取裡的舊版
v=$(date +%Y%m%d%H%M)
perl -pi -e "s/((?:href|src)=\"(?:css|js)\/[\w.-]+\.(?:css|js))(?:\?v=\d+)?\"/\$1?v=$v\"/g" index.html
echo "版本號：$v"
