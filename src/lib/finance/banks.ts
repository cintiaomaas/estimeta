/** Local visual metadata only; no banking integrations. */
export const banks = [
  { code: "itau", name: "Itaú", logo: "/banks/itau.png" },
  { code: "nubank", name: "Nubank", logo: "/banks/nubank.png" },
  { code: "banco-do-brasil", name: "Banco do Brasil", logo: "/banks/banco-do-brasil.svg" },
  { code: "bradesco", name: "Bradesco", logo: "/banks/bradesco.png" },
  { code: "santander", name: "Santander", logo: "/banks/santander.jpg" },
  { code: "caixa", name: "Caixa Econômica Federal", logo: "/banks/caixa.svg" },
  { code: "inter", name: "Banco Inter", logo: "/banks/inter.svg" },
  { code: "c6-bank", name: "C6 Bank", logo: "/banks/c6-bank.svg" },
  { code: "sicredi", name: "Sicredi", logo: "/banks/sicredi.png" },
  { code: "sicoob", name: "Sicoob", logo: "/banks/sicoob.svg" },
  { code: "viacredi", name: "Viacredi", logo: "/banks/viacredi.jpg" },
  { code: "picpay", name: "PicPay", logo: "/banks/picpay.svg" },
  { code: "other", name: "Outro", logo: null },
] as const;

export type BankCode = (typeof banks)[number]["code"];
export const bankCodes = banks.map((bank) => bank.code);
export function findBank(code?: string | null) {
  return banks.find((bank) => bank.code === code);
}
