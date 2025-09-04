// mygf/src/admin/features/certificates/TemplatePicker.tsx
import { useQuery } from '@tanstack/react-query';
import React from 'react';
import { listCertTemplates } from '../../api/certificates';

export default function TemplatePicker({ value, onChange }: { value?: string; onChange: (id: string) => void }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cert-templates'],
    queryFn: async () => {
      const res = await listCertTemplates();
      return res.templates || [];
    },
  });

  const selected = value || '';
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange(e.target.value);
  };
  const selectedTemplate = data?.find((t: any) => t.id === selected);

  return (
    <div className="space-y-2">
      <select
        className="border rounded p-2 w-full"
        value={selected}
        onChange={handleChange}
      >
        <option value="">Select certificate design…</option>
        {Array.isArray(data) && data.map((t: any) => (
          <option key={t.id} value={t.id}>
            {t.title}
          </option>
        ))}
      </select>
      {selectedTemplate && selectedTemplate.preview && (
        <div className="mt-2">
          <img
            src={selectedTemplate.preview}
            alt="Certificate preview"
            className="rounded shadow"
            style={{ maxWidth: '100%' }}
          />
        </div>
      )}
      {isLoading && <p className="text-sm text-slate-500">Loading templates…</p>}
      {error && <p className="text-sm text-rose-600">Failed to load templates.</p>}
    </div>
  );
}