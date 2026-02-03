export type EndpointStatus = 'online' | 'starting' | 'offline' | 'loading';

export interface EndpointConfig {
  label: string;
  url: string;
  healthPath: string;
  readyPath?: string;
}
