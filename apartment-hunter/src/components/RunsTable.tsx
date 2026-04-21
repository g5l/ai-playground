"use client";

import {
  Table,
  Badge,
  Text,
  Button,
  Group,
  Tooltip,
  Stack,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import type { ScrapeRun } from "@/types/index";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 0) return "—";
  const secs = Math.round(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m ${rem}s`;
}

function StatusBadge({ status }: { status: ScrapeRun["status"] }) {
  const map: Record<ScrapeRun["status"], { color: string; label: string }> = {
    success: { color: "green", label: "Sucesso" },
    error: { color: "red", label: "Erro" },
    running: { color: "yellow", label: "Em andamento" },
  };
  const { color, label } = map[status];
  return (
    <Badge color={color} variant="filled" size="sm">
      {label}
    </Badge>
  );
}

// ---------------------------------------------------------------------------
// RunsTable
// ---------------------------------------------------------------------------

interface RunsTableProps {
  runs: ScrapeRun[];
}

export function RunsTable({ runs }: RunsTableProps) {
  const router = useRouter();

  async function handleRunNow() {
    try {
      const res = await fetch("/api/scrape/run", { method: "POST" });
      const body = (await res.json()) as { success?: boolean; error?: string; stats?: unknown };

      if (!res.ok || !body.success) {
        notifications.show({
          title: "Erro ao executar scraper",
          message: body.error ?? "Erro desconhecido.",
          color: "red",
        });
        return;
      }

      notifications.show({
        title: "Scraper iniciado com sucesso",
        message: "Os resultados aparecerão na tabela abaixo.",
        color: "green",
      });
      router.refresh();
    } catch (err) {
      notifications.show({
        title: "Erro de rede",
        message: err instanceof Error ? err.message : "Não foi possível conectar.",
        color: "red",
      });
    }
  }

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button
          leftSection={<IconPlayerPlay size={16} />}
          color="violet"
          onClick={() => void handleRunNow()}
        >
          Executar Agora
        </Button>
      </Group>

      {runs.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          Nenhuma execução registrada. Clique em &apos;Executar Agora&apos; para iniciar.
        </Text>
      ) : (
        <Table.ScrollContainer minWidth={900}>
          <Table striped highlightOnHover withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Fonte</Table.Th>
                <Table.Th>Início</Table.Th>
                <Table.Th>Fim</Table.Th>
                <Table.Th>Duração</Table.Th>
                <Table.Th>Encontrados</Table.Th>
                <Table.Th>Novos</Table.Th>
                <Table.Th>Atualizados</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Erros</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {runs.map((run) => (
                <Table.Tr key={run.id}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {run.source}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDate(run.started_at)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">
                      {run.finished_at ? formatDate(run.finished_at) : (
                        <Text component="span" size="sm" c="yellow">
                          Em andamento
                        </Text>
                      )}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm">{formatDuration(run.started_at, run.finished_at)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ta="right">{run.listings_found}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ta="right">{run.listings_new}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" ta="right">{run.listings_updated}</Text>
                  </Table.Td>
                  <Table.Td>
                    <StatusBadge status={run.status} />
                  </Table.Td>
                  <Table.Td>
                    {run.errors.length === 0 ? (
                      <Badge color="gray" variant="light" size="sm">0</Badge>
                    ) : (
                      <Tooltip
                        label={
                          <Stack gap={4}>
                            {run.errors.map((e, i) => (
                              <Text key={i} size="xs">{e}</Text>
                            ))}
                          </Stack>
                        }
                        multiline
                        maw={400}
                        withArrow
                      >
                        <Badge color="red" variant="filled" size="sm" style={{ cursor: "help" }}>
                          {run.errors.length}
                        </Badge>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
    </Stack>
  );
}
