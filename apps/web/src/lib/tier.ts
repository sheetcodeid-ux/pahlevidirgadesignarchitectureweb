/**
 * Tier layanan — sumber tunggal untuk seksi harga di beranda.
 *
 * Angkanya datang dari dokumen strategi studio (§3.1 dan §3.2), bukan dikarang
 * di sini. Kalau pemilik menaikkan harga — dokumen itu menyebut aturannya:
 * setiap 3 proyek selesai pada satu tier, naikkan 10–15% untuk klien baru —
 * yang diubah cuma berkas ini, dan beranda ikut.
 *
 * Kenapa angkanya DITERBITKAN, padahal FAQ sebelumnya menyatakan sebaliknya:
 * itu keputusan pemilik, dan jawaban FAQ soal tarif sudah ikut diubah supaya
 * situsnya tidak membantah dirinya sendiri. Dua tempat yang menyebut harga
 * harus selalu sepakat.
 *
 * Yang TIDAK diterbitkan dan tetap "ditanyakan": persentase uang muka, lama
 * tiap tahap, dan jadwal kunjungan lokasi. Ketiganya memang berubah per
 * proyek, dan dokumen strategi tidak menetapkannya.
 */

export interface Tier {
  /** Dipakai sebagai kunci data-t: tierS<kunci>… */
  kunci: string;
  nama: string;
  ringkas: string;
  /** Rentang fee apa adanya, sudah diformat. */
  fee: string;
  /** Untuk siapa tier ini. Tampil sebagai baris terakhir kartu. */
  untuk: string;
  isi: string[];
  /** Satu per kelompok. Kartunya ditinggikan dan diberi lencana. */
  sorot?: boolean;
  /** Kalimat kecil di atas daftar isi. */
  isiKop: string;
}

export interface KelompokTier {
  kunci: string;
  label: string;
  ket: string;
  tier: Tier[];
}

export const TIER: KelompokTier[] = [
  {
    kunci: "kafe",
    label: "COFFEE SHOP & F&B",
    ket: "The vertical we specialise in. A café is a portfolio piece that three hundred people walk through every day.",
    tier: [
      {
        kunci: "starter",
        nama: "Starter",
        ringkas: "For a first coffee shop, working to a budget that is real.",
        fee: "Rp 15–25 million",
        untuk: "A first coffee shop, tight budget",
        isiKop: "What you get:",
        isi: [
          "Concept design",
          "Floor plan and layout",
          "Basic 3D visuals",
        ],
      },
      {
        kunci: "signature",
        nama: "Signature",
        ringkas: "For owners with a clear picture of the room they want to be known for.",
        fee: "Rp 45–80 million",
        untuk: "Strong vision, aiming for iconic",
        sorot: true,
        isiKop: "Everything in Starter, plus:",
        isi: [
          "Full construction drawings (DED)",
          "Spatial branding and material palette",
          "Contractor briefing and support",
          "Bar and kitchen workflow planning",
        ],
      },
      {
        kunci: "flagship",
        nama: "Flagship",
        ringkas: "Full service, from the first sketch through to the opening photographs.",
        fee: "Rp 100–180 million",
        untuk: "F&B groups opening more branches",
        isiKop: "Everything in Signature, plus:",
        isi: [
          "Construction supervision",
          "Custom furniture design",
          "Professional photo documentation",
        ],
      },
    ],
  },
  {
    kunci: "rumah",
    label: "HOUSES",
    ket: "Tropical houses designed for heat, rain and humidity — not adapted from a plan drawn for somewhere colder.",
    tier: [
      {
        kunci: "konsultasi",
        nama: "Consultation",
        ringkas: "For owners who will build it themselves with their own tukang.",
        fee: "Rp 10–20 million",
        untuk: "Building it yourself, with a tukang",
        isiKop: "What you get:",
        isi: [
          "Design concept",
          "Schematic floor plan",
          "Orientation and ventilation advice",
        ],
      },
      {
        kunci: "standar",
        nama: "Standard",
        ringkas: "Concept through to drawings a contractor can build from without phoning us.",
        fee: "Rp 35–70 million",
        untuk: "100–200 m², build budget Rp 500 M – 1.5 B",
        sorot: true,
        isiKop: "Everything in Consultation, plus:",
        isi: [
          "Full construction drawings (DED)",
          "Contractor-ready working drawings",
          "Material and finish schedule",
        ],
      },
      {
        kunci: "premium",
        nama: "Premium",
        ringkas: "The house, the inside of it, and the ground it sits on — handled as one project.",
        fee: "Rp 80–200 million",
        untuk: "Over 200 m², build budget above Rp 2 B",
        isiKop: "Everything in Standard, plus:",
        isi: [
          "Construction supervision",
          "Interior design",
          "Landscape design",
          "Photo documentation at handover",
        ],
      },
    ],
  },
];
