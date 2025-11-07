/**
 * Firebase Authentication Service
 * - 구글 로그인/로그아웃
 * - 사용자 정보 관리
 * - 세션 유지
 */

// User 타입 정의 (Firebase Auth SDK를 import하지 않기 위해)
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}

// 현재 로그인된 사용자 (메모리에만 저장)
let currentUser: User | null = null;

// 간단한 로거 (background service worker용)
const log = {
  info: (msg: string, data?: any) => console.log(`[FirebaseAuth] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[FirebaseAuth] ${msg}`, error || ''),
};

/**
 * 구글 로그인 (Chrome Identity API 사용)
 * Chrome Extension에서는 launchWebAuthFlow 사용
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    log.info('Starting Google sign-in');

    // OAuth2 URL 생성
    const manifest = chrome.runtime.getManifest() as any;
    const clientId = manifest?.oauth2?.client_id as string | undefined;

    if (!clientId) {
      log.error('Client ID not found in manifest', { manifestKeys: Object.keys(manifest || {}) });
      throw new Error('OAuth2 client_id not configured in manifest.json');
    }

    log.info('Client ID found', { clientId: clientId.substring(0, 20) + '...' });

    const redirectUrl = chrome.identity.getRedirectURL();
    log.info('Redirect URL', { redirectUrl });
    const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('scope', [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ].join(' '));

    log.info('Launching web auth flow');

    // Web Auth Flow로 토큰 얻기
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true
        },
        (responseUrl) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else if (responseUrl) {
            resolve(responseUrl);
          } else {
            reject(new Error('No response URL'));
          }
        }
      );
    });

    // URL에서 access token 추출
    const url = new URL(responseUrl);
    const accessToken = url.hash.match(/access_token=([^&]+)/)?.[1];

    if (!accessToken) {
      throw new Error('No access token in response');
    }

    log.info('Access token received');

    // Google User Info API로 사용자 정보 가져오기
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!userInfoResponse.ok) {
      throw new Error('Failed to fetch user info');
    }

    const userInfo = await userInfoResponse.json();

    // User 객체 생성 (Firebase User 형식에 맞게)
    currentUser = {
      uid: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      photoURL: userInfo.picture,
      emailVerified: userInfo.verified_email,
      providerId: 'google.com'
    } as User;

    log.info('User signed in', { uid: currentUser.uid, email: currentUser.email });

    return currentUser;
  } catch (error) {
    log.error('Google sign-in failed', error);
    return null;
  }
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
  try {
    // Chrome에서 캐시된 토큰 제거
    await new Promise<void>((resolve) => {
      chrome.identity.clearAllCachedAuthTokens(() => {
        log.info('All auth tokens cleared');
        resolve();
      });
    });

    currentUser = null;
    log.info('User signed out');
  } catch (error) {
    log.error('Sign out failed', error);
    throw error;
  }
}

/**
 * 현재 로그인된 사용자 가져오기
 */
export async function getCurrentUser(): Promise<User | null> {
  // 메모리에 저장된 사용자 정보 반환
  return currentUser;
}

/**
 * 사용자 ID 가져오기
 */
export async function getUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.uid || null;
}

/**
 * 사용자 이메일 가져오기
 */
export async function getUserEmail(): Promise<string | null> {
  const user = await getCurrentUser();
  return user?.email || null;
}

/**
 * 로그인 상태 확인
 */
export async function isSignedIn(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
