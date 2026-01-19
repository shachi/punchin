// attendance-deno/src/types.ts

// Hono App環境型
export interface AppEnv {
  Variables: {
    user: SessionUser | null;
  };
}

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  isAdmin: number; // SQLiteはBooleanをIntegerで保存
}

export interface UserWithoutPassword {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  checkIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  checkOut: string | null;
  isAbsent: number;
  createdAt: string;
}

export interface UserState {
  id: string;
  userId: string;
  currentState: UserStateType;
  lastUpdated: string;
}

export type UserStateType = 
  | "not_checked_in" 
  | "checked_in" 
  | "on_break" 
  | "checked_out" 
  | "absent";

export interface TimeEditRequest {
  id: string;
  userId: string;
  recordId: string;
  field: "checkIn" | "checkOut" | "breakStart" | "breakEnd";
  oldValue: string | null;
  newValue: string;
  reason: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  updatedAt: string;
}

export interface JWTPayload {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
  exp: number;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

// フォーマット済み勤怠レコード（管理画面用）
export interface FormattedAttendanceRecord {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  checkOut: string | null;
  isAbsent: boolean;
  breakDuration: number | null;
  totalWorkHours: number | null;
}
