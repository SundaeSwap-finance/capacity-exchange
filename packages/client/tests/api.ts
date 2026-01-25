import { PromiseDefaultApi } from '@client/types/PromiseAPI';
import { createConfiguration } from '@client/configuration';
import { ServerConfiguration } from '@client/servers';

export const getApi = () => {
  const config = createConfiguration({
    baseServer: new ServerConfiguration("http://localhost:3000", {})
  });
  return new PromiseDefaultApi(config);
};
