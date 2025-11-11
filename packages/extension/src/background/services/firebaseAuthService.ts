/**
 * Firebase Authentication Service
 * - 구글 로그인/로그아웃 (Chrome Identity API만 사용)
 * - 사용자 정보 관리
 * - 세션 유지
 */

// User 타입 정의 (간소화)
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  providerId: string;
}

// 현재 로그인된 사용자 (메모리와 chrome.storage에 저장)
let currentUser: User | null = null;

// 간단한 로거
const log = {
  info: (msg: string, data?: any) => console.log(`[FirebaseAuth] ${msg}`, data || ''),
  error: (msg: string, error?: any) => console.error(`[FirebaseAuth] ${msg}`, error || ''),
};

/**
 * 구글 로그인 (Chrome Identity API - launchWebAuthFlow 사용)
 * 1. launchWebAuthFlow로 OAuth 인증 (unpacked extension 지원)
 * 2. Access token 추출
 * 3. Google UserInfo API로 사용자 정보 획득
 */
export async function signInWithGoogle(): Promise<User | null> {
  try {
    log.info('Starting Google sign-in with launchWebAuthFlow');

    // Chrome Identity API 사용 가능 여부 확인
    if (!chrome.identity) {
      throw new Error('chrome.identity API is not available');
    }

    // OAuth2 설정
    // Chrome Extension용 Client ID (chrome extension ver)
    const clientId = '967073037521-dfs3lt81s9kd4vil2chgf4pemb47sg79.apps.googleusercontent.com';
    const redirectUrl = chrome.identity.getRedirectURL();
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.email',
      'https://www.googleapis.com/auth/userinfo.profile'
    ];

    log.info('OAuth configuration:', {
      clientId: clientId.substring(0, 20) + '...',
      redirectUrl,
      scopes
    });

    // OAuth URL 생성
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('response_type', 'token');
    authUrl.searchParams.set('redirect_uri', redirectUrl);
    authUrl.searchParams.set('scope', scopes.join(' '));

    log.info('Launching web auth flow...');

    // launchWebAuthFlow로 OAuth 인증
    const responseUrl = await new Promise<string>((resolve, reject) => {
      chrome.identity.launchWebAuthFlow(
        {
          url: authUrl.toString(),
          interactive: true
        },
        (redirectUrl) => {
          if (chrome.runtime.lastError) {
            log.error('launchWebAuthFlow error', chrome.runtime.lastError);
            reject(chrome.runtime.lastError);
          } else if (redirectUrl) {
            resolve(redirectUrl);
          } else {
            reject(new Error('No redirect URL received'));
          }
        }
      );
    });

    log.info('Auth flow completed, extracting token...');

    // URL에서 access_token 추출
    const url = new URL(responseUrl);
    const accessToken = url.hash
      .substring(1)
      .split('&')
      .find(param => param.startsWith('access_token='))
      ?.split('=')[1];

    if (!accessToken) {
      throw new Error('Access token not found in response');
    }

    log.info('Access token received', {
      tokenLength: accessToken.length,
      tokenPrefix: accessToken.substring(0, 10) + '...'
    });

    // Google UserInfo API로 사용자 정보 가져오기
    log.info('Fetching user info from Google API...');

    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    log.info('User info response received', { status: userInfoResponse.status });

    if (!userInfoResponse.ok) {
      const errorText = await userInfoResponse.text();
      log.error('User info request failed', { status: userInfoResponse.status, errorText });
      throw new Error(`Failed to fetch user info: ${userInfoResponse.status} - ${errorText}`);
    }

    const userInfo = await userInfoResponse.json();
    log.info('User info received', { email: userInfo.email, id: userInfo.id });

    // 사용자 정보로 User 객체 생성
    currentUser = {
      uid: userInfo.id,
      email: userInfo.email,
      displayName: userInfo.name,
      photoURL: userInfo.picture,
      emailVerified: userInfo.verified_email,
      providerId: 'google.com'
    };

    // Access token과 함께 Chrome storage에 저장
    await chrome.storage.local.set({
      firebaseAuthUser: currentUser,
      googleAccessToken: accessToken // sync에서 사용할 토큰
    });

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
    // Chrome storage에서 사용자 정보 및 토큰 제거
    await chrome.storage.local.remove(['firebaseAuthUser', 'googleAccessToken']);

    currentUser = null;
    log.info('User signed out');
  } catch (error) {
    log.error('Sign out failed', error);
    throw error;
  }
}

/**
 * 저장된 Access Token 가져오기 (sync에서 사용)
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const result = await chrome.storage.local.get(['googleAccessToken']);
    return result.googleAccessToken || null;
  } catch (error) {
    log.error('Get access token failed', error);
    return null;
  }
}

/**
 * 현재 로그인된 사용자 가져오기
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    // 메모리에 저장된 사용자 정보가 있으면 반환
    if (currentUser) {
      return currentUser;
    }

    // Chrome storage에서 사용자 정보 로드
    const result = await chrome.storage.local.get(['firebaseAuthUser']);
    if (result.firebaseAuthUser) {
      currentUser = result.firebaseAuthUser;
      return currentUser;
    }

    return null;
  } catch (error) {
    log.error('Get current user failed', error);
    return null;
  }
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
