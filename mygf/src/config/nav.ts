// Central menu config (single source of truth) for all roles
import type React from "react";
import { LayoutDashboard, Building2, Users, Shield, Settings, BookOpen, CreditCard, BarChart, FileText } from "lucide-react";

export type Role = "superadmin" | "admin" | "vendor" | "student" | "orgadmin" | "orguser";

export type MenuItem = {
  label: string;
  to: string; // absolute route path
  icon?: React.ComponentType<{ className?: string }> | any;
  exact?: boolean;
};

export type MenuGroup = {
  heading?: string;
  items: MenuItem[];
};

export type RoleMenuMap = Record<Role, MenuGroup[]>;

const SA = "/superadmin";
const AD = "/admin";
const VE = "/vendor"; // future use

export const MENUS: RoleMenuMap = {
  superadmin: [
    { heading: "Overview", items: [ { label: "Dashboard", to: `${SA}/overview`, icon: LayoutDashboard, exact: true } ] },
    {
      heading: "Management",
      items: [
        { label: "Organizations", to: `${SA}/organizations`, icon: Building2 },
        { label: "Users",         to: `${SA}/users`,         icon: Users },
        { label: "Students",      to: `${SA}/students`,      icon: Users },
        { label: "Courses",       to: `${SA}/courses`,       icon: BookOpen },
        { label: "Assessments",       to: `${SA}/assessments`,icon: FileText },
      ],
    },
    {
      heading: "Commerce",
      items: [
        { label: "Payments",       to: `${SA}/payments`,       icon: CreditCard },
        { label: "Subscriptions",  to: `${SA}/subscriptions`,  icon: FileText },
        { label: "Payouts",        to: `${SA}/payouts`,        icon: CreditCard },
        { label: "Reconciliation", to: `${SA}/reconciliation`, icon: FileText },
      ],
    },
    {
      heading: "Insights",
      items: [
        { label: "Analytics", to: `${SA}/analytics`, icon: BarChart },
        { label: "Audit Logs", to: `${SA}/audit`,   icon: Shield },
        { label: "Compliance", to: `${SA}/compliance`, icon: Shield },
      ],
    },
    { heading: "System", items: [ { label: "Integrations", to: `${SA}/integrations`, icon: FileText }, { label: "Settings", to: `${SA}/settings`, icon: Settings } ] },
  ],

  admin: [
    { heading: "Overview", items: [ { label: "Dashboard", to: `${AD}/overview`, icon: LayoutDashboard, exact: true } ] },
    {
      heading: "Learning",
      items: [
        { label: "Courses",      to: `${AD}/courses`,     icon: BookOpen },
        { label: "Curriculum",   to: `${AD}/curriculum`,  icon: FileText },
        { label: "Assessments",  to: `${AD}/assessments`, icon: FileText },
        { label: "Assignments",  to: `${AD}/assignments`, icon: FileText },
      ],
    },
    {
      heading: "People",
      items: [ 
        { label: "Students", to: `${AD}/students`, icon: Users },
        { label: "Users", to: `${AD}/users`,    icon: Users },
       ],
    },
    {
      heading: "Commerce",
      items: [
        { label: "Payments",      to: `${AD}/payments`,      icon: CreditCard },
        { label: "Orders",        to: `${AD}/orders`,        icon: FileText },
        { label: "Subscriptions", to: `${AD}/subscriptions`, icon: FileText },
      ],
    },
    {
      heading: "Engagement",
      items: [
        { label: "Certificates", to: `${AD}/certificates`, icon: FileText },
        { label: "Reviews",      to: `${AD}/reviews`,      icon: FileText },
        { label: "Media",        to: `${AD}/media`,        icon: FileText },
        { label: "Marketing",    to: `${AD}/marketing`,    icon: FileText },
        { label: "Community",    to: `${AD}/community`,    icon: Users },
        { label: "Reports",      to: `${AD}/reports`,      icon: BarChart },
      ],
    },
    { heading: "Settings", items: [ { label: "Settings", to: `${AD}/settings`, icon: Settings } ] },
  ],

  vendor: [
    { heading: "Overview", items: [ { label: "Dashboard", to: `${VE}/overview`, icon: LayoutDashboard, exact: true } ] },
    { heading: "Learning", items: [ { label: "Courses", to: `${VE}/courses`, icon: BookOpen } ] },
  ],

  student: [],
  orgadmin: [],
  orguser: [],
};
