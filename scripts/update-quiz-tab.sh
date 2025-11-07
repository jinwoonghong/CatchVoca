#!/bin/bash
# QuizTab에 모바일 퀴즈 기능 추가

cd "$(dirname "$0")/.."

echo "QuizTab에 모바일 퀴즈 기능을 추가합니다..."

# 1. QRCode import 추가
sed -i "s|import type { WordEntry, Rating } from '@catchvoca/types';|import type { WordEntry, Rating } from '@catchvoca/types';\nimport QRCode from 'qrcode';|" packages/extension/src/popup/components/QuizTab.tsx

echo "✅ 1단계 완료: QRCode import 추가"

# 2. 모바일 퀴즈 상태 추가
sed -i "/} | null>(null);/a\
\
  // 모바일 퀴즈 상태\
  const [isUploading, setIsUploading] = useState(false);\
  const [mobileUrl, setMobileUrl] = useState<string | null>(null);\
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);" packages/extension/src/popup/components/QuizTab.tsx

echo "✅ 2단계 완료: 모바일 퀴즈 상태 추가"

echo "Done! 나머지는 수동으로 추가해야 합니다."
