import { GetSecretValueCommand, SecretsManagerClient } from '@aws-sdk/client-secrets-manager';

/** Fetch a plain-text secret from AWS Secrets Manager by ARN. */
export async function fetchSecret(arn: string): Promise<string> {
  const client = new SecretsManagerClient();
  const res = await client.send(new GetSecretValueCommand({ SecretId: arn }));
  if (!res.SecretString) {
    throw new Error(`Secret ${arn} has no string value`);
  }
  return res.SecretString;
}
