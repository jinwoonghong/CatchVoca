/**
 * Firebase Authentication Service (Custom Token 방식)
 * - Chrome Identity API로 Google OAuth
 * - Vercel API로 Custom Token 교환
 * - Firebase Auth로 로그인
 * - 완전한 에러 처리 및 재시도 로직
 */

import { initializeApp, getApps } from 'firebase/app';
import { getAuth, signInWithCustomToken, Auth } from 'firebase/auth';
import { firebaseConfig } from '../../config/firebase.config';
import {
  retryWithBackoff,
  withTimeout,
  checkStorageQuota,
  cleanupOldStorage,
  isAccessTokenExpired,
} from '../utils/auth-helpers';

// User 타입 정의
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}

// 로거
const logger = {
  info: (msg: string, data?: any) => console.log(`[FirebaseAuth] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[FirebaseAuth] ${msg}`, error || ''),
  warn: (msg: string, data?: any) => console.warn(`[FirebaseAuth] ${msg}`, data || ''),
};

// 상수
const OAUTH_TIMEOUT = 30000; // 30초
const API_TIMEOUT = 15000; // 15초
const VERCEL_API_URL =
  import.meta.env.VITE_VERCEL_API_URL || 'https://catch-voca-quiz.vercel.app';

// 상태 관리
let authOperationInProgress = false;
const authWaiters: Array<(user: User | null) => void> = [];

/**
 * Firebase 초기화 (싱글톤)
 */
export function initializeFirebase(): { auth: Auth } {
  const apps = getApps();
  let auth: Auth;

  if (apps.length > 0) {
    auth = getAuth(apps[0]);
    logger.info('Using existing Firebase app');
  } else {
    const app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    logger.info('Firebase app initialized');
  }

  return { auth };
}

/**
 * Google 로그인 (전체 인증 플로우)
 */
export async function signInWithGoogle(): Promise<User | null> {
  // 동시 작업 방지
  if (authOperationInProgress) {
    logger.info('Auth operation in progress, waiting...');
    return new Promise((resolve) => authWaiters.push(resolve));
  }

  authOperationInProgress = true;

  try {
    logger.info('=== Starting Google Sign-In Flow ===');

    // Storage quota 체크
    const quota = await checkStorageQuota();
    logger.info('Storage quota:', quota);

    if (quota.usagePercent > 80) {
      logger.warn('Storage quota high, cleaning up...');
      await cleanupOldStorage();
    }

    // Step 1: Chrome Identity OAuth
    logger.info('Step 1: Chrome Identity OAuth');
    const accessToken = await performChromeIdentityAuth();

    // Step 2: Token 교환
    logger.info('Step 2: Exchange for Custom Token');
    const { customToken, user: userInfo } = await exchangeForCustomToken(accessToken);

    // Step 3: Firebase 로그인
    logger.info('Step 3: Sign in to Firebase');
    const firebaseUser = await signInToFirebase(customToken);

    // Step 4: User 객체 생성 및 저장
    const user: User = {
      uid: firebaseUser.uid,
      email: userInfo.email,
      displayName: userInfo.displayName,
      photoURL: userInfo.photoURL,
      emailVerified: userInfo.emailVerified,
      providerId: 'google.com',
    };

    await persistUser(user, accessToken);

    logger.info('=== Sign-In Successful ===', { uid: user.uid });

    // 대기 중인 요청들에게 알림
    authWaiters.forEach((resolve) => resolve(user));
    authWaiters.length = 0;

    return user;
  } catch (error) {
    logger.error('=== Sign-In Failed ===', error);

    // 대기 중인 요청들에게 실패 알림
    authWaiters.forEach((resolve) => resolve(null));
    authWaiters.length = 0;

    // 사용자가 취소한 경우 null 반환 (에러 던지지 않음)
    if (error instanceof Error && error.message === 'USER_CANCELLED') {
      logger.info('User cancelled login');
      return null;
    }

    throw error;
  } finally {
    authOperationInProgress = false;
  }
}

/**
 * Step 1: Chrome Identity API OAuth
 */
async function performChromeIdentityAuth(): Promise<string> {
  if (!chrome.identity) {
    throw new Error('chrome.identity API not available');
  }

  const clientId =
    '967073037521-dfs3lt81s9kd4vil2chgf4pemb47sg79.apps.googleusercontent.com';
  const redirectUrl = chrome.identity.getRedirectURL();
  const scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];

  logger.info('OAuth config', { redirectUrl });

  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('redirect_uri', redirectUrl);
  authUrl.searchParams.set('scope', scopes.join(' '));

  try {
    const responseUrl = await withTimeout(
      launchWebAuthFlow(authUrl.toString()),
      OAUTH_TIMEOUT,
      'OAuth flow timed out'
    );

    const accessToken = extractAccessToken(responseUrl);
    logger.info('Access token obtained');

    return accessToken;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('did not approve')) {
        throw new Error('USER_CANCELLED');
      }
      if (error.message.includes('timed out')) {
        throw new Error('OAUTH_TIMEOUT: OAuth flow took too long');
      }
    }
    throw error;
  }
}

function launchWebAuthFlow(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.launchWebAuthFlow({ url, interactive: true }, (responseUrl) => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else if (responseUrl) {
        resolve(responseUrl);
      } else {
        reject(new Error('No redirect URL received'));
      }
    });
  });
}

function extractAccessToken(responseUrl: string): string {
  const url = new URL(responseUrl);
  const hash = url.hash.substring(1);

  if (!hash) {
    throw new Error('No OAuth response data in URL hash');
  }

  const params = new URLSearchParams(hash);
  const token = params.get('access_token');

  if (!token) {
    const error = params.get('error');
    const errorDesc = params.get('error_description');
    throw new Error(`OAuth error: ${error} - ${errorDesc}`);
  }

  if (!/^[\w\-\.]+$/.test(token)) {
    throw new Error('Invalid access token format');
  }

  return token;
}

/**
 * Step 2: Token 교환 (Vercel API)
 */
async function exchangeForCustomToken(accessToken: string): Promise<{
  customToken: string;
  user: {
    email: string;
    displayName: string;
    photoURL: string;
    emailVerified: boolean;
  };
}> {
  const endpoint = `${VERCEL_API_URL}/api/auth/exchange-token`;

  try {
    const response = await retryWithBackoff(async () => {
      return await withTimeout(
        fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        API_TIMEOUT,
        'Token exchange API timed out'
      );
    }, 3);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({
        error: 'Unknown error',
      }));

      throw new Error(
        `Token exchange failed (${response.status}): ${errorData.error || errorData.message}`
      );
    }

    const data = await response.json();

    if (!data.customToken || !data.user) {
      throw new Error('Invalid response from token exchange API');
    }

    return {
      customToken: data.customToken,
      user: data.user,
    };
  } catch (error) {
    logger.error('Token exchange error', error);

    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        throw new Error('EXCHANGE_TIMEOUT: Token exchange API did not respond');
      }
      if (error.message.includes('fetch') || error.message.includes('Failed to fetch')) {
        throw new Error('NETWORK_ERROR: Cannot reach token exchange API');
      }
    }

    throw new Error(
      `Token exchange failed: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Step 3: Firebase 로그인
 */
async function signInToFirebase(customToken: string) {
  const { auth } = initializeFirebase();

  // Token 포맷 검증
  const parts = customToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid custom token format (not a JWT)');
  }

  try {
    const userCredential = await withTimeout(
      signInWithCustomToken(auth, customToken),
      API_TIMEOUT,
      'Firebase sign-in timed out'
    );

    return userCredential.user;
  } catch (error: any) {
    logger.error('Firebase sign-in error', error);

    if (error.code === 'auth/invalid-custom-token') {
      throw new Error('INVALID_CUSTOM_TOKEN: Token rejected by Firebase');
    }
    if (error.code === 'auth/network-request-failed') {
      throw new Error('FIREBASE_NETWORK_ERROR: Cannot reach Firebase');
    }
    if (error.message?.includes('timed out')) {
      throw new Error('FIREBASE_TIMEOUT: Firebase did not respond');
    }

    throw error;
  }
}

/**
 * Step 4: User 정보 저장
 */
async function persistUser(user: User, accessToken: string): Promise<void> {
  try {
    const expiresAt = Date.now() + 3600 * 1000; // 1시간 후

    await chrome.storage.local.set({
      firebaseAuthUser: user,
      googleAccessToken: accessToken,
      authExpiresAt: expiresAt,
    });

    logger.info('User data persisted to storage');
  } catch (error: any) {
    if (error.name === 'QuotaExceededError') {
      logger.error('Storage quota exceeded');
      throw new Error('STORAGE_QUOTA_EXCEEDED: Cannot save user data');
    }
    throw error;
  }
}

/**
 * 현재 로그인된 사용자 가져오기
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const result = await chrome.storage.local.get('firebaseAuthUser');
    return (result.firebaseAuthUser as User) || null;
  } catch (error) {
    logger.error('Failed to get current user', error);
    return null;
  }
}

/**
 * 유효한 Firebase ID Token 가져오기
 */
export async function getValidIdToken(): Promise<string> {
  const { auth } = initializeFirebase();

  if (!auth.currentUser) {
    throw new Error('Not authenticated - no Firebase user');
  }

  try {
    // Access Token 만료 확인
    const isExpired = await isAccessTokenExpired();
    if (isExpired) {
      logger.warn('Access token expired, need to re-authenticate');
      throw new Error('TOKEN_EXPIRED: Please sign in again');
    }

    // Firebase ID Token 가져오기
    const idToken = await auth.currentUser.getIdToken(false);
    return idToken;
  } catch (error) {
    logger.error('Failed to get ID token', error);
    throw error;
  }
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
  try {
    const { auth } = initializeFirebase();
    await auth.signOut();

    await chrome.storage.local.remove(['firebaseAuthUser', 'googleAccessToken', 'authExpiresAt']);

    logger.info('Sign out successful');
  } catch (error) {
    logger.error('Sign out failed', error);
    throw error;
  }
}

// 이전 API와의 호환성을 위한 함수들
export async function getAccessToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(['googleAccessToken']);
    return result.googleAccessToken || null;
  } catch (error) {
    logger.error('Get access token failed', error);
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.uid || null;
}

export async function getUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email || null;
}

export async function isSignedIn(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
