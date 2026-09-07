/** Shared native API in supported browsers and Node 22; intentionally no DOM or Node ambient types. */
declare function structuredClone<T>(value: T): T;
