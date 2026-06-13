import type { Metadata } from "next";
import Link from "next/link";
import { Brain } from "lucide-react";

export const metadata: Metadata = {
  title: "MindWell - Your Wellness Companion",
  description: "AI-powered mental wellness tracker for competitive exam students",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-calm-50 via-white to-wellness-50 flex flex-col">
      <header className="p-6">
        <Link href="/" className="flex items-center gap-2 w-fit">
          <div className="w-8 h-8 bg-gradient-to-br from-calm-500 to-wellness-500 rounded-lg flex items-center justify-center">
            <Brain className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold bg-gradient-to-r from-calm-700 to-wellness-700 bg-clip-text text-transparent">
            MindWell
          </span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">{children}</div>
      </main>
      <footer className="p-6 text-center text-sm text-muted-foreground">
        <p>
          If you are in crisis, please contact{" "}
          <a
            href="tel:9152987821"
            className="text-calm-600 hover:underline font-medium"
          >
            iCall: 9152987821
          </a>{" "}
          or{" "}
          <a
            href="tel:08046110007"
            className="text-calm-600 hover:underline font-medium"
          >
            NIMHANS: 080-46110007
          </a>
        </p>
      </footer>
    </div>
  );
}
