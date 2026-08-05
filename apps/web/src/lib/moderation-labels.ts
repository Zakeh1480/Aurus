import type { ReportReason, ReportStatus } from "@aurafarming/shared";

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  cheating: "Trapaça / uso de terceiros",
  harassment: "Assédio ou comportamento abusivo",
  inappropriate_camera_content: "Conteúdo impróprio na câmera",
  other: "Outro motivo",
};

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: "Aberta",
  resolved: "Resolvida",
};
