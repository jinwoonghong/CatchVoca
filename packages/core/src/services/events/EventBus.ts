/**
 * EventBus - 실시간 이벤트 동기화
 * BroadcastChannel API를 사용하여 탭 간 데이터 동기화
 */

import type { EventType } from '@catchvoca/types';

/**
 * 이벤트 핸들러 타입
 */
export type EventHandler<T = unknown> = (data: T) => void;

/**
 * 이벤트 메시지 구조
 */
export interface EventMessage<T = unknown> {
  /** 이벤트 타입 */
  type: EventType;
  /** 이벤트 데이터 */
  data: T;
  /** 발생 시각 (timestamp) */
  timestamp: number;
  /** 발신자 ID (선택사항) */
  senderId?: string;
}

/**
 * EventBus 클래스
 * BroadcastChannel을 래핑하여 타입 안전한 이벤트 시스템 제공
 */
export class EventBus {
  private channel: BroadcastChannel | null = null;
  private handlers: Map<EventType, Set<EventHandler>> = new Map();
  private readonly channelName: string;
  private readonly senderId: string;

  /**
   * EventBus 생성자
   * @param channelName BroadcastChannel 이름 (기본값: 'catchvoca-events')
   */
  constructor(channelName: string = 'catchvoca-events') {
    this.channelName = channelName;
    this.senderId = this.generateSenderId();
    this.initialize();
  }

  /**
   * BroadcastChannel 초기화
   */
  private initialize(): void {
    if (typeof BroadcastChannel === 'undefined') {
      console.warn('BroadcastChannel is not supported in this environment');
      return;
    }

    this.channel = new BroadcastChannel(this.channelName);
    this.channel.onmessage = (event: MessageEvent<EventMessage>) => {
      this.handleMessage(event.data);
    };
  }

  /**
   * 발신자 ID 생성
   */
  private generateSenderId(): string {
    return `sender-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 메시지 처리
   */
  private handleMessage(message: EventMessage): void {
    // 자신이 보낸 메시지는 무시 (선택사항)
    if (message.senderId === this.senderId) {
      return;
    }

    const handlers = this.handlers.get(message.type);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(message.data);
        } catch (error) {
          console.error(`Error in event handler for ${message.type}:`, error);
        }
      });
    }
  }

  /**
   * 이벤트 발행
   * @param type 이벤트 타입
   * @param data 이벤트 데이터
   */
  emit<T = unknown>(type: EventType, data: T): void {
    if (!this.channel) {
      console.warn('BroadcastChannel is not available');
      return;
    }

    const message: EventMessage<T> = {
      type,
      data,
      timestamp: Date.now(),
      senderId: this.senderId,
    };

    try {
      this.channel.postMessage(message);
    } catch (error) {
      console.error(`Failed to emit event ${type}:`, error);
    }
  }

  /**
   * 이벤트 핸들러 등록
   * @param type 이벤트 타입
   * @param handler 이벤트 핸들러
   */
  on<T = unknown>(type: EventType, handler: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }

    const handlers = this.handlers.get(type)!;
    handlers.add(handler as EventHandler);
  }

  /**
   * 이벤트 핸들러 제거
   * @param type 이벤트 타입
   * @param handler 제거할 핸들러 (생략 시 해당 타입의 모든 핸들러 제거)
   */
  off<T = unknown>(type: EventType, handler?: EventHandler<T>): void {
    if (!this.handlers.has(type)) {
      return;
    }

    if (handler) {
      // 특정 핸들러만 제거
      const handlers = this.handlers.get(type)!;
      handlers.delete(handler as EventHandler);

      // 핸들러가 없으면 Map에서도 제거
      if (handlers.size === 0) {
        this.handlers.delete(type);
      }
    } else {
      // 해당 타입의 모든 핸들러 제거
      this.handlers.delete(type);
    }
  }

  /**
   * 모든 이벤트 핸들러 제거
   */
  clear(): void {
    this.handlers.clear();
  }

  /**
   * EventBus 종료 및 리소스 해제
   */
  close(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.clear();
  }

  /**
   * 등록된 핸들러 개수 조회
   * @param type 이벤트 타입 (선택사항)
   * @returns 핸들러 개수
   */
  getHandlerCount(type?: EventType): number {
    if (type) {
      return this.handlers.get(type)?.size ?? 0;
    }

    let total = 0;
    this.handlers.forEach((handlers) => {
      total += handlers.size;
    });
    return total;
  }

  /**
   * BroadcastChannel 사용 가능 여부 확인
   */
  isAvailable(): boolean {
    return this.channel !== null;
  }

  /**
   * 현재 발신자 ID 조회
   */
  getSenderId(): string {
    return this.senderId;
  }
}

/**
 * 싱글톤 EventBus 인스턴스
 */
export const eventBus = new EventBus();
