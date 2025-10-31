/**
 * BaseRepository - 공통 Repository 로직을 제공하는 추상 클래스
 */

import type { Table } from 'dexie';

/**
 * 모든 Repository의 기본 인터페이스
 */
export interface IRepository<T, CreateDTO, UpdateDTO> {
  create(data: CreateDTO): Promise<string>;
  findById(id: string): Promise<T | null>;
  update(id: string, changes: UpdateDTO): Promise<void>;
  delete(id: string): Promise<void>;
  findAll(): Promise<T[]>;
}

/**
 * BaseRepository 추상 클래스
 * - 공통 CRUD 로직 제공
 * - Dexie Table 추상화
 */
export abstract class BaseRepository<T extends { id: string }, CreateDTO, UpdateDTO>
  implements IRepository<T, CreateDTO, UpdateDTO>
{
  constructor(protected table: Table<T, string>) {}

  /**
   * ID로 엔티티 조회
   */
  async findById(id: string): Promise<T | null> {
    const entity = await this.table.get(id);
    return entity || null;
  }

  /**
   * 엔티티 업데이트
   */
  async update(id: string, changes: UpdateDTO): Promise<void> {
    const exists = await this.table.get(id);
    if (!exists) {
      throw new Error(`Entity with id ${id} not found`);
    }

    await this.table.update(id, changes as Partial<T>);
  }

  /**
   * 엔티티 삭제
   */
  async delete(id: string): Promise<void> {
    await this.table.delete(id);
  }

  /**
   * 모든 엔티티 조회
   */
  async findAll(): Promise<T[]> {
    return await this.table.toArray();
  }

  /**
   * 엔티티 생성 (추상 메서드, 하위 클래스에서 구현)
   */
  abstract create(data: CreateDTO): Promise<string>;

  /**
   * 엔티티 존재 여부 확인
   */
  protected async exists(id: string): Promise<boolean> {
    const entity = await this.table.get(id);
    return !!entity;
  }

  /**
   * 여러 엔티티를 한 번에 생성
   */
  protected async bulkCreate(entities: T[]): Promise<string[]> {
    const keys = await this.table.bulkAdd(entities, { allKeys: true });
    return keys as string[];
  }
}
