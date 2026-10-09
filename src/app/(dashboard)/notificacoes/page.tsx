import { NotificationCenter } from "@/components/notifications/notification-center";
export default async function Page({ searchParams }: { searchParams: Promise<{ selected?: string }> }) {
  const { selected } = await searchParams;
  return <NotificationCenter selected={selected && /^[a-f0-9-]{36}$/.test(selected) ? selected : undefined} />;
}
