/**
 * CatchVoca Logger Utility
 * 환경별 로그 레벨 제어 및 구조화된 로깅
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogEntry {
  level: string;
  timestamp: string;
  context?: string;
  message: string;
  data?: unknown;
}

export class Logger {
  private currentLevel: LogLevel;
  private context?: string;

  constructor(context?: string) {
    this.context = context;
    // 환경별 로그 레벨 설정
    this.currentLevel = this.getEnvironmentLogLevel();
  }

  /**
   * 환경에 따른 로그 레벨 결정
   */
  private getEnvironmentLogLevel(): LogLevel {
    // Chrome Extension 환경에서는 import.meta.env 사용 불가
    // 대신 globalThis 또는 process.env 체크
    if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
      return LogLevel.WARN;
    }

    // Development 환경
    return LogLevel.DEBUG;
  }

  /**
   * 로그 출력 여부 판단
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.currentLevel;
  }

  /**
   * 로그 엔트리 생성
   */
  private createLogEntry(level: string, message: string, data?: unknown): LogEntry {
    return {
      level,
      timestamp: new Date().toISOString(),
      context: this.context,
      message,
      data,
    };
  }

  /**
   * 로그 포맷팅
   */
  private formatLog(entry: LogEntry): string {
    const contextStr = entry.context ? `[${entry.context}]` : '';
    const dataStr = entry.data ? `\n${JSON.stringify(entry.data, null, 2)}` : '';
    return `${entry.timestamp} ${entry.level} ${contextStr} ${entry.message}${dataStr}`;
  }

  /**
   * DEBUG 레벨 로그
   */
  debug(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const entry = this.createLogEntry('DEBUG', message, data);
    console.debug(this.formatLog(entry));
  }

  /**
   * INFO 레벨 로그
   */
  info(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const entry = this.createLogEntry('INFO', message, data);
    console.info(this.formatLog(entry));
  }

  /**
   * WARN 레벨 로그
   */
  warn(message: string, data?: unknown): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const entry = this.createLogEntry('WARN', message, data);
    console.warn(this.formatLog(entry));
  }

  /**
   * ERROR 레벨 로그
   */
  error(message: string, error?: unknown): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const entry = this.createLogEntry('ERROR', message, error);
    console.error(this.formatLog(entry));

    // Error 객체인 경우 스택 트레이스 추가 출력
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
  }

  /**
   * 컨텍스트가 있는 새 Logger 인스턴스 생성
   */
  withContext(context: string): Logger {
    return new Logger(context);
  }

  /**
   * 로그 레벨 동적 변경 (테스트용)
   */
  setLogLevel(level: LogLevel): void {
    this.currentLevel = level;
  }
}

// 기본 Logger 인스턴스 (lazy initialization)
let _logger: Logger | null = null;

export const logger = {
  get instance(): Logger {
    if (!_logger) {
      _logger = new Logger();
    }
    return _logger;
  },

  debug(message: string, data?: unknown): void {
    this.instance.debug(message, data);
  },

  info(message: string, data?: unknown): void {
    this.instance.info(message, data);
  },

  warn(message: string, data?: unknown): void {
    this.instance.warn(message, data);
  },

  error(message: string, error?: unknown): void {
    this.instance.error(message, error);
  },

  withContext(context: string): Logger {
    return this.instance.withContext(context);
  },

  setLogLevel(level: LogLevel): void {
    this.instance.setLogLevel(level);
  },
};
