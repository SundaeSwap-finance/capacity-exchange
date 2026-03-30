import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

export async function getSecretKey(secretsManager: SecretsManagerClient, secretId: string) {
    const response = await secretsManager.send(
        new GetSecretValueCommand({ SecretId: secretId })
    );

    if (!response.SecretString) {
        throw new Error(`Secret '${secretId}' has no string value`);
    }

    return response.SecretString;
}