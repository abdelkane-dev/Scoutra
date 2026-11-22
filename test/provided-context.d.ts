export interface TestDbInfo {
  available: boolean;
  appUrl: string;
  authUrl: string;
  migratorUrl: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    db: TestDbInfo;
  }
}
