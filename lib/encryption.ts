import { AccessControlConditions, encryptString } from '@lit-protocol/auth-helpers';
import { getLitClient } from '@/lib/lit';

export interface EncryptedMemoryPayload {
  ciphertext: string;
  dataToEncryptHash: string;
  accessControlConditions: AccessControlConditions;
}

export function createWalletAccessControlConditions(
  walletAddress: string,
): AccessControlConditions {
  return [
    {
      contractAddress: '',
      standardContractType: '',
      chain: 'polygon',
      method: '',
      parameters: [':userAddress'],
      returnValueTest: {
        comparator: '=',
        value: walletAddress.toLowerCase(),
      },
    },
  ];
}

export async function encryptMemory(
  text: string,
  walletAddress: string,
): Promise<EncryptedMemoryPayload> {
  const accessControlConditions = createWalletAccessControlConditions(walletAddress);
  const { ciphertext, dataToEncryptHash } = await encryptString(
    {
      accessControlConditions,
      dataToEncrypt: text,
    },
    await getLitClient(),
  );

  return {
    ciphertext,
    dataToEncryptHash,
    accessControlConditions,
  };
}

export async function decryptMemory(
  ciphertext: string,
  dataToEncryptHash: string,
  accessControlConditions: AccessControlConditions,
  sessionSigs: Record<string, unknown>,
): Promise<string> {
  const litClient = await getLitClient();
  const decrypted = await litClient.decrypt({
    accessControlConditions,
    chain: 'polygon',
    ciphertext,
    dataToEncryptHash,
    sessionSigs,
  });

  if (typeof decrypted === 'string') return decrypted;
  return new TextDecoder().decode(decrypted as Uint8Array<ArrayBufferLike>);
}
