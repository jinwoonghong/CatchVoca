/**
 * Firebase Configuration
 *
 * Firebase Console에서 받은 정보로 교체하세요:
 * https://console.firebase.google.com
 *
 * 프로젝트 설정 → 내 앱 → 웹 앱 → Firebase SDK 구성
 */

export const firebaseConfig = {
  apiKey: "AIzaSyDmhK8tjiNJ8SW46tBFoqvIYJWnuvF5wdU",
  authDomain: "catchvoca-6c9a8.firebaseapp.com",
  databaseURL: "https://catchvoca-6c9a8-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "catchvoca-6c9a8",
  storageBucket: "catchvoca-6c9a8.firebasestorage.app",
  messagingSenderId: "967073037521",
  appId: "1:967073037521:web:7c2e52878c0307fc61d9f0",
};

/**
 * Firebase Realtime Database 경로
 */
export const FIREBASE_PATHS = {
  QUIZZES: 'quizzes',
} as const;

/**
 * 퀴즈 데이터 자동 삭제 기간 (밀리초)
 * 기본: 7일
 */
export const QUIZ_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

