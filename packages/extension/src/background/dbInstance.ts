/**
 * Background Service Worker용 DB 인스턴스 관리
 * Dexie가 모듈 로드 시점에 window를 참조하므로 동적 import 사용
 */

import type { CheckVocaDB } from '@catchvoca/core';

let dbInstance: CheckVocaDB | null = null;
let initPromise: Promise<CheckVocaDB> | null = null;

/**
 * DB 인스턴스 가져오기 (lazy initialization with dynamic import)
 */
export async function getDbInstance(): Promise<CheckVocaDB> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const { CheckVocaDB } = await import('@catchvoca/core');
    dbInstance = new CheckVocaDB();
    await dbInstance.open();
    console.log('[Background] Database initialized');
    return dbInstance;
  })();

  return initPromise;
}

/**
 * 동기 방식으로 db 반환 (이미 초기화된 경우에만 사용)
 */
export function getDb(): CheckVocaDB {
  if (!dbInstance) {
    throw new Error('DB not initialized. Call getDbInstance() first.');
  }
  return dbInstance;
}
