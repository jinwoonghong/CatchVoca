import 'fake-indexeddb/auto';
import { afterEach } from 'vitest';

// IndexedDB 테스트 환경을 위한 설정
afterEach(() => {
  // 각 테스트 후 IndexedDB 정리
  indexedDB.deleteDatabase('CheckVocaDB');
});
