/**
 * Background Service Worker용 DB 인스턴스 관리
 * Service Worker에서는 dynamic import를 사용할 수 없으므로 static import 사용
 */

import { CheckVocaDB } from '@catchvoca/core';

let dbInstance: CheckVocaDB | null = null;
let initPromise: Promise<CheckVocaDB> | null = null;

/**
 * DB 인스턴스 가져오기 (lazy initialization)
 */
export async function getDbInstance(): Promise<CheckVocaDB> {
  if (dbInstance) {
    return dbInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
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
