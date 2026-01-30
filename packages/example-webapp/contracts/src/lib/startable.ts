export interface Startable<T> {
  start(): Promise<T>;
}
