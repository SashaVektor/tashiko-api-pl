import crypto from "node:crypto";
import axios from "axios";

const PUBKEY_URL = "https://api.monobank.ua/api/merchant/pubkey";

let cachedPublicKeyPem = null;

const fetchPublicKey = async () => {
  const { data } = await axios.get(PUBKEY_URL, {
    headers: { "X-Token": process.env.MONOBANK_TOKEN },
  });
  cachedPublicKeyPem = Buffer.from(data.key, "base64").toString("utf8");
  return cachedPublicKeyPem;
};

const verifyWithKey = (rawBody, signatureBase64, publicKeyPem) => {
  const verifier = crypto.createVerify("SHA256");
  verifier.update(rawBody);
  verifier.end();
  return verifier.verify(publicKeyPem, Buffer.from(signatureBase64, "base64"));
};

export const verifyMonobankSignature = async (rawBody, signatureBase64) => {
  if (!rawBody || !signatureBase64) return false;

  const currentKey = cachedPublicKeyPem || (await fetchPublicKey());
  try {
    if (verifyWithKey(rawBody, signatureBase64, currentKey)) return true;
  } catch {
    // Malformed signature against the cached key — fall through and retry
    // once against a freshly fetched key in case it was rotated.
  }

  const freshKey = await fetchPublicKey();
  if (freshKey === currentKey) return false;
  try {
    return verifyWithKey(rawBody, signatureBase64, freshKey);
  } catch {
    return false;
  }
};
