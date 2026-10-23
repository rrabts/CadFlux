export const kindLabels = {
  UPDATE_SINGLE: "Atualização Unipessoal",
  UPDATE_FAMILY: "Atualização Familiar",
  INCLUDE_FAMILY: "Inclusão Familiar",
  INCLUDE_SINGLE_BF: "Inclusão Unipessoal Bolsa Família",
  INCLUDE_SINGLE_BPC: "Inclusão Unipessoal BPC",
  VERIFICATION: "Averiguação Cadastral",
  GUIDANCE: "Orientação",
} as const;
export type AttendanceKind = keyof typeof kindLabels;
export const opinionLabels = {
  PENDING: "Aguardando classificação",
  WITH: "Com parecer",
  WITHOUT: "Sem parecer",
} as const;
export type OpinionStatus = keyof typeof opinionLabels;
export function permitsOpinion(kind: AttendanceKind) {
  return kind === "UPDATE_SINGLE" || kind === "UPDATE_FAMILY" || kind === "VERIFICATION";
}
export interface AttendanceInput {
  benefitIds?: string[];
  serviceDate: string;
  name: string;
  cpf: string;
  responsibleRole: "RF" | "RL";
  familyCode: string | null;
  phone: string | null;
  kind: AttendanceKind;
  opinion: OpinionStatus;
  crowded: boolean;
}
export interface Attendance extends AttendanceInput {
  id: string;
  ownerUserId: string;
  unitId: string;
  kindName: string | null;
  benefits: { benefitId: string; name: string }[];
  version: number;
  operatorName: string;
  operatorRegistration: string;
  operatorCategory: string;
  unitName: string;
  unitCode: string;
  timezone: string;
  cancelledAt: string | null;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}
export function dateInTimezone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function weekStart(date: string) {
  const day = new Date(date + "T00:00:00Z");
  day.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  return day.toISOString().slice(0, 10);
}
export function formatServiceDate(value: string) {
  return value.slice(0, 10).split("-").reverse().join("/");
}
