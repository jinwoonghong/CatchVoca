/**
 * Online Synchronization Service
 *
 * Handles bidirectional sync between IndexedDB (local) and Firestore (cloud)
 * Features:
 * - Google OAuth authentication via Chrome Identity API
 * - Timestamp-based conflict resolution
 * - Incremental sync (only changes since last sync)
 * - Offline queue for failed sync operations
 * - Auto-sync with configurable interval
 */

import type {
  WordEntry,
  ReviewState,
  SyncStatus,
  SyncResult,
  AuthUser,
} from '@catchvoca/types';
import { getDbInstance } from '../dbInstance';
import { eventBus } from '@catchvoca/core';
import * as firebaseAuthService from './firebaseAuthService';

/**
 * Sync Service Configuration
 */
const SYNC_CONFIG = {
  API_BASE_URL: 'https://catch-voca-quiz.vercel.app/api',
  AUTO_SYNC_INTERVAL: 5 * 60 * 1000, // 5 minutes
  DEBOUNCE_DELAY: 3000, // 3 seconds
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000, // 1 second
} as const;

/**
 * SyncService Class
 *
 * Singleton service for managing online synchronization
 */
class SyncService {
  private authToken: string | null = null;
  private currentUser: AuthUser | null = null;
  private lastSyncedAt: number = 0;
  private clockOffset: number = 0; // Server-client time difference in ms
  private syncInProgress: boolean = false;
  private autoSyncTimerId: number | null = null;
  private debounceTimerId: number | null = null;

  /**
   * Initialize sync service
   * Loads saved sync state from chrome.storage
   */
  async initialize(): Promise<void> {
    try {
      const result = await chrome.storage.local.get(['authToken', 'currentUser', 'lastSyncedAt', 'clockOffset']);

      this.authToken = result.authToken || null;
      this.currentUser = result.currentUser || null;
      this.lastSyncedAt = result.lastSyncedAt || 0;
      this.clockOffset = result.clockOffset || 0;

      console.log('[SyncService] Initialized:', {
        isAuthenticated: !!this.authToken,
        userId: this.currentUser?.uid,
        lastSyncedAt: new Date(this.lastSyncedAt).toISOString(),
        clockOffset: this.clockOffset,
      });
    } catch (error) {
      console.error('[SyncService] Initialization failed:', error);
    }
  }

  /**
   * Authenticate user with Google OAuth
   * Uses Firebase Auth with Chrome Identity API
   */
  async authenticate(): Promise<AuthUser> {
    try {
      // Firebase Auth를 통한 Google 로그인
      const user = await firebaseAuthService.signInWithGoogle();

      if (!user) {
        throw new Error('Authentication failed');
      }

      // AuthUser 형식으로 변환
      this.currentUser = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
      };

      // authToken은 Firebase Auth에서 자동으로 관리됨
      // 여기서는 사용자 정보만 저장
      await chrome.storage.local.set({
        currentUser: this.currentUser,
      });

      console.log('[SyncService] Authentication successful:', this.currentUser);

      return this.currentUser;
    } catch (error) {
      console.error('[SyncService] Authentication failed:', error);
      throw error;
    }
  }

  /**
   * Sign out current user
   * Clears auth state and stops auto-sync
   */
  async signOut(): Promise<void> {
    try {
      // Firebase Auth 로그아웃
      await firebaseAuthService.signOut();

      // Clear local state
      this.authToken = null;
      this.currentUser = null;
      this.lastSyncedAt = 0;

      await chrome.storage.local.remove(['authToken', 'currentUser', 'lastSyncedAt']);

      // Stop auto-sync
      this.stopAutoSync();

      console.log('[SyncService] Sign out successful');
    } catch (error) {
      console.error('[SyncService] Sign out failed:', error);
      throw error;
    }
  }

  /**
   * Get access token for API requests
   */
  private async getIdToken(): Promise<string> {
    const user = await firebaseAuthService.getCurrentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }

    // 저장된 Google Access Token 가져오기
    const token = await firebaseAuthService.getAccessToken();
    if (!token) {
      throw new Error('Access token not found. Please sign in again.');
    }

    return token;
  }

  /**
   * Push local changes to server
   * Uploads words and reviews modified since last sync
   */
  async pushSync(): Promise<SyncResult> {
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    try {
      this.syncInProgress = true;

      // Get Firebase ID token
      const idToken = await this.getIdToken();

      // Get local changes from IndexedDB
      const db = await getDbInstance();

      // Get all words (for initial sync) or words modified since last sync
      const allWords = await db.wordEntries.toArray();

      const localWords: WordEntry[] = this.lastSyncedAt > 0
        ? allWords.filter(word => word.updatedAt > this.lastSyncedAt)
        : allWords;

      // Get all reviews (for initial sync) or reviews modified since last sync
      const allReviews = await db.reviewStates.toArray();

      const localReviews: ReviewState[] = this.lastSyncedAt > 0
        ? allReviews.filter(review => {
            // Check if review was updated since last sync
            // ✅ history가 undefined일 수 있으므로 체크
            if (!review.history || review.history.length === 0) {
              return false;
            }
            const lastHistory = review.history[review.history.length - 1];
            return lastHistory && lastHistory.reviewedAt > this.lastSyncedAt;
          })
        : allReviews;

      console.log('[SyncService] Push sync:', {
        totalWords: allWords.length,
        wordsToSync: localWords.length,
        totalReviews: allReviews.length,
        reviewsToSync: localReviews.length,
        isInitialSync: this.lastSyncedAt === 0,
      });

      // Debug: Log first word to check data structure
      if (localWords.length > 0) {
        const sampleWord = localWords[0];
        console.log('[SyncService] Sample word data:', {
          id: sampleWord?.id,
          word: sampleWord?.word,
          hasDefinitions: !!sampleWord?.definitions,
          definitionsCount: sampleWord?.definitions?.length,
          createdAt: sampleWord?.createdAt,
          updatedAt: sampleWord?.updatedAt,
        });
      }

      // Generate device ID
      const deviceId = await this.getDeviceId();

      // Push to server
      const response = await fetch(`${SYNC_CONFIG.API_BASE_URL}/sync/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          words: localWords,
          reviews: localReviews,
          deviceId,
          timestamp: this.getServerTime(),
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[SyncService] Push sync error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText,
        });
        throw new Error(`Push sync failed: ${response.status} - ${errorText}`);
      }

      const result = await response.json();

      // Update clock offset based on server response
      await this.updateClockOffset(result.timestamp);

      // Update last synced timestamp after successful push
      this.lastSyncedAt = result.timestamp;
      await chrome.storage.local.set({ lastSyncedAt: this.lastSyncedAt });

      console.log('[SyncService] Push sync completed:', {
        wordsSynced: result.synced.words,
        reviewsSynced: result.synced.reviews,
        timestamp: result.timestamp,
      });

      return {
        success: true,
        timestamp: result.timestamp,
        wordsSynced: result.synced.words,
        reviewsSynced: result.synced.reviews,
      };
    } catch (error) {
      console.error('[SyncService] Push sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Pull server changes to local
   * Downloads words and reviews modified since last sync
   */
  async pullSync(): Promise<SyncResult> {
    if (!this.currentUser) {
      throw new Error('Not authenticated');
    }

    if (this.syncInProgress) {
      throw new Error('Sync already in progress');
    }

    try {
      this.syncInProgress = true;

      // Get Firebase ID token
      const idToken = await this.getIdToken();

      // Pull from server
      const response = await fetch(
        `${SYNC_CONFIG.API_BASE_URL}/sync/pull?lastSyncedAt=${this.lastSyncedAt}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Pull sync failed: ${response.status}`);
      }

      const result = await response.json();

      // Apply server changes to IndexedDB
      const db = await getDbInstance();
      const { words, reviews } = result.data || { words: [], reviews: [] };

      let wordsApplied = 0;
      let reviewsApplied = 0;

      // Merge words with conflict resolution
      for (const serverWord of words) {
        try {
          const localWord = await db.wordEntries.get(serverWord.id);

          if (!localWord) {
            // New word from server - add it
            await db.wordEntries.add(serverWord);
            wordsApplied++;
          } else if (serverWord.deletedAt) {
            // Server word is deleted
            if (!localWord.deletedAt || serverWord.deletedAt > localWord.deletedAt) {
              // Apply deletion
              await db.wordEntries.update(serverWord.id, { deletedAt: serverWord.deletedAt });
              wordsApplied++;
            }
          } else if (serverWord.updatedAt > localWord.updatedAt) {
            // Server word is newer - update local
            await db.wordEntries.put(serverWord);
            wordsApplied++;
          }
          // else: local word is newer or same, keep local version
        } catch (error) {
          console.warn('[SyncService] Failed to merge word:', serverWord.id, error);
        }
      }

      // Merge review states with conflict resolution
      for (const serverReview of reviews) {
        try {
          const localReview = await db.reviewStates.get(serverReview.id);

          if (!localReview) {
            // New review from server - add it
            await db.reviewStates.add(serverReview);
            reviewsApplied++;
          } else {
            // Compare last history entry timestamps
            // ✅ history가 undefined일 수 있으므로 체크
            const serverLastHistory = serverReview.history?.[serverReview.history.length - 1];
            const localLastHistory = localReview.history?.[localReview.history.length - 1];

            if (serverLastHistory && localLastHistory) {
              if (serverLastHistory.reviewedAt > localLastHistory.reviewedAt) {
                // Server review is newer - update local
                await db.reviewStates.put(serverReview);
                reviewsApplied++;
              }
            } else if (serverLastHistory) {
              // Server has history but local doesn't - use server
              await db.reviewStates.put(serverReview);
              reviewsApplied++;
            }
          }
        } catch (error) {
          console.warn('[SyncService] Failed to merge review:', serverReview.id, error);
        }
      }

      // Update clock offset based on server response
      await this.updateClockOffset(result.timestamp);

      // Update last synced timestamp only if data was received
      // This prevents updating timestamp during initial sync when server is empty
      if (words.length > 0 || reviews.length > 0) {
        this.lastSyncedAt = result.timestamp;
        await chrome.storage.local.set({ lastSyncedAt: this.lastSyncedAt });
      }

      // Emit sync completed event for UI refresh
      if (wordsApplied > 0 || reviewsApplied > 0) {
        eventBus.emit('sync:completed', {
          wordsApplied,
          reviewsApplied,
          timestamp: result.timestamp,
        });
      }

      console.log('[SyncService] Pull sync completed:', {
        wordsReceived: words.length,
        wordsApplied,
        reviewsReceived: reviews.length,
        reviewsApplied,
      });

      return {
        success: true,
        timestamp: result.timestamp,
        wordsSynced: wordsApplied,
        reviewsSynced: reviewsApplied,
      };
    } catch (error) {
      console.error('[SyncService] Pull sync failed:', error);
      throw error;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Bidirectional sync
   * Performs pull then push to ensure consistency
   */
  async sync(): Promise<SyncResult> {
    try {
      // Pull first to get latest server changes (with retry)
      const pullResult = await this.retryOperation(
        () => this.pullSync(),
        'Pull sync'
      );

      // Then push local changes (with retry)
      const pushResult = await this.retryOperation(
        () => this.pushSync(),
        'Push sync'
      );

      return {
        success: true,
        timestamp: Date.now(),
        wordsSynced: pullResult.wordsSynced + pushResult.wordsSynced,
        reviewsSynced: pullResult.reviewsSynced + pushResult.reviewsSynced,
      };
    } catch (error) {
      console.error('[SyncService] Sync failed:', error);
      throw error;
    }
  }

  /**
   * Start auto-sync with configured interval
   */
  startAutoSync(): void {
    if (this.autoSyncTimerId) {
      return; // Already running
    }

    console.log('[SyncService] Starting auto-sync...');

    this.autoSyncTimerId = setInterval(() => {
      this.sync().catch((error) => {
        console.error('[SyncService] Auto-sync failed:', error);
      });
    }, SYNC_CONFIG.AUTO_SYNC_INTERVAL) as unknown as number;
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync(): void {
    if (this.autoSyncTimerId) {
      clearInterval(this.autoSyncTimerId);
      this.autoSyncTimerId = null;
      console.log('[SyncService] Auto-sync stopped');
    }
  }

  /**
   * Trigger debounced sync
   * Used after local data changes
   */
  triggerDebouncedSync(): void {
    if (this.debounceTimerId) {
      clearTimeout(this.debounceTimerId);
    }

    this.debounceTimerId = setTimeout(() => {
      this.sync().catch((error) => {
        console.error('[SyncService] Debounced sync failed:', error);
      });
    }, SYNC_CONFIG.DEBOUNCE_DELAY) as unknown as number;
  }

  /**
   * Get sync status
   */
  getStatus(): SyncStatus {
    return {
      isAuthenticated: !!this.currentUser,
      currentUser: this.currentUser,
      authToken: this.authToken, // 하위 호환성을 위해 유지 (null)
      lastSyncedAt: this.lastSyncedAt,
      syncInProgress: this.syncInProgress,
    };
  }

  /**
   * Reset last synced timestamp
   * Useful for forcing a full sync
   */
  async resetLastSyncedAt(): Promise<void> {
    this.lastSyncedAt = 0;
    await chrome.storage.local.set({ lastSyncedAt: 0 });
    console.log('[SyncService] Last synced timestamp reset to 0');
  }

  /**
   * Update clock offset based on server timestamp
   * Compensates for client-server time difference
   */
  private async updateClockOffset(serverTimestamp: number): Promise<void> {
    const clientTimestamp = Date.now();
    const newOffset = serverTimestamp - clientTimestamp;

    // Only update if significant difference (>1 second)
    if (Math.abs(newOffset - this.clockOffset) > 1000) {
      this.clockOffset = newOffset;
      await chrome.storage.local.set({ clockOffset: this.clockOffset });
      console.log(`[SyncService] Clock offset updated: ${this.clockOffset}ms (${(this.clockOffset / 1000).toFixed(1)}s)`);
    }
  }

  /**
   * Get server-adjusted timestamp
   * Returns current time adjusted for server clock
   */
  private getServerTime(): number {
    return Date.now() + this.clockOffset;
  }

  /**
   * Get or create device ID
   */
  private async getDeviceId(): Promise<string> {
    const result = await chrome.storage.local.get('deviceId');

    if (result.deviceId) {
      return result.deviceId;
    }

    // Generate new device ID
    const deviceId = `device_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await chrome.storage.local.set({ deviceId });

    return deviceId;
  }

  /**
   * Retry sync operation with exponential backoff
   */
  private async retryOperation<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= SYNC_CONFIG.MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;

        if (attempt < SYNC_CONFIG.MAX_RETRY_ATTEMPTS) {
          const delay = SYNC_CONFIG.RETRY_DELAY * Math.pow(2, attempt - 1); // Exponential backoff
          console.warn(`[SyncService] ${operationName} attempt ${attempt} failed, retrying in ${delay}ms...`, error);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`${operationName} failed after ${SYNC_CONFIG.MAX_RETRY_ATTEMPTS} attempts: ${lastError?.message}`);
  }
}

// Export singleton instance
export const syncService = new SyncService();
