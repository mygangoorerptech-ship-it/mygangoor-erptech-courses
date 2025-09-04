// mygf/src/admin/features/reports/TemplateModal.tsx
import React, { useState } from 'react';
import Modal from '../../components/Modal';
import Button from '../../components/Button';
import TemplatePicker from './TemplatePicker';
import { generateCertificate } from '../../api/certificates';

export default function TemplateModal({ item, onClose }: { item: any; onClose: () => void }) {
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = async () => {
    if (!selectedTemplate) return;
    setDownloadUrl('');
    setErrorMessage(null);
    setIsLoading(true);
    try {
      const blob = await generateCertificate({
        templateId: selectedTemplate,
        studentId: item.student.id,
        courseId: item.course.id,
      });
      const url = window.URL.createObjectURL(blob);
      setDownloadUrl(url);
    } catch (err: any) {
      console.error('Certificate generation failed:', err);
      const msg = err?.response?.data?.error || err?.message || 'Unknown error';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal open={true} title={`Issue Template Certificate - ${item.course.title}`} onClose={onClose} size="lg">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-slate-600 mb-2">
            Select a design and click Generate to issue a new certificate.
          </p>
          <TemplatePicker value={selectedTemplate} onChange={setSelectedTemplate} />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={!selectedTemplate || isLoading}
          >
            {isLoading ? 'Generating…' : 'Generate'}
          </Button>
        </div>
        {downloadUrl && (
          <div className="mt-4 text-sm text-green-600">
            Certificate ready!{' '}
            <a href={downloadUrl} target="_blank" rel="noopener noreferrer">
              Download PDF
            </a>
          </div>
        )}
        {errorMessage && (
          <div className="mt-4 text-sm text-rose-600">
            Failed to generate certificate: {errorMessage}
          </div>
        )}
      </div>
    </Modal>
  );
}
