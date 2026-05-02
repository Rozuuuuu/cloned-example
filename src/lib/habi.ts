import { supabase } from "@/integrations/supabase/client";

export type HulasLevel = "pawisin" | "normal" | "chill";

export interface ScanRecord {
  id: string;
  fabricName: string;
  grade: string;
  fiberType: string;
  scannedAt: string;
  imagePath?: string | null;
}

export interface FabricData {
  name: string;
  grade: string;
  fiberType: string;
  breathability: number;
  sustainability: number;
  description?: string;
  personalMessage: string;
  climateAlert?: string;
  washTips: string[];
  resaleValue: string;
  upcyclingIdea: string;
  isSuccess: boolean;
}

const HULAS_KEY = "hulas_level";

export const getHulas = (): HulasLevel =>
  (localStorage.getItem(HULAS_KEY) as HulasLevel) || "pawisin";

export const setHulas = async (value: HulasLevel) => {
  localStorage.setItem(HULAS_KEY, value);
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from("profiles").upsert({ id: user.id, hulas_level: value });
  }
};

export const loadHulasFromProfile = async (): Promise<HulasLevel> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return getHulas();
  const { data } = await supabase
    .from("profiles")
    .select("hulas_level")
    .eq("id", user.id)
    .maybeSingle();
  const level = (data?.hulas_level as HulasLevel) || getHulas();
  localStorage.setItem(HULAS_KEY, level);
  return level;
};

/** Mirrors DatabaseService.GetScansAsync — newest first, optionally limited. */
export const getRecentScans = async (limit?: number): Promise<ScanRecord[]> => {
  const query = supabase
    .from("scans")
    .select("id,fabric_name,grade,fiber_type,image_path,scanned_at")
    .order("scanned_at", { ascending: false });
  const { data, error } = limit ? await query.limit(limit) : await query;
  const remote: ScanRecord[] = error || !data ? [] : data.map((r) => ({
    id: r.id as string,
    fabricName: r.fabric_name as string,
    grade: r.grade as string,
    fiberType: r.fiber_type as string,
    scannedAt: r.scanned_at as string,
    imagePath: (r.image_path as string | null) ?? undefined,
  }));
  // Merge any offline drafts so the user sees pending scans immediately.
  const merged = [...getOfflineScans(), ...remote].sort(
    (a, b) => new Date(b.scannedAt).getTime() - new Date(a.scannedAt).getTime()
  );
  return limit ? merged.slice(0, limit) : merged;
};

export interface NewScan {
  fabricName: string;
  grade: string;
  fiberType: string;
  imageFile?: File | Blob | null;
}

/** Local offline queue for scans saved while backend is unreachable. */
const OFFLINE_KEY = "habi_offline_scans";

interface OfflineScan {
  localId: string;
  fabricName: string;
  grade: string;
  fiberType: string;
  scannedAt: string;
  imageDataUrl?: string | null;
  imageMime?: string | null;
}

const readOfflineQueue = (): OfflineScan[] => {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
  } catch {
    return [];
  }
};

const writeOfflineQueue = (q: OfflineScan[]) =>
  localStorage.setItem(OFFLINE_KEY, JSON.stringify(q));

const fileToDataUrl = (file: File | Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const res = await fetch(dataUrl);
  return res.blob();
};

export const getOfflineScans = (): ScanRecord[] =>
  readOfflineQueue().map((o) => ({
    id: `offline:${o.localId}`,
    fabricName: o.fabricName,
    grade: o.grade,
    fiberType: o.fiberType,
    scannedAt: o.scannedAt,
    imagePath: null,
  }));

const queueOffline = async (record: NewScan): Promise<ScanRecord> => {
  const localId = crypto.randomUUID();
  const scannedAt = new Date().toISOString();
  const entry: OfflineScan = {
    localId,
    fabricName: record.fabricName,
    grade: record.grade,
    fiberType: record.fiberType,
    scannedAt,
    imageDataUrl: record.imageFile ? await fileToDataUrl(record.imageFile) : null,
    imageMime: record.imageFile ? (record.imageFile as File).type || "image/jpeg" : null,
  };
  const q = readOfflineQueue();
  q.unshift(entry);
  writeOfflineQueue(q);
  return {
    id: `offline:${localId}`,
    fabricName: entry.fabricName,
    grade: entry.grade,
    fiberType: entry.fiberType,
    scannedAt,
    imagePath: null,
  };
};

/** Replays queued offline scans to Supabase. Returns count synced. */
export const syncOfflineScans = async (): Promise<number> => {
  if (!navigator.onLine) return 0;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const queue = readOfflineQueue();
  if (queue.length === 0) return 0;
  const remaining: OfflineScan[] = [];
  let synced = 0;
  for (const item of queue) {
    let imagePath: string | null = null;
    try {
      if (item.imageDataUrl) {
        const blob = await dataUrlToBlob(item.imageDataUrl);
        const ext = (item.imageMime || "image/jpeg").split("/")[1] || "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("scan-images")
          .upload(path, blob, { upsert: false, contentType: item.imageMime || "image/jpeg" });
        if (!upErr) imagePath = path;
      }
      const { error } = await supabase.from("scans").insert({
        user_id: user.id,
        fabric_name: item.fabricName,
        grade: item.grade,
        fiber_type: item.fiberType,
        image_path: imagePath,
        scanned_at: item.scannedAt,
      });
      if (error) {
        remaining.push(item);
      } else {
        synced++;
      }
    } catch {
      remaining.push(item);
    }
  }
  writeOfflineQueue(remaining);
  return synced;
};

/** Mirrors ScannerViewModel.ProcessPhotoAsync save step. */
export const saveScan = async (record: NewScan): Promise<ScanRecord | null> => {
  if (!navigator.onLine) {
    return queueOffline(record);
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return queueOffline(record);

  let imagePath: string | null = null;
  if (record.imageFile) {
    const ext =
      record.imageFile instanceof File && record.imageFile.name.includes(".")
        ? record.imageFile.name.split(".").pop()
        : "jpg";
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("scan-images")
      .upload(path, record.imageFile, { upsert: false, contentType: (record.imageFile as File).type || "image/jpeg" });
    if (!upErr) imagePath = path;
  }

  const { data, error } = await supabase
    .from("scans")
    .insert({
      user_id: user.id,
      fabric_name: record.fabricName,
      grade: record.grade,
      fiber_type: record.fiberType,
      image_path: imagePath,
    })
    .select("id,fabric_name,grade,fiber_type,image_path,scanned_at")
    .single();
  if (error || !data) {
    // Backend reachable but insert failed — queue locally so we don't lose it.
    return queueOffline(record);
  }
  return {
    id: data.id as string,
    fabricName: data.fabric_name as string,
    grade: data.grade as string,
    fiberType: data.fiber_type as string,
    scannedAt: data.scanned_at as string,
    imagePath: (data.image_path as string | null) ?? undefined,
  };
};

/** Mirrors DatabaseService.DeleteScanAsync — also removes the uploaded image. */
export const deleteScan = async (scan: ScanRecord): Promise<boolean> => {
  if (scan.id.startsWith("offline:")) {
    const localId = scan.id.slice("offline:".length);
    writeOfflineQueue(readOfflineQueue().filter((o) => o.localId !== localId));
    return true;
  }
  if (scan.imagePath) {
    await supabase.storage.from("scan-images").remove([scan.imagePath]);
  }
  const { error } = await supabase.from("scans").delete().eq("id", scan.id);
  return !error;
};

/** Look up a single scan by id (supports offline drafts). */
export const getScanById = async (id: string): Promise<ScanRecord | null> => {
  if (id.startsWith("offline:")) {
    return getOfflineScans().find((s) => s.id === id) ?? null;
  }
  const { data, error } = await supabase
    .from("scans")
    .select("id,fabric_name,grade,fiber_type,image_path,scanned_at")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return {
    id: data.id as string,
    fabricName: data.fabric_name as string,
    grade: data.grade as string,
    fiberType: data.fiber_type as string,
    scannedAt: data.scanned_at as string,
    imagePath: (data.image_path as string | null) ?? undefined,
  };
};

/** Returns a public URL for a stored scan image (bucket is public). */
export const getScanImageUrl = (path?: string | null): string | undefined => {
  if (!path) return undefined;
  const { data } = supabase.storage.from("scan-images").getPublicUrl(path);
  return data.publicUrl;
};

/**
 * Mirrors ResultViewModel.OnResultTypeChanged exactly.
 * resultType "success" → A+ Premium Linen, anything else → F- Polyester Blend.
 */
export const buildFabricResult = (resultType: "success" | "fail" | "warning"): FabricData => {
  const isSuccess = resultType === "success";
  const hulas = getHulas();
  if (isSuccess) {
    return {
      name: "Premium Linen",
      grade: "A+",
      fiberType: "100% Natural Linen",
      breathability: 95,
      sustainability: 90,
      personalMessage:
        hulas === "pawisin"
          ? "Perfect! Super breathable ito para sa Cebu humidity. Goodbye sticky feeling!"
          : "Great choice! This natural fabric will keep you comfortable all day.",
      washTips: ["Cold water wash only", "Hang dry in shade", "Iron while damp"],
      resaleValue: "₱450 – ₱850",
      upcyclingIdea: "Reusable market bags or decorative pillow covers.",
      isSuccess: true,
    };
  }
  return {
    name: "Polyester Blend",
    grade: "F-",
    fiberType: "85% Polyester, 15% Rayon",
    breathability: 25,
    sustainability: 15,
    personalMessage:
      hulas === "pawisin"
        ? "Babala! Plastic bag ang feel nito sa init. Mataas ang risk ng amoy-araw!"
        : "Not ideal for our tropical climate. Poor airflow and moisture-wicking.",
    climateAlert:
      "Sa 32°C ng Cebu, itrap ng fabric na ito ang sweat at magiging amoy-araw ka bago mag-tanghali.",
    washTips: ["Wash separately", "Use fabric softener", "Low heat or air dry"],
    resaleValue: "₱80 – ₱150",
    upcyclingIdea: '"Basahan" – cleaning cloth for floors or windows.',
    isSuccess: false,
  };
};

/** Mirrors DashboardViewModel switch. */
export const getHulasPersona = (
  hulas: HulasLevel
): { label: string; advice: string } => {
  switch (hulas) {
    case "chill":
      return {
        label: "Chill Lang Profile",
        advice: "You stay cool naturally! Cotton or linen blends work great for you.",
      };
    case "normal":
      return {
        label: "Normal Lang Profile",
        advice: "Breathable cotton or bamboo blends are your best friend.",
      };
    default:
      return {
        label: "Pawisin Profile",
        advice: "Sa 32°C ng Cebu, stick to 100% linen or cotton. Iwasan ang polyester!",
      };
  }
};

export interface WeatherInfo {
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
}

/** Mirrors WeatherService.GetWeatherAsync. */
export const getWeather = async (
  location = "Consolacion, Cebu"
): Promise<WeatherInfo> => {
  await new Promise((r) => setTimeout(r, 400));
  return {
    location,
    temperature: 32,
    feelsLike: 37,
    humidity: 85,
    windSpeed: 12,
    condition: "Sunny",
  };
};

export const humidityLabel = (h: number) =>
  h >= 80 ? "High Humidity" : h >= 60 ? "Moderate Humidity" : "Low Humidity";

export const fabricAdvice = (h: number) =>
  h >= 80
    ? "Wear breathable natural fabrics today!"
    : "Any breathable fabric works fine today.";
