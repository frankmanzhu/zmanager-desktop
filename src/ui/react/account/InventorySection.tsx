export function InventorySection({
  title,
  icon,
  empty,
  children,
}: Readonly<{
  title: string;
  icon: React.ReactNode;
  empty: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="grid gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </h3>
      <div className="grid gap-2">
        {children || <p className="text-xs opacity-60">{empty}</p>}
      </div>
    </section>
  );
}
