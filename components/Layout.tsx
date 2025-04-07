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
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
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
    <div className="flex flex-col min-h-screen bg-gray-100">
      <Head>
        <title>{title}</title>
        <meta
          name="description"
          content="シンプルで使いやすい勤怠管理システム"
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Header />

      <main className="flex-grow container mx-auto px-4 py-8">{children}</main>

      <footer className="bg-white py-4 shadow-inner">
        <div className="container mx-auto px-4 text-center text-gray-600 text-sm">
          <p>© {new Date().getFullYear()} 勤怠管理システム</p>
        </div>
      </footer>
    </div>
  );
}
