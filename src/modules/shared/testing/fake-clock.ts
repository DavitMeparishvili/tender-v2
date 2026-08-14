import type { Clock } from "../domain/clock";

export class FakeClock implements Clock {
  constructor(private readonly current: Date) {}

  now(): Date {
    return this.current;
  }
}
