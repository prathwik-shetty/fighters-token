import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fighters Token | Official Token Booking Platform",
  description: "Production-ready token-booking platform with live seat-style selection, WhatsApp OTP login, and secure payments.",
  keywords: ["Fighters Token", "Token Booking", "Fighters Community", "Movie Seat Booking UX", "Razorpay"],
  authors: [{ name: "Fighters Token Team" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        {children}
      </body>
    </html>
  );
}
