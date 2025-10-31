import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';
import { db } from '../src/db/database';

// IndexedDB 테스트 환경을 위한 설정
afterEach(async () => {
  // 각 테스트 후 테이블만 클리어 (DB 삭제하지 않음)
  // deleteDatabase()는 싱글톤 인스턴스를 닫아버려서 사용하지 않음
  try {
    await db.wordEntries.clear();
    await db.reviewStates.clear();
  } catch (error) {
    // DB가 아직 열리지 않았거나 이미 닫힌 경우 무시
    console.warn('Database cleanup skipped:', error);
  }
});
