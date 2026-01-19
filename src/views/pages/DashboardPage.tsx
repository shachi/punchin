// attendance-deno/src/views/pages/DashboardPage.tsx
/** @jsxImportSource hono/jsx */
import type { FC } from "hono/jsx";
import { DashboardContent, type UserStateType } from "./DashboardContent.tsx";
import type { AttendanceRecord, SessionUser } from "../../types.ts";

interface DashboardPageProps {
  user: SessionUser;
  currentState: UserStateType;
  record?: AttendanceRecord | null;
  editRequests?: Array<{ id: string; field: string; status: string }>;
}

export const DashboardPage: FC<DashboardPageProps> = ({ user, currentState, record, editRequests }) => {
  return (
    <div class="max-w-4xl mx-auto">
      <div class="bg-white shadow-md rounded-lg p-6 mb-6">
        <h1 class="text-2xl font-bold text-gray-800 mb-4">
          勤怠管理ダッシュボード
        </h1>
        
        <DashboardContent
          currentState={currentState}
          record={record}
          editRequests={editRequests}
        />
      </div>
    </div>
  );
};
