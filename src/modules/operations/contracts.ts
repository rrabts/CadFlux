import type { AttendanceKind } from "@/modules/attendances/contracts";
export type OperationalUnit = { id: string; name: string; code: string; timezone: string };
export type Configuration = {
  units: OperationalUnit[];
  selected: OperationalUnit | null;
  notice: string;
  types: { code: AttendanceKind; name: string; active: boolean }[];
  benefits: { id: string; name: string; active: boolean }[];
};
