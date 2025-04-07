// components/AttendanceButtons.tsx
import { useState } from "react";

interface AttendanceButtonsProps {
  currentState: string;
  onStateChange: (newState: string, message: string) => void;
  onError: (message: string) => void;
}

export default function AttendanceButtons({
  currentState,
  onStateChange,
  onError,
}: AttendanceButtonsProps) {
  // 残りのコードは同じ
  // ...
}
