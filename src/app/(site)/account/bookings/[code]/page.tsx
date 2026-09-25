import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookingDetail } from "@/components/account/booking-detail";
import { ApiError } from "@/lib/server/api";
import { requireCustomerPage } from "@/lib/server/auth";
import { customerBookingDetail } from "@/lib/server/customer-bookings";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage(props: PageProps<"/account/bookings/[code]">) {
  const { code } = await props.params;
  const { customer } = await requireCustomerPage(`/account/bookings/${encodeURIComponent(code)}`);
  let data;
  try {
    data = await customerBookingDetail(customer.id, code);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  return (
    <div className="space-y-4">
      <Link href="/account/bookings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> All rides
      </Link>
      <BookingDetail data={data} />
    </div>
  );
}
