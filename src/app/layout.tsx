import { CartProvider } from "@/context/CartContext";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CartProvider>
      {children}
    </CartProvider>
  );
}
