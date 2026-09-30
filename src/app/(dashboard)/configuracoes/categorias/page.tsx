import { requireUser } from "@/lib/auth/session";
import { CatalogManager } from "@/components/finance/catalog-manager";
export default async function Page() { await requireUser(); return <CatalogManager kind="categories" />; }

