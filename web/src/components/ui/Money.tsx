import { formatMoney, formatSignedMoney } from "../../lib/format";

export function Money({ amount, signed = false, precise = false }: { readonly amount: number; readonly signed?: boolean; readonly precise?: boolean }) {
  return <>{signed ? formatSignedMoney(amount) : formatMoney(amount, precise)}</>;
}
