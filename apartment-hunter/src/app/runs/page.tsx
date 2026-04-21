/**
 * /runs — Scraper run history page (server component).
 */

import { Title, Text, Group, ThemeIcon } from "@mantine/core";
import { IconActivity } from "@tabler/icons-react";
import { getScrapeRuns } from "@/db/queries/listings";
import { RunsTable } from "@/components/RunsTable";

export default function RunsPage() {
  const runs = getScrapeRuns(50);

  return (
    <>
      <Group mb="xs" gap="sm">
        <ThemeIcon size="lg" variant="light" color="violet">
          <IconActivity size={20} />
        </ThemeIcon>
        <Title order={2}>Execuções do Scraper</Title>
      </Group>

      <Text c="dimmed" size="sm" mb="xl">
        Histórico de execuções automáticas de coleta de dados.
      </Text>

      <RunsTable runs={runs} />
    </>
  );
}
