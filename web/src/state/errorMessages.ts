import type { BusinessIdentity } from "./types";

/**
 * Les messages d'erreur du moteur (RangeError/TimeBudgetError) sont précis
 * pour le débogage mais embarquent parfois un id technique
 * (`businessId="service-a3f8e21c"`) — jamais destiné au joueur (spec M11.1
 * I1, étendu M11.1.5 §3.2 : aucune fuite d'id technique, y compris dans les
 * messages d'erreur). Cette fonction retire le préfixe technique
 * (`simulateMonth: `, `resolveBusinessMonth: `...) et remplace tout id
 * d'entreprise connu par son nom commercial affiché.
 */
export function sanitizeEngineError(
  message: string,
  businessIdentities: Readonly<Record<string, BusinessIdentity>>,
): string {
  let result = message.replace(/^[A-Za-z]+:\s*/, "");
  for (const [id, identity] of Object.entries(businessIdentities)) {
    result = result.split(`businessId="${id}"`).join(`« ${identity.displayName} »`);
    result = result.split(`"${id}"`).join(`« ${identity.displayName} »`);
  }
  return result.trim();
}
