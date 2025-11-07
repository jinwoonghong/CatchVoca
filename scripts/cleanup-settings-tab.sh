#!/bin/bash
# SettingsTab에서 모바일 퀴즈 관련 코드 제거

cd "$(dirname "$0")/.."

echo "SettingsTab에서 모바일 퀴즈 코드를 제거합니다..."

FILE="packages/extension/src/popup/components/SettingsTab.tsx"

# 1. QRCode import 제거
sed -i '/import QRCode from/d' "$FILE"

# 2. 모바일 퀴즈 상태 변수 3개 제거 (lines 21-23)
sed -i '/const \[isUploading, setIsUploading\] = useState(false);/d' "$FILE"
sed -i '/const \[mobileUrl, setMobileUrl\] = useState<string | null>(null);/d' "$FILE"
sed -i '/const \[qrCodeDataUrl, setQrCodeDataUrl\] = useState<string | null>(null);/d' "$FILE"

echo "✅ 완료: import와 state 변수 제거됨"
echo "⚠️  주의: 함수와 UI는 수동으로 제거해야 합니다 (lines 191-254, 631-692)"
