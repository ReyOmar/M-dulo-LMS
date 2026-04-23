"use client";

import { useRole } from "@/contexts/RoleContext";
import { AdminDashboard } from "@/components/dashboards/AdminDashboard";
import { TeacherDashboard } from "@/components/dashboards/TeacherDashboard";
import { StudentDashboard } from "@/components/dashboards/StudentDashboard";

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
