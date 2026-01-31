export type EndpointStatus = 'online' | 'starting' | 'offline' | 'loading';

export interface EndpointConfig {
  label: string;
  url: string;
  healthPath: string;
  readyPath?: string;
  /** If true, health check uses POST with GraphQL introspection query */
  graphql?: boolean;
}
