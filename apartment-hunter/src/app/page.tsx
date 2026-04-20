"use client";

import { Title, Text, SimpleGrid, Group, ThemeIcon } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { ListingCard } from "@/components/ListingCard";
import type { Listing } from "@/types";

// ---------------------------------------------------------------------------
// Hardcoded sample listing for Phase 1 UI preview
// In Phase 2, this will be replaced by a real DB query filtered by today's date
// ---------------------------------------------------------------------------
const SAMPLE_LISTING: Listing = {
  id: "00000000-0000-0000-0000-000000000001",
  dedupe_key: "sample:001",
  title: "Apartamento 3 dormitórios em Moinhos de Vento",
  price: 850_000,
  condo_fee: 1_200,
  iptu: 320,
  area: 95,
  bedrooms: 3,
  suites: 1,
  parking: 2,
  neighborhood: "Moinhos de Vento",
  city: "Porto Alegre",
  address: "Rua Coronel Bordini, 500",
  description:
    "Excelente apartamento com acabamento de alto padrão, varanda gourmet, piscina e academia no condomínio.",
  pets_allowed: 1,
  latitude: -30.028,
  longitude: -51.198,
  first_seen_at: new Date().toISOString(),
  last_seen_at: new Date().toISOString(),
  last_checked_at: new Date().toISOString(),
  status: "active",
};

export default function HomePage() {
  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* Page header */}
      <Group mb="xs" gap="sm">
        <ThemeIcon size="lg" variant="light" color="green">
          <IconSparkles size={20} />
        </ThemeIcon>
        <Title order={2}>Novos Imóveis Hoje</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="xl">
        {today.charAt(0).toUpperCase() + today.slice(1)}
      </Text>

      {/* Listing grid */}
      <SimpleGrid
        cols={{ base: 1, sm: 2, lg: 3 }}
        spacing="md"
      >
        <ListingCard listing={SAMPLE_LISTING} isNew />
      </SimpleGrid>
    </>
  );
}
