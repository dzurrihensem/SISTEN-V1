import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import Papa from "papaparse";
import { GoogleGenAI } from "@google/genai";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from "recharts";
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Bell,
  Users,
  GraduationCap,
  CalendarCheck,
  ExternalLink,
  X,
  Upload,
  FileText,
  Download,
  Share2,
  Plus,
  Trash2,
  Lock,
  LogOut,
  Menu,
  ArrowLeft,
  RefreshCw,
  ClipboardList,
  Sparkles,
  Search,
  Filter,
  UserCheck,
  UserX,
  Clock,
  MapPin,
  ChevronRight,
  Link,
  User,
  Moon,
  Sun,
  CheckCircle,
} from "lucide-react";

// --- Helpers ---
const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  // Check if it's already in DD/MM/YYYY format
  if (dateStr.includes("/") && dateStr.split("/")[0].length === 2)
    return dateStr;

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
};

const formatTime = (timeStr: string) => {
  if (!timeStr) return "";
  try {
    // If it's already in AM/PM format, return it
    if (
      timeStr.toLowerCase().includes("am") ||
      timeStr.toLowerCase().includes("pm")
    )
      return timeStr;

    // Try to parse it. If it's just HH:mm, prepend a dummy date
    const timeToParse = timeStr.includes("T")
      ? timeStr
      : `2000-01-01T${timeStr}`;
    const date = new Date(timeToParse);
    if (isNaN(date.getTime())) return timeStr;

    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch (e) {
    return timeStr;
  }
};

const parseDateToISO = (dateStr: string): string => {
  if (!dateStr) return "";

  // Try standard YYYY-MM-DD
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;

  // Try DD/MM/YYYY or M/D/YYYY
  // This regex handles both 1-2 digit day/month
  const ddmmyyyy = dateStr.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, "0");
    const month = ddmmyyyy[2].padStart(2, "0");
    const year = ddmmyyyy[3];
    // Assuming DD/MM/YYYY format which is standard in Malaysia
    return `${year}-${month}-${day}`;
  }
  
  // Try MM/DD/YYYY (US format fallback if above fails logic or for specific cases)
  // Note: The above regex is greedy for DD/MM/YYYY. If you have mixed formats, this is tricky.
  // But for SSEMJ (Malaysia), DD/MM/YYYY is standard.

  try {
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      const offset = date.getTimezoneOffset() * 60000;
      return new Date(date.getTime() - offset).toISOString().slice(0, 10);
    }
  } catch (e) {
    console.error("Error parsing date:", dateStr);
  }

  return "";
};

// --- Types ---
type WebLink = { id: string; title: string; url: string; iconUrl?: string };
type Announcement = {
  id: string;
  title: string;
  date: string;
  content: string;
};
type Stat = { teachers: number; students: number };
type AbsentDetail = {
  name: string;
  reason: string;
  duration: string;
  bidang?: string;
};
type Attendance = {
  present: number;
  absent: number;
  total: number;
  date: string;
  absentDetails: AbsentDetail[];
};
type PanitiaFile = {
  id: string;
  name: string;
  type: string;
  size: string;
  date: string;
  uploader: string;
  panitia: string;
  url: string;
};
type Teacher = { name: string; bidang: string };
type Student = {
  id: string;
  daftarMurid: string;
  nama: string;
  tingkatan: string;
  kadPengenalan: string;
  bidang: string;
};
type UserLink = {
  id: string;
  title: string;
  url: string;
  instructions: string;
  bidang: "Pentadbiran" | "Kurikulum" | "HEM" | "Kokurikulum" | "Kesenian";
  date: string;
};

// --- Helper Functions ---
const getDirectImageUrl = (url: string) => {
  if (!url) return "";

  // Regex to capture the FILE_ID from various Google Drive URL formats
  const driveRegex =
    /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
  const match = url.match(driveRegex);

  if (match && match[1]) {
    const fileId = match[1];
    // This is often the most reliable direct link format for images
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  }

  // If it's not a recognizable Google Drive link, return it as is
  return url;
};

// --- Google Sheet Config ---
const GOOGLE_SHEET_ID_LINKS = "14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0";
const GOOGLE_SHEET_CSV_URL_LINKS = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_LINKS}/export?format=csv&gid=0`;

const GOOGLE_SHEET_ID_TEACHERS = "14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0";
const GOOGLE_SHEET_CSV_URL_TEACHERS = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_TEACHERS}/export?format=csv&gid=1003335939`;
const GOOGLE_SHEET_CSV_URL_KEBERADAAN = `https://docs.google.com/spreadsheets/d/${GOOGLE_SHEET_ID_TEACHERS}/export?format=csv&gid=2096914617`;
const GOOGLE_SHEET_CSV_URL_STUDENTS = `https://docs.google.com/spreadsheets/d/12Ye1hVZJEouk1svCCQTdh09FWYibFsCn4QQI6wcgqiI/export?format=csv&gid=0`;
const GOOGLE_SHEET_CSV_URL_USER_LINKS = `https://docs.google.com/spreadsheets/d/14Yyc8l_ZbJSdad-Nz6BrT56eHt92rISJ2ApFs9EB7N0/export?format=csv&gid=1500958888`;
const GOOGLE_SHEET_CSV_URL_PANITIA_TEACHERS = `https://docs.google.com/spreadsheets/d/1eE4WGugWlSMyuPYv12vhW9jDm_AKcBVHCFBVp5DSBhQ/export?format=csv&gid=1089731353`;
const GOOGLE_SHEET_CSV_URL_PANITIA_FILES = `https://docs.google.com/spreadsheets/d/1eE4WGugWlSMyuPYv12vhW9jDm_AKcBVHCFBVp5DSBhQ/export?format=csv&gid=0`; // GID 0 is a placeholder, update if needed

// --- Mock Data ---
const INITIAL_LINKS: WebLink[] = [
  {
    id: "1",
    title: "E-OPR",
    url: "https://eoperasi.moe.gov.my/",
    iconUrl: "https://eoperasi.moe.gov.my/images/logo_kpm.png",
  },
  { id: "2", title: "SMART RPH", url: "https://smartrph.com/", iconUrl: "" },
  {
    id: "3",
    title: "HRMIS",
    url: "https://hrmis2.eghrmis.gov.my/",
    iconUrl:
      "https://hrmis2.eghrmis.gov.my/HRMISNET/Common/Images/JPA_Logo.png",
  },
  { id: "4", title: "SPLKPM", url: "https://splkpm.moe.gov.my/", iconUrl: "" },
];

const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: "1",
    title: "Mesyuarat Guru Bil 3/2026",
    date: "2026-03-01",
    content: "Sila hadir ke bilik mesyuarat pada jam 2.00 petang.",
  },
  {
    id: "2",
    title: "Penghantaran RPH Minggu 10",
    date: "2026-02-28",
    content: "Mohon semua guru melengkapkan e-RPH sebelum hari Jumaat.",
  },
];

const INITIAL_STATS: Stat = { teachers: 0, students: 1850 };
const INITIAL_ATTENDANCE: Attendance = {
  present: 0,
  absent: 0,
  total: 0,
  date: new Date().toISOString().split("T")[0],
  absentDetails: [],
};

const INITIAL_FILES: PanitiaFile[] = [];

// --- Components ---

const IframeViewer = ({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) => {
  return (
    <div className="fixed inset-0 z-[100] bg-white">
      {/* Floating Back Button */}
      <button
        onClick={onClose}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 z-[110] flex items-center gap-2 px-4 py-2.5 bg-black/30 hover:bg-black/50 text-white backdrop-blur-md rounded-full transition-all shadow-lg"
      >
        <ArrowLeft size={20} />
        <span className="font-medium pr-1">Kembali</span>
      </button>

      {/* Fallback overlay in case iframe fails to load due to X-Frame-Options */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-8 text-center z-0">
        <ExternalLink size={48} className="text-gray-400 mb-4" />
        <h3 className="text-xl font-semibold text-gray-700 mb-2">
          Memuatkan {title}...
        </h3>
        <p className="text-gray-500 max-w-md mb-6">
          Jika aplikasi tidak dipaparkan, ia mungkin disebabkan oleh tetapan
          keselamatan laman web tersebut.
        </p>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200"
        >
          <ExternalLink size={20} /> Buka di Tab Baru
        </a>
      </div>

      <iframe
        src={url}
        className="w-full h-full border-0 absolute inset-0 z-10 bg-white"
        title={title}
        sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
      />
    </div>
  );
};

const AttendanceDetailsModal = ({
  attendance,
  onClose,
}: {
  attendance: Attendance;
  onClose: () => void;
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("semua");

  const filteredDetails = attendance.absentDetails.filter((detail) => {
    const matchesSearch = detail.name
      .toLowerCase()
      .includes(searchTerm.toLowerCase());
    const matchesFilter =
      filterType === "semua" ||
      (filterType === "cuti" &&
        (detail.reason.includes("CUTI") || detail.reason.includes("MC"))) ||
      (filterType === "program" && detail.reason.includes("PROGRAM")) ||
      (filterType === "keluar" && detail.reason.includes("Keluar")) ||
      (filterType === "lewat" && detail.reason.includes("Lewat"));
    return matchesSearch && matchesFilter;
  });

  const getIcon = (reason: string) => {
    if (reason.includes("CUTI") || reason.includes("MC"))
      return <UserX size={18} className="text-red-500" />;
    if (reason.includes("PROGRAM"))
      return <MapPin size={18} className="text-purple-500" />;
    if (reason.includes("Keluar"))
      return <Clock size={18} className="text-amber-500" />;
    if (reason.includes("Lewat"))
      return <Clock size={18} className="text-blue-500" />;
    return <UserX size={18} className="text-gray-500" />;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="glass-panel w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-slate-200/50 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-50 text-teal-600 rounded-xl">
              <CalendarCheck size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800 serif">
                Perincian Keberadaan Guru
              </h2>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                Tarikh: {formatDate(attendance.date)}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Stats Summary In Modal */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 formal-card text-center">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Jumlah
              </p>
              <p className="text-2xl font-black text-slate-800">
                {attendance.total}
              </p>
            </div>
            <div className="p-4 formal-card text-center">
              <p className="text-[9px] font-bold text-green-500 uppercase tracking-widest mb-1">
                Hadir
              </p>
              <p className="text-2xl font-black text-green-600">
                {attendance.present}
              </p>
            </div>
            <div className="p-4 formal-card text-center">
              <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mb-1">
                Tiada
              </p>
              <p className="text-2xl font-black text-red-600">
                {attendance.absent}
              </p>
            </div>
            <div className="p-4 formal-card text-center">
              <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-widest mb-1">
                Peratus
              </p>
              <p className="text-2xl font-black text-indigo-600">
                {Math.round((attendance.present / attendance.total) * 100)}%
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Cari nama guru..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
              {["semua", "cuti", "program", "keluar", "lewat"].map((type) => (
                <button
                  key={type}
                  onClick={() => setFilterType(type)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                    filterType === type
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Detailed List */}
          <div className="space-y-3">
            {filteredDetails.map((detail, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 formal-card flex items-center gap-4 group hover:bg-slate-50 transition-colors"
              >
                <div className="p-3 bg-slate-50 text-slate-600 rounded-xl">
                  {getIcon(detail.reason)}
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-gray-800">{detail.name}</h4>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <p className="text-xs font-medium text-gray-500">
                      {detail.reason}
                    </p>
                    {detail.bidang && (
                      <span className="text-[10px] font-bold text-purple-500 bg-purple-50 px-2 py-0.5 rounded-full border border-purple-100">
                        {detail.bidang}
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-indigo-500 bg-indigo-50 px-2 py-1 rounded-full">
                    {detail.duration}
                  </span>
                </div>
              </motion.div>
            ))}

            {filteredDetails.length === 0 && (
              <div className="p-12 text-center text-gray-400 font-medium">
                Tiada rekod dijumpai untuk kriteria ini.
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

const SenaraiPautan = ({
  links,
  onSave,
  onDelete,
}: {
  links: UserLink[];
  onSave: (link: UserLink) => void;
  onDelete: (id: string) => void;
}) => {
  const [showForm, setShowForm] = useState(false);
  const [editingLink, setEditingLink] = useState<UserLink | null>(null);
  const [formData, setFormData] = useState<Partial<UserLink>>({
    title: "",
    url: "",
    instructions: "",
    bidang: "Pentadbiran",
  });

  const categories = [
    "Pentadbiran",
    "Kurikulum",
    "HEM",
    "Kokurikulum",
    "Kesenian",
  ] as const;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.title && formData.url) {
      onSave({
        id: editingLink?.id || Date.now().toString(),
        title: formData.title,
        url: formData.url,
        instructions: formData.instructions || "",
        bidang: (formData.bidang as any) || "Pentadbiran",
        date: new Date().toISOString().split("T")[0],
      });
      setShowForm(false);
      setEditingLink(null);
      setFormData({
        title: "",
        url: "",
        instructions: "",
        bidang: "Pentadbiran",
      });
    }
  };

  const handleEdit = (link: UserLink) => {
    setEditingLink(link);
    setFormData(link);
    setShowForm(true);
  };

  const handleShare = (link: UserLink) => {
    const text = `*${link.title}*\n\nPautan: ${link.url}\n\nArahan: ${link.instructions}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3 serif">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <ClipboardList size={20} />
          </div>
          Senarai Pautan/Link
        </h2>
        <button
          onClick={() => {
            setEditingLink(null);
            setFormData({
              title: "",
              url: "",
              instructions: "",
              bidang: "Pentadbiran",
            });
            setShowForm(true);
          }}
          className="btn-formal btn-formal-primary shadow-lg shadow-indigo-200 w-full sm:w-auto"
        >
          <Plus size={20} className="mr-2" /> Tambah Pautan
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="formal-card p-5 sm:p-8"
        >
          <h3 className="text-lg font-bold mb-6 text-gray-800">
            {editingLink ? "Edit Pautan" : "Tambah Pautan Baru"}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                  Tajuk
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  placeholder="Contoh: Pengisian Google Form..."
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-medium"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Pautan/Link
                </label>
                <input
                  type="url"
                  value={formData.url}
                  onChange={(e) =>
                    setFormData({ ...formData, url: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-medium"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Arahan
                </label>
                <textarea
                  value={formData.instructions}
                  onChange={(e) =>
                    setFormData({ ...formData, instructions: e.target.value })
                  }
                  placeholder="Masukkan arahan atau nota di sini..."
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-medium min-h-[100px]"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  Bidang
                </label>
                <select
                  value={formData.bidang}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      bidang: e.target.value as any,
                    })
                  }
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 font-medium bg-transparent"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-4 pt-4">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="btn-formal btn-formal-secondary"
              >
                Batal
              </button>
              <button
                type="submit"
                className="btn-formal btn-formal-primary"
              >
                Simpan
              </button>
            </div>
          </form>
        </motion.div>
      )}

      <div className="space-y-10">
        {categories.map((cat) => {
          const filteredLinks = links.filter((l) => l.bidang === cat);
          if (filteredLinks.length === 0) return null;

          return (
            <div key={cat} className="space-y-4">
              <h3 className="text-lg font-bold text-indigo-600 px-2 flex items-center gap-2 serif">
                <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                {cat}
              </h3>
              <div className="formal-card overflow-hidden">
                {/* Desktop Table View */}
                <div className="overflow-x-auto hidden md:block">
                  <table className="w-full text-left border-collapse min-w-[600px]">
                    <thead>
                      <tr className="border-b border-slate-200/50">
                        <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                          Tajuk & Arahan
                        </th>
                        <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                          Pautan
                        </th>
                        <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">
                          Tindakan
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLinks.map((link) => (
                        <tr
                          key={link.id}
                          className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="p-5 max-w-md">
                            <div className="space-y-1">
                              <p className="font-bold text-slate-800">
                                {link.title}
                              </p>
                              <p className="text-xs text-slate-500 leading-relaxed">
                                {link.instructions}
                              </p>
                            </div>
                          </td>
                          <td className="p-5">
                            <a
                              href={link.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-indigo-600 hover:underline text-sm font-medium flex items-center gap-1"
                            >
                              Buka Pautan <ExternalLink size={14} />
                            </a>
                          </td>
                          <td className="p-5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleShare(link)}
                                className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                title="Kongsi ke WhatsApp"
                              >
                                <Share2 size={16} />
                              </button>
                              <button
                                onClick={() => handleEdit(link)}
                                className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit"
                              >
                                <Plus size={16} className="rotate-45" />
                              </button>
                              <button
                                onClick={() => onDelete(link.id)}
                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                title="Padam"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Card View for User Links */}
                <div className="md:hidden divide-y divide-slate-100">
                  {filteredLinks.map((link) => (
                    <div key={link.id} className="p-5 space-y-4">
                      <div className="space-y-2">
                        <h4 className="font-bold text-slate-800 leading-tight">
                          {link.title}
                        </h4>
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {link.instructions}
                        </p>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold uppercase tracking-wider"
                        >
                          <ExternalLink size={14} /> Buka Pautan
                        </a>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleShare(link)}
                            className="p-2 text-green-500 hover:bg-green-50 rounded-lg"
                          >
                            <Share2 size={18} />
                          </button>
                          <button
                            onClick={() => handleEdit(link)}
                            className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg"
                          >
                            <Plus size={18} className="rotate-45" />
                          </button>
                          <button
                            onClick={() => onDelete(link.id)}
                            className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
        {links.length === 0 && (
          <div className="p-16 text-center formal-card">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-slate-50 text-slate-300 rounded-2xl">
                <ClipboardList size={48} />
              </div>
            </div>
            <p className="text-slate-500 font-medium">
              Tiada pautan disenaraikan. Sila tambah pautan baru.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const LiveClock = () => {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const days = ["Ahad", "Isnin", "Selasa", "Rabu", "Khamis", "Jumaat", "Sabtu"];
  const dayName = days[time.getDay()];

  const dateStr = time.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const timeStr = time.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  return (
    <div className="text-left">
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">
        {dayName}, {dateStr}
      </p>
      <p className="text-lg font-black text-slate-800 tabular-nums leading-none tracking-tight">
        {timeStr}
      </p>
    </div>
  );
};

const TeacherAttendanceAnalysis = ({ data }: { data: any[] }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);

  const analysis = useMemo(() => {
    const statsMap = new Map<string, {
      name: string;
      absent: number;
      course: number;
      late: number;
      out: number;
    }>();

    data.forEach((row) => {
      const lowerRow: Record<string, string> = {};
      Object.keys(row).forEach((k) => {
        if (k) lowerRow[k.toLowerCase().trim()] = row[k];
      });

      const nama = lowerRow["nama guru"] || "";
      if (!nama) return;

      if (!statsMap.has(nama)) {
        statsMap.set(nama, { name: nama, absent: 0, course: 0, late: 0, out: 0 });
      }

      const stats = statsMap.get(nama)!;

      const sebabVal = (lowerRow["sebab"] || lowerRow["sebab tidak hadir"] || "").toUpperCase();
      const programVal = (lowerRow["nama program"] || lowerRow["program"] || "").toUpperCase();
      const tujuanVal = lowerRow["keluar pejabat"] || lowerRow["tujuan keluar"] || lowerRow["tujuan"] || "";
      const lewatVal = lowerRow["lewat hadir"] || lowerRow["lewat"] || "";

      if (sebabVal.includes("CUTI") || sebabVal.includes("MC") || sebabVal.includes("CRK")) {
        stats.absent++;
      } else if (sebabVal.includes("PROGRAM") || programVal.includes("KURSUS") || programVal.includes("BENGKEL") || programVal.includes("MESYUARAT")) {
        stats.course++;
      }

      if (tujuanVal) {
        stats.out++;
      }

      if (lewatVal) {
        stats.late++;
      }
    });

    return Array.from(statsMap.values())
      .filter(s => s.absent > 0 || s.course > 0 || s.late > 0 || s.out > 0)
      .sort((a, b) => (b.absent + b.course + b.late + b.out) - (a.absent + a.course + a.late + a.out));
  }, [data]);

  const filteredAnalysis = analysis.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const displayedAnalysis = showAll ? filteredAnalysis : filteredAnalysis.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
            <ClipboardList size={18} />
          </div>
          Analisis Keberadaan Guru (Kumulatif)
        </h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Cari nama guru..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm"
          />
        </div>
      </div>

      <div className="formal-card overflow-hidden flex flex-col">
        {/* Desktop View */}
        <div className={`hidden md:block overflow-x-auto ${showAll ? 'max-h-[400px] overflow-y-auto' : ''}`}>
          <table className="w-full text-left border-collapse">
            <thead className={showAll ? "sticky top-0 z-10 bg-white shadow-sm" : ""}>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nama Guru</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Tidak Hadir</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Berkursus</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Datang Lewat</th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Keluar Pejabat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {displayedAnalysis.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-bold text-slate-700">{item.name}</td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.absent > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-400'}`}>
                      {item.absent}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.course > 0 ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                      {item.course}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.late > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                      {item.late}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.out > 0 ? 'bg-teal-50 text-teal-600' : 'bg-slate-50 text-slate-400'}`}>
                      {item.out}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className={`md:hidden divide-y divide-slate-100 ${showAll ? 'max-h-[400px] overflow-y-auto' : ''}`}>
          {displayedAnalysis.map((item, idx) => (
            <div key={idx} className="p-4 space-y-3">
              <div className="font-bold text-slate-800">{item.name}</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Tidak Hadir</span>
                  <span className={`text-xs font-bold ${item.absent > 0 ? 'text-red-600' : 'text-slate-400'}`}>{item.absent}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Berkursus</span>
                  <span className={`text-xs font-bold ${item.course > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{item.course}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Lewat</span>
                  <span className={`text-xs font-bold ${item.late > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{item.late}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Keluar</span>
                  <span className={`text-xs font-bold ${item.out > 0 ? 'text-teal-600' : 'text-slate-400'}`}>{item.out}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        {!showAll && filteredAnalysis.length > 5 && (
          <div className="p-3 text-center bg-slate-50/50 border-t border-slate-100">
            <button
              onClick={() => setShowAll(true)}
              className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest hover:text-indigo-700"
            >
              + {filteredAnalysis.length - 5} lagi... Papar semua
            </button>
          </div>
        )}
        {showAll && filteredAnalysis.length > 5 && (
          <div className="p-3 text-center bg-slate-50/50 border-t border-slate-100">
            <button
              onClick={() => setShowAll(false)}
              className="text-[10px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-700 flex items-center justify-center gap-1 mx-auto"
            >
              <X size={14} /> Kembali
            </button>
          </div>
        )}

        {filteredAnalysis.length === 0 && (
          <div className="p-12 text-center text-slate-400 font-medium">
            Tiada data analisis dijumpai.
          </div>
        )}
      </div>
    </div>
  );
};

const Dashboard = ({
  links,
  isLoadingLinks,
  linksError,
  announcements,
  stats,
  attendance,
  rawAttendanceData,
  onOpenApp,
  teachersError,
  onRefresh,
}: {
  links: WebLink[];
  isLoadingLinks: boolean;
  linksError: string;
  announcements: Announcement[];
  stats: Stat;
  attendance: Attendance;
  rawAttendanceData: any[];
  onOpenApp: (link: WebLink) => void;
  teachersError: string;
  onRefresh: () => void;
}) => {
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);

  const chartData = [
    { name: "Hadir", value: attendance.present, color: "#10b981" },
    { name: "Tiada", value: attendance.absent, color: "#ef4444" },
  ];

  return (
    <div className="space-y-6 sm:space-y-10">
      <AnimatePresence>
        {showAttendanceModal && (
          <AttendanceDetailsModal
            attendance={attendance}
            onClose={() => setShowAttendanceModal(false)}
          />
        )}
      </AnimatePresence>

      {/* Apps Grid Section */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex justify-between items-start sm:items-center gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 sm:gap-3 serif">
            <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
              <LayoutDashboard size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="leading-tight">Aplikasi Digital Warga SSEMJ</span>
          </h2>
          <button
            onClick={onRefresh}
            className="p-2 hover:bg-slate-100 rounded-lg text-indigo-600 hover:rotate-180 transition-transform duration-500 shrink-0"
            title="Segar Semula Data"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {linksError && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
            {linksError}
          </div>
        )}

        {isLoadingLinks ? (
          <div className="flex flex-col items-center justify-center p-16 bg-white rounded-2xl border border-slate-100 shadow-sm">
            <RefreshCw
              className="animate-spin text-blue-500 mb-4"
              size={32}
            />
            <p className="text-slate-500 font-medium">Memuat turun pautan...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6 auto-rows-fr grid-flow-dense">
            {links.map((link) => {
               const isProminent = link.title.toLowerCase().includes('smart rph') || link.title.toLowerCase().includes('e-opr');
               return (
              <motion.div
                key={link.id}
                onClick={() => onOpenApp(link)}
                whileHover={{ y: -4 }}
                className={`
                  formal-card hover:scale-[1.02] transition-all flex items-center justify-center group cursor-pointer relative overflow-hidden
                  ${isProminent ? 'col-span-2 row-span-1 p-4 sm:p-6 min-h-[120px] sm:min-h-[140px] flex-row gap-4 sm:gap-6 text-left border-indigo-100 bg-indigo-50/30' : 'flex-col p-4 sm:p-6 min-h-[120px] sm:min-h-[140px] text-center'}
                `}
              >
                <div className={`
                  rounded-full flex items-center justify-center text-indigo-600 transition-transform duration-300 group-hover:scale-110 bg-indigo-50 shrink-0
                  ${isProminent ? 'w-16 h-16 sm:w-20 sm:h-20 mb-0' : 'w-12 h-12 sm:w-14 sm:h-14 mb-3 sm:mb-4'}
                `}>
                  {link.iconUrl ? (
                    <img
                      src={getDirectImageUrl(link.iconUrl)}
                      alt={link.title}
                      className="w-full h-full object-contain p-2 sm:p-3"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : (
                    <ExternalLink size={isProminent ? 28 : 20} className="sm:w-[32px] sm:h-[32px]" />
                  )}
                  <ExternalLink
                    size={isProminent ? 28 : 20}
                    className={`${link.iconUrl ? "hidden" : ""} sm:w-[32px] sm:h-[32px]`}
                  />
                </div>
                <span className={`font-bold text-slate-800 line-clamp-2 group-hover:text-blue-700 transition-colors ${isProminent ? 'text-lg sm:text-xl tracking-tight' : 'text-xs sm:text-sm'}`}>
                  {link.title}
                </span>
              </motion.div>
            )})}

            {links.length === 0 && !linksError && (
              <div className="col-span-full p-10 text-center text-slate-500 bg-white rounded-2xl border border-slate-100">
                Tiada pautan aplikasi dijumpai.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error Displays */}
      {teachersError && (
        <div className="p-5 bg-red-50 text-red-700 rounded-2xl text-sm border border-red-100">
          <p className="font-bold mb-2">Ralat Memuat Turun Data Guru:</p>
          <p>{teachersError}</p>
        </div>
      )}



      {/* Keberadaan Guru Section */}
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-4">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 sm:gap-3 serif">
            <div className="p-1.5 sm:p-2 bg-teal-50 text-teal-600 rounded-xl shrink-0">
              <CalendarCheck size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <span className="leading-tight">Keberadaan Guru <span className="text-sm sm:text-lg text-slate-500 font-medium">({formatDate(attendance.date)})</span></span>
          </h2>
          <button
            onClick={() => setShowAttendanceModal(true)}
            className="text-xs font-bold text-indigo-600 hover:underline flex items-center gap-1 self-end sm:self-auto"
          >
            Lihat Perincian Penuh <ChevronRight size={14} />
          </button>
        </div>

        <div className="formal-card overflow-hidden">
          {/* Desktop Table View for Keberadaan */}
          <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse min-w-[500px]">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Nama Guru
                  </th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Sebab / Status
                  </th>
                  <th className="p-4 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                    Tempoh
                  </th>
                </tr>
              </thead>
              <tbody>
                {attendance.absentDetails && attendance.absentDetails.length > 0 ? (
                  attendance.absentDetails.slice(0, 5).map((detail, idx) => (
                    <tr
                      key={idx}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 text-sm">
                            {detail.name}
                          </span>
                          {detail.bidang && (
                            <span className="text-[10px] font-medium text-slate-400">
                              {detail.bidang}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-medium text-red-600 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                          {detail.reason}
                        </span>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-bold text-slate-500">
                          {detail.duration}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-8 text-center text-teal-600 font-bold text-sm"
                    >
                      Semua guru hadir bertugas hari ini.
                    </td>
                  </tr>
                )}
                {attendance.absentDetails && attendance.absentDetails.length > 5 && (
                  <tr>
                    <td
                      colSpan={3}
                      className="p-3 text-center bg-slate-50/50"
                    >
                      <button
                        onClick={() => setShowAttendanceModal(true)}
                        className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest hover:text-indigo-700"
                      >
                        + {attendance.absentDetails.length - 5} lagi... Klik untuk lihat semua
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View for Keberadaan */}
          <div className="md:hidden divide-y divide-slate-100">
            {attendance.absentDetails && attendance.absentDetails.length > 0 ? (
              <>
                {attendance.absentDetails.slice(0, 5).map((detail, idx) => (
                  <div key={idx} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-bold text-slate-800 text-sm leading-tight">{detail.name}</p>
                        {detail.bidang && (
                          <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mt-0.5">{detail.bidang}</p>
                        )}
                      </div>
                      <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded">
                        {detail.duration}
                      </span>
                    </div>
                    <div className="flex">
                      <span className="text-[10px] font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full border border-red-100">
                        {detail.reason}
                      </span>
                    </div>
                  </div>
                ))}
                {attendance.absentDetails.length > 5 && (
                  <button
                    onClick={() => setShowAttendanceModal(true)}
                    className="w-full py-3 text-center text-[10px] font-bold text-indigo-500 uppercase tracking-widest bg-slate-50/50 hover:bg-slate-100 transition-colors"
                  >
                    + {attendance.absentDetails.length - 5} lagi... Klik untuk lihat semua
                  </button>
                )}
              </>
            ) : (
              <div className="p-8 text-center text-teal-600 font-bold text-sm">
                Semua guru hadir bertugas hari ini.
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-8 sm:space-y-12">
        {/* Announcements Section - Card Layout */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 sm:gap-3 serif">
              <div className="p-1.5 sm:p-2 bg-amber-50 text-amber-600 rounded-xl shrink-0">
                <Bell size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="leading-tight">Makluman Terkini</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {announcements.length > 0 ? (
              announcements.map((ann) => (
                <motion.div
                  key={ann.id}
                  whileHover={{ y: -4 }}
                  className="formal-card p-5 sm:p-6 relative overflow-hidden group"
                >
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-amber-500/5 rounded-full blur-xl group-hover:bg-amber-500/10 transition-all"></div>
                  <div className="flex justify-between items-start mb-4">
                    <span className="text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 bg-indigo-50 rounded-full text-indigo-600">
                      {formatDate(ann.date)}
                    </span>
                    <div className="p-1.5 bg-amber-50 text-amber-500 rounded-lg">
                      <Sparkles size={14} />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-800 mb-2 group-hover:text-indigo-600 transition-colors">
                    {ann.title}
                  </h3>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {ann.content}
                  </p>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full p-12 text-center formal-card text-slate-400 font-medium">
                Tiada makluman terkini.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PengurusanMurid = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClass, setSelectedClass] = useState("Semua");
  const [selectedBidang, setSelectedBidang] = useState("Semua");
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchStudents();
  }, []);

  const fetchStudents = () => {
    setIsLoading(true);
    setError("");
    Papa.parse(GOOGLE_SHEET_CSV_URL_STUDENTS, {
      download: true,
      header: true,
      complete: (results) => {
        const parsedStudents: Student[] = [];
        results.data.forEach((row: any, index) => {
          if (!row) return;

          // Create a case-insensitive row object
          const lowerCaseRow: Record<string, string> = {};
          Object.keys(row).forEach((key) => {
            if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
          });

          if (Object.keys(lowerCaseRow).length > 0) {
              parsedStudents.push({
                id: index.toString(),
                daftarMurid: lowerCaseRow["daftar murid"] || lowerCaseRow["daftarmurid"] || "",
                nama: lowerCaseRow["nama"] || "",
                tingkatan: lowerCaseRow["tingkatan"] || "",
                kadPengenalan: lowerCaseRow["kad pengenalan"] || lowerCaseRow["kadpengenalan"] || "",
                bidang: lowerCaseRow["bidang"] || "",
              });
          }
        });
        setStudents(parsedStudents);
        setIsLoading(false);
      },
      error: (err) => {
        console.error("Error fetching students:", err);
        setError("Gagal memuatkan data murid. Sila cuba lagi.");
        setIsLoading(false);
      },
    });
  };

  const classes = ["Semua", ...Array.from(new Set(students.map((s) => s.tingkatan).filter(Boolean)))].sort();
  const bidangList = ["Semua", ...Array.from(new Set(students.map((s) => s.bidang).filter(Boolean)))].sort();

  const filteredStudents = students.filter((s) => {
    const matchesSearch = s.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.kadPengenalan.includes(searchTerm);
    const matchesClass = selectedClass === "Semua" || s.tingkatan === selectedClass;
    const matchesBidang = selectedBidang === "Semua" || s.bidang === selectedBidang;
    return matchesSearch && matchesClass && matchesBidang;
  });

  const statsByClass = students.reduce((acc, s) => {
    if (s.tingkatan) acc[s.tingkatan] = (acc[s.tingkatan] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const statsByBidang = students.reduce((acc, s) => {
    if (s.bidang) acc[s.bidang] = (acc[s.bidang] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const groupedStudents = filteredStudents.reduce((acc, s) => {
    const t = s.tingkatan || "Tiada Maklumat Tingkatan";
    if (!acc[t]) acc[t] = [];
    acc[t].push(s);
    return acc;
  }, {} as Record<string, Student[]>);

  const sortedTingkatan = Object.keys(groupedStudents).sort();

  const classChartData = Object.entries(statsByClass)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => ({ name, value }));

  const bidangChartData = Object.entries(statsByBidang)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([name, value]) => ({ name, value }));

  const COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316", "#eab308", "#22c55e", "#06b6d4"];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="p-2 sm:p-3 bg-indigo-50 text-indigo-600 rounded-xl sm:rounded-2xl shrink-0">
            <Users size={24} className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 serif leading-tight">Carian Maklumat Murid</h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5 sm:mt-0">Cari nama, tingkatan dan maklumat lain murid</p>
          </div>
        </div>
        <button 
          onClick={fetchStudents}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all"
        >
          <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
          Segarkan Data
        </button>
      </div>

      {!isLoading && students.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="formal-card p-4 sm:p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <GraduationCap size={16} className="text-indigo-500" />
              Jumlah Murid Mengikut Kelas
            </h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={classChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <RechartsTooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="formal-card p-4 sm:p-6">
            <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-500" />
              Jumlah Murid Mengikut Bidang
            </h3>
            <div className="h-64 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={bidangChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {bidangChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {bidangChartData.map((entry, index) => (
                <div key={entry.name} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                  {entry.name} ({entry.value})
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="formal-card p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="md:col-span-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder="Cari nama atau No. KP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-slate-50/50 text-sm"
            />
          </div>
          <div>
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-slate-50/50 text-sm"
            >
              <option value="Semua">Semua Tingkatan</option>
              {classes.filter(c => c !== "Semua").map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={selectedBidang}
              onChange={(e) => setSelectedBidang(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all bg-slate-50/50 text-sm"
            >
              <option value="Semua">Semua Bidang</option>
              {bidangList.filter(b => b !== "Semua").map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <div className="p-4 mb-6 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
            {error}
          </div>
        )}

        <div className="overflow-x-auto hidden md:block">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daftar Murid</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Nama</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tingkatan</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">No. KP</th>
                <th className="text-left py-4 px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Bidang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <RefreshCw size={32} className="animate-spin" strokeWidth={1.5} />
                      <p className="text-sm">Memuatkan data murid...</p>
                    </div>
                  </td>
                </tr>
              ) : sortedTingkatan.length > 0 ? (
                sortedTingkatan.map((tingkatan) => (
                  <React.Fragment key={tingkatan}>
                    <tr className="bg-slate-50/80">
                      <td colSpan={5} className="py-3 px-4 border-y border-slate-200/60">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-700 text-sm">{tingkatan}</span>
                          <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">
                            {groupedStudents[tingkatan].length} Murid
                          </span>
                        </div>
                      </td>
                    </tr>
                    {groupedStudents[tingkatan].map((s) => (
                      <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="py-4 px-4 text-xs font-mono text-slate-500">{s.daftarMurid}</td>
                        <td className="py-4 px-4">
                          <p className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors">{s.nama}</p>
                        </td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-[10px] font-bold">{s.tingkatan}</span>
                        </td>
                        <td className="py-4 px-4 text-sm text-slate-600 font-mono">{s.kadPengenalan}</td>
                        <td className="py-4 px-4">
                          <span className="px-2 py-1 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase">{s.bidang}</span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-slate-400">
                      <Search size={32} strokeWidth={1.5} />
                      <p className="text-sm">Tiada murid dijumpai</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View for Students */}
        <div className="md:hidden space-y-4">
          {isLoading ? (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <RefreshCw size={32} className="animate-spin" strokeWidth={1.5} />
                <p className="text-sm">Memuatkan data murid...</p>
              </div>
            </div>
          ) : sortedTingkatan.length > 0 ? (
            sortedTingkatan.map((tingkatan) => (
              <div key={tingkatan} className="space-y-3">
                <div className="flex items-center gap-2 px-2 py-1 bg-indigo-50 rounded-lg">
                  <span className="font-bold text-indigo-700 text-xs">{tingkatan}</span>
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider">
                    {groupedStudents[tingkatan].length} Murid
                  </span>
                </div>
                {groupedStudents[tingkatan].map((s) => (
                  <div key={s.id} className="p-4 formal-card space-y-3">
                    <div className="flex justify-between items-start">
                      <h4 className="font-bold text-slate-800 text-sm leading-tight">{s.nama}</h4>
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[10px] font-bold uppercase shrink-0">
                        {s.bidang}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest mb-0.5">No. Daftar</p>
                        <p className="text-slate-600 font-mono">{s.daftarMurid}</p>
                      </div>
                      <div>
                        <p className="text-slate-400 font-bold uppercase tracking-widest mb-0.5">No. KP</p>
                        <p className="text-slate-600 font-mono">{s.kadPengenalan}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          ) : (
            <div className="py-12 text-center">
              <div className="flex flex-col items-center gap-2 text-slate-400">
                <Search size={32} strokeWidth={1.5} />
                <p className="text-sm">Tiada murid dijumpai</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const PengurusanPanitia = ({
  files,
  setFiles,
  teacherNames,
  fetchPanitiaFiles,
}: {
  files: PanitiaFile[];
  setFiles: (files: PanitiaFile[]) => void;
  teacherNames: string[];
  fetchPanitiaFiles: () => void;
}) => {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [expandedPanitia, setExpandedPanitia] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [formData, setFormData] = useState({
    panitia: "Panitia Bahasa Melayu",
    customPanitia: "",
    namaGuru: "",
    file: null as File | null,
  });

  const panitiaOptions = [
    "Panitia Seni Muzik",
    "Panitia Seni Teater",
    "Panitia Seni Visual",
    "Panitia Seni Tari",
    "Panitia Sains",
    "Panitia Matematik",
    "Panitia Pendidikan Moral",
    "Panitia Pendidikan Islam",
    "Panitia Pendidikan Jasmani & Kesihatan",
    "Panitia Bahasa Melayu",
    "Panitia Bahasa Inggeris",
    "Lain-lain (Nyatakan)",
  ];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, file: e.target.files[0] });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.file || !formData.namaGuru) {
      alert("Sila lengkapkan semua maklumat.");
      return;
    }

    setIsUploading(true);
    setShowSuccess(false);
    setUploadProgress(10);
    console.log("Upload started...");

    const panitiaName =
      formData.panitia === "Lain-lain (Nyatakan)"
        ? formData.customPanitia
        : formData.panitia;

    try {
      const reader = new FileReader();
      
      reader.onload = async () => {
        const base64File = (reader.result as string).split(",")[1];
        
        const payload = {
          filename: formData.file?.name,
          mimeType: formData.file?.type,
          data: base64File,
          panitia: panitiaName,
          namaGuru: formData.namaGuru,
          folderId: "1czc0tIccEQb3vo5uYD02gyplHjYBQ1Ei",
          sheetId: "1eE4WGugWlSMyuPYv12vhW9jDm_AKcBVHCFBVp5DSBhQ",
        };

        setUploadProgress(40);

        const GAS_URL = import.meta.env.VITE_GAS_PANITIA_URL;

        if (GAS_URL && GAS_URL.startsWith("http")) {
          try {
            const response = await fetch(GAS_URL, {
              method: "POST",
              body: JSON.stringify(payload),
            });
            
            const result = await response.json();
            
            if (result.success) {
              console.log("Upload success:", result.url);
              const newFile: PanitiaFile = {
                id: Date.now().toString(),
                name: formData.file?.name || "Untitled",
                type: formData.file?.type.split("/")[1] || "file",
                size: `${(formData.file!.size / (1024 * 1024)).toFixed(2)} MB`,
                date: new Date().toISOString().split("T")[0],
                uploader: formData.namaGuru,
                panitia: panitiaName,
                url: result.url,
              };
              setFiles([newFile, ...files]);
              setUploadProgress(100);
              setShowSuccess(true);
              setTimeout(() => {
                setShowSuccess(false);
                setShowUploadModal(false);
                setFormData({ panitia: "Panitia Bahasa Melayu", customPanitia: "", namaGuru: "", file: null });
                setIsUploading(false);
                fetchPanitiaFiles();
              }, 2000);
            } else {
              console.error("Upload failed (server):", result.message);
              alert("Gagal: " + result.message);
              setIsUploading(false);
            }
          } catch (err) {
            console.error("Upload error (fetch):", err);
            setIsUploading(false);
            if (err instanceof TypeError) {
              alert("Muat naik sedang diproses. Sila semak Google Drive/Sheets anda dalam beberapa saat.");
              setShowUploadModal(false);
              setFormData({ panitia: "Panitia Bahasa Melayu", customPanitia: "", namaGuru: "", file: null });
            } else {
              alert("Ralat sambungan ke pelayan muat naik.");
            }
          }
        } else {
          console.warn("VITE_GAS_PANITIA_URL not set or invalid. Simulating upload...");
          setTimeout(() => {
            setUploadProgress(100);
            const newFile: PanitiaFile = {
              id: Date.now().toString(),
              name: formData.file?.name || "Untitled",
              type: formData.file?.type.split("/")[1] || "file",
              size: `${(formData.file!.size / (1024 * 1024)).toFixed(2)} MB`,
              date: new Date().toISOString().split("T")[0],
              uploader: formData.namaGuru,
              panitia: panitiaName,
              url: "#",
            };
            setFiles([newFile, ...files]);
            setShowSuccess(true);
            setTimeout(() => {
              setShowSuccess(false);
              setShowUploadModal(false);
              setFormData({ panitia: "Panitia Bahasa Melayu", customPanitia: "", namaGuru: "", file: null });
              setIsUploading(false);
            }, 2000);
          }, 1500);
        }
      };

      reader.onerror = () => {
        console.error("FileReader error");
        setIsUploading(false);
        alert("Ralat membaca fail.");
      };

      reader.readAsDataURL(formData.file);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Ralat semasa memuat naik.");
      setIsUploading(false);
    }
  };

  const handleDelete = (id: string) => {
    setFiles(files.filter((f) => f.id !== id));
  };

  // Group files by panitia
  const groupedFiles = files.reduce((acc, file) => {
    if (!acc[file.panitia]) acc[file.panitia] = [];
    acc[file.panitia].push(file);
    return acc;
  }, {} as Record<string, PanitiaFile[]>);

  const panitiaList = Object.keys(groupedFiles).sort();

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-3 serif">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <FolderOpen size={20} />
          </div>
          Pengurusan Panitia
        </h2>
        <button
          onClick={() => setShowUploadModal(true)}
          className="btn-formal btn-formal-primary shadow-lg shadow-indigo-200 w-full sm:w-auto"
        >
          <Upload size={20} className="mr-2" /> Muat Naik Bahan
        </button>
      </div>

      <AnimatePresence>
        {showUploadModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className={`bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden ${isUploading ? 'cursor-wait' : ''}`}
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 serif">Muat Naik Bahan Panitia</h3>
                <button 
                  onClick={() => !isUploading && setShowUploadModal(false)} 
                  className={`text-slate-400 hover:text-slate-600 ${isUploading ? 'cursor-not-allowed opacity-30' : ''}`}
                  disabled={isUploading}
                >
                  <X size={20} />
                </button>
              </div>

              <div className="relative">
                <form onSubmit={handleUpload} className="p-6 space-y-5 transition-all">
                  <div className={isUploading ? 'opacity-50 pointer-events-none' : ''}>
                    <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nama Guru</label>
                  <select
                    value={formData.namaGuru}
                    onChange={(e) => setFormData({ ...formData, namaGuru: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium bg-white"
                    required
                  >
                    <option value="">-- Pilih Nama Guru --</option>
                    {teacherNames.map((name, index) => (
                      <option key={`${name}-${index}`} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Pilih Panitia</label>
                  <select
                    value={formData.panitia}
                    onChange={(e) => setFormData({ ...formData, panitia: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium bg-white"
                  >
                    {panitiaOptions.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </div>

                {formData.panitia === "Lain-lain (Nyatakan)" && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nyatakan Panitia</label>
                    <input
                      type="text"
                      value={formData.customPanitia}
                      onChange={(e) => setFormData({ ...formData, customPanitia: e.target.value })}
                      placeholder="Sila nyatakan panitia..."
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-sm font-medium"
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fail Bahan</label>
                  <div className="relative">
                    <input
                      type="file"
                      onChange={handleFileChange}
                      className="hidden"
                      id="panitia-file-upload"
                      required
                    />
                    <label
                      htmlFor="panitia-file-upload"
                      className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-slate-200 rounded-2xl cursor-pointer hover:bg-slate-50 hover:border-indigo-300 transition-all group"
                    >
                      {formData.file ? (
                        <div className="flex items-center gap-3 text-indigo-600">
                          <FileText size={32} />
                          <div className="text-left">
                            <p className="text-sm font-bold truncate max-w-[200px]">{formData.file.name}</p>
                            <p className="text-[10px] opacity-60">{(formData.file.size / 1024).toFixed(1)} KB</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <Upload className="text-slate-300 group-hover:text-indigo-400 mb-2" size={32} />
                          <p className="text-xs font-bold text-slate-400 group-hover:text-indigo-500">Klik untuk pilih fail</p>
                        </>
                      )}
                    </label>
                  </div>
                </div>

                {isUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      <span>Memuat Naik...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${uploadProgress}%` }}
                        className="h-full bg-indigo-600"
                      />
                    </div>
                  </div>
                )}

                {showSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-center gap-2 py-2 text-emerald-600 font-bold text-sm"
                  >
                    <CheckCircle size={18} />
                    <span>Berjaya Dimuat Naik!</span>
                  </motion.div>
                )}

                    </div>

                  <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-600 font-bold text-sm hover:bg-slate-50 transition-all"
                    disabled={isUploading}
                  >
                    Batal
                  </button>
                  <motion.button
                    whileHover={!isUploading && !showSuccess ? { scale: 1.02 } : {}}
                    whileTap={{ scale: 0.95 }}
                    type="submit"
                    className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${
                      showSuccess 
                        ? "bg-emerald-500 text-white shadow-emerald-200" 
                        : isUploading 
                          ? "bg-slate-700 text-white cursor-not-allowed" 
                          : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-indigo-200"
                    }`}
                    disabled={isUploading || showSuccess}
                  >
                    {showSuccess ? (
                      <>
                        <CheckCircle size={18} />
                        <span>Berjaya Dimuat Naik</span>
                      </>
                    ) : isUploading ? (
                      <>
                        <RefreshCw size={18} className="animate-spin inline-block" />
                        <span>Memuat Naik...</span>
                      </>
                    ) : (
                      "Muat Naik"
                    )}
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        {panitiaList.map((panitia) => (
          <div key={panitia} className="space-y-2">
            <button
              onClick={() => setExpandedPanitia(expandedPanitia === panitia ? null : panitia)}
              className={`w-full text-left p-5 formal-card flex items-center justify-between group transition-all ${
                expandedPanitia === panitia ? "border-indigo-500 ring-2 ring-indigo-500/10" : "hover:border-indigo-300"
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-xl transition-colors ${
                  expandedPanitia === panitia ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600 group-hover:bg-indigo-100"
                }`}>
                  <FolderOpen size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-800 serif">
                    {panitia}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                    {groupedFiles[panitia].length} Dokumen Tersedia
                  </p>
                </div>
              </div>
              <div className={`p-2 rounded-full transition-all ${
                expandedPanitia === panitia ? "bg-indigo-50 text-indigo-600 rotate-90" : "text-slate-300 group-hover:text-slate-400"
              }`}>
                <ChevronRight size={20} />
              </div>
            </button>

            <AnimatePresence>
              {expandedPanitia === panitia && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <div className="formal-card overflow-hidden mt-2 border-indigo-100">
                    {/* Desktop Table View */}
                    <div className="overflow-x-auto hidden md:block">
                      <table className="w-full text-left border-collapse min-w-[800px]">
                        <thead>
                          <tr className="border-b border-slate-200/50 bg-slate-50/50">
                            <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                              Nama Fail
                            </th>
                            <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                              Tarikh
                            </th>
                            <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px]">
                              Dimuat Naik Oleh
                            </th>
                            <th className="p-5 font-bold text-slate-400 uppercase tracking-wider text-[10px] text-right">
                              Tindakan
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {groupedFiles[panitia].map((file) => (
                            <tr
                              key={file.id}
                              className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                            >
                              <td className="p-5">
                                <div className="flex items-center gap-4">
                                  <div className="p-2.5 bg-red-50 text-red-500 rounded-xl">
                                    <FileText size={20} />
                                  </div>
                                  <div className="flex flex-col">
                                    <span className="font-semibold text-slate-700">
                                      {file.name}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                      {file.size}
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-5 text-slate-500 text-sm font-medium">
                                {formatDate(file.date)}
                              </td>
                              <td className="p-5 text-slate-500 text-sm font-medium">
                                {file.uploader}
                              </td>
                              <td className="p-5 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="p-2 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                    title="Lihat/Muat Turun"
                                  >
                                    <Download size={16} />
                                  </a>
                                  <button
                                    className="p-2 text-teal-500 hover:bg-teal-50 rounded-lg transition-colors"
                                    title="Kongsi"
                                    onClick={() => {
                                      const text = `*Bahan Panitia: ${file.name}*\n\nPanitia: ${file.panitia}\nDimuat Naik Oleh: ${file.uploader}\n\nPautan: ${file.url}`;
                                      window.open(
                                        `https://wa.me/?text=${encodeURIComponent(
                                          text
                                        )}`,
                                        "_blank"
                                      );
                                    }}
                                  >
                                    <Share2 size={16} />
                                  </button>
                                  <button
                                    onClick={() => handleDelete(file.id)}
                                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Padam"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile Card View for Panitia Files */}
                    <div className="md:hidden divide-y divide-slate-100">
                      {groupedFiles[panitia].map((file) => (
                        <div key={file.id} className="p-4 space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="p-2.5 bg-red-50 text-red-500 rounded-xl shrink-0">
                              <FileText size={20} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-bold text-slate-700 text-sm truncate">
                                {file.name}
                              </p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {file.size}
                                </span>
                                <span className="w-1 h-1 rounded-full bg-slate-200"></span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                                  {formatDate(file.date)}
                                </span>
                              </div>
                              <p className="text-[10px] font-medium text-slate-500 mt-1">
                                Oleh: {file.uploader}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                            <div className="flex gap-2">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                              >
                                <Download size={14} /> Lihat
                              </a>
                              <button
                                onClick={() => {
                                  const text = `*Bahan Panitia: ${file.name}*\n\nPanitia: ${file.panitia}\nDimuat Naik Oleh: ${file.uploader}\n\nPautan: ${file.url}`;
                                  window.open(
                                    `https://wa.me/?text=${encodeURIComponent(
                                      text
                                    )}`,
                                    "_blank"
                                  );
                                }}
                                className="flex items-center gap-2 px-3 py-1.5 bg-teal-50 text-teal-600 rounded-lg text-[10px] font-bold uppercase tracking-wider"
                              >
                                <Share2 size={14} /> Kongsi
                              </button>
                            </div>
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}
        {files.length === 0 && (
          <div className="p-16 text-center formal-card">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-slate-50 text-slate-300 rounded-2xl">
                <FolderOpen size={48} />
              </div>
            </div>
            <p className="text-slate-500 font-medium">
              Tiada bahan dimuat naik. Sila muat naik bahan baru.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const AdminPanel = ({
  links,
  setLinks,
  announcements,
  setAnnouncements,
  stats,
  setStats,
  attendance,
  setAttendance,
  refreshLinks,
  saveAnnouncements,
  saveStats,
}: {
  links: WebLink[];
  setLinks: (l: WebLink[]) => void;
  announcements: Announcement[];
  setAnnouncements: (a: Announcement[]) => void;
  stats: Stat;
  setStats: (s: Stat) => void;
  attendance: Attendance;
  setAttendance: (a: Attendance) => void;
  refreshLinks: () => void;
  saveAnnouncements: (a: Announcement[]) => void;
  saveStats: (s: number) => void;
}) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "dzurri") {
      setIsAuthenticated(true);
      setError("");
    } else {
      setError("Kata laluan salah");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="formal-card p-10 w-full max-w-md"
        >
          <div className="flex justify-center mb-8">
            <div className="p-5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Lock size={32} />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-8 serif">
            Log Masuk Admin
          </h2>
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Kata Laluan"
                className="w-full px-5 py-4 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all text-slate-800 placeholder-slate-400 font-medium"
              />
              {error && (
                <p className="text-red-500 text-sm mt-3 px-2 font-medium">
                  {error}
                </p>
              )}
            </div>
            <button
              type="submit"
              className="w-full py-4 btn-formal btn-formal-primary shadow-lg shadow-indigo-200 font-bold"
            >
              Log Masuk
            </button>
          </form>
        </motion.div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="space-y-10">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2 sm:gap-3 serif">
          <div className="p-1.5 sm:p-2 bg-indigo-50 text-indigo-600 rounded-xl shrink-0">
            <Settings size={20} className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="leading-tight">Panel Pentadbir</span>
        </h2>
        <button
          onClick={() => setIsAuthenticated(false)}
          className="btn-formal btn-formal-secondary text-red-500 border-red-100 hover:bg-red-50"
        >
          <LogOut size={18} className="mr-2" /> Log Keluar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Manage Links */}
        <div className="formal-card p-5 sm:p-8 space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 serif">
              Urus Aplikasi Digital
            </h3>
            <button
              onClick={refreshLinks}
              className="btn-formal btn-formal-secondary text-xs"
            >
              <RefreshCw size={14} className="mr-2" /> Segar Semula
            </button>
          </div>
          <div className="p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-sm text-indigo-800">
            <p className="font-bold mb-2">Nota Penting:</p>
            <p className="leading-relaxed opacity-80">
              Pautan kini diuruskan sepenuhnya melalui Google Sheet. Sila kemas
              kini data di dalam Google Sheet anda. Aplikasi ini akan memuat
              turun data secara automatik.
            </p>
            <a
              href={GOOGLE_SHEET_CSV_URL_LINKS.replace(
                "/export?format=csv&gid=0",
                "/edit",
              )}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 mt-4 text-indigo-600 hover:text-indigo-800 font-bold transition-colors"
            >
              Buka Google Sheet <ExternalLink size={16} />
            </a>
          </div>
          <div className="space-y-4 opacity-70 pointer-events-none">
            {links.map((link, index) => (
              <div
                key={link.id}
                className="flex flex-col gap-3 formal-card p-5"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">
                      Tajuk Aplikasi
                    </label>
                    <input
                      value={link.title}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm mt-2 font-medium text-slate-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">
                      Pautan URL
                    </label>
                    <input
                      value={link.url}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm mt-2 font-medium text-slate-500"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider ml-2">
                      URL Logo / Ikon
                    </label>
                    <input
                      value={link.iconUrl || ""}
                      readOnly
                      className="w-full px-4 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm mt-2 font-medium text-slate-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manage Stats & Attendance */}
        <div className="space-y-10">
          <div className="formal-card p-5 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 serif">
              Statistik Semasa
            </h3>
            <div className="p-5 bg-teal-50/50 border border-teal-100 rounded-2xl text-sm text-teal-800">
              <p className="font-bold mb-2">Nota:</p>
              <p className="leading-relaxed opacity-80">
                Jumlah guru kini diselaraskan secara automatik dari Google Sheet
                senarai nama guru.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-2 mb-2">
                  Jumlah Guru (Auto)
                </label>
                <input
                  type="number"
                  value={stats.teachers}
                  readOnly
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 bg-slate-50 font-bold text-lg text-slate-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-2 mb-2">
                  Jumlah Murid
                </label>
                <input
                  type="number"
                  value={stats.students}
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    setStats({
                      ...stats,
                      students: val,
                    });
                    saveStats(val);
                  }}
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-lg text-slate-800"
                />
              </div>
            </div>
          </div>

          <div className="formal-card p-5 sm:p-8 space-y-6">
            <h3 className="text-lg font-bold text-slate-800 serif">Keberadaan Guru</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-2 mb-2">
                  Hadir
                </label>
                <input
                  type="number"
                  value={attendance.present}
                  onChange={(e) =>
                    setAttendance({
                      ...attendance,
                      present: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-lg text-teal-600"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-2 mb-2">
                  Cuti / Tidak Hadir
                </label>
                <input
                  type="number"
                  value={attendance.absent}
                  onChange={(e) =>
                    setAttendance({
                      ...attendance,
                      absent: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-lg text-red-600"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider ml-2 mb-2">
                  Jumlah Keseluruhan (Auto)
                </label>
                <input
                  type="number"
                  value={attendance.total}
                  readOnly
                  className="w-full px-5 py-3 rounded-lg border border-slate-200 bg-slate-50 font-bold text-lg text-slate-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Manage Announcements */}
        <div className="formal-card p-5 sm:p-8 space-y-6 lg:col-span-2">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800 serif">Urus Makluman</h3>
            <button
              onClick={() => {
                const newAnns = [
                  {
                    id: Date.now().toString(),
                    title: "Makluman Baru",
                    date: new Date().toISOString().split("T")[0],
                    content: "",
                  },
                  ...announcements,
                ];
                setAnnouncements(newAnns);
                saveAnnouncements(newAnns);
              }}
              className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Plus size={20} />
            </button>
          </div>
          <div className="space-y-6">
            {announcements.map((ann, index) => (
              <div
                key={ann.id}
                className="bg-slate-50/50 border border-slate-200 p-6 rounded-3xl space-y-4 relative"
              >
                <button
                  onClick={() => {
                    const newAnns = announcements.filter((a) => a.id !== ann.id);
                    setAnnouncements(newAnns);
                    saveAnnouncements(newAnns);
                  }}
                  className="absolute top-6 right-6 p-2 text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 size={18} />
                </button>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:pr-12">
                  <input
                    value={ann.title}
                    onChange={(e) => {
                      const newAnns = [...announcements];
                      newAnns[index].title = e.target.value;
                      setAnnouncements(newAnns);
                      saveAnnouncements(newAnns);
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-slate-800"
                    placeholder="Tajuk Makluman"
                  />
                  <input
                    type="date"
                    value={ann.date}
                    onChange={(e) => {
                      const newAnns = [...announcements];
                      newAnns[index].date = e.target.value;
                      setAnnouncements(newAnns);
                      saveAnnouncements(newAnns);
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-600"
                  />
                </div>
                <textarea
                  value={ann.content}
                  onChange={(e) => {
                    const newAnns = [...announcements];
                    newAnns[index].content = e.target.value;
                    setAnnouncements(newAnns);
                    saveAnnouncements(newAnns);
                  }}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all min-h-[100px] font-medium text-slate-600 leading-relaxed"
                  placeholder="Kandungan makluman..."
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const KeberadaanForm = ({ teachers }: { teachers: Teacher[] }) => {
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [bidang, setBidang] = useState("");
  const [sebab, setSebab] = useState("");
  const [sebabProgram, setSebabProgram] = useState("");

  const [tempoh, setTempoh] = useState("sehari");
  const [tarikhMula, setTarikhMula] = useState("");
  const [tarikhTamat, setTarikhTamat] = useState("");

  const [masaMula, setMasaMula] = useState("");
  const [masaTamat, setMasaTamat] = useState("");
  const [tujuanKeluar, setTujuanKeluar] = useState("");

  const [lewat, setLewat] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleTeacherChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const name = e.target.value;
    setSelectedTeacher(name);
    const teacher = teachers.find((t) => t.name === name);
    setBidang(teacher ? teacher.bidang : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Get local date string for fallback
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000;
    const todayStr = new Date(today.getTime() - offset)
      .toISOString()
      .slice(0, 10);

    const payload = {
      nama: selectedTeacher,
      bidang: bidang,
      sebab: sebab,
      program: sebabProgram,
      tempoh: tempoh,
      tarikhMula: tarikhMula || todayStr,
      tarikhTamat: tarikhTamat || todayStr,
      masaMula: masaMula,
      masaTamat: masaTamat,
      tujuan: tujuanKeluar,
      lewat: lewat,
    };

    const GAS_URL =
      "https://script.google.com/macros/s/AKfycbyo-jocuZVTZR3oQ5QNkNztxl3l_a5Zgqx_DdCtqBqd6RNcMBUyh21-vRi-ok3ANk3VtA/exec";

    if (GAS_URL) {
      try {
        await fetch(GAS_URL, {
          method: "POST",
          mode: "no-cors", // Required to avoid CORS issues with simple GAS deployments
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
      } catch (error) {
        console.error("Error submitting form:", error);
      }
    } else {
      console.log("Simulasi hantaran (GAS URL tidak ditetapkan):", payload);
    }

    setIsSubmitting(false);
    setSubmitted(true);

    // Reset form after 3 seconds
    setTimeout(() => {
      setSubmitted(false);
      setSelectedTeacher("");
      setBidang("");
      setSebab("");
      setSebabProgram("");
      setTempoh("sehari");
      setTarikhMula("");
      setTarikhTamat("");
      setMasaMula("");
      setMasaTamat("");
      setTujuanKeluar("");
      setLewat("");
    }, 3000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
        <div className="p-1.5 sm:p-2 bg-teal-50 text-teal-600 rounded-xl shrink-0">
          <ClipboardList size={24} className="w-5 h-5 sm:w-6 sm:h-6" />
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-slate-800 serif leading-tight">
          Borang Keberadaan Guru
        </h2>
      </div>

      <div className="formal-card p-5 sm:p-8 max-w-3xl">
        <div className="mb-8 p-4 bg-teal-50 text-teal-800 rounded-xl text-sm border border-teal-100">
          <p className="font-bold mb-1">Makluman:</p>
          <p className="opacity-80">
            Borang ini membolehkan guru memaklumkan ketidakhadiran, kelewatan,
            atau urusan luar. Data akan direkodkan untuk rujukan pentadbir.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              1. Nama Guru
            </label>
            <select
              value={selectedTeacher}
              onChange={handleTeacherChange}
              required
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
            >
              <option value="">-- Pilih Nama Guru --</option>
              {teachers.map((t, i) => (
                <option key={i} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              Bidang / Jabatan (Kesan Automatik)
            </label>
            <input
              type="text"
              value={bidang}
              readOnly
              placeholder="Akan diisi secara automatik"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 bg-slate-50 font-medium text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              2. Sebab Tidak Hadir
            </label>
            <select
              value={sebab}
              onChange={(e) => setSebab(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
            >
              <option value="">-- Pilih Sebab (Jika Berkenaan) --</option>
              <option value="CUTI SAKIT (MC)">CUTI SAKIT (MC)</option>
              <option value="CUTI REHAT KHAS (CRK)">
                CUTI REHAT KHAS (CRK)
              </option>
              <option value="PROGRAM">PROGRAM (NYATAKAN)</option>
            </select>
          </div>

          <AnimatePresence>
            {sebab === "PROGRAM" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-2">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Nyatakan Program
                  </label>
                  <input
                    type="text"
                    value={sebabProgram}
                    onChange={(e) => setSebabProgram(e.target.value)}
                    required
                    placeholder="Contoh: Kursus KSSR di PPD"
                    className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Tempoh Tarikh (Hanya tunjuk jika sebab dipilih) */}
          <AnimatePresence>
            {sebab && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-4 pb-2 border-t border-gray-100">
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                    Tempoh Tarikh
                  </label>
                  <div className="flex flex-wrap gap-4 sm:gap-6 mb-4">
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="tempoh"
                        value="sehari"
                        checked={tempoh === "sehari"}
                        onChange={(e) => setTempoh(e.target.value)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                        Sehari Sahaja
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer group">
                      <input
                        type="radio"
                        name="tempoh"
                        value="lebih"
                        checked={tempoh === "lebih"}
                        onChange={(e) => setTempoh(e.target.value)}
                        className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium text-slate-700 group-hover:text-indigo-600 transition-colors">
                        Lebih Dari Sehari
                      </span>
                    </label>
                  </div>

                  {tempoh === "sehari" ? (
                    <div>
                      <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                        Tarikh
                      </label>
                      <input
                        type="date"
                        value={tarikhMula}
                        onChange={(e) => setTarikhMula(e.target.value)}
                        required
                        className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Tarikh Mula
                        </label>
                        <input
                          type="date"
                          value={tarikhMula}
                          onChange={(e) => setTarikhMula(e.target.value)}
                          required
                          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                          Tarikh Tamat
                        </label>
                        <input
                          type="date"
                          value={tarikhTamat}
                          onChange={(e) => setTarikhTamat(e.target.value)}
                          required
                          className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">
              3. Mohon Kebenaran Tinggal Pejabat
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Masa Mula
                </label>
                <input
                  type="time"
                  value={masaMula}
                  onChange={(e) => setMasaMula(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                  Masa Tamat
                </label>
                <input
                  type="time"
                  value={masaTamat}
                  onChange={(e) => setMasaTamat(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                Tujuan / Urusan
              </label>
              <input
                type="text"
                value={tujuanKeluar}
                onChange={(e) => setTujuanKeluar(e.target.value)}
                placeholder="Contoh: Urusan Bank / Klinik"
                className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
              4. Lewat Hadir (Nyatakan)
            </label>
            <input
              type="text"
              value={lewat}
              onChange={(e) => setLewat(e.target.value)}
              placeholder="Contoh: Hantar anak ke klinik"
              className="w-full px-4 py-3 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium text-slate-700 bg-white"
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={isSubmitting || !selectedTeacher}
              className="w-full py-4 btn-formal btn-formal-primary shadow-lg shadow-indigo-200 font-bold"
            >
              {isSubmitting ? "Menghantar..." : "Hantar Borang Keberadaan"}
            </button>
          </div>

          <AnimatePresence>
            {submitted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-4 bg-green-50 text-green-700 rounded-xl text-center font-bold border border-green-200"
              >
                Borang berjaya dihantar!
              </motion.div>
            )}
          </AnimatePresence>
        </form>
      </div>
    </div>
  );
};

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("theme") === "dark" ||
        (!localStorage.getItem("theme") && window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    return false;
  });

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);
  const [activeApp, setActiveApp] = useState<WebLink | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // State
  const [links, setLinks] = useState<WebLink[]>([]);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [linksError, setLinksError] = useState("");
  const [teachersError, setTeachersError] = useState("");
  const [teachersList, setTeachersList] = useState<Teacher[]>([]);

  const [announcements, setAnnouncements] = useState<Announcement[]>(
    INITIAL_ANNOUNCEMENTS,
  );
  const [stats, setStats] = useState<Stat>(INITIAL_STATS);
  const [attendance, setAttendance] = useState<Attendance>(INITIAL_ATTENDANCE);
  const [rawAttendanceData, setRawAttendanceData] = useState<any[]>([]);
  const [files, setFiles] = useState<PanitiaFile[]>(INITIAL_FILES);
  const [userLinks, setUserLinks] = useState<UserLink[]>([]);
  const [panitiaTeachers, setPanitiaTeachers] = useState<string[]>([]);

  const fetchLinksFromSheet = async () => {
    setIsLoadingLinks(true);
    setLinksError("");
    try {
      Papa.parse(GOOGLE_SHEET_CSV_URL_LINKS, {
        download: true,
        header: true,
        complete: (results) => {
          const parsedLinks: WebLink[] = [];

          results.data.forEach((row: any, index) => {
            if (!row) return;

            // Create a case-insensitive row object
            const lowerCaseRow: Record<string, string> = {};
            Object.keys(row).forEach((key) => {
              if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
            });

            // Check if row has data (skip empty rows)
            if (Object.keys(lowerCaseRow).length > 0) {
              // Try to match column names flexibly
              const title =
                lowerCaseRow.tajuk ||
                lowerCaseRow.title ||
                lowerCaseRow.nama ||
                "";
              const url =
                lowerCaseRow.url ||
                lowerCaseRow.pautan ||
                lowerCaseRow.link ||
                "";
              const iconUrl =
                lowerCaseRow.logo ||
                lowerCaseRow.icon ||
                lowerCaseRow.ikon ||
                lowerCaseRow.iconurl ||
                "";

              if (title && url) {
                parsedLinks.push({
                  id: `sheet-${index}`,
                  title: title.trim(),
                  url: url.trim(),
                  iconUrl: iconUrl.trim(),
                });
              }
            }
          });

          if (parsedLinks.length > 0) {
            setLinks(parsedLinks);
          } else {
            setLinksError(
              'Tiada data pautan dijumpai atau format lajur tidak sepadan. Sila pastikan lajur "Tajuk", "URL", dan "Logo" wujud.',
            );
            setLinks(INITIAL_LINKS); // Fallback to initial links on error
          }
          setIsLoadingLinks(false);
        },
        error: (error) => {
          console.error("Error fetching links CSV:", error);
          setLinksError(
            'Gagal memuat turun data pautan dari Google Sheet. Pastikan Sheet telah ditetapkan kepada "Anyone with the link can view".',
          );
          setLinks(INITIAL_LINKS);
          setIsLoadingLinks(false);
        },
      });
    } catch (error) {
      console.error("Error fetching links:", error);
      setLinksError("Ralat sistem semasa memuat turun data pautan.");
      setLinks(INITIAL_LINKS);
      setIsLoadingLinks(false);
    }
  };

  const fetchTeachersFromSheet = async () => {
    setTeachersError("");
    try {
      // Add cache buster to ensure fresh data
      const response = await fetch(
        `${GOOGLE_SHEET_CSV_URL_TEACHERS}&t=${new Date().getTime()}`,
      );
      if (!response.ok) {
        if (response.status === 400) {
          throw new Error(
            `Gagal mengakses Google Sheet (Kod: 400). Kemungkinan besar GID tab tidak betul atau anda tidak mempunyai kebenaran. Sila sahkan GID dan tetapan perkongsian "Anyone with the link".`,
          );
        }
        throw new Error(
          `Gagal mengakses Google Sheet (Kod: ${response.status}). Sila pastikan tetapan perkongsian adalah "Anyone with the link".`,
        );
      }
      const csvText = await response.text();

      if (!csvText) {
        throw new Error("Fail Google Sheet kosong atau tidak dapat dibaca.");
      }

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const teacherNames: string[] = [];
          const teachersData: Teacher[] = [];
          results.data.forEach((row: any) => {
            if (!row) return;
            const lowerCaseRow: Record<string, string> = {};
            Object.keys(row).forEach((key) => {
              if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
            });

            const teacherName =
              lowerCaseRow["nama guru"] || lowerCaseRow["nama"];
            const teacherBidang =
              lowerCaseRow["bidang"] ||
              lowerCaseRow["jabatan"] ||
              lowerCaseRow["opsyen"] ||
              "Tiada Maklumat";

            if (teacherName && teacherName.trim() !== "") {
              teacherNames.push(teacherName.trim());
              teachersData.push({
                name: teacherName.trim(),
                bidang: teacherBidang.trim(),
              });
            }
          });

          if (teacherNames.length > 0) {
            setTeachersList(teachersData);
            setStats((prev) => ({ ...prev, teachers: teacherNames.length }));
            setAttendance((prev) => {
              const newPresent = teacherNames.length - prev.absent;
              return {
                ...prev,
                total: teacherNames.length,
                present: newPresent >= 0 ? newPresent : 0,
              };
            });
          } else {
            setTeachersError(
              'Tiada nama guru dijumpai. Pastikan lajur "NAMA GURU" wujud dan mempunyai data.',
            );
          }
        },
        error: (error: any) => {
          console.error("Error parsing teachers CSV:", error);
          setTeachersError(
            `Gagal memproses data guru. Sila semak format CSV. Ralat: ${error.message}`,
          );
        },
      });
    } catch (error: any) {
      console.error("Error fetching teachers CSV:", error);
      setTeachersError(
        error.message || "Ralat tidak diketahui semasa memuat turun data guru.",
      );
    }
  };

  const fetchStudentsCountFromSheet = async () => {
    try {
      const response = await fetch(
        `${GOOGLE_SHEET_CSV_URL_STUDENTS}&t=${new Date().getTime()}`,
      );
      if (!response.ok) return;
      const csvText = await response.text();
      if (!csvText) return;

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          let studentCount = 0;
          results.data.forEach((row: any) => {
            if (!row) return;
            const lowerCaseRow: Record<string, string> = {};
            Object.keys(row).forEach((key) => {
              if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
            });
            if (Object.keys(lowerCaseRow).length > 0) {
              studentCount++;
            }
          });
          setStats((prev) => ({ ...prev, students: studentCount }));
        },
      });
    } catch (error) {
      console.error("Error fetching students count:", error);
    }
  };

  const fetchKeberadaanFromSheet = async () => {
    try {
      // Add cache buster to ensure fresh data
      const response = await fetch(
        `${GOOGLE_SHEET_CSV_URL_KEBERADAAN}&t=${new Date().getTime()}`,
      );
      if (!response.ok) {
        return;
      }
      const csvText = await response.text();

      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          setRawAttendanceData(results.data);
          const today = new Date();
          const offset = today.getTimezoneOffset() * 60000;
          const todayStr = new Date(today.getTime() - offset)
            .toISOString()
            .slice(0, 10);

          const absentMap = new Map<string, AbsentDetail>();

          results.data.forEach((row: any) => {
            const lowerRow: Record<string, string> = {};
            Object.keys(row).forEach((k) => {
              if (k) lowerRow[k.toLowerCase().trim()] = row[k];
            });

            const nama = lowerRow["nama guru"] || "";
            if (!nama) return;

            const bidangKey =
              Object.keys(lowerRow).find((k) => k.includes("bidang")) || "";
            const bidang = bidangKey ? lowerRow[bidangKey] : "";

            let tarikhMula = lowerRow["tarikh mula"] || "";
            let tarikhTamat = lowerRow["tarikh tamat"] || "";
            
            // Normalize dates to ISO format (YYYY-MM-DD) for consistent comparison
            if (tarikhMula) tarikhMula = parseDateToISO(tarikhMula);
            if (tarikhTamat) tarikhTamat = parseDateToISO(tarikhTamat);
            
            // If tarikhTamat is empty, assume it's the same as tarikhMula
            if (!tarikhTamat && tarikhMula) tarikhTamat = tarikhMula;

            const tempoh = lowerRow["mode"] || lowerRow["tempoh"] || "";
            const timestamp = lowerRow["timestamp"] || lowerRow["masa"] || "";

            // Fallback to timestamp if no date was provided
            if (!tarikhMula && timestamp) {
              // Try to extract date from timestamp (usually "M/D/YYYY H:mm:ss" or similar)
              const datePart = timestamp.split(" ")[0];
              const isoDate = parseDateToISO(datePart);
              if (isoDate) {
                tarikhMula = isoDate;
                tarikhTamat = isoDate;
              }
            }

            // Fallback to today ONLY if absolutely no date info is available
            // This is risky for historical data but necessary for simple daily forms
            if (!tarikhMula) {
              tarikhMula = todayStr;
              tarikhTamat = todayStr;
            }

            let isAbsentToday = false;

            if (tempoh.toLowerCase() === "sehari" || !tempoh) {
              if (tarikhMula === todayStr) isAbsentToday = true;
            } else if (tempoh.toLowerCase() === "lebih") {
              if (tarikhMula <= todayStr && tarikhTamat >= todayStr)
                isAbsentToday = true;
            }

            if (isAbsentToday) {
              let reason = "";
              let duration = "";

              const sebabVal =
                lowerRow["sebab"] || lowerRow["sebab tidak hadir"] || "";
              const programVal =
                lowerRow["nama program"] || lowerRow["program"] || "";
              const tujuanVal =
                lowerRow["keluar pejabat"] ||
                lowerRow["tujuan keluar"] ||
                lowerRow["tujuan"] ||
                "";
              const lewatVal =
                lowerRow["lewat hadir"] || lowerRow["lewat"] || "";
              const masaMulaVal =
                lowerRow["masa mula"] || lowerRow["masa keluar"] || "";
              const masaTamatVal =
                lowerRow["masa tamat"] || lowerRow["masa masuk"] || "";
              const modeVal = tempoh;

              if (sebabVal) {
                reason = sebabVal;
                if (programVal) reason += ` (${programVal})`;
                duration =
                  modeVal.toLowerCase() === "sehari" || !modeVal
                    ? "Sehari"
                    : `${formatDate(tarikhMula)} hingga ${formatDate(tarikhTamat)}`;
              } else if (tujuanVal || (masaMulaVal && masaTamatVal)) {
                reason = tujuanVal ? `Keluar: ${tujuanVal}` : "Keluar Pejabat";
                duration =
                  masaMulaVal && masaTamatVal
                    ? `${formatTime(masaMulaVal)} - ${formatTime(masaTamatVal)}`
                    : "Hari ini";
              } else if (lewatVal) {
                reason = `Lewat: ${lewatVal}`;
                duration = "Hari ini";
              } else {
                reason = "Tidak Hadir / Keluar";
                duration = "Hari ini";
              }

              if (reason) {
                // Deduplicate by teacher name, keeping the latest entry
                absentMap.set(nama, { name: nama, reason, duration, bidang });
              }
            }
          });

          const absentList = Array.from(absentMap.values());

          setAttendance((prev) => {
            const newPresent = prev.total - absentList.length;
            return {
              ...prev,
              absent: absentList.length,
              present: newPresent >= 0 ? newPresent : 0,
              absentDetails: absentList,
            };
          });
        },
      });
    } catch (error) {
      console.error("Error fetching keberadaan:", error);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements");
      if (res.ok) {
        const data = await res.json();
        if (data && data.length > 0) {
          setAnnouncements(data);
        }
      }
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

  const fetchUserLinks = async () => {
    try {
      // Fetch from Google Sheet
      const sheetResponse = await fetch(`${GOOGLE_SHEET_CSV_URL_USER_LINKS}&t=${new Date().getTime()}`);
      let sheetLinks: UserLink[] = [];
      
      if (sheetResponse.ok) {
        const csvText = await sheetResponse.text();
        if (csvText) {
          sheetLinks = await new Promise<UserLink[]>((resolve) => {
            Papa.parse(csvText, {
              header: true,
              skipEmptyLines: true,
              complete: (results) => {
                const parsed: UserLink[] = [];
                results.data.forEach((row: any) => {
                  if (!row) return;
                  const lowerCaseRow: Record<string, string> = {};
                  Object.keys(row).forEach((key) => {
                    if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
                  });

                  if (Object.keys(lowerCaseRow).length > 0 && (lowerCaseRow.title || lowerCaseRow.tajuk)) {
                    parsed.push({
                      id: lowerCaseRow.id || Date.now().toString() + Math.random(),
                      title: lowerCaseRow.title || lowerCaseRow.tajuk || "",
                      url: lowerCaseRow.url || lowerCaseRow.pautan || "",
                      instructions: lowerCaseRow.instructions || lowerCaseRow.arahan || "",
                      bidang: (lowerCaseRow.bidang as any) || "Pentadbiran",
                      date: lowerCaseRow.date || lowerCaseRow.tarikh || new Date().toISOString().split("T")[0],
                    });
                  }
                });
                resolve(parsed);
              }
            });
          });
        }
      }

      // Deduplicate sheet links to ensure no double data
      const uniqueLinksMap = new Map<string, UserLink>();
      
      const getUniqueKey = (link: UserLink) => {
        const title = (link.title || "").replace(/\s+/g, "").toLowerCase();
        const url = (link.url || "").replace(/\/$/, "").toLowerCase();
        return `${title}-${url}`;
      };

      sheetLinks.forEach(link => {
        uniqueLinksMap.set(getUniqueKey(link), link);
      });

      const finalLinks = Array.from(uniqueLinksMap.values()).sort((a, b) => {
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      setUserLinks(finalLinks);
    } catch (error) {
      console.error("Error fetching user links:", error);
    }
  };

  const fetchPanitiaTeachers = async () => {
    try {
      Papa.parse(GOOGLE_SHEET_CSV_URL_PANITIA_TEACHERS, {
        download: true,
        header: true,
        complete: (results) => {
          const names: string[] = results.data
            .map((row: any) => {
              const lowerCaseRow: Record<string, string> = {};
              Object.keys(row).forEach((key) => {
                if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
              });
              const teacherName = lowerCaseRow["nama guru"] || row["NAMA GURU"] || "";
              return teacherName.trim();
            })
            .filter((name: string) => name !== "");
          
          // Ensure unique names to avoid duplicate key errors
          const uniqueNames = Array.from(new Set(names));
          setPanitiaTeachers(uniqueNames);
        },
        error: (error) => {
          console.error("Error fetching panitia teachers CSV:", error);
        },
      });
    } catch (error) {
      console.error("Error fetching panitia teachers:", error);
    }
  };

  const fetchPanitiaFiles = async () => {
    try {
      const response = await fetch(`${GOOGLE_SHEET_CSV_URL_PANITIA_FILES}&t=${new Date().getTime()}`);
      if (!response.ok) return;
      const csvText = await response.text();
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const parsedFiles: PanitiaFile[] = results.data
            .map((row: any, index: number) => {
              const lowerCaseRow: Record<string, string> = {};
              Object.keys(row).forEach((key) => {
                if (key) lowerCaseRow[key.toLowerCase().trim()] = row[key];
              });
              
              const fileName = lowerCaseRow["nama fail"] || lowerCaseRow["filename"] || "";
              if (!fileName) return null;
              
              return {
                id: `panitia-${index}`,
                name: fileName,
                type: "file",
                size: "N/A",
                date: lowerCaseRow["timestamp"] || lowerCaseRow["masa"] || "",
                uploader: lowerCaseRow["nama guru"] || lowerCaseRow["uploader"] || "",
                panitia: lowerCaseRow["nama panitia"] || lowerCaseRow["panitia"] || "",
                url: lowerCaseRow["link url"] || lowerCaseRow["url"] || "#",
              };
            })
            .filter(Boolean) as PanitiaFile[];
          setFiles(parsedFiles);
        },
      });
    } catch (error) {
      console.error("Error fetching panitia files:", error);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/stats");
      if (res.ok) {
        const data = await res.json();
        if (data && data.students) {
          setStats((prev) => ({ ...prev, students: data.students }));
        }
      }
    } catch (error) {
      console.error("Error fetching stats:", error);
    }
  };

  const saveAnnouncements = async (newAnns: Announcement[]) => {
    try {
      await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ announcements: newAnns }),
      });
    } catch (error) {
      console.error("Error saving announcements:", error);
    }
  };

  const saveStats = async (newStudents: number) => {
    try {
      await fetch("/api/stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ students: newStudents }),
      });
    } catch (error) {
      console.error("Error saving stats:", error);
    }
  };

  const saveUserLink = async (link: UserLink) => {
    try {
      // Optimistically update UI to avoid waiting for Google Sheet cache
      setUserLinks(prev => {
        const filtered = prev.filter(l => l.id !== link.id);
        return [link, ...filtered].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      });

      // Send to Google Sheet (Share_Link tab)
      const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyo-jocuZVTZR3oQ5QNkNztxl3l_a5Zgqx_DdCtqBqd6RNcMBUyh21-vRi-ok3ANk3VtA/exec"; 
      
      if (GOOGLE_SCRIPT_URL) {
        try {
          await fetch(GOOGLE_SCRIPT_URL, {
            method: "POST",
            mode: "no-cors", // Important for GAS without CORS headers
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(link),
          });
          console.log("Data sent to Google Sheet successfully");
        } catch (sheetError) {
          console.error("Error sending to Google Sheet:", sheetError);
        }
      } else {
        console.warn("Google Script URL not set. Please update GOOGLE_SCRIPT_URL in src/App.tsx.");
      }
    } catch (error) {
      console.error("Error saving user link:", error);
    }
  };

  const deleteUserLink = async (id: string) => {
    try {
      const res = await fetch(`/api/user-links/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchUserLinks();
      }
    } catch (error) {
      console.error("Error deleting user link:", error);
    }
  };

  useEffect(() => {
    fetchLinksFromSheet();
    fetchTeachersFromSheet();
    fetchStudentsCountFromSheet();
    fetchKeberadaanFromSheet();
    fetchAnnouncements();
    fetchStats();
    fetchUserLinks();
    fetchPanitiaTeachers();
    fetchPanitiaFiles();
  }, []);

  const [showAbsentModal, setShowAbsentModal] = useState(false);

  const navItems = [
    { id: "dashboard", label: "Utama", icon: LayoutDashboard },
    { id: "murid", label: "Murid", icon: Users },
    { id: "pautan", label: "Senarai Pautan", icon: Link },
    { id: "keberadaan", label: "Keberadaan Guru", icon: ClipboardList },
    { id: "panitia", label: "Pengurusan Panitia", icon: FolderOpen },
    { id: "admin", label: "Admin", icon: Settings },
  ];

  return (
    <div className="min-h-screen font-sans text-slate-700 flex flex-col lg:flex-row relative overflow-hidden bg-transparent">
      <div className="bg-mesh" />
      <AnimatePresence>
        {showAbsentModal && (
          <AttendanceDetailsModal
            attendance={attendance}
            onClose={() => setShowAbsentModal(false)}
          />
        )}
      </AnimatePresence>
      {/* Animated Background Blobs */}
      <div className="bg-shape shape-1"></div>
      <div className="bg-shape shape-2"></div>
      <div className="bg-shape shape-3"></div>

      {/* Mobile Topbar */}
      <nav className="lg:hidden glass-panel px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-50 p-1 flex items-center justify-center">
             <img
               src={getDirectImageUrl(
                 "https://drive.google.com/file/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u/view?usp=drive_link",
               )}
               alt="Logo"
               className="w-full h-full object-contain"
             />
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-black text-purple-600 text-lg leading-none">S1STEN</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">SSEMJ 1 STOP CENTRE</span>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mt-0.5">
              {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </span>
          </div>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed inset-x-0 top-[60px] z-40 bg-white border-b border-slate-200 shadow-xl lg:hidden"
          >
            <div className="p-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                    activeTab === item.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <item.icon size={20} />
                  {item.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 glass-panel fixed inset-y-0 left-0 z-40 border-r border-slate-200/50">
        <div className="flex flex-col items-center justify-center border-b border-slate-200/50 py-8">
           <div className="flex flex-col items-center gap-3">
             <div className="w-24 h-24 rounded-2xl bg-white p-4 flex items-center justify-center mb-2 shadow-sm border border-slate-100">
               <img
                 src={getDirectImageUrl(
                   "https://drive.google.com/file/d/1tyJ5QLBbqarYBYAzkFmPJ7ZBZ0fYp97u/view?usp=drive_link",
                 )}
                 alt="Logo"
                 className="w-full h-full object-contain"
               />
             </div>
             <div className="text-center">
                <h1 className="text-3xl font-black tracking-tighter text-purple-600">
                  S1STEN
                </h1>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                  SSEMJ 1 STOP CENTRE
                </p>
             </div>
           </div>
        </div>
        
        <nav className="flex-1 p-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full sidebar-item font-semibold text-sm ${
                activeTab === item.id ? "active" : ""
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-200/50">
           <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                 <LiveClock />
                 <button
                   onClick={toggleTheme}
                   className="p-2 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 transition-all border border-slate-200"
                   title={isDarkMode ? "Tukar ke Mod Cerah" : "Tukar ke Mod Gelap"}
                 >
                   {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                 </button>
              </div>
           </div>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen transition-all duration-300">
        {/* Top Bar */}
        <header className="glass-panel min-h-[70px] px-4 md:px-8 flex flex-col md:flex-row items-center justify-between sticky top-0 z-30 gap-4 py-3 md:py-0 transition-all border-b border-slate-200/50">
           <div className="hidden md:block">
              <h2 className="text-lg font-bold text-slate-800 tracking-tight serif">
                {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
              </h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SSEMJ 1 Stop Centre</p>
           </div>

           <div className="flex items-center gap-2 sm:gap-4 w-full md:w-auto justify-start md:justify-end overflow-x-auto no-scrollbar pb-2 md:pb-0">
              <div className="flex items-center gap-2 sm:gap-4 min-w-max px-1">
                 <div className="formal-card px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3">
                    <div className="p-1 sm:p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                       <Users size={14} className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                       <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Guru</p>
                       <p className="text-xs sm:text-sm font-bold text-slate-700 leading-none">{stats.teachers}</p>
                    </div>
                 </div>
                 <div className="formal-card px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3">
                    <div className="p-1 sm:p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                       <GraduationCap size={14} className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                       <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Murid</p>
                       <p className="text-xs sm:text-sm font-bold text-slate-700 leading-none">{stats.students}</p>
                    </div>
                 </div>
                 <div className="formal-card px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3">
                    <div className="p-1 sm:p-1.5 bg-green-50 text-green-600 rounded-lg">
                       <UserCheck size={14} className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div>
                       <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Hadir</p>
                       <p className="text-xs sm:text-sm font-bold text-slate-700 leading-none">{attendance.present}</p>
                    </div>
                 </div>
                 <button 
                    onClick={() => setShowAbsentModal(true)}
                    className="formal-card px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center gap-1.5 sm:gap-3 hover:bg-red-50 transition-colors cursor-pointer"
                 >
                    <div className="p-1 sm:p-1.5 bg-red-50 text-red-600 rounded-lg">
                       <UserX size={14} className="w-3 h-3 sm:w-4 sm:h-4" />
                    </div>
                    <div className="text-left">
                       <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Tiada</p>
                       <p className="text-xs sm:text-sm font-bold text-slate-700 leading-none">{attendance.absent}</p>
                    </div>
                 </button>
              </div>
           </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">

           <AnimatePresence mode="wait">
             <motion.div
               key={activeTab}
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
             >
               {activeTab === "dashboard" && (
                 <Dashboard
                   links={links}
                   isLoadingLinks={isLoadingLinks}
                   linksError={linksError}
                   announcements={announcements}
                   stats={stats}
                   attendance={attendance}
                   rawAttendanceData={rawAttendanceData}
                   onOpenApp={setActiveApp}
                   teachersError={teachersError}
                   onRefresh={fetchLinksFromSheet}
                 />
               )}
               {activeTab === "murid" && (
                 <PengurusanMurid />
               )}
               {activeTab === "pautan" && (
                 <SenaraiPautan
                   links={userLinks}
                   onSave={saveUserLink}
                   onDelete={deleteUserLink}
                 />
               )}
               {activeTab === "panitia" && (
                 <PengurusanPanitia
                   files={files}
                   setFiles={setFiles}
                   teacherNames={panitiaTeachers}
                   fetchPanitiaFiles={fetchPanitiaFiles}
                 />
               )}
               {activeTab === "keberadaan" && (
                  <div className="space-y-8">
                    <TeacherAttendanceAnalysis data={rawAttendanceData} />
                    <KeberadaanForm teachers={teachersList} />
                  </div>
               )}
               {activeTab === "admin" && (
                 <AdminPanel
                   links={links}
                   setLinks={setLinks}
                   announcements={announcements}
                   setAnnouncements={setAnnouncements}
                   stats={stats}
                   setStats={setStats}
                   attendance={attendance}
                   setAttendance={setAttendance}
                   refreshLinks={fetchLinksFromSheet}
                   saveAnnouncements={saveAnnouncements}
                   saveStats={saveStats}
                 />
               )}
             </motion.div>
           </AnimatePresence>
        </main>
      </div>

      {/* Fullscreen App Viewer */}
      <AnimatePresence>
        {activeApp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-50"
          >
            <IframeViewer
              url={activeApp.url}
              title={activeApp.title}
              onClose={() => setActiveApp(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
