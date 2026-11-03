import type { AccountRecord } from "@/lib/finance/client";
import { currency } from "@/lib/finance/client";
import { foreignMoney } from "@/lib/finance/currencies";
import { displayDate } from "@/lib/finance/dates";

export function AccountBalance({ account: row }: { account: AccountRecord }) {
  const foreign = !!row.currency && row.currency !== "BRL";
  const balance = row.balance === undefined ? row.initialBalance : row.balance;
  return <>
    <dl><dt>Saldo ao fim de {row.balancePeriod?.split("-").reverse().join("/") ?? "mês corrente"}</dt>
      <dd className={balance?.startsWith("-") ? "negative" : undefined}>{balance === null ? "Conversão indisponível" : currency(balance)}</dd>
      <dt>Saldo inicial: {foreign ? row.initialBalanceBRL ? currency(row.initialBalanceBRL) : "Conversão indisponível" : currency(row.initialBalance)}</dt>
    </dl>
    {foreign && <div className="account-exchange">
      <small>Equivalente a {foreignMoney(row.originalBalance ?? row.initialBalance, row.currency!)}</small>
      {row.exchange ? <>
        <small>Cotação: 1 {row.currency} = R$ {row.exchange.rate.replace(/0+$/, "").replace(/\.$/, "").replace(".", ",")} · Referência: {displayDate(row.exchange.referenceDate)}</small>
        <small>{row.exchange.source}{row.currency === "ARS" ? " · ARS de referência, não paralelo" : ""}</small>
        {row.exchange.stale && <small role="status">Não foi possível atualizar. Exibindo a última cotação salva.</small>}
      </> : <small role="status">Sem cotação disponível. Esta conta ainda não participa dos totais em reais.</small>}
    </div>}
  </>;
}
