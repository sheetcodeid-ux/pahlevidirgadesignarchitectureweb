interface Props {
  name: string;
  src?: string;
  size?: "sm" | "md" | "lg";
  brand?: boolean;
}

/** Inisial dari kata pertama dan terakhir — "Muhammad Lutfi Fikri" → "MF". */
function inisial(nama: string) {
  const kata = nama.trim().split(/\s+/);
  const awal = kata[0]?.[0] ?? "";
  const akhir = kata.length > 1 ? kata[kata.length - 1][0] : "";
  return (awal + akhir).toUpperCase();
}

/**
 * Avatar dengan cadangan inisial.
 *
 * Inisialnya selalu digambar, lalu gambar diletakkan menutupinya. Pendekatan
 * ini dipilih setelah versi berbasis onError terbukti rapuh: dengan
 * loading="lazy", gambar yang berada di luar layar tidak pernah diminta, jadi
 * onError tidak pernah menyala dan avatarnya tampil kosong. Menumpuk seperti
 * ini juga menghilangkan kedipan antara kotak kosong dan inisial.
 */
export function Avatar({ name, src, size = "md", brand = false }: Props) {
  const kelas = ["avatar", size !== "md" && `avatar--${size}`, brand && "avatar--brand"]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={kelas} title={name}>
      <span aria-hidden="true">{inisial(name)}</span>
      {src && <img src={src} alt="" loading="lazy" />}
      <span className="sr-only">{name}</span>
    </span>
  );
}
