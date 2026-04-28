"use client";

import { useRole } from "@/contexts/RoleContext";
import { AdminDashboard } from "@/components/features/dashboards/AdminDashboard";
import { TeacherDashboard } from "@/components/features/dashboards/TeacherDashboard";
import { StudentDashboard } from "@/components/features/dashboards/StudentDashboard";

export default function DashboardController() {
  const { role } = useRole();

  return (
    <>
      {role === "admin" && <AdminDashboard />}
      {role === "teacher" && <TeacherDashboard />}
      {role === "student" && <StudentDashboard />}
    </>
  );
}
