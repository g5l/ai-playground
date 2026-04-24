import { Title, Text, Group, ThemeIcon } from "@mantine/core";
import { IconSparkles } from "@tabler/icons-react";
import { NewListingsGrid } from "@/components/NewListingsGrid";
import { getNewListingsToday } from "@/db/queries/listings";

export const dynamic = "force-dynamic";

export default function HomePage() {
  const listings = getNewListingsToday();

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

      <NewListingsGrid listings={listings} />
    </>
  );
}
