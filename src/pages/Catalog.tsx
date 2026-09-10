import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import SpecimenGridLayout from "@/components/SpecimenGridLayout";
import { SpecimenEmpty, SpecimenSkeletonList } from "@/components/SpecimenStates";
import ConfirmDialog from "@/components/ConfirmDialog";
import { Input } from "@/components/ui/input";
import { useAuthGuard } from "@/hooks/use-auth-guard";
import { useScanImages } from "@/hooks/use-scan-images";
import { PHOTO_HINT, validatePhoto } from "@/lib/image-validation";
import {
  buildFabricResult,
  deleteScan,
  getRecentScans,
  saveScan,
  updateScan,
  type ScanRecord,
} from "@/lib/habi";

/** Grade → the same metric set the Result page prints, so rows stay identical. */
const metricsFor = (grade: string) => {
  const good = /^[ABC]/i.test(grade.trim());
  const base = buildFabricResult(good ? "success" : "fail");
  return { breathability: base.breathability, sustainability: base.sustainability };
};

type FormState = {
  fabricName: string;
  grade: string;
  fiberType: string;
  file: File | null;
  removeImage: boolean;
};

const emptyForm: FormState = {
  fabricName: "",
  grade: "",
  fiberType: "",
  file: null,
  removeImage: false,
};

const PAGE = 6;

const Catalog = () => {
  const navigate = useNavigate();
  const { session, checked } = useAuthGuard();
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ScanRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ScanRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);

  // search / filter / paging
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [minBreath, setMinBreath] = useState(0);
  const [minSustain, setMinSustain] = useState(0);
  const [visible, setVisible] = useState(PAGE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const images = useScanImages(scans);

  const refresh = async () => {
    setScans(await getRecentScans());
    setLoading(false);
  };

  useEffect(() => {
    if (!session) return;
    void refresh();
  }, [session]);

  const preview = useMemo(
    () => (form.file ? URL.createObjectURL(form.file) : undefined),
    [form.file]
  );
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const grades = useMemo(
    () => Array.from(new Set(scans.map((s) => s.grade.trim().toUpperCase()))).sort(),
    [scans]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return scans.filter((s) => {
      const m = metricsFor(s.grade);
      if (q && !`${s.fabricName} ${s.fiberType}`.toLowerCase().includes(q)) return false;
      if (gradeFilter !== "all" && s.grade.trim().toUpperCase() !== gradeFilter) return false;
      if (m.breathability < minBreath) return false;
      if (m.sustainability < minSustain) return false;
      return true;
    });
  }, [scans, query, gradeFilter, minBreath, minSustain]);

  useEffect(() => setVisible(PAGE), [query, gradeFilter, minBreath, minSustain]);

  const rows = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  const loadMore = useCallback(() => setVisible((v) => v + PAGE), []);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => entries[0]?.isIntersecting && loadMore(),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore, rows.length]);

  const resetForm = () => {
    setEditing(null);
    setForm(emptyForm);
    setPhotoError(null);
    setFieldErrors({});
    if (fileRef.current) fileRef.current.value = "";
  };

  const startEdit = (s: ScanRecord) => {
    setEditing(s);
    setForm({
      fabricName: s.fabricName,
      grade: s.grade,
      fiberType: s.fiberType,
      file: null,
      removeImage: false,
    });
    setPhotoError(null);
    setFieldErrors({});
    if (fileRef.current) fileRef.current.value = "";
    nameRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const onPickPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      setPhotoError(null);
      setForm((f) => ({ ...f, file: null }));
      return;
    }
    const error = await validatePhoto(file);
    if (error) {
      setPhotoError(error);
      setForm((f) => ({ ...f, file: null, removeImage: false }));
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setPhotoError(null);
    setForm((f) => ({ ...f, file, removeImage: false }));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const fabricName = form.fabricName.trim();
    const grade = form.grade.trim();
    const fiberType = form.fiberType.trim();
    const errs: Record<string, string> = {};
    if (!fabricName) errs.fabricName = "Fabric name is required.";
    else if (fabricName.length > 100) errs.fabricName = "Keep the name under 100 characters.";
    if (!grade) errs.grade = "Grade is required.";
    else if (grade.length > 4) errs.grade = "Grade can be at most 4 characters.";
    if (!fiberType) errs.fiberType = "Fiber type is required.";
    else if (fiberType.length > 120) errs.fiberType = "Keep the fiber under 120 characters.";
    setFieldErrors(errs);
    if (Object.keys(errs).length || photoError) {
      toast.error("Fix the highlighted fields first.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateScan(editing, {
          fabricName,
          grade,
          fiberType,
          imageFile: form.file,
          removeImage: form.removeImage,
        });
        if (!updated) throw new Error("update failed");
        toast.success("Specimen updated");
      } else {
        const created = await saveScan({ fabricName, grade, fiberType, imageFile: form.file });
        if (!created) throw new Error("create failed");
        toast.success("Specimen catalogued");
      }
      resetForm();
      await refresh();
    } catch {
      toast.error(editing ? "Could not update specimen" : "Could not save specimen");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      const ok = await deleteScan(pendingDelete);
      if (!ok) throw new Error("delete failed");
      toast.success("Specimen removed");
      if (editing?.id === pendingDelete.id) resetForm();
      setPendingDelete(null);
      await refresh();
    } catch {
      toast.error("Could not delete specimen");
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "2-digit",
      year: "numeric",
    });

  const fieldClass = "border-2 border-deep-sage bg-transparent";
  const errClass = "type-label mt-1 block text-warning-red";

  return (
    <SpecimenGridLayout
      title="Specimen Catalog"
      eyebrow={`Plate 04 · ${scans.length} entries on file`}
      actions={
        <button
          onClick={() => navigate("/history")}
          className="type-label border-2 border-cream/60 px-3 py-2 text-cream transition-colors hover:bg-cream hover:text-deep-sage"
        >
          Closet →
        </button>
      }
    >
      {/* Entry plate — add / edit */}
      <form
        onSubmit={onSubmit}
        data-testid="catalog-form"
        noValidate
        aria-label={editing ? "Edit specimen" : "Add specimen"}
        className="mb-6 border-2 border-deep-sage bg-card"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="flex items-center justify-between border-b-2 border-deep-sage px-4 py-2">
          <span className="type-mono text-sage-green">
            {editing ? "Edit entry" : "New entry"}
          </span>
          {editing && (
            <button
              type="button"
              onClick={resetForm}
              className="type-label text-sage-green underline"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="grid gap-4 p-4 md:grid-cols-3">
          <div>
            <label htmlFor="cat-name" className="type-label text-sage-green">
              Fabric name
            </label>
            <Input
              id="cat-name"
              ref={nameRef}
              maxLength={100}
              value={form.fabricName}
              aria-invalid={!!fieldErrors.fabricName}
              aria-describedby={fieldErrors.fabricName ? "cat-name-error" : undefined}
              onChange={(e) => setForm((f) => ({ ...f, fabricName: e.target.value }))}
              placeholder="Premium Linen"
              className={fieldClass}
            />
            {fieldErrors.fabricName && (
              <span id="cat-name-error" role="alert" className={errClass}>
                {fieldErrors.fabricName}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="cat-grade" className="type-label text-sage-green">
              Grade
            </label>
            <Input
              id="cat-grade"
              maxLength={4}
              value={form.grade}
              aria-invalid={!!fieldErrors.grade}
              aria-describedby={fieldErrors.grade ? "cat-grade-error" : undefined}
              onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
              placeholder="A+"
              className={fieldClass}
            />
            {fieldErrors.grade && (
              <span id="cat-grade-error" role="alert" className={errClass}>
                {fieldErrors.grade}
              </span>
            )}
          </div>
          <div>
            <label htmlFor="cat-fiber" className="type-label text-sage-green">
              Fiber type
            </label>
            <Input
              id="cat-fiber"
              maxLength={120}
              value={form.fiberType}
              aria-invalid={!!fieldErrors.fiberType}
              aria-describedby={fieldErrors.fiberType ? "cat-fiber-error" : undefined}
              onChange={(e) => setForm((f) => ({ ...f, fiberType: e.target.value }))}
              placeholder="100% Natural Linen"
              className={fieldClass}
            />
            {fieldErrors.fiberType && (
              <span id="cat-fiber-error" role="alert" className={errClass}>
                {fieldErrors.fiberType}
              </span>
            )}
          </div>

          <div className="md:col-span-2">
            <label htmlFor="cat-photo" className="type-label text-sage-green">
              Specimen photo
            </label>
            <input
              id="cat-photo"
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              data-testid="catalog-photo"
              aria-invalid={!!photoError}
              aria-describedby="cat-photo-hint"
              onChange={onPickPhoto}
              className="type-body block w-full border-2 border-deep-sage bg-transparent p-2 text-deep-sage file:mr-3 file:border-2 file:border-deep-sage file:bg-deep-sage file:px-3 file:py-1 file:text-cream"
            />
            <span id="cat-photo-hint" className="type-label mt-1 block text-sage-green">
              {PHOTO_HINT}
            </span>
            {photoError && (
              <span
                data-testid="catalog-photo-error"
                role="alert"
                className={errClass}
              >
                {photoError}
              </span>
            )}
            {editing && editing.imagePath && !form.file && (
              <label className="type-label mt-2 flex items-center gap-2 text-sage-green">
                <input
                  type="checkbox"
                  checked={form.removeImage}
                  onChange={(e) => setForm((f) => ({ ...f, removeImage: e.target.checked }))}
                />
                Remove current photo
              </label>
            )}
          </div>

          <div className="flex items-end gap-3">
            {(preview || (editing && images[editing.id] && !form.removeImage)) && (
              <img
                src={preview ?? images[editing!.id]}
                alt="Specimen preview"
                className="h-16 w-16 border-2 border-deep-sage object-cover"
              />
            )}
            <button
              type="submit"
              disabled={saving}
              data-testid="catalog-submit"
              className="type-h3 flex-1 border-2 border-deep-sage bg-deep-sage px-4 py-3 text-cream transition-colors hover:bg-sage-green disabled:opacity-50"
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Add specimen →"}
            </button>
          </div>
        </div>
      </form>

      {/* Finder plate — search & filters */}
      <section
        aria-label="Search and filter specimens"
        className="mb-6 grid gap-4 border-2 border-deep-sage bg-card p-4 md:grid-cols-4"
        style={{ boxShadow: "var(--shadow-card)" }}
      >
        <div className="md:col-span-2">
          <label htmlFor="cat-search" className="type-label text-sage-green">
            Search name or fiber
          </label>
          <Input
            id="cat-search"
            type="search"
            data-testid="catalog-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Linen, cotton…"
            className={fieldClass}
          />
        </div>
        <div>
          <label htmlFor="cat-grade-filter" className="type-label text-sage-green">
            Grade
          </label>
          <select
            id="cat-grade-filter"
            data-testid="catalog-grade-filter"
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className="type-body block h-10 w-full border-2 border-deep-sage bg-transparent px-2 text-deep-sage"
          >
            <option value="all">All grades</option>
            {grades.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="cat-min-breath" className="type-label text-sage-green">
              Min breath.
            </label>
            <Input
              id="cat-min-breath"
              type="number"
              min={0}
              max={100}
              value={minBreath}
              onChange={(e) => setMinBreath(Number(e.target.value) || 0)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="cat-min-sustain" className="type-label text-sage-green">
              Min sustain.
            </label>
            <Input
              id="cat-min-sustain"
              type="number"
              min={0}
              max={100}
              value={minSustain}
              onChange={(e) => setMinSustain(Number(e.target.value) || 0)}
              className={fieldClass}
            />
          </div>
        </div>
        <div className="md:col-span-4 flex items-center justify-between border-t-2 border-deep-sage pt-3">
          <span className="type-mono text-sage-green" data-testid="catalog-count">
            Showing {rows.length} of {filtered.length} filtered · {scans.length} on file
          </span>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGradeFilter("all");
              setMinBreath(0);
              setMinSustain(0);
            }}
            className="type-label border-2 border-deep-sage px-3 py-2 text-deep-sage transition-colors hover:bg-terracotta/25"
          >
            Reset filters
          </button>
        </div>
      </section>

      {/* Catalogued rows — Result-page layout per entry */}
      {loading || !checked ? (
        <SpecimenSkeletonList rows={3} label="Reading catalog" />
      ) : scans.length === 0 ? (
        <SpecimenEmpty
          index="04"
          title="Catalog is empty"
          note="Add a specimen above — name, grade, fiber and a photo — and it appears here, in your closet, and in every export."
        />
      ) : filtered.length === 0 ? (
        <SpecimenEmpty
          index="04"
          title="No specimens match"
          note="Nothing on file matches this search and filter set. Widen the metrics or reset the filters to see the full catalog again."
        />
      ) : (
        <div className="space-y-5">
          {rows.map((s, i) => {
            const img = images[s.id];
            const m = metricsFor(s.grade);
            const good = /^[ABC]/i.test(s.grade.trim());
            const gradeColor = good ? "hsl(var(--sage-green))" : "hsl(var(--warning-red))";
            return (
              <article
                key={s.id}
                data-testid="catalog-row"
                className="grid gap-0 border-2 border-deep-sage md:grid-cols-12"
                style={{ boxShadow: "var(--shadow-card)" }}
              >
                <div className="flex items-stretch border-b-2 border-deep-sage md:col-span-5 md:border-b-0 md:border-r-2">
                  {img && (
                    <img
                      src={img}
                      alt={s.fabricName}
                      loading="lazy"
                      className="h-40 w-1/2 border-r-2 border-deep-sage object-cover md:h-full"
                    />
                  )}
                  <div className="flex flex-1 flex-col items-center justify-center bg-card p-6">
                    <span
                      className="font-display text-[48px] leading-none"
                      style={{ color: gradeColor }}
                    >
                      {s.grade}
                    </span>
                    <span className="type-label text-sage-green">Grade</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:col-span-7">
                  <div className="col-span-2 border-b-2 border-deep-sage bg-card p-4">
                    <div className="type-mono text-sage-green">
                      {String(i + 1).padStart(2, "0")} · Specimen
                    </div>
                    <div className="type-h2 text-deep-sage">{s.fabricName}</div>
                    <div className="type-label text-sage-green">
                      {s.fiberType} · {formatDate(s.scannedAt)}
                    </div>
                  </div>
                  <div className="border-r-2 border-deep-sage bg-card p-4">
                    <div className="type-mono text-sage-green">Breathability</div>
                    <div className="type-h1 text-deep-sage">{m.breathability}%</div>
                  </div>
                  <div className="bg-card p-4">
                    <div className="type-mono text-sage-green">Sustainability</div>
                    <div className="type-h1 text-deep-sage">{m.sustainability}%</div>
                  </div>
                  <div className="col-span-2 flex flex-wrap gap-0 border-t-2 border-deep-sage bg-card p-4">
                    <button
                      onClick={() => navigate(`/scan/${encodeURIComponent(s.id)}`)}
                      className="type-label border-2 border-deep-sage px-3 py-2 text-deep-sage transition-colors hover:bg-terracotta/25"
                    >
                      View report
                    </button>
                    <button
                      onClick={() => startEdit(s)}
                      aria-label={`Edit ${s.fabricName}`}
                      className="type-label -ml-[2px] border-2 border-deep-sage px-3 py-2 text-deep-sage transition-colors hover:bg-terracotta/25"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setPendingDelete(s)}
                      disabled={deleting}
                      aria-label={`Delete ${s.fabricName}`}
                      className="type-label -ml-[2px] border-2 border-deep-sage px-3 py-2 text-deep-sage transition-colors hover:bg-warning-red hover:text-cream disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </article>
            );
          })}

          <div ref={sentinelRef} aria-hidden="true" />
          {hasMore && (
            <button
              type="button"
              onClick={loadMore}
              data-testid="catalog-load-more"
              className="type-label w-full border-2 border-deep-sage px-3 py-3 text-deep-sage transition-colors hover:bg-terracotta/25"
            >
              Load {Math.min(PAGE, filtered.length - visible)} more →
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete this specimen?"
        description={
          pendingDelete
            ? `“${pendingDelete.fabricName}” will be removed from the catalog, history and exports. This cannot be undone.`
            : undefined
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        disabled={deleting}
        onConfirm={confirmDelete}
        onOpenChange={(o) => {
          if (deleting) return;
          if (!o) setPendingDelete(null);
        }}
      />
    </SpecimenGridLayout>
  );
};

export default Catalog;
