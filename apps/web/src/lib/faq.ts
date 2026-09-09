/**
 * Isi halaman /faq — sumber tunggal untuk halaman itu DAN untuk lima
 * pertanyaan yang disorot di beranda. Kalimatnya tidak boleh disalin ke
 * tempat lain: dua salinan pasti menyimpang, dan itu bug yang sudah
 * memakan berjam-jam di stylesheet sistem.
 *
 * `menunggu: true` berarti jawabannya sudah benar tapi ANGKANYA belum
 * diberikan pemilik — halaman menandainya dengan lencana "FIGURES ON
 * REQUEST", persis seperti rancangan yang di-ACC. Empat pertanyaan yang
 * masih begitu: tarif, uang muka, lama pengerjaan, dan kunjungan ke lokasi.
 */
export type KategoriFaq = "mulai" | "uang" | "waktu" | "kerja" | "selesai";

export const LABEL_FAQ: Record<KategoriFaq, string> = {
  mulai: "Getting started",
  uang: "Money",
  waktu: "Time",
  kerja: "Working together",
  selesai: "After handover",
};

export interface Tanya {
  /** Dipakai sebagai anchor: /faq#<id>. Jangan diubah kalau sudah dibagikan. */
  id: string;
  kat: KategoriFaq;
  tanya: string;
  /** HTML — jawabannya memuat <p>, <strong>, dan <ul>. */
  jawab: string;
  /** Angkanya masih ditunggu dari pemilik. */
  menunggu?: boolean;
}

export const FAQ: Tanya[] = [
  {
    id: "we-only-own-land-is",
    kat: "mulai",
    tanya: "We only own land. Is it too early to talk to an architect?",
    jawab: `<p>It is the best possible time. Half of what decides a good building — where it sits on the plot, which way it faces, where the water goes, how high you can build — is settled before a single line is drawn.</p>
<p>Coming to us with a finished idea is not a problem either. But coming with only land means nothing has been decided wrongly yet.</p>`,
  },
  {
    id: "do-you-work-with-clients",
    kat: "mulai",
    tanya: "Do you work with clients outside Indonesia?",
    jawab: `<p>Yes. We work in English and in Bahasa Indonesia, whichever is easier for you, and we answer in the same one you write in.</p>
<p>Distance changes the mechanics, not the work: calls by video or WhatsApp, drawings and invoices on your project page, and a written record of every decision so nothing depends on who remembers what. What distance does not remove is the need for someone to stand on the site — at some point that is either us travelling or a person you trust locally.</p>`,
  },
  {
    id: "what-do-you-need-from",
    kat: "mulai",
    tanya: "What do you need from us in the first message?",
    jawab: `<p>Three things, and none of them need to be precise: <strong>where the site is</strong>, <strong>roughly what you can spend</strong>, and <strong>what you are unsure about</strong>.</p>
<p>That third one is the useful one. “I have a corner plot and no idea whether to build up or out” tells us more than a page of requirements.</p>`,
  },
  {
    id: "is-the-first-conversation-free",
    kat: "mulai",
    tanya: "Is the first conversation free?",
    jawab: `<p>Yes, and it always will be. About an hour, video or WhatsApp, where we talk about the site, the money and the timeline honestly. You leave it knowing what your project would realistically take, whether or not you work with us.</p>
<p>Drawings are not free — for anyone. We do not produce concepts so that studios can be compared side by side.</p>`,
  },
  {
    id: "how-much-do-you-charge",
    kat: "uang",
    tanya: "How much do you charge?",
    menunggu: true,
    jawab: `<p>Fees are structured one of two ways, and we tell you which one applies before any work starts: <strong>a percentage of the construction cost</strong> for full projects, or <strong>a fixed fee per stage</strong> when the scope is clear and contained.</p>
<p>Either way the fee is split across stages, and each stage is invoiced only when it is delivered. You are never paying for work that has not arrived yet.</p>
<p><strong>The actual numbers are not published on this page yet.</strong> Ask in the first message and you will have them in the reply — we would rather quote against your real site than post a figure that fits nobody.</p>`,
  },
  {
    id: "how-much-do-you-need",
    kat: "uang",
    tanya: "How much do you need before you start?",
    menunggu: true,
    jawab: `<p>A deposit at the start of the first stage, then payments as each stage is delivered. The deposit exists because the first stage — measuring, checking regulations, testing what the plot allows — is real work whether or not the project continues.</p>
<p><strong>The percentage is not published here yet.</strong> It comes with the written proposal, together with the schedule for every later payment, so you see the whole shape before agreeing to any of it.</p>`,
  },
  {
    id: "what-if-our-budget-turns",
    kat: "uang",
    tanya: "What if our budget turns out to be too small?",
    jawab: `<p>We will say so in the first reply, not in month three. A design you cannot afford to finish is not a design — it is a drawing.</p>
<p>Often the honest answer is not “no” but “not this size”, or “not this finish”, or “yes, but in two phases”. Those are useful answers and they cost you nothing to hear.</p>`,
  },
  {
    id: "are-there-costs-beyond-your",
    kat: "uang",
    tanya: "Are there costs beyond your fee?",
    jawab: `<p>Yes, and they are on the table from the first proposal. Depending on the project, expect some of:</p>
<p><ul><li>Land survey and soil investigation</li><li>Structural and MEP engineers</li><li>Permits and government fees</li><li>3D renders, if you want them for approval or for selling</li><li>Printing and document legalisation</li></ul></p>
<p>These are paid to the people who do them, not to us with a margin added.</p>`,
  },
  {
    id: "do-you-take-a-commission",
    kat: "uang",
    tanya: "Do you take a commission from contractors or suppliers?",
    jawab: `<p>No. Not from contractors, not from material suppliers, not from anyone.</p>
<p>This matters more than it sounds. A studio earning a percentage on materials has a quiet reason to specify the expensive tile. Our fee comes from you, so the only reason to specify anything is that it is right for the building.</p>`,
  },
  {
    id: "how-long-does-it-take",
    kat: "waktu",
    tanya: "How long does it take?",
    menunggu: true,
    jawab: `<p>It is decided by stages, not by a single number: understanding the site, concept, developed design, then construction drawings and permit documents. Each stage ends with something you can hold and approve before the next one starts.</p>
<p><strong>The typical duration of each stage is not published here yet</strong> — it moves with the size of the building and with how fast permits move in your area, and a made-up range would only mislead. The written proposal carries the dates for your project specifically.</p>`,
  },
  {
    id: "can-you-do-it-faster",
    kat: "waktu",
    tanya: "Can you do it faster?",
    jawab: `<p>Concept alone takes longer than two weeks once the site has been measured properly, so we would rather lose the job than promise a date we would then miss.</p>
<p>What can genuinely be shortened is the waiting: decisions made in days instead of weeks, one person who can answer instead of three. That is why the studio is small.</p>`,
  },
  {
    id: "what-if-we-have-to",
    kat: "waktu",
    tanya: "What if we have to pause the project?",
    jawab: `<p>Pausing is normal — permits stall, funding moves, families change their minds. Nothing is lost. Your drawings, documents and decisions stay on your project page, and the page stays live.</p>
<p>When you come back, we start from the last approved stage rather than from the beginning.</p>`,
  },
  {
    id: "how-do-we-know-what",
    kat: "kerja",
    tanya: "How do we know what is happening?",
    jawab: `<p>Every client gets a project page. Phases, drawings, invoices and the comment thread all live there, and it updates when we update it — not when you ask.</p>
<p>It needs no password and no app. The link we send you is the login, which also means you can forward it to whoever else needs to see it.</p>`,
  },
  {
    id: "how-many-revisions-do-we",
    kat: "kerja",
    tanya: "How many revisions do we get?",
    jawab: `<p>Revisions belong to a stage, not to the whole project. Inside a stage we work until you are satisfied; once you approve that stage and we move on, reopening it is a change of scope and is quoted as one.</p>
<p>This is not us being rigid. Unlimited revisions across stages is exactly how projects end up eighteen months late with a design nobody chose deliberately.</p>`,
  },
  {
    id: "do-you-work-with-our",
    kat: "kerja",
    tanya: "Do you work with our contractor, or do you bring one?",
    jawab: `<p>Both work. If you already have a contractor you trust, we draw for them and answer their questions directly — a detail the builder has to phone about was not finished.</p>
<p>If you do not have one, we can introduce contractors we have worked with. We do not take a fee for the introduction, and you hire them, not us.</p>`,
  },
  {
    id: "can-we-take-the-drawings",
    kat: "kerja",
    tanya: "Can we take the drawings and build without you?",
    jawab: `<p>You can, and if that is the plan you should say so early — another studio will serve you better and charge you less.</p>
<p>We stay involved because drawings are not the building. Someone has to answer the question the contractor asks on a Tuesday morning, and if that is nobody, the answer gets invented on site.</p>`,
  },
  {
    id: "do-you-visit-the-site",
    kat: "selesai",
    tanya: "Do you visit the site during construction?",
    menunggu: true,
    jawab: `<p>Yes. How often depends on the project's size, its distance from us, and what stage the work is at — dense during structure and finishes, lighter in between.</p>
<p><strong>The visit schedule and who pays travel for distant sites is not fixed on this page yet</strong>, because it changes completely between a site in Pontianak and one in another province. It is written into the proposal so there is no argument about it later.</p>`,
  },
  {
    id: "do-we-get-the-files",
    kat: "selesai",
    tanya: "Do we get the files after handover?",
    jawab: `<p>Yes. You receive the drawing set as PDF, and the working files where they are yours to have. They are your building's documents; withholding them to guarantee future work is not how we operate.</p>
<p>Your project page also stays live after handover, so the drawings and invoices remain findable years later — which is usually when somebody actually needs them.</p>`,
  },
  {
    id: "will-our-project-appear-on",
    kat: "selesai",
    tanya: "Will our project appear on this website?",
    jawab: `<p>Only if you say yes. We ask after handover, and no is a complete answer that changes nothing about how we worked with you.</p>
<p>If you agree, we agree together on what is shown: some clients are happy with everything, some want the building without the address, some want nothing that identifies them.</p>`,
  },
];

/**
 * Lima yang disorot di beranda. Hanya id — kalimatnya tetap satu, di atas.
 */
export const SOROTAN_ID = [
  "do-you-work-with-clients",
  "how-much-do-you-charge",
  "how-long-does-it-take",
  "do-we-get-the-files",
  "do-you-visit-the-site"
];

export const SOROTAN_FAQ = SOROTAN_ID.map((id) => {
  const t = FAQ.find((x) => x.id === id);
  if (!t) throw new Error(`SOROTAN_ID menunjuk id yang tidak ada di FAQ: ${id}`);
  return t;
});
