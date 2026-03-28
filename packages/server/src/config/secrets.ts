import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

const secretsManagerClient = new SecretsManagerClient();

/** Fetch a plain-text secret from AWS Secrets Manager by ARN or secret name. */
export async function fetchSecret(secretId: string): Promise<string> {
  const res = await secretsManagerClient.send(new GetSecretValueCommand({ SecretId: secretId }));
  if (!res.SecretString) {
    throw new Error(`Secret ${secretId} has no string value`);
  }
  return res.SecretString;
}
