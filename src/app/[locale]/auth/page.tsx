import { Suspense } from "react";
import { AuthForm } from "@/components/features/auth-form";
export default function AuthPage() {
  return (
    <Suspense fallback={<p>Loading…</p>}>
      <AuthForm />
    </Suspense>
  );
}
