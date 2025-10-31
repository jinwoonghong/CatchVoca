/**
 * EventBus 테스트
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventBus } from '../../../src/services/events/EventBus';

// BroadcastChannel Mock
class MockBroadcastChannel {
  name: string;
  onmessage: ((event: MessageEvent) => void) | null = null;
  private static channels: Map<string, MockBroadcastChannel[]> = new Map();

  constructor(name: string) {
    this.name = name;

    // 같은 이름의 채널 그룹에 등록
    if (!MockBroadcastChannel.channels.has(name)) {
      MockBroadcastChannel.channels.set(name, []);
    }
    MockBroadcastChannel.channels.get(name)!.push(this);
  }

  postMessage(message: unknown): void {
    // 같은 채널 이름을 가진 다른 인스턴스에 메시지 전달
    const channels = MockBroadcastChannel.channels.get(this.name) || [];
    channels.forEach((channel) => {
      if (channel !== this && channel.onmessage) {
        // 비동기로 메시지 전달 (실제 BroadcastChannel 동작 모방)
        setTimeout(() => {
          channel.onmessage?.(new MessageEvent('message', { data: message }));
        }, 0);
      }
    });
  }

  close(): void {
    const channels = MockBroadcastChannel.channels.get(this.name);
    if (channels) {
      const index = channels.indexOf(this);
      if (index > -1) {
        channels.splice(index, 1);
      }
    }
  }

  static reset(): void {
    this.channels.clear();
  }
}

describe('EventBus', () => {
  beforeEach(() => {
    // BroadcastChannel Mock 설정
    globalThis.BroadcastChannel = MockBroadcastChannel as unknown as typeof BroadcastChannel;
    MockBroadcastChannel.reset();
  });

  afterEach(() => {
    MockBroadcastChannel.reset();
  });

  describe('초기화', () => {
    it('EventBus 인스턴스를 생성해야 함', () => {
      const bus = new EventBus();
      expect(bus).toBeInstanceOf(EventBus);
      expect(bus.isAvailable()).toBe(true);
      bus.close();
    });

    it('커스텀 채널 이름으로 생성해야 함', () => {
      const bus = new EventBus('custom-channel');
      expect(bus.isAvailable()).toBe(true);
      bus.close();
    });

    it('고유한 senderId를 생성해야 함', () => {
      const bus1 = new EventBus();
      const bus2 = new EventBus();
      expect(bus1.getSenderId()).not.toBe(bus2.getSenderId());
      bus1.close();
      bus2.close();
    });
  });

  describe('on/off', () => {
    it('이벤트 핸들러를 등록해야 함', () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.on('word:created', handler);
      expect(bus.getHandlerCount('word:created')).toBe(1);
      bus.close();
    });

    it('여러 핸들러를 등록할 수 있어야 함', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('word:created', handler1);
      bus.on('word:created', handler2);
      expect(bus.getHandlerCount('word:created')).toBe(2);
      bus.close();
    });

    it('특정 핸들러를 제거해야 함', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('word:created', handler1);
      bus.on('word:created', handler2);
      bus.off('word:created', handler1);

      expect(bus.getHandlerCount('word:created')).toBe(1);
      bus.close();
    });

    it('특정 타입의 모든 핸들러를 제거해야 함', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('word:created', handler1);
      bus.on('word:created', handler2);
      bus.off('word:created');

      expect(bus.getHandlerCount('word:created')).toBe(0);
      bus.close();
    });
  });

  describe('emit', () => {
    it('이벤트를 발행해야 함', async () => {
      const bus1 = new EventBus('test-channel');
      const bus2 = new EventBus('test-channel');
      const handler = vi.fn();

      bus2.on('word:created', handler);

      const testData = { word: 'test', meaning: 'testing' };
      bus1.emit('word:created', testData);

      // BroadcastChannel은 비동기이므로 대기
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).toHaveBeenCalledWith(testData);
      bus1.close();
      bus2.close();
    });

    it('같은 타입의 여러 핸들러를 호출해야 함', async () => {
      const bus1 = new EventBus('test-channel');
      const bus2 = new EventBus('test-channel');
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus2.on('word:created', handler1);
      bus2.on('word:created', handler2);

      const testData = { word: 'test' };
      bus1.emit('word:created', testData);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalledWith(testData);
      expect(handler2).toHaveBeenCalledWith(testData);
      bus1.close();
      bus2.close();
    });

    it('자신이 보낸 메시지는 무시해야 함', async () => {
      const bus = new EventBus('test-channel');
      const handler = vi.fn();

      bus.on('word:created', handler);
      bus.emit('word:created', { word: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler).not.toHaveBeenCalled();
      bus.close();
    });

    it('다른 이벤트 타입에는 영향을 주지 않아야 함', async () => {
      const bus1 = new EventBus('test-channel');
      const bus2 = new EventBus('test-channel');
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus2.on('word:created', handler1);
      bus2.on('word:updated', handler2);

      bus1.emit('word:created', { word: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(handler1).toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      bus1.close();
      bus2.close();
    });
  });

  describe('clear', () => {
    it('모든 핸들러를 제거해야 함', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('word:created', handler1);
      bus.on('word:updated', handler2);

      expect(bus.getHandlerCount()).toBe(2);

      bus.clear();

      expect(bus.getHandlerCount()).toBe(0);
      bus.close();
    });
  });

  describe('close', () => {
    it('리소스를 해제하고 핸들러를 모두 제거해야 함', () => {
      const bus = new EventBus();
      const handler = vi.fn();

      bus.on('word:created', handler);
      expect(bus.isAvailable()).toBe(true);

      bus.close();

      expect(bus.isAvailable()).toBe(false);
      expect(bus.getHandlerCount()).toBe(0);
    });
  });

  describe('getHandlerCount', () => {
    it('특정 타입의 핸들러 개수를 반환해야 함', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.on('word:created', handler1);
      bus.on('word:created', handler2);

      expect(bus.getHandlerCount('word:created')).toBe(2);
      bus.close();
    });

    it('전체 핸들러 개수를 반환해야 함', () => {
      const bus = new EventBus();
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      bus.on('word:created', handler1);
      bus.on('word:updated', handler2);
      bus.on('word:deleted', handler3);

      expect(bus.getHandlerCount()).toBe(3);
      bus.close();
    });

    it('등록되지 않은 타입은 0을 반환해야 함', () => {
      const bus = new EventBus();
      expect(bus.getHandlerCount('word:created')).toBe(0);
      bus.close();
    });
  });

  describe('에러 처리', () => {
    it('핸들러 에러가 다른 핸들러 실행을 방해하지 않아야 함', async () => {
      const bus1 = new EventBus('test-channel');
      const bus2 = new EventBus('test-channel');

      const errorHandler = vi.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = vi.fn();

      bus2.on('word:created', errorHandler);
      bus2.on('word:created', successHandler);

      // console.error를 모킹하여 에러 로그 숨기기
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      bus1.emit('word:created', { word: 'test' });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
      bus1.close();
      bus2.close();
    });
  });

  describe('복잡한 시나리오', () => {
    it('여러 탭 간 데이터 동기화 시뮬레이션', async () => {
      // 3개의 탭 시뮬레이션
      const tab1 = new EventBus('catchvoca');
      const tab2 = new EventBus('catchvoca');
      const tab3 = new EventBus('catchvoca');

      const tab2Handler = vi.fn();
      const tab3Handler = vi.fn();

      tab2.on('word:created', tab2Handler);
      tab3.on('word:created', tab3Handler);

      const wordData = { word: 'synchronize', meaning: '동기화하다' };
      tab1.emit('word:created', wordData);

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(tab2Handler).toHaveBeenCalledWith(wordData);
      expect(tab3Handler).toHaveBeenCalledWith(wordData);

      tab1.close();
      tab2.close();
      tab3.close();
    });
  });
});
