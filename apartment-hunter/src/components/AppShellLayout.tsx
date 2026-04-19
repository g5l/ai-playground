"use client";

import {
  AppShell,
  Burger,
  Group,
  NavLink,
  Text,
  ActionIcon,
  useMantineColorScheme,
  Box,
  ScrollArea,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconHome,
  IconList,
  IconSettings,
  IconActivity,
  IconSun,
  IconMoon,
  IconBuilding,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    href: "/",
    label: "Novidades",
    icon: <IconHome size={18} />,
  },
  {
    href: "/all",
    label: "Todos os Imóveis",
    icon: <IconBuilding size={18} />,
  },
  {
    href: "/profile",
    label: "Perfil de Busca",
    icon: <IconSettings size={18} />,
  },
  {
    href: "/runs",
    label: "Execuções",
    icon: <IconActivity size={18} />,
  },
];

export function AppShellLayout({ children }: { children: React.ReactNode }) {
  const [opened, { toggle }] = useDisclosure();
  const pathname = usePathname();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();

  const appName =
    process.env.NEXT_PUBLIC_APP_NAME ?? "Apartment Hunter POA";

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 240,
        breakpoint: "sm",
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      {/* ------------------------------------------------------------------ */}
      {/* Header */}
      {/* ------------------------------------------------------------------ */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group>
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Group gap={8}>
              <IconBuilding size={24} />
              <Text fw={700} size="lg">
                {appName}
              </Text>
            </Group>
          </Group>

          <ActionIcon
            variant="subtle"
            onClick={() => toggleColorScheme()}
            size="lg"
            aria-label="Alternar tema"
          >
            {colorScheme === "dark" ? (
              <IconSun size={20} />
            ) : (
              <IconMoon size={20} />
            )}
          </ActionIcon>
        </Group>
      </AppShell.Header>

      {/* ------------------------------------------------------------------ */}
      {/* Navbar */}
      {/* ------------------------------------------------------------------ */}
      <AppShell.Navbar p="xs">
        <ScrollArea>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              component={Link}
              href={item.href}
              label={item.label}
              leftSection={item.icon}
              active={
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href)
              }
              mb={4}
            />
          ))}
        </ScrollArea>
      </AppShell.Navbar>

      {/* ------------------------------------------------------------------ */}
      {/* Main content */}
      {/* ------------------------------------------------------------------ */}
      <AppShell.Main>
        <Box maw={1400} mx="auto">
          {children}
        </Box>
      </AppShell.Main>
    </AppShell>
  );
}
