// components/Layout.tsx
import Head from "next/head";
import { useSession } from "next-auth/react";
import { useRouter } from "next/router";
import Header from "./Header";

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
  requireAuth?: boolean;
  requireAdmin?: boolean;
}

export default function Layout({
  children,
  title = "勤怠管理システム",
  requireAuth = false,
  requireAdmin = false,
}: LayoutProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === "loading") {
    return <div className="loading">Loading...</div>;
  }

  if (requireAuth && !session) {
    router.push("/login");
    return null;
  }

  if (requireAdmin && (!session || !session.user?.isAdmin)) {
    router.push("/dashboard");
    return null;
  }

  return (
    <div>
      <Head>
        <title>{title}</title>
        <meta name="description" content="勤怠管理システム" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="container mx-auto px-4 py-8">{children}</main>

      <footer className="bg-gray-100 py-4 text-center">
        <p>© 2025 勤怠管理システム</p>
      </footer>
    </div>
  );
}
