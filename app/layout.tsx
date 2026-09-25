import type { Metadata, Viewport } from "next";
import { DM_Sans, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SessionProvider from "@/components/SessionProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { SmoothScroll } from "@/components/SmoothScroll";
import { Toaster } from "@/components/Toaster";
import { OfflineSync } from "@/components/OfflineSync";

// Body/UI text: Inter is built for dense-interface legibility, unlike DM
// Sans's small-size-optimized, low-stroke-contrast letterforms which read
// thin at regular text sizes.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Reserved for large display numbers and hero headings only (see
// `.font-display` in globals.css) - DM Sans's personality is worth keeping
// there, it's only regular body text where it reads thin.
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Timetable Attendance Tracker",
  description: "Track your timetable, attendance, and CGPA in one place",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Timetable",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#16130f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Applies the saved light/dark and colour choice before first paint,
            so the page doesn't flash the default theme on load. Mirrors
            ThemeProvider's logic. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var d=document.documentElement,p=localStorage.getItem("timetable-theme-preference")||"auto",h=new Date().getHours();d.setAttribute("data-theme",p==="auto"?(h>=19||h<6?"dark":"light"):p);d.setAttribute("data-accent",localStorage.getItem("timetable-accent")||"saffron");d.setAttribute("data-style",localStorage.getItem("timetable-style")||"glass")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <SessionProvider>
            {children}
            <ServiceWorkerRegister />
            <SmoothScroll />
            <Toaster />
            <OfflineSync />
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
