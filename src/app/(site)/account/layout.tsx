import { AccountNav } from "@/components/account/account-nav";
import { MotionProvider } from "@/components/providers/motion-provider";
import { requireCustomerPage } from "@/lib/server/auth";
import { getSetting } from "@/lib/server/settings";

export default async function AccountLayout({ children }: LayoutProps<"/account">) {
  const [{ customer }, business] = await Promise.all([requireCustomerPage("/account"), getSetting("business")]);
  return (
    <MotionProvider>
      <div className="bg-screen">
        <div className="container-page grid grid-cols-[minmax(0,1fr)] gap-5 pb-14 pt-4 sm:pt-6 lg:grid-cols-[264px_minmax(0,1fr)] lg:gap-8 lg:pb-20 lg:pt-8">
          <div className="no-print min-w-0">
            <AccountNav name={customer.name} email={customer.email} phone={business.phone || undefined} whatsapp={business.whatsapp || business.phone || undefined} />
          </div>
          <div className="min-w-0">{children}</div>
        </div>
      </div>
    </MotionProvider>
  );
}
