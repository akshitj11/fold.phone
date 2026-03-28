import { LIT_NETWORK } from '@lit-protocol/constants';
import { LitNodeClient } from '@lit-protocol/lit-node-client';

let litClient: LitNodeClient | null = null;
let connectPromise: Promise<LitNodeClient> | null = null;

export async function initializeLitClient(): Promise<LitNodeClient> {
  if (litClient) return litClient;
  if (connectPromise) return connectPromise;

  const client = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev,
  });

  connectPromise = client.connect().then(() => {
    litClient = client;
    return client;
  });

  return connectPromise;
}

export async function getLitClient(): Promise<LitNodeClient> {
  if (litClient) return litClient;
  return initializeLitClient();
}
