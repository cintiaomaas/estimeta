"use client";

import { useState } from "react";
import Image from "next/image";
import { Landmark } from "lucide-react";
import { banks, findBank } from "@/lib/finance/banks";
import { Select } from "./controls";

function BankLogo({ bank }: { bank: ReturnType<typeof findBank> }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  return <span className="bank-logo">
    {!loaded && <Landmark size={24} aria-hidden="true" />}
    {bank?.logo && !failed && <Image src={bank.logo} alt={bank.name} width={32} height={32} unoptimized
      style={{ opacity: loaded ? 1 : 0 }}
      onLoad={() => setLoaded(true)} onError={() => { setFailed(true); setLoaded(false); }} />}
  </span>;
}

export function BankIdentity({ bankCode }: { bankCode?: string | null }) {
  const bank = findBank(bankCode);
  return <span className="bank-identity"><BankLogo key={bank?.code ?? "unknown"} bank={bank} /><span>{bank?.name ?? "Instituição não informada"}</span></span>;
}

export function BankSelect({ defaultValue }: { defaultValue?: string | null }) {
  const [value, setValue] = useState<string>(findBank(defaultValue)?.code ?? "");
  return <div className="bank-select">
    <Select id="catalog-bank" name="bankCode" label="Banco / Instituição financeira" value={value} onChange={(event) => setValue(event.target.value)}>
      <option value="">Não informada</option>
      {banks.map((bank) => <option key={bank.code} value={bank.code}>{bank.name}</option>)}
    </Select>
    <BankIdentity bankCode={value} />
  </div>;
}
