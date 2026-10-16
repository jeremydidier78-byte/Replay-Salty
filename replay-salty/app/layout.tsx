import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Replay Salty — La communauté des combats Pokémon",
  description: "Publie, partage et découvre des replays de combats Pokémon, tous jeux confondus."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
