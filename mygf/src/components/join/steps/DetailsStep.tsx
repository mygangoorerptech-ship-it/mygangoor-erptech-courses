// mygf/src/components/join/steps/DetailsStep.tsx
import React from "react";
import { Calendar, ImageUp, Mail, Phone, Upload, User } from "lucide-react";
import Field from "../ui/Field";
import Note from "../ui/Note";
import type { Gender } from "../types";

export default function DetailsStep({
  values, onValues, errors
}: {
  values: {
    fullName: string; age: number | ""; gender: Gender | "";
    birth: string; address: string; mobile: string; email: string; photoUrl: string | null
  };
  onValues: {
    fullName: (v: string) => void; age: (v: number | "") => void; gender: (v: Gender) => void;
    birth: (v: string) => void; address: (v: string) => void; mobile: (v: string) => void;
    email: (v: string) => void; photo: (f: File | null) => void;
  };
  errors: Record<string, string>;
}) {
  const fileInput = React.useRef<HTMLInputElement | null>(null);

  return (
    <div className="grid gap-4">
      <Note text="Fields marked * are required." />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Full Name *" icon={<User className="w-4 h-4" />} error={errors.fullName}>
          <input
            value={values.fullName}
            onChange={(e) => onValues.fullName(e.target.value)}
            placeholder="Your name"
            className="Input"
          />
        </Field>

        <Field label="Age *" icon={<Calendar className="w-4 h-4" />} error={errors.age}>
          <input
            type="number" min={10} max={100}
            value={values.age}
            onChange={(e) => onValues.age(e.target.value ? Number(e.target.value) : "")}
            placeholder="e.g., 24"
            className="Input"
          />
        </Field>

        <Field label="Gender *" error={errors.gender}>
          <div className="flex gap-3">
            {(["Male", "Female", "Other"] as Gender[]).map((g) => (
              <label key={g} className="inline-flex items-center gap-2">
                <input
                  type="radio" name="gender" value={g}
                  checked={values.gender === g}
                  onChange={() => onValues.gender(g)}
                  className="Radio"
                />
                <span>{g}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Birth date *" icon={<Calendar className="w-4 h-4" />} error={errors.birth}>
          <input
            type="date" value={values.birth}
            onChange={(e) => onValues.birth(e.target.value)}
            className="Input"
          />
        </Field>
      </div>

      <Field label="Full Address *" error={errors.address}>
        <textarea
          value={values.address}
          onChange={(e) => onValues.address(e.target.value)}
          rows={3}
          placeholder="House no, street, city, pincode"
          className="Input resize-y"
        />
      </Field>

      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Mobile Number *" icon={<Phone className="w-4 h-4" />} error={errors.mobile}>
          <input
            inputMode="numeric" maxLength={10}
            value={values.mobile}
            onChange={(e) => onValues.mobile(e.target.value.replace(/\D/g, "").slice(0, 10))}
            placeholder="10-digit number"
            className="Input"
          />
        </Field>

        <Field label="Email ID *" icon={<Mail className="w-4 h-4" />} error={errors.email}>
          <input
            type="email" value={values.email}
            onChange={(e) => onValues.email(e.target.value)}
            placeholder="name@example.com"
            className="Input"
          />
        </Field>
      </div>

      <Field label="Upload Photo *" error={errors.photo}>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border bg-white hover:bg-slate-50"
          >
            <Upload className="w-4 h-4" /> Choose file
          </button>
          <input
            ref={fileInput}
            type="file" accept="image/*" className="hidden"
            onChange={(e) => onValues.photo(e.target.files?.[0] ?? null)}
          />
          {values.photoUrl ? (
            <img src={values.photoUrl} alt="preview" className="w-14 h-14 rounded-lg object-cover border" />
          ) : (
            <div className="w-14 h-14 grid place-content-center rounded-lg border text-slate-500">
              <ImageUp className="w-5 h-5" />
            </div>
          )}
        </div>
      </Field>
    </div>
  );
}
