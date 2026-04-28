export type HulasLevel = "pawisin" | "normal";

export interface ScanRecord {
  id: string;
  fabricName: string;
  grade: string;
  fiberType: string;
  scannedAt: string;
}

export interface FabricData {
  name: string;
  grade: string;
  fiberType: string;
  breathability: number;
  sustainability: number;
  personalMessage: string;
  climateAlert?: string;
  washTips: string[];
  resaleValue: string;
  upcyclingIdea: string;
  isSuccess: boolean;
}

export const getHulas = (): HulasLevel =>
  (localStorage.getItem("hulas_level") as HulasLevel) || "pawisin";

export const getRecentScans = (): ScanRecord[] => {
  try {
    const raw = localStorage.getItem("habi_scans");
    if (raw) return JSON.parse(raw);
  } catch {}
  // seed with sample data so the dashboard isn't empty
  const seed: ScanRecord[] = [
    {
      id: "1",
      fabricName: "Premium Linen",
      grade: "A+",
      fiberType: "100% Natural Linen",
      scannedAt: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    },
    {
      id: "2",
      fabricName: "Cotton Blend",
      grade: "B",
      fiberType: "70% Cotton, 30% Polyester",
      scannedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2).toISOString(),
    },
    {
      id: "3",
      fabricName: "Polyester Shirt",
      grade: "F-",
      fiberType: "100% Polyester",
      scannedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
    },
  ];
  localStorage.setItem("habi_scans", JSON.stringify(seed));
  return seed;
};

export const addScan = (record: Omit<ScanRecord, "id" | "scannedAt">) => {
  const scans = getRecentScans();
  const next: ScanRecord = {
    ...record,
    id: crypto.randomUUID(),
    scannedAt: new Date().toISOString(),
  };
  const updated = [next, ...scans].slice(0, 10);
  localStorage.setItem("habi_scans", JSON.stringify(updated));
  return next;
};

export const buildFabricResult = (resultType: "success" | "fail"): FabricData => {
  const hulas = getHulas();
  if (resultType === "success") {
    return {
      name: "Premium Linen",
      grade: "A+",
      fiberType: "100% Natural Linen",
      breathability: 95,
      sustainability: 90,
      personalMessage:
        hulas === "pawisin"
          ? "Perfect! Super breathable for Cebu humidity. Goodbye sticky feeling!"
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
        ? "Warning! This feels like a plastic bag in the heat. High risk of sun-smell!"
        : "Not ideal for our tropical climate. Poor airflow and moisture-wicking.",
    climateAlert:
      "At 32°C in Cebu, this fabric will trap sweat and you'll smell of sun before noon.",
    washTips: ["Wash separately", "Use fabric softener", "Low heat or air dry"],
    resaleValue: "₱80 – ₱150",
    upcyclingIdea: '"Basahan" — cleaning cloth for floors or windows.',
    isSuccess: false,
  };
};

export interface WeatherInfo {
  location: string;
  temperature: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  condition: string;
}

export const getWeather = (): WeatherInfo => ({
  location: "Consolacion, Cebu",
  temperature: 32,
  feelsLike: 37,
  humidity: 85,
  windSpeed: 12,
  condition: "Sunny",
});

export const humidityLabel = (h: number) =>
  h >= 80 ? "High Humidity" : h >= 60 ? "Moderate Humidity" : "Low Humidity";

export const fabricAdvice = (h: number) =>
  h >= 80
    ? "Wear breathable natural fabrics today!"
    : "Any breathable fabric works fine today.";