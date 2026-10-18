export interface User {
  id: number;
  username: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Employee {
  id: number;
  fullName: string;
  phone: string | null;
  position: string | null;
  employmentStartDate: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  currentSalary: number | null;
}

export interface SalaryRecord {
  id: number;
  monthlySalary: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  effectiveMonth: string;
  createdAt: string;
}

export interface EmployeeDetail extends Employee {
  latestSalary: SalaryRecord | null;
  salaryHistory: SalaryRecord[];
}

export interface EmployeeOption {
  id: number;
  fullName: string;
  isActive: boolean;
  position: string | null;
}

export interface Advance {
  id: number;
  employeeId: number;
  employee: { id: number; fullName: string; isActive: boolean };
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdvanceList extends Paginated<Advance> {
  totalAmount: number;
}

export interface EmployeeAdvance {
  id: number;
  employeeId: number;
  amount: number;
  date: string;
  note: string | null;
  createdAt: string;
}

export interface MonthlySummaryItem {
  month: string;
  monthlySalary: number;
  totalAdvances: number;
  remainingSalary: number;
  advancePercentage: number | null;
}

export interface ReportRow {
  employeeId: number;
  fullName: string;
  position: string | null;
  phone: string | null;
  isActive: boolean;
  monthlySalary: number;
  totalAdvances: number;
  advanceCount: number;
  remainingSalary: number;
  advancePercentage: number | null;
}

export interface MonthlyReport {
  period: { year: number; month: number; key: string; from: string; to: string };
  rows: ReportRow[];
  totals: {
    employees: number;
    totalSalary: number;
    totalAdvances: number;
    totalRemaining: number;
    advancePercentage: number | null;
  };
}

export interface DashboardStats {
  period: { year: number; month: number; key: string };
  cards: { activeEmployees: number; totalSalary: number; totalAdvances: number; totalRemaining: number };
  recentAdvances: {
    id: number;
    amount: number;
    date: string;
    note: string | null;
    employee: { id: number; fullName: string };
  }[];
  topAdvances: {
    employeeId: number;
    fullName: string;
    totalAdvances: number;
    advanceCount: number;
    monthlySalary: number;
    advancePercentage: number | null;
  }[];
  chart: { month: string; totalSalary: number; totalAdvances: number }[];
}
