import type { Metadata } from "next";
import {
  ColorSchemeScript,
  MantineProvider,
  createTheme,
  mantineHtmlProps,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { AppShellLayout } from "@/components/AppShellLayout";

// Mantine core styles
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/dates/styles.css";

const theme = createTheme({
  primaryColor: "blue",
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  defaultRadius: "md",
});

export const metadata: Metadata = {
  title: {
    template: "%s | Apartment Hunter POA",
    default: "Apartment Hunter POA",
  },
  description: "Ferramenta pessoal de busca de apartamentos em Porto Alegre.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" {...mantineHtmlProps}>
      <head>
        {/* ColorSchemeScript must be in <head> to avoid flash of wrong theme */}
        <ColorSchemeScript defaultColorScheme="auto" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="auto">
          <Notifications position="top-right" />
          <AppShellLayout>{children}</AppShellLayout>
        </MantineProvider>
      </body>
    </html>
  );
}
