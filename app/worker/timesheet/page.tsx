import { redirect } from "next/navigation";

/** Redirect old /worker/timesheet to /worker/timekeeping */
export default function TimesheetRedirect() {
  redirect("/worker/timekeeping");
}
