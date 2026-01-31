export type EndpointStatusType = 'online' | 'starting' | 'offline' | 'loading';

export interface EndpointStatus {
  status: EndpointStatusType;
  details?: string;
}

interface BaseEndpoint {
  label: string;
  url: string;
}

export interface GraphQLEndpoint extends BaseEndpoint {
  type: 'graphql';
}

export interface RESTEndpoint extends BaseEndpoint {
  type: 'rest';
  healthPath: string;
  readyPath?: string;
}

export type EndpointConfig = GraphQLEndpoint | RESTEndpoint;
