import { useNavigate } from "react-router-dom";

interface EcoSpot {
  name: string;
  category: string;
  distance: string;
  emoji: string;
  blurb: string;
}

const spots: EcoSpot[] = [
  {
    name: "Cebu Thrift Hub",
    category: "Ukay-ukay",
    distance: "1.2 km",
    emoji: "👕",
    blurb: "Pre-loved linen and cotton picks updated weekly.",
  },
  {
    name: "Basahan Co-op",
    category: "Upcycle drop-off",
    distance: "2.4 km",
    emoji: "♻️",
    blurb: "Bring synthetic scraps to be turned into cleaning cloths.",
  },
  {
    name: "Lola Inday's Sastre",
    category: "Repair / Tailor",
    distance: "0.8 km",
    emoji: "🧵",
    blurb: "Mend, hem, and resize before retiring an item.",
  },
  {
    name: "Consolacion Eco-Market",
    category: "Resale",
    distance: "3.1 km",
    emoji: "🛍️",
    blurb: "Sell pre-loved fabrics every Saturday morning.",
  },
];

const EcoMap = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-cream pb-32">
      <div className="rounded-b-[28px] bg-deep-sage px-5 pb-6 pt-12 text-cream">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20"
            aria-label="Back"
          >
            ←
          </button>
          <div>
            <p className="text-[13px] text-[#CCDDCB]">Sustainable spots near you</p>
            <h1 className="text-xl font-bold">Eco-Map 🗺️</h1>
          </div>
        </div>
      </div>

      {/* Mock map */}
      <div className="mx-5 mt-5 h-44 overflow-hidden rounded-3xl bg-gradient-to-br from-sage-green/30 to-deep-sage/20">
        <div className="flex h-full items-center justify-center text-center text-deep-sage">
          <div>
            <div className="text-4xl">📍</div>
            <p className="mt-1 text-sm font-semibold">Consolacion, Cebu</p>
            <p className="text-xs text-muted-foreground">{spots.length} eco-friendly spots nearby</p>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-5 pt-5">
        {spots.map((s) => (
          <div key={s.name} className="habi-card flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-input-bg text-2xl">
              {s.emoji}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-deep-sage">{s.name}</span>
                <span className="text-xs text-muted-foreground">{s.distance}</span>
              </div>
              <div className="text-xs font-semibold text-sage-green">{s.category}</div>
              <p className="mt-1 text-xs text-muted-foreground">{s.blurb}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default EcoMap;