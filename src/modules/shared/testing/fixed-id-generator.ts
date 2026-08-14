import type { IdGenerator } from "../domain/id-generator";

export class FixedIdGenerator implements IdGenerator {
  constructor(private readonly id: string) {}

  next(): string {
    return this.id;
  }
}
