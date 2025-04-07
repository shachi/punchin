// types/next-auth.d.ts
import NextAuth, { DefaultSession } from "next-auth";

declare module "next-auth" {
  /**
   * セッションオブジェクトの型を拡張して、カスタムプロパティを追加します
   */
  interface Session {
    user: {
      id: string;
      isAdmin: boolean;
    } & DefaultSession["user"];
  }

  /**
   * ユーザーオブジェクトの型を拡張
   */
  interface User {
    isAdmin: boolean;
  }
}

declare module "next-auth/jwt" {
  /**
   * JWTトークンの型を拡張
   */
  interface JWT {
    id: string;
    isAdmin: boolean;
  }
}
