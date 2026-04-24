"use client";

import { SimpleGrid, Paper, Text, Button, Stack } from "@mantine/core";
import { ListingCard } from "@/components/ListingCard";
import type { Listing } from "@/types";

interface NewListingEntry extends Listing {
  score: number | null;
  rationale: string | null;
}

interface NewListingsGridProps {
  listings: NewListingEntry[];
}

export function NewListingsGrid({ listings }: NewListingsGridProps) {
  if (listings.length === 0) {
    return (
      <Paper p="xl" radius="md" withBorder>
        <Stack align="center" gap="md">
          <Text c="dimmed" ta="center">
            Nenhum imóvel novo hoje. Execute o scraper para buscar novos imóveis.
          </Text>
          <Button
            onClick={async () => {
              await fetch("/api/scrape/run", { method: "POST" });
              window.location.reload();
            }}
          >
            Executar Agora
          </Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      {listings.map((entry) => (
        <ListingCard
          key={entry.id}
          listing={entry}
          isNew
          score={entry.score ?? undefined}
          rationale={entry.rationale ?? undefined}
        />
      ))}
    </SimpleGrid>
  );
}
