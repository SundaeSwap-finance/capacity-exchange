import { DefaultApi } from '@client/apis/DefaultApi';
import { Configuration } from '@client/runtime';

export const getApi = () => {
  const config = new Configuration({
    basePath: 'http://localhost:3000',
  });
  return new DefaultApi(config);
};
