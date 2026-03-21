
// src/admin/avatar/RoleAvatar.tsx
import { Shield, Crown, Briefcase, GraduationCap, Building2, User } from '../../icons';

type Role = 'superadmin'|'admin'|'teacher'|'student'|'orgadmin'|'orguser';

export default function RoleAvatar({ role, size = 36 }: { role: Role; size?: number }) {
  const base = 'inline-flex items-center justify-center rounded-full shadow-sm ring-1 ring-black/5';
  const map: Record<Role, { className: string; Icon: any; label: string }> = {
    superadmin: { className: 'bg-gradient-to-br from-indigo-500 to-violet-500 text-white', Icon: Shield, label: 'SA' },
    admin:      { className: 'bg-gradient-to-br from-sky-500 to-cyan-500 text-white',    Icon: Crown,  label: 'AD' },
    teacher:    { className: 'bg-gradient-to-br from-amber-500 to-orange-500 text-white', Icon: Briefcase, label: 'TE' },
    student:    { className: 'bg-gradient-to-br from-emerald-500 to-teal-500 text-white',Icon: GraduationCap, label: 'ST' },
    orgadmin:   { className: 'bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white',Icon: Building2, label: 'OA' },
    orguser:    { className: 'bg-gradient-to-br from-slate-500 to-stone-500 text-white', Icon: User, label: 'OU' },
  };

  const { className, Icon } = map[role] || map.orguser;
  const style = { width: size, height: size };

  return (
    <span className={`${base} ${className}`} style={style} aria-hidden>
      <Icon size={Math.round(size * 0.56)} />
    </span>
  );
}
