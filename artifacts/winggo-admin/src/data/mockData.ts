export const REVENUE_DATA = [
  { day: "Mon", revenue: 48200, deposits: 32000, withdrawals: 18000 },
  { day: "Tue", revenue: 61500, deposits: 41000, withdrawals: 22000 },
  { day: "Wed", revenue: 52800, deposits: 36000, withdrawals: 19500 },
  { day: "Thu", revenue: 78300, deposits: 54000, withdrawals: 28000 },
  { day: "Fri", revenue: 92100, deposits: 63000, withdrawals: 34000 },
  { day: "Sat", revenue: 115600, deposits: 81000, withdrawals: 42000 },
  { day: "Sun", revenue: 98400, deposits: 70000, withdrawals: 36000 },
];

export const USER_GROWTH_DATA = [
  { month: "Nov", users: 12400 },
  { month: "Dec", users: 18900 },
  { month: "Jan", users: 24300 },
  { month: "Feb", users: 31800 },
  { month: "Mar", users: 42100 },
  { month: "Apr", users: 58600 },
  { month: "May", users: 74200 },
];

export const GAME_STATS_DATA = [
  { name: "Ludo", value: 38, color: "#7c3aed" },
  { name: "World War", value: 28, color: "#f59e0b" },
  { name: "Carrom", value: 15, color: "#34d399" },
  { name: "Cricket", value: 12, color: "#60a5fa" },
  { name: "Others", value: 7,  color: "#f87171" },
];

export const MOCK_USERS = [
  { id: "WG-1001", name: "Rahul Sharma",    phone: "+91 98765 43210", wallet: 2340, kyc: "verified",  status: "active",  joined: "12 Jan 2025", matches: 142, winRate: "72%" },
  { id: "WG-1002", name: "Priya Patel",     phone: "+91 87654 32109", wallet: 890,  kyc: "pending",   status: "active",  joined: "28 Jan 2025", matches: 67,  winRate: "58%" },
  { id: "WG-1003", name: "Amit Kumar",      phone: "+91 76543 21098", wallet: 5600, kyc: "verified",  status: "active",  joined: "5 Feb 2025",  matches: 289, winRate: "81%" },
  { id: "WG-1004", name: "Sneha Reddy",     phone: "+91 65432 10987", wallet: 0,    kyc: "rejected",  status: "banned",  joined: "19 Feb 2025", matches: 12,  winRate: "33%" },
  { id: "WG-1005", name: "Vikram Singh",    phone: "+91 54321 09876", wallet: 1200, kyc: "verified",  status: "active",  joined: "3 Mar 2025",  matches: 98,  winRate: "65%" },
  { id: "WG-1006", name: "Meera Nair",      phone: "+91 43210 98765", wallet: 320,  kyc: "pending",   status: "active",  joined: "22 Mar 2025", matches: 31,  winRate: "52%" },
  { id: "WG-1007", name: "Arjun Menon",     phone: "+91 32109 87654", wallet: 8900, kyc: "verified",  status: "active",  joined: "8 Apr 2025",  matches: 412, winRate: "88%" },
  { id: "WG-1008", name: "Deepika Joshi",   phone: "+91 21098 76543", wallet: 450,  kyc: "pending",   status: "active",  joined: "15 Apr 2025", matches: 23,  winRate: "47%" },
];

export const MOCK_WITHDRAWALS = [
  { id: "WD-4521", user: "Rahul Sharma",  amount: 1500, method: "UPI",    bank: "GPay - HDFC",         date: "Today 09:12",     status: "pending"  },
  { id: "WD-4520", user: "Amit Kumar",    amount: 3200, method: "Bank",   bank: "SBI - ****4321",       date: "Today 08:45",     status: "pending"  },
  { id: "WD-4519", user: "Vikram Singh",  amount: 800,  method: "UPI",    bank: "PhonePe - Axis",      date: "Today 07:30",     status: "approved" },
  { id: "WD-4518", user: "Arjun Menon",   amount: 5000, method: "Bank",   bank: "ICICI - ****8765",     date: "Yesterday 22:10", status: "approved" },
  { id: "WD-4517", user: "Meera Nair",    amount: 250,  method: "UPI",    bank: "Paytm - IndusInd",    date: "Yesterday 18:55", status: "rejected" },
  { id: "WD-4516", user: "Deepika Joshi", amount: 400,  method: "UPI",    bank: "GPay - Kotak",        date: "Yesterday 14:20", status: "approved" },
];

export const MOCK_KYC = [
  { id: "WG-1001", name: "Rahul Sharma",  pan: "ABCDE1234F", aadhaar: "****-****-4521", submitted: "2 May 2025", status: "verified",  risk: "low"  },
  { id: "WG-1002", name: "Priya Patel",   pan: "FGHIJ5678K", aadhaar: "****-****-7832", submitted: "8 May 2025", status: "pending",   risk: "low"  },
  { id: "WG-1006", name: "Meera Nair",    pan: "KLMNO9012P", aadhaar: "****-****-3341", submitted: "9 May 2025", status: "pending",   risk: "medium" },
  { id: "WG-1008", name: "Deepika Joshi", pan: "PQRST3456U", aadhaar: "****-****-9012", submitted: "10 May 2025",status: "pending",   risk: "low"  },
  { id: "WG-1004", name: "Sneha Reddy",   pan: "UVWXY7890Z", aadhaar: "****-****-6623", submitted: "1 May 2025", status: "rejected",  risk: "high" },
  { id: "WG-1005", name: "Vikram Singh",  pan: "AABCD1111E", aadhaar: "****-****-1122", submitted: "28 Apr 2025",status: "verified",  risk: "low"  },
];

export const MOCK_GAMES = [
  { id: 1, name: "Ludo Classic",   category: "Board",   players: "2-4", fee: "₹1-₹50", pool: "₹500",  active: true,  matches: 1240, bots: 30 },
  { id: 2, name: "World War",      category: "Battle",  players: "2",   fee: "₹5-₹100",pool: "₹2000", active: true,  matches: 890,  bots: 25 },
  { id: 3, name: "Carrom",         category: "Board",   players: "2",   fee: "₹2-₹25", pool: "₹250",  active: false, matches: 340,  bots: 40 },
  { id: 4, name: "Snake & Ladder", category: "Board",   players: "2-4", fee: "₹1-₹10", pool: "₹100",  active: true,  matches: 567,  bots: 50 },
  { id: 5, name: "Cricket",        category: "Sports",  players: "2",   fee: "₹5-₹50", pool: "₹500",  active: true,  matches: 432,  bots: 20 },
  { id: 6, name: "Spin & Win",     category: "Casual",  players: "1",   fee: "Free",   pool: "₹50",   active: true,  matches: 3400, bots: 0  },
];

export const MOCK_BANNERS = [
  { id: 1, title: "Diwali Bonus",      type: "Home Banner",  status: "active",   views: 48200, clicks: 9840, ctr: "20.4%" },
  { id: 2, title: "First Deposit 50%", type: "Popup",        status: "active",   views: 31500, clicks: 8200, ctr: "26.0%" },
  { id: 3, title: "World War Finals",  type: "Home Banner",  status: "scheduled",views: 0,     clicks: 0,    ctr: "—"    },
  { id: 4, title: "Refer & Earn ₹50",  type: "Daily Banner", status: "active",   views: 22100, clicks: 3800, ctr: "17.2%" },
  { id: 5, title: "KYC Verify Now",    type: "Popup",        status: "inactive", views: 8900,  clicks: 1200, ctr: "13.5%" },
];

export const NOTIFICATIONS = [
  { id: 1, type: "warning", msg: "3 withdrawal requests pending approval",    time: "2m ago"  },
  { id: 2, type: "info",    msg: "7 new KYC submissions received",            time: "15m ago" },
  { id: 3, type: "success", msg: "World War tournament completed — ₹25,000 distributed", time: "1h ago"  },
  { id: 4, type: "error",   msg: "User WG-1004 flagged for suspicious activity", time: "3h ago"  },
];
