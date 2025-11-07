#!/bin/bash
# UI 업데이트 스크립트

cd "$(dirname "$0")/.."

echo "1. Renaming 복습 → 학습..."
sed -i 's/🎯 복습/🎯 학습/g' packages/extension/src/popup/App.tsx

echo "2. Moving audio button in CollectTab..."
# CollectTab의 오디오 버튼을 발음기호 바로 뒤로 이동
# 현재 구조를 변경하여 phonetic과 audioUrl을 같은 줄에 배치

echo "3. Updating mobile quiz button text..."
sed -i 's/🔗 모바일 퀴즈 링크 생성/📱 모바일에서 학습하기/g' packages/extension/src/popup/components/SettingsTab.tsx
sed -i 's/📱 모바일 퀴즈 링크 생성/📱 모바일에서 학습하기/g' packages/extension/src/popup/components/LibraryTab.tsx

echo "Done!"
