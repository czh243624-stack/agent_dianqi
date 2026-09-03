import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getAiAssistantSnapshot,
  listAllInquiriesForDashboard,
  listCustomers,
  type AiAssistantSnapshot,
  type CustomerSummary,
  type Inquiry,
} from "../api";
import { WorldMarketMap } from "../components/WorldMarketMap";
import "../homeDashboard.css";

const STATUS_LABEL: Record<string, string> = {
  new: "待分析",
  analyzing: "分析中",
  pending_review: "待审核",
  approved: "待发送",
  sent: "已发送",
  rejected: "已退回",
};

type HomeStats = {
  total: number;
  currentMonth: number;
  pending: number;
  pendingReview: number;
  sent: number;
  customers: number;
  aLeads: number;
  bLeads: number;
  cLeads: number;
  byChannel: Array<{ name: string; count: number }>;
  recent: Inquiry[];
};

function emptyStats(): HomeStats {
  return {
    total: 0,
    currentMonth: 0,
    pending: 0,
    pendingReview: 0,
    sent: 0,
    customers: 0,
    aLeads: 0,
    bLeads: 0,
    cLeads: 0,
    byChannel: [],
    recent: [],
  };
}

function countAbc(customers: CustomerSummary[], inquiries: Inquiry[]) {
  const grades = { A: 0, B: 0, C: 0 };
  const fromCustomers = customers.filter((item) => item.leadGrade === "A" || item.leadGrade === "B" || item.leadGrade === "C");
  if (fromCustomers.length) {
    for (const item of fromCustomers) grades[item.leadGrade as "A" | "B" | "C"] += 1;
    return grades;
  }

  const seen = new Set<string>();
  for (const inquiry of inquiries) {
    const grade = inquiry.leadGrade;
    if (grade !== "A" && grade !== "B" && grade !== "C") continue;
    const key = inquiry.customer?.id || inquiry.buyerEmail || inquiry.buyerCompany || inquiry.id;
    if (seen.has(key)) continue;
    seen.add(key);
    grades[grade] += 1;
  }
  return grades;
}

function buildStats(
  inquiries: Inquiry[],
  customers: CustomerSummary[],
  snapshot: AiAssistantSnapshot | null,
): HomeStats {
  const pendingStatuses = new Set(["new", "analyzing", "pending_review", "approved", "rejected"]);
  const abc = countAbc(customers, inquiries);
  const recent = [...inquiries].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, 5);

  return {
    total: snapshot?.inquiries.total ?? inquiries.length,
    currentMonth: snapshot?.inquiries.currentMonth ?? inquiries.length,
    pending: inquiries.filter((item) => pendingStatuses.has(item.status)).length,
    pendingReview: inquiries.filter((item) => item.status === "pending_review").length,
    sent: inquiries.filter((item) => item.status === "sent").length,
    customers: customers.length,
    aLeads: abc.A,
    bLeads: abc.B,
    cLeads: abc.C,
    byChannel: snapshot?.inquiries.byChannel ?? [],
    recent,
  };
}

function shortStamp(value: string) {
  const date = new Date(value);
  return `${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function statusLabel(status: string) {
  return STATUS_LABEL[status] || status;
}

function inquiryPath(params?: { q?: string }) {
  const search = new URLSearchParams();
  if (params?.q) search.set("q", params.q);
  const qs = search.toString();
  return qs ? `/inquiries?${qs}` : "/inquiries";
}

export function OpsDashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<HomeStats>(emptyStats());
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [customers, setCustomers] = useState<CustomerSummary[]>([]);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");
    try {
      const [inquiryPack, customersRes, snapshot] = await Promise.all([
        listAllInquiriesForDashboard(80, 20),
        listCustomers(),
        getAiAssistantSnapshot(),
      ]);
      setInquiries(inquiryPack.items);
      setCustomers(customersRes.items);
      setStats(buildStats(inquiryPack.items, customersRes.items, snapshot));
    } catch (e) {
      setError(String((e as Error).message || e));
    }
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
    const timer = window.setInterval(() => refresh().catch(() => undefined), 30000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const boardStats = useMemo(
    () => ({
      total: stats.total,
      currentMonth: stats.currentMonth,
      pending: stats.pending,
      pendingReview: stats.pendingReview,
      sent: stats.sent,
      aLeads: stats.aLeads,
      bLeads: stats.bLeads,
      cLeads: stats.cLeads,
      byChannel: stats.byChannel,
      recent: stats.recent.slice(0, 4).map((item) => ({
        id: item.id,
        company: item.buyerCompany || item.buyerName || "未命名客户",
        country: item.buyerCountry || "未识别",
        status: statusLabel(item.status),
        time: shortStamp(item.updatedAt),
      })),
      customers: stats.customers,
    }),
    [stats],
  );

  return (
    <div className="home-ops">
      {error ? <div className="home-error">{error}</div> : null}
      <WorldMarketMap
        inquiries={inquiries}
        customers={customers}
        stats={boardStats}
        onCountryClick={(query) => navigate(inquiryPath({ q: query }))}
        onOpenInquiry={(id) => navigate(`/inquiries/${id}`)}
      />
    </div>
  );
}
