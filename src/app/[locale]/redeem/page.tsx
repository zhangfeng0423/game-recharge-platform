import { RedeemForm } from "@/components/features/redeem-form";

export default async function RedeemPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return (
    <div className="container mx-auto px-4 py-12">
      <RedeemForm />
    </div>
  );
}
