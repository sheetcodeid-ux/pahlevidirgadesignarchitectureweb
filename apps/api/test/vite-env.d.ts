/* Tipe untuk import.meta.glob, yang dipakai parameterArray.test.ts.

   Ditaruh di sini, bukan di tsconfig utama: paket ini bertipe Workers, dan
   menarik seluruh tipe Vite ke dalam sumber Worker akan mengaburkan batas
   antara yang berjalan di edge dan yang berjalan di runner tes. */
/// <reference types="vite/client" />
